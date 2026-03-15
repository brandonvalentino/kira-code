/**
 * LiteLLM proxy token issuance.
 * Issues short-lived proxy keys to authenticated users.
 */
import { Hono } from 'hono';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';

type Env = { Variables: AuthVariables };

const TOKEN_TTL_SECONDS = 3600; // 1 hour

export function tokensRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  /**
   * GET /v1/user/llm-token
   * Returns a short-lived LiteLLM proxy key and the proxy URL.
   * The client can use this key directly against the LiteLLM proxy.
   */
  app.get('/llm-token', auth, async (c) => {
    const user = c.var.user;

    const proxyUrl = process.env.LITELLM_PROXY_URL;
    const masterKey = process.env.LITELLM_MASTER_KEY;

    if (!proxyUrl || !masterKey) {
      return c.json({ error: 'LiteLLM proxy not configured' }, 503);
    }

    // Issue a key via LiteLLM admin API
    const res = await fetch(`${proxyUrl}/key/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        duration: `${TOKEN_TTL_SECONDS}s`,
        metadata: { user_id: user.id, email: user.email },
        max_budget: 0.10, // $0.10 per token
        budget_duration: '1h',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[tokens] LiteLLM key generation failed:', text);
      return c.json({ error: 'Failed to issue LiteLLM token' }, 500);
    }

    const data = await res.json() as { key: string };
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

    return c.json({
      proxy_key: data.key,
      proxy_url: proxyUrl,
      expires_at: expiresAt,
    });
  });

  return app;
}
