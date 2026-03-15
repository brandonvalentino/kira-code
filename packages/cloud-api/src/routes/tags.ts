import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { tags } from '../db/schema.js';
import { assertProjectMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  name: z.string().min(1),
  color: z.string(),
});

const UpdateSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
});

export function tagsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const data = CreateSchema.parse(await c.req.json());
    if (!(await assertProjectMember(state, user.id, data.project_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const [row] = await state.db
      .insert(tags)
      .values({ id: data.id ?? uuidv4(), project_id: data.project_id, name: data.name, color: data.color })
      .returning();
    return c.json({ data: row, txid: uuidv4() }, 201);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(tags).where(eq(tags.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!(await assertProjectMember(state, user.id, row.project_id))) return c.json({ error: 'Forbidden' }, 403);
    const data = UpdateSchema.parse(await c.req.json());
    const [updated] = await state.db.update(tags).set(data).where(eq(tags.id, id)).returning();
    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(tags).where(eq(tags.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!(await assertProjectMember(state, user.id, row.project_id))) return c.json({ error: 'Forbidden' }, 403);
    await state.db.delete(tags).where(eq(tags.id, id));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
