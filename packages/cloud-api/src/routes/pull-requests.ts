import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { pullRequests } from '../db/schema.js';
import { assertIssueMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  number: z.number().int(),
  status: z.enum(['open', 'merged', 'closed']).default('open'),
  target_branch_name: z.string(),
  issue_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().default(null),
  merged_at: z.string().nullable().default(null),
  merge_commit_sha: z.string().nullable().default(null),
});

const UpdateSchema = z.object({
  status: z.enum(['open', 'merged', 'closed']).optional(),
  merged_at: z.string().nullable().optional(),
  merge_commit_sha: z.string().nullable().optional(),
  workspace_id: z.string().uuid().nullable().optional(),
});

export function pullRequestsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const data = CreateSchema.parse(await c.req.json());
    if (!(await assertIssueMember(state, user.id, data.issue_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const [row] = await state.db.insert(pullRequests).values({
      id: data.id ?? uuidv4(),
      url: data.url,
      number: data.number,
      status: data.status,
      target_branch_name: data.target_branch_name,
      issue_id: data.issue_id,
      workspace_id: data.workspace_id,
      merged_at: data.merged_at ? new Date(data.merged_at) : null,
      merge_commit_sha: data.merge_commit_sha,
    }).returning();
    return c.json({ data: row, txid: uuidv4() }, 201);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(pullRequests).where(eq(pullRequests.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!(await assertIssueMember(state, user.id, row.issue_id))) return c.json({ error: 'Forbidden' }, 403);
    const data = UpdateSchema.parse(await c.req.json());
    const { merged_at, ...rest } = data;
    const [updated] = await state.db.update(pullRequests).set({
      ...rest,
      merged_at: merged_at != null ? new Date(merged_at) : null,
      updated_at: new Date(),
    }).where(eq(pullRequests.id, id)).returning();
    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(pullRequests).where(eq(pullRequests.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!(await assertIssueMember(state, user.id, row.issue_id))) return c.json({ error: 'Forbidden' }, 403);
    await state.db.delete(pullRequests).where(eq(pullRequests.id, id));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
