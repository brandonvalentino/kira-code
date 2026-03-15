import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { projects, organizationMembers } from '../db/schema.js';

type Env = { Variables: AuthVariables };

const CreateProjectSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
});

const UpdateProjectSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
});

async function assertMember(state: AppState, userId: string, orgId: string) {
  const m = await state.db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organization_id, orgId),
        eq(organizationMembers.user_id, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  return !!m;
}

export function projectsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const body = await c.req.json();
    const data = CreateProjectSchema.parse(body);

    if (!(await assertMember(state, user.id, data.organization_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const id = data.id ?? uuidv4();
    const [project] = await state.db
      .insert(projects)
      .values({ id, organization_id: data.organization_id, name: data.name, color: data.color })
      .returning();

    return c.json({ data: project, txid: uuidv4() }, 201);
  });

  app.get('/:id', auth, async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('id');
    const project = await state.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then((r) => r[0]);
    if (!project) return c.json({ error: 'Not found' }, 404);

    if (!(await assertMember(state, user.id, project.organization_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json(project);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('id');
    const project = await state.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then((r) => r[0]);
    if (!project) return c.json({ error: 'Not found' }, 404);

    if (!(await assertMember(state, user.id, project.organization_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const data = UpdateProjectSchema.parse(body);
    const [updated] = await state.db
      .update(projects)
      .set({ ...data, updated_at: new Date() })
      .where(eq(projects.id, projectId))
      .returning();

    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const projectId = c.req.param('id');
    const project = await state.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then((r) => r[0]);
    if (!project) return c.json({ error: 'Not found' }, 404);

    if (!(await assertMember(state, user.id, project.organization_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await state.db.delete(projects).where(eq(projects.id, projectId));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
