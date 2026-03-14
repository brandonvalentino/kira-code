/**
 * Session store - CRUD operations for sessions.
 */
import { eq } from 'drizzle-orm';
import { getDb, executeSql } from '../db/index.js';
import { sessions, type Session, type NewSession } from '../db/schema.js';
import { randomUUID } from 'crypto';

/**
 * Create session input.
 */
export interface CreateSessionInput {
  workspaceId: Buffer;
  executor?: string;
}

/**
 * Find all sessions for a workspace, ordered by most recently used.
 * "Most recently used" is defined as the most recent non-dev server execution process.
 * Sessions with no executions fall back to created_at for ordering.
 */
export async function findByWorkspaceId(workspaceId: Buffer): Promise<Session[]> {
  const results = await executeSql(`
    SELECT s.id, s.workspace_id, s.executor, s.agent_working_dir, s.created_at, s.updated_at
    FROM sessions s
    LEFT JOIN (
      SELECT ep.session_id, MAX(ep.created_at) as last_used
      FROM execution_processes ep
      WHERE ep.run_reason != 'devserver' AND ep.dropped = 0
      GROUP BY ep.session_id
    ) latest_ep ON s.id = latest_ep.session_id
    WHERE s.workspace_id = ?
    ORDER BY COALESCE(latest_ep.last_used, s.created_at) DESC
  `, [workspaceId]);

  return results.rows.map((row) => ({
    id: Buffer.from(row.id as ArrayBuffer),
    workspaceId: Buffer.from(row.workspace_id as ArrayBuffer),
    executor: row.executor as string | null,
    agentWorkingDir: row.agent_working_dir as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Find the most recently used session for a workspace.
 */
export async function findLatestByWorkspaceId(workspaceId: Buffer): Promise<Session | null> {
  const results = await executeSql(`
    SELECT s.id, s.workspace_id, s.executor, s.agent_working_dir, s.created_at, s.updated_at
    FROM sessions s
    LEFT JOIN (
      SELECT ep.session_id, MAX(ep.created_at) as last_used
      FROM execution_processes ep
      WHERE ep.run_reason != 'devserver' AND ep.dropped = 0
      GROUP BY ep.session_id
    ) latest_ep ON s.id = latest_ep.session_id
    WHERE s.workspace_id = ?
    ORDER BY COALESCE(latest_ep.last_used, s.created_at) DESC
    LIMIT 1
  `, [workspaceId]);

  const row = results.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: Buffer.from(row.id as ArrayBuffer),
    workspaceId: Buffer.from(row.workspace_id as ArrayBuffer),
    executor: row.executor as string | null,
    agentWorkingDir: row.agent_working_dir as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Find a session by ID.
 */
export async function findById(id: Buffer): Promise<Session | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Create a new session.
 */
export async function create(input: CreateSessionInput): Promise<Session> {
  const db = getDb();
  const id = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  const now = new Date().toISOString();

  // TODO: Resolve agent_working_dir from workspace repos
  // For now, leave it null
  const agentWorkingDir = null;

  const newSession: NewSession = {
    id,
    workspaceId: input.workspaceId,
    executor: input.executor ?? null,
    agentWorkingDir,
    createdAt: now,
    updatedAt: now,
  };

  const results = await db.insert(sessions).values(newSession).returning();
  return results[0];
}

/**
 * Update the executor for a session.
 */
export async function updateExecutor(id: Buffer, executor: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ executor, updatedAt: new Date().toISOString() })
    .where(eq(sessions.id, id));
}