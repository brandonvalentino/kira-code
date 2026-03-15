import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { notifications } from '../db/schema.js';

type Env = { Variables: AuthVariables };

const UpdateSchema = z.object({
  seen: z.boolean().optional(),
  dismissed_at: z.string().nullable().optional(),
});

export function notificationsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.get('/', auth, async (c) => {
    const user = c.var.user;
    const rows = await state.db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, user.id));
    return c.json(rows);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(notifications).where(eq(notifications.id, id)).limit(1).then(r => r[0]);
    if (!row || row.user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    const data = UpdateSchema.parse(await c.req.json());
    const { dismissed_at, ...rest } = data;
    const [updated] = await state.db.update(notifications).set({
      ...rest,
      dismissed_at: dismissed_at != null ? new Date(dismissed_at) : null,
    }).where(eq(notifications.id, id)).returning();
    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(notifications).where(eq(notifications.id, id)).limit(1).then(r => r[0]);
    if (!row || row.user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    await state.db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.user_id, user.id)));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
