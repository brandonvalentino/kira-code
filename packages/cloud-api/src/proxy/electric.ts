/**
 * Auth-gated ElectricSQL shape proxy.
 *
 * Forwards authenticated shape requests to the internal ElectricSQL service.
 * The table and WHERE clause are set server-side to prevent unauthorized data access.
 */
import type { Context } from 'hono';
import type { RequestUser } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { organizationMembers, projects } from '../db/schema.js';

// Electric params forwarded from client (others are stripped for security)
const ELECTRIC_PASSTHROUGH_PARAMS = new Set([
  'offset',
  'handle',
  'live',
  'cursor',
  'columns',
]);

export interface ShapeProxyOptions {
  /** Electric internal service URL, e.g. http://electric:3000 */
  electricUrl: string;
  /** Table name in PostgreSQL */
  table: string;
  /** SQL WHERE clause with $1, $2... placeholders */
  whereClause?: string;
  /** Positional values for the WHERE clause */
  whereParams?: string[];
}

/**
 * Proxy a shape request to ElectricSQL with a server-controlled WHERE clause.
 */
export async function proxyShape(
  c: Context,
  opts: ShapeProxyOptions,
): Promise<Response> {
  const electricBase = opts.electricUrl.replace(/\/$/, '');
  const url = new URL(`${electricBase}/v1/shape`);

  // Server-controlled: table and WHERE (client cannot override)
  url.searchParams.set('table', opts.table);
  if (opts.whereClause) {
    url.searchParams.set('where', opts.whereClause);
    opts.whereParams?.forEach((val, i) => {
      url.searchParams.set(`params[${i + 1}]`, val);
    });
  }

  // Forward safe client params
  const incoming = new URL(c.req.url);
  for (const [key, value] of incoming.searchParams) {
    if (ELECTRIC_PASSTHROUGH_PARAMS.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  // Stream body back to client
  return new Response(upstream.body, {
    status: upstream.status,
    headers: filterElectricHeaders(upstream.headers),
  });
}

/**
 * Verify the requesting user is a member of the given organization.
 */
export async function assertOrgMember(
  db: Db,
  user: RequestUser,
  orgId: string,
): Promise<void> {
  const membership = await db
    .select({ organization_id: organizationMembers.organization_id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organization_id, orgId),
        eq(organizationMembers.user_id, user.id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!membership) {
    throw new ProxyAuthError('Not a member of this organization');
  }
}

/**
 * Verify the requesting user has access to the given project via org membership.
 */
export async function assertProjectAccess(
  db: Db,
  user: RequestUser,
  projectId: string,
): Promise<string> {
  const project = await db
    .select({ organization_id: projects.organization_id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!project) {
    throw new ProxyAuthError('Project not found');
  }

  await assertOrgMember(db, user, project.organization_id);
  return project.organization_id;
}

export class ProxyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyAuthError';
  }
}

/**
 * Strip headers that shouldn't be forwarded from Electric to the client.
 */
function filterElectricHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const strip = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailer',
    'upgrade',
    'proxy-authorization',
    'proxy-authenticate',
  ]);

  headers.forEach((value, key) => {
    if (!strip.has(key.toLowerCase())) {
      out[key] = value;
    }
  });

  return out as Record<string, string>;
}
