import { Hono } from 'hono';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';

type Env = { Variables: AuthVariables };

export function identityRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.get('/', auth, async (c) => {
    const user = c.var.user;
    return c.json({
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
    });
  });

  return app;
}
