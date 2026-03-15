import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { organizationMembers } from '../db/schema.js';
import { isMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const UpdateSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export function organizationMembersRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.get('/:org_id', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('org_id');
    if (!(await isMember(state, user.id, orgId))) return c.json({ error: 'Forbidden' }, 403);
    const rows = await state.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organization_id, orgId));
    return c.json(rows);
  });

  app.patch('/:org_id/members/:user_id', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('org_id');
    const targetUserId = c.req.param('user_id');

    // Must be admin
    const myMembership = await state.db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organization_id, orgId), eq(organizationMembers.user_id, user.id)))
      .limit(1)
      .then(r => r[0]);
    if (!myMembership || myMembership.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const data = UpdateSchema.parse(await c.req.json());
    await state.db
      .update(organizationMembers)
      .set({ role: data.role })
      .where(and(eq(organizationMembers.organization_id, orgId), eq(organizationMembers.user_id, targetUserId)));

    return c.json({ success: true });
  });

  app.delete('/:org_id/members/:user_id', auth, async (c) => {
    const user = c.var.user;
    const orgId = c.req.param('org_id');
    const targetUserId = c.req.param('user_id');

    const myMembership = await state.db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organization_id, orgId), eq(organizationMembers.user_id, user.id)))
      .limit(1)
      .then(r => r[0]);
    if (!myMembership || (myMembership.role !== 'admin' && targetUserId !== user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await state.db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.organization_id, orgId), eq(organizationMembers.user_id, targetUserId)));

    return c.json({ success: true });
  });

  return app;
}
