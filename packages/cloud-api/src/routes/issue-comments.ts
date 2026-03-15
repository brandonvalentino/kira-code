import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { issueComments } from '../db/schema.js';
import { assertIssueMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  issue_id: z.string().uuid(),
  message: z.string().min(1),
  parent_id: z.string().uuid().nullable().default(null),
});

const UpdateSchema = z.object({
  message: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export function issueCommentsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const data = CreateSchema.parse(await c.req.json());
    if (!(await assertIssueMember(state, user.id, data.issue_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const [row] = await state.db
      .insert(issueComments)
      .values({ id: data.id ?? uuidv4(), ...data, author_id: user.id })
      .returning();
    return c.json({ data: row, txid: uuidv4() }, 201);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const comment = await state.db.select().from(issueComments).where(eq(issueComments.id, id)).limit(1).then(r => r[0]);
    if (!comment) return c.json({ error: 'Not found' }, 404);
    if (comment.author_id !== user.id) return c.json({ error: 'Forbidden' }, 403);
    const data = UpdateSchema.parse(await c.req.json());
    const [updated] = await state.db.update(issueComments).set({ ...data, updated_at: new Date() }).where(eq(issueComments.id, id)).returning();
    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const comment = await state.db.select().from(issueComments).where(eq(issueComments.id, id)).limit(1).then(r => r[0]);
    if (!comment) return c.json({ error: 'Not found' }, 404);
    if (comment.author_id !== user.id) return c.json({ error: 'Forbidden' }, 403);
    await state.db.delete(issueComments).where(eq(issueComments.id, id));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
