/**
 * Auth middleware for cloud-api Hono routes.
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import type { Db } from '../db/index.js';
import type { JwtService } from './jwt.js';
import { JwtError } from './jwt.js';
import { eq } from 'drizzle-orm';
import { authSessions, users } from '../db/schema.js';

export interface RequestUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  session_id: string;
}

// Hono context variable keys
export type AuthVariables = {
  user: RequestUser;
};

/**
 * Middleware that verifies a Bearer JWT and populates c.var.user.
 * Returns 401 if the token is missing, invalid, or expired.
 */
export function requireSession(
  jwtService: JwtService,
  db: Db,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);

    let claims;
    try {
      claims = jwtService.verifyAccessToken(token);
    } catch (err) {
      if (err instanceof JwtError) {
        return c.json({ error: err.message }, 401);
      }
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify session is still active
    const session = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, claims.session_id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session || session.revoked_at !== null) {
      return c.json({ error: 'Session revoked' }, 401);
    }

    // Load user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, claims.sub))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    c.set('user', {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      session_id: claims.session_id,
    });

    await next();
  };
}

/**
 * Middleware that verifies a shared internal secret.
 * Used for server-to-server endpoints (e.g. /v1/internal/*).
 */
export function requireInternal(internalSecret: string): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token || token !== internalSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}
