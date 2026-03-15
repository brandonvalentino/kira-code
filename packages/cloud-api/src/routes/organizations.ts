import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { organizations, organizationMembers } from '../db/schema.js';

type Env = { Variables: AuthVariables };

const CreateOrganizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  is_personal: z.boolean().optional().default(false),
});

const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

export function organizationsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.get('/', auth, async (c) => {
    const user = c.var.user;
    const rows = await state.db
      .select({ org: organizations })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizationMembers.organization_id, organizations.id),
      )
      .where(eq(organizationMembers.user_id, user.id));

    return c.json(rows.map((r) => r.org));
  });

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const body = await c.req.json();
    const data = CreateOrganizationSchema.parse(body);

    const id = data.id ?? uuidv4();
    const [org] = await state.db
      .insert(organizations)
      .values({
        id,
        name: data.name,
        slug: data.slug,
        is_personal: data.is_personal,
      })
      .returning();

    // Add creator as admin
    await state.db.insert(organizationMembers).values({
      organization_id: org.id,
      user_id: user.id,
      role: 'admin',
    });

    return c.json({ data: org, txid: uuidv4() }, 201);
  });

  app.get('/:id', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('id');

    const membership = await state.db
      .select()
      .from(organizationMembers)
      .where(
        eq(organizationMembers.organization_id, orgId) &&
          eq(organizationMembers.user_id, user.id),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!membership) return c.json({ error: 'Not found' }, 404);

    const org = await state.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
      .then((r) => r[0]);

    if (!org) return c.json({ error: 'Not found' }, 404);
    return c.json(org);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('id');

    // Must be admin
    const membership = await state.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organization_id, orgId))
      .limit(1)
      .then((r) => r[0]);

    if (!membership || membership.user_id !== user.id || membership.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const data = UpdateOrganizationSchema.parse(body);

    const [updated] = await state.db
      .update(organizations)
      .set({ ...data, updated_at: new Date() })
      .where(eq(organizations.id, orgId))
      .returning();

    return c.json({ data: updated, txid: uuidv4() });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('id');

    const membership = await state.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organization_id, orgId))
      .limit(1)
      .then((r) => r[0]);

    if (!membership || membership.user_id !== user.id || membership.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await state.db.delete(organizations).where(eq(organizations.id, orgId));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
