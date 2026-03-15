/**
 * OAuth routes: GitHub OAuth handoff + token refresh.
 * Handles the app's OAuth flow (initiate → callback → handoff tokens).
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import * as crypto from 'crypto';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { oauthHandoffs, oauthAccounts, users, authSessions } from '../db/schema.js';

type Env = { Variables: AuthVariables };

const HandoffInitSchema = z.object({
  provider: z.string(),
  return_to: z.string(),
  app_challenge: z.string(),
});

const HandoffRedeemSchema = z.object({
  handoff_id: z.string().uuid(),
  app_code: z.string(),
  app_verifier: z.string(),
});

const TokenRefreshSchema = z.object({
  refresh_token: z.string(),
});

export function oauthPublicRouter(state: AppState) {
  const app = new Hono();

  /**
   * Initiate OAuth handoff — returns an authorize_url for the app to open.
   */
  app.post('/web/init', async (c) => {
    const data = HandoffInitSchema.parse(await c.req.json());

    if (!['github'].includes(data.provider)) {
      return c.json({ error: 'Unsupported provider' }, 400);
    }

    const handoffId = uuidv4();
    const stateParam = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await state.db.insert(oauthHandoffs).values({
      id: handoffId,
      provider: data.provider,
      state: stateParam,
      return_to: data.return_to,
      app_challenge: data.app_challenge,
      expires_at: expiresAt,
    });

    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) return c.json({ error: 'OAuth not configured' }, 503);

    const publicBase = process.env.SERVER_PUBLIC_BASE_URL ?? 'http://localhost:8081';
    const callbackUrl = `${publicBase}/v1/oauth/github/callback`;
    const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${stateParam}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user,user:email`;

    return c.json({ handoff_id: handoffId, authorize_url: authorizeUrl });
  });

  /**
   * Redeem a handoff code for access + refresh tokens.
   */
  app.post('/web/redeem', async (c) => {
    const data = HandoffRedeemSchema.parse(await c.req.json());

    const handoff = await state.db
      .select()
      .from(oauthHandoffs)
      .where(and(eq(oauthHandoffs.id, data.handoff_id), eq(oauthHandoffs.status, 'authorized')))
      .limit(1)
      .then((r) => r[0]);

    if (!handoff || !handoff.app_code_hash || !handoff.user_id) {
      return c.json({ error: 'Invalid or expired handoff' }, 400);
    }

    if (handoff.expires_at < new Date()) {
      return c.json({ error: 'Handoff expired' }, 400);
    }

    // Verify app_code via hash: sha256(app_code) == stored app_code_hash
    const codeHash = crypto
      .createHash('sha256')
      .update(data.app_code)
      .digest('hex');
    if (codeHash !== handoff.app_code_hash) {
      return c.json({ error: 'Invalid code' }, 400);
    }

    // Mark redeemed
    await state.db
      .update(oauthHandoffs)
      .set({ status: 'redeemed', redeemed_at: new Date() })
      .where(eq(oauthHandoffs.id, data.handoff_id));

    // Create session
    const sessionId = uuidv4();
    await state.db.insert(authSessions).values({
      id: sessionId,
      user_id: handoff.user_id,
    });

    const accessToken = state.jwt.signAccessToken(handoff.user_id, sessionId);
    const refreshJti = uuidv4();
    const refreshToken = state.jwt.signRefreshToken(handoff.user_id, sessionId, refreshJti);

    const user = await state.db
      .select()
      .from(users)
      .where(eq(users.id, handoff.user_id))
      .limit(1)
      .then((r) => r[0]);

    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, username: user.username },
    });
  });

  /**
   * GitHub OAuth callback — exchanges code for user info, stores handoff.
   */
  app.get('/github/callback', async (c) => {
    const code = c.req.query('code');
    const stateParam = c.req.query('state');

    if (!code || !stateParam) {
      return c.json({ error: 'Missing code or state' }, 400);
    }

    const handoff = await state.db
      .select()
      .from(oauthHandoffs)
      .where(and(eq(oauthHandoffs.state, stateParam), eq(oauthHandoffs.provider, 'github')))
      .limit(1)
      .then((r) => r[0]);

    if (!handoff || handoff.expires_at < new Date()) {
      return c.text('OAuth session expired', 400);
    }

    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return c.text('OAuth not configured', 503);

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return c.text('GitHub OAuth failed', 400);

    // Fetch GitHub user info
    const ghUser = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'kira-cloud-api' },
    }).then((r) => r.json()) as { id: number; login: string; email?: string; name?: string };

    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'kira-cloud-api' },
    });
    const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primaryEmail = emails.find((e) => e.primary && e.verified)?.email ?? ghUser.email ?? '';

    if (!primaryEmail) return c.text('Could not get email from GitHub', 400);

    // Upsert user
    let user = await state.db
      .select()
      .from(users)
      .where(eq(users.email, primaryEmail))
      .limit(1)
      .then((r) => r[0]);

    if (!user) {
      const [newUser] = await state.db
        .insert(users)
        .values({ id: uuidv4(), email: primaryEmail, username: ghUser.login })
        .returning();
      user = newUser;
    }

    // Upsert OAuth account
    const existing = await state.db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, 'github'), eq(oauthAccounts.provider_user_id, String(ghUser.id))))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      await state.db.insert(oauthAccounts).values({
        id: uuidv4(),
        user_id: user.id,
        provider: 'github',
        provider_user_id: String(ghUser.id),
        email: primaryEmail,
        username: ghUser.login,
      });
    }

    // Generate app code and store hash
    const appCode = uuidv4();
    const appCodeHash = crypto.createHash('sha256').update(appCode).digest('hex');

    await state.db
      .update(oauthHandoffs)
      .set({
        status: 'authorized',
        authorized_at: new Date(),
        user_id: user.id,
        app_code_hash: appCodeHash,
      })
      .where(eq(oauthHandoffs.id, handoff.id));

    // Redirect back to app with code
    const returnTo = new URL(handoff.return_to);
    returnTo.searchParams.set('handoff_id', handoff.id);
    returnTo.searchParams.set('app_code', appCode);
    return c.redirect(returnTo.toString());
  });

  /**
   * Refresh access token using a refresh token.
   */
  app.post('/tokens/refresh', async (c) => {
    const data = TokenRefreshSchema.parse(await c.req.json());

    let claims;
    try {
      claims = state.jwt.verifyRefreshToken(data.refresh_token);
    } catch {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const session = await state.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, claims.session_id))
      .limit(1)
      .then((r) => r[0]);

    if (!session || session.revoked_at !== null) {
      return c.json({ error: 'Session revoked' }, 401);
    }

    const accessToken = state.jwt.signAccessToken(claims.sub, claims.session_id);
    const newRefreshJti = uuidv4();
    const refreshToken = state.jwt.signRefreshToken(claims.sub, claims.session_id, newRefreshJti);

    return c.json({ access_token: accessToken, refresh_token: refreshToken });
  });

  return app;
}

export function oauthProtectedRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/logout', auth, async (c) => {
    const user = c.var.user;
    await state.db
      .update(authSessions)
      .set({ revoked_at: new Date() })
      .where(eq(authSessions.id, user.session_id));
    return c.json({ success: true });
  });

  app.get('/profile', auth, async (c) => {
    const user = c.var.user;
    const accounts = await state.db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.user_id, user.id));
    return c.json({
      user_id: user.id,
      email: user.email,
      username: user.username,
      providers: accounts.map((a) => ({ provider: a.provider, username: a.username })),
    });
  });

  return app;
}
