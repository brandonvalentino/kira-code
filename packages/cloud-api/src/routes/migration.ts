/**
 * Data migration routes.
 * Used for onboarding users migrating from other tools or from an older
 * Kira version. Bulk-imports projects, issues, PRs, and workspaces.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { projects, issues, pullRequests, workspaces, projectStatuses } from '../db/schema.js';
import { assertProjectMember, isMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const MigrateProjectsSchema = z.object({
  organization_id: z.string().uuid(),
  projects: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string(),
    color: z.string().default('#6366f1'),
  })),
});

const MigrateIssuesSchema = z.object({
  project_id: z.string().uuid(),
  status_id: z.string().uuid(),
  issues: z.array(z.object({
    id: z.string().uuid().optional(),
    title: z.string(),
    description: z.string().nullable().default(null),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).nullable().default(null),
    sort_order: z.number().default(0),
    extension_metadata: z.record(z.unknown()).default({}),
  })),
});

export function migrationRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  /**
   * Bulk import projects into an organization.
   */
  app.post('/projects', auth, async (c) => {
    const user = c.var.user;
    const data = MigrateProjectsSchema.parse(await c.req.json());

    if (!(await isMember(state, user.id, data.organization_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const created = await state.db
      .insert(projects)
      .values(
        data.projects.map((p) => ({
          id: p.id ?? uuidv4(),
          organization_id: data.organization_id,
          name: p.name,
          color: p.color,
        })),
      )
      .onConflictDoNothing()
      .returning();

    return c.json({ created: created.length, projects: created });
  });

  /**
   * Bulk import issues into a project.
   */
  app.post('/issues', auth, async (c) => {
    const user = c.var.user;
    const data = MigrateIssuesSchema.parse(await c.req.json());

    if (!(await assertProjectMember(state, user.id, data.project_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Validate status exists in project
    const status = await state.db
      .select()
      .from(projectStatuses)
      .where(eq(projectStatuses.id, data.status_id))
      .limit(1)
      .then((r) => r[0]);

    if (!status) return c.json({ error: 'Status not found' }, 404);

    const rows = data.issues.map((issue) => ({
      id: issue.id ?? uuidv4(),
      project_id: data.project_id,
      status_id: data.status_id,
      title: issue.title,
      description: issue.description,
      priority: issue.priority ?? null,
      sort_order: issue.sort_order,
      extension_metadata: issue.extension_metadata,
      creator_user_id: user.id,
      // issue_number / simple_id set by DB trigger
      issue_number: 0,
      simple_id: '',
    }));

    const created = await state.db.insert(issues).values(rows).onConflictDoNothing().returning();
    return c.json({ created: created.length, issues: created });
  });

  /**
   * Bulk import pull requests.
   */
  app.post('/pull_requests', auth, async (c) => {
    void c.var.user; // auth context available but not needed for bulk insert
    const body = await c.req.json() as { pull_requests: Array<{ url: string; number: number; target_branch_name: string; issue_id: string; status?: string }> };

    const created = [];
    for (const pr of (body.pull_requests ?? [])) {
      try {
        const [row] = await state.db.insert(pullRequests).values({
          id: uuidv4(),
          url: pr.url,
          number: pr.number,
          target_branch_name: pr.target_branch_name,
          issue_id: pr.issue_id,
          status: (pr.status as 'open' | 'merged' | 'closed') ?? 'open',
        }).onConflictDoNothing().returning();
        if (row) created.push(row);
      } catch { /* skip duplicates */ }
    }

    return c.json({ created: created.length });
  });

  /**
   * Bulk import workspaces.
   */
  app.post('/workspaces', auth, async (c) => {
    const user = c.var.user;
    const body = await c.req.json() as { project_id: string; workspaces: Array<{ id?: string; name?: string; issue_id?: string; local_workspace_id?: string }> };

    if (!(await assertProjectMember(state, user.id, body.project_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const created = [];
    for (const ws of (body.workspaces ?? [])) {
      try {
        const [row] = await state.db.insert(workspaces).values({
          id: ws.id ?? uuidv4(),
          project_id: body.project_id,
          owner_user_id: user.id,
          name: ws.name ?? null,
          issue_id: ws.issue_id ?? null,
          local_workspace_id: ws.local_workspace_id ?? null,
        }).onConflictDoNothing().returning();
        if (row) created.push(row);
      } catch { /* skip duplicates */ }
    }

    return c.json({ created: created.length });
  });

  return app;
}
