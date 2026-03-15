/**
 * Relay host management routes.
 * Relay hosts are local kira-code servers that register themselves with the
 * cloud API so remote-web users can tunnel into them.
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { hosts, relaySessions } from '../db/schema.js';

type Env = { Variables: AuthVariables };

const RELAY_SESSION_TTL_SECONDS = 120;

const RegisterSchema = z.object({
  machine_id: z.string(),
  name: z.string().min(1),
  agent_version: z.string().optional(),
  shared_with_organization_id: z.string().uuid().optional(),
});

const UpdateSchema = z.object({
  name: z.string().optional(),
  shared_with_organization_id: z.string().uuid().nullable().optional(),
});

export function hostsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  /**
   * List hosts accessible to the current user.
   * Returns own hosts + hosts shared with orgs the user belongs to.
   */
  app.get('/', auth, async (c) => {
    const user = c.var.user;
    const rows = await state.db
      .select()
      .from(hosts)
      .where(eq(hosts.owner_user_id, user.id));
    return c.json({ hosts: rows });
  });

  /**
   * Register or update a relay host. Called by the local server on startup.
   * Uses machine_id as the idempotency key — upserts by (owner, machine_id).
   */
  app.put('/register', auth, async (c) => {
    const user = c.var.user;
    const data = RegisterSchema.parse(await c.req.json());

    const existing = await state.db
      .select()
      .from(hosts)
      .where(and(eq(hosts.owner_user_id, user.id), eq(hosts.machine_id, data.machine_id)))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      const [updated] = await state.db
        .update(hosts)
        .set({
          name: data.name,
          agent_version: data.agent_version ?? null,
          status: 'online',
          last_seen_at: new Date(),
          updated_at: new Date(),
          ...(data.shared_with_organization_id !== undefined
            ? { shared_with_organization_id: data.shared_with_organization_id }
            : {}),
        })
        .where(eq(hosts.id, existing.id))
        .returning();
      return c.json({ host: updated });
    }

    const [host] = await state.db
      .insert(hosts)
      .values({
        id: uuidv4(),
        owner_user_id: user.id,
        machine_id: data.machine_id,
        name: data.name,
        agent_version: data.agent_version ?? null,
        status: 'online',
        last_seen_at: new Date(),
        shared_with_organization_id: data.shared_with_organization_id ?? null,
      })
      .returning();

    return c.json({ host }, 201);
  });

  /**
   * Mark host offline (called when local server shuts down).
   */
  app.post('/:host_id/offline', auth, async (c) => {
    const user = c.var.user;
    const hostId = c.req.param('host_id');
    const host = await state.db.select().from(hosts).where(eq(hosts.id, hostId)).limit(1).then(r => r[0]);
    if (!host || host.owner_user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    await state.db.update(hosts).set({ status: 'offline', updated_at: new Date() }).where(eq(hosts.id, hostId));
    return c.json({ success: true });
  });

  /**
   * Create a relay session — allows a remote user to tunnel into the host.
   */
  app.post('/:host_id/sessions', auth, async (c) => {
    const user = c.var.user;
    const hostId = c.req.param('host_id');

    const host = await state.db.select().from(hosts).where(eq(hosts.id, hostId)).limit(1).then(r => r[0]);
    if (!host) return c.json({ error: 'Not found' }, 404);

    // Access: owner OR shared with user's org
    const canAccess =
      host.owner_user_id === user.id ||
      (host.shared_with_organization_id !== null);
    // TODO: verify org membership for shared hosts

    if (!canAccess) return c.json({ error: 'Forbidden' }, 403);

    const expiresAt = new Date(Date.now() + RELAY_SESSION_TTL_SECONDS * 1000);
    const [session] = await state.db
      .insert(relaySessions)
      .values({
        id: uuidv4(),
        host_id: hostId,
        request_user_id: user.id,
        state: 'requested',
        expires_at: expiresAt,
      })
      .returning();

    return c.json({ session }, 201);
  });

  app.patch('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const host = await state.db.select().from(hosts).where(eq(hosts.id, id)).limit(1).then(r => r[0]);
    if (!host || host.owner_user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    const data = UpdateSchema.parse(await c.req.json());
    const [updated] = await state.db.update(hosts).set({ ...data, updated_at: new Date() }).where(eq(hosts.id, id)).returning();
    return c.json({ host: updated });
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const host = await state.db.select().from(hosts).where(eq(hosts.id, id)).limit(1).then(r => r[0]);
    if (!host || host.owner_user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    await state.db.delete(hosts).where(eq(hosts.id, id));
    return c.json({ success: true });
  });

  return app;
}
