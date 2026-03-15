/**
 * GitHub App routes.
 * Handles webhook events, OAuth app installation callback,
 * and org-level GitHub App status/management.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { githubAppInstallations } from '../db/schema.js';
import { isMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function githubAppPublicRouter(state: AppState) {
  const app = new Hono();

  /**
   * GitHub App webhook endpoint.
   */
  app.post('/webhook', async (c) => {
    const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
    if (!webhookSecret) return c.json({ error: 'Webhook not configured' }, 503);

    const signature = c.req.header('x-hub-signature-256') ?? '';
    const body = await c.req.text();

    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = c.req.header('x-github-event');
    const payload = JSON.parse(body) as {
      action?: string;
      installation?: { id: number; account: { login: string; type: string } };
    };

    if (event === 'installation') {
      if (payload.action === 'deleted' && payload.installation) {
        await state.db
          .delete(githubAppInstallations)
          .where(eq(githubAppInstallations.installation_id, payload.installation.id));
      }
    }

    return c.json({ ok: true });
  });

  /**
   * GitHub App OAuth callback for app installation.
   */
  app.get('/app/callback', async (c) => {
    const installationId = c.req.query('installation_id');
    const setupAction = c.req.query('setup_action');

    if (!installationId || setupAction !== 'install') {
      return c.text('Invalid callback', 400);
    }

    // Redirect to frontend to link installation to an org
    const frontendUrl = process.env.SERVER_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    return c.redirect(`${frontendUrl}/github-app/link?installation_id=${installationId}`);
  });

  return app;
}

export function githubAppProtectedRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  /**
   * Link a GitHub App installation to an organization.
   */
  app.post('/organizations/:org_id/github-app/link', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('org_id');

    if (!(await isMember(state, user.id, orgId))) return c.json({ error: 'Forbidden' }, 403);

    const body = await c.req.json() as { installation_id: number };
    if (!body.installation_id) return c.json({ error: 'installation_id required' }, 400);

    // Fetch installation info from GitHub
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKey) return c.json({ error: 'GitHub App not configured' }, 503);

    // Note: In production, use @octokit/auth-app to create an installation token
    // For now, store the installation_id directly
    const existing = await state.db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.installation_id, body.installation_id))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      // Update org link
      await state.db
        .update(githubAppInstallations)
        .set({ organization_id: orgId, updated_at: new Date() })
        .where(eq(githubAppInstallations.installation_id, body.installation_id));
    } else {
      await state.db.insert(githubAppInstallations).values({
        id: uuidv4(),
        organization_id: orgId,
        installation_id: body.installation_id,
        account_login: '',
        account_type: 'Organization',
      });
    }

    return c.json({ success: true });
  });

  /**
   * Get GitHub App installation status for an organization.
   */
  app.get('/organizations/:org_id/github-app/status', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('org_id');

    if (!(await isMember(state, user.id, orgId))) return c.json({ error: 'Forbidden' }, 403);

    const installation = await state.db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.organization_id, orgId))
      .limit(1)
      .then((r) => r[0]);

    return c.json({
      installed: !!installation,
      installation_id: installation?.installation_id ?? null,
      account_login: installation?.account_login ?? null,
    });
  });

  /**
   * Uninstall GitHub App from an organization.
   */
  app.delete('/organizations/:org_id/github-app', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('org_id');

    if (!(await isMember(state, user.id, orgId))) return c.json({ error: 'Forbidden' }, 403);

    await state.db
      .delete(githubAppInstallations)
      .where(eq(githubAppInstallations.organization_id, orgId));

    return c.json({ success: true });
  });

  return app;
}
