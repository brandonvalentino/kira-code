import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { workspaces } from '../db/schema.js';
import { assertProjectMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  issue_id: z.string().uuid().nullable().default(null),
  local_workspace_id: z.string().uuid().nullable().default(null),
  name: z.string().nullable().default(null),
  archived: z.boolean().default(false),
  files_changed: z.number().int().nullable().default(null),
  lines_added: z.number().int().nullable().default(null),
  lines_removed: z.number().int().nullable().default(null),
});

const UpdateSchema = z.object({
  issue_id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  files_changed: z.number().int().nullable().optional(),
  lines_added: z.number().int().nullable().optional(),
  lines_removed: z.number().int().nullable().optional(),
});

export function workspacesRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const data = CreateSchema.parse(await c.req.json());
    if (!(await assertProjectMember(state, user.id, data.project_id))) return c.json({ error: 'Forbidden' }, 403);
    const [row] = await state.db.insert(workspaces).values({ id: data.id ?? uuidv4(), owner_user_id: user.id, ...data }).returning();
    return c.json({ data: row, txid: uuidv4() }, 201);
  });

  app.get('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!(await assertProjectMember(state, user.id, row.project_id))) return c.json({ error: 'Forbidden' }, 403);
    return c.json(row);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.owner_user_id !== user.id && !(await assertProjectMember(state, user.id, row.project_id))) return c.json({ error: 'Forbidden' }, 403);
    const data = UpdateSchema.parse(await c.req.json());
    const [updated] = await state.db.update(workspaces).set({ ...data, updated_at: new Date() }).where(eq(workspaces.id, id)).returning();
    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.owner_user_id !== user.id) return c.json({ error: 'Forbidden' }, 403);
    await state.db.delete(workspaces).where(eq(workspaces.id, id));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
