import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { issues } from '../db/schema.js';
import { assertProjectMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateIssueSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  status_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).nullable().default(null),
  start_date: z.string().nullable().default(null),
  target_date: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
  sort_order: z.number().default(0),
  parent_issue_id: z.string().uuid().nullable().default(null),
  parent_issue_sort_order: z.number().nullable().default(null),
  extension_metadata: z.record(z.unknown()).default({}),
});

const UpdateIssueSchema = z.object({
  status_id: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).nullable().optional(),
  start_date: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  sort_order: z.number().optional(),
  parent_issue_id: z.string().uuid().nullable().optional(),
  parent_issue_sort_order: z.number().nullable().optional(),
  extension_metadata: z.record(z.unknown()).nullable().optional(),
});

export function issuesRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const body = await c.req.json();
    const data = CreateIssueSchema.parse(body);

    const orgId = await assertProjectMember(state, user.id, data.project_id);
    if (!orgId) return c.json({ error: 'Forbidden' }, 403);

    const id = data.id ?? uuidv4();
    const [issue] = await state.db
      .insert(issues)
      .values({
        id,
        project_id: data.project_id,
        status_id: data.status_id,
        title: data.title,
        description: data.description,
        priority: data.priority ?? null,
        sort_order: data.sort_order,
        parent_issue_id: data.parent_issue_id,
        parent_issue_sort_order: data.parent_issue_sort_order,
        extension_metadata: data.extension_metadata,
        creator_user_id: user.id,
        // issue_number and simple_id are set by DB trigger
        issue_number: 0,
        simple_id: '',
      })
      .returning();

    return c.json({ data: issue, txid: uuidv4() }, 201);
  });

  app.get('/:id', auth, async (c) => {
    const user = c.var.user;
    const issueId = c.req.param('id');
    const issue = await state.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1)
      .then((r) => r[0]);
    if (!issue) return c.json({ error: 'Not found' }, 404);

    const orgId = await assertProjectMember(state, user.id, issue.project_id);
    if (!orgId) return c.json({ error: 'Forbidden' }, 403);

    return c.json(issue);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const issueId = c.req.param('id');
    const issue = await state.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1)
      .then((r) => r[0]);
    if (!issue) return c.json({ error: 'Not found' }, 404);

    const orgId = await assertProjectMember(state, user.id, issue.project_id);
    if (!orgId) return c.json({ error: 'Forbidden' }, 403);

    const body = await c.req.json();
    const data = UpdateIssueSchema.parse(body);

    // Convert ISO date strings to Date objects for Drizzle timestamp columns
    const { start_date, target_date, completed_at, ...rest } = data;
    const [updated] = await state.db
      .update(issues)
      .set({
        ...rest,
        start_date: start_date != null ? new Date(start_date) : null,
        target_date: target_date != null ? new Date(target_date) : null,
        completed_at: completed_at != null ? new Date(completed_at) : null,
        updated_at: new Date(),
      })
      .where(eq(issues.id, issueId))
      .returning();

    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const issueId = c.req.param('id');
    const issue = await state.db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1)
      .then((r) => r[0]);
    if (!issue) return c.json({ error: 'Not found' }, 404);

    const orgId = await assertProjectMember(state, user.id, issue.project_id);
    if (!orgId) return c.json({ error: 'Forbidden' }, 403);

    await state.db.delete(issues).where(eq(issues.id, issueId));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
