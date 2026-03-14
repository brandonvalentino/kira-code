/**
 * Workspace store - CRUD operations for workspaces.
 */
import { eq, desc, sql } from 'drizzle-orm';
import { getDb, executeSql } from '../db/index.js';
import { workspaces, workspaceRepos, repos, type Workspace, type NewWorkspace } from '../db/schema.js';
import { randomUUID } from 'crypto';

/**
 * Workspace with computed status fields.
 */
export interface WorkspaceWithStatus extends Workspace {
  isRunning: boolean;
  isErrored: boolean;
}

/**
 * Create workspace input.
 */
export interface CreateWorkspaceInput {
  branch: string;
  name?: string;
  taskId?: string;
}

/**
 * Update workspace input.
 */
export interface UpdateWorkspaceInput {
  archived?: boolean;
  pinned?: boolean;
  name?: string | null;
}

/**
 * Find all workspaces, sorted by created_at DESC.
 */
export async function findAll(): Promise<Workspace[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(workspaces)
    .orderBy(desc(workspaces.createdAt));
  return results;
}

/**
 * Find all workspaces with computed status fields.
 * Matches Rust's `find_all_with_status` query.
 */
export async function findAllWithStatus(
  archived?: boolean,
  limit?: number
): Promise<WorkspaceWithStatus[]> {
  // Build the query with status calculations
  // This matches the Rust query logic:
  // - is_running: EXISTS running execution process for codingagent/setupscript/cleanupscript
  // - is_errored: latest execution process status is 'failed' or 'killed'
  const results = await executeSql(`
    SELECT
      w.id,
      w.task_id,
      w.container_ref,
      w.branch,
      w.setup_completed_at,
      w.created_at,
      w.updated_at,
      w.archived,
      w.pinned,
      w.name,
      w.worktree_deleted,
      CASE WHEN EXISTS (
        SELECT 1
        FROM sessions s
        JOIN execution_processes ep ON ep.session_id = s.id
        WHERE s.workspace_id = w.id
          AND ep.status = 'running'
          AND ep.run_reason IN ('setupscript','cleanupscript','codingagent')
        LIMIT 1
      ) THEN 1 ELSE 0 END AS is_running,
      CASE WHEN (
        SELECT ep.status
        FROM sessions s
        JOIN execution_processes ep ON ep.session_id = s.id
        WHERE s.workspace_id = w.id
          AND ep.run_reason IN ('setupscript','cleanupscript','codingagent')
        ORDER BY ep.created_at DESC
        LIMIT 1
      ) IN ('failed','killed') THEN 1 ELSE 0 END AS is_errored
    FROM workspaces w
    ORDER BY w.updated_at DESC
  `);

  let workspacesList = results.rows.map((row) => ({
    id: Buffer.from(row.id as ArrayBuffer),
    taskId: row.task_id ? Buffer.from(row.task_id as ArrayBuffer) : null,
    containerRef: row.container_ref as string | null,
    branch: row.branch as string,
    setupCompletedAt: row.setup_completed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    archived: Boolean(row.archived),
    pinned: Boolean(row.pinned),
    name: row.name as string | null,
    worktreeDeleted: Boolean(row.worktree_deleted),
    isRunning: Boolean(row.is_running),
    isErrored: Boolean(row.is_errored),
  }));

  // Apply archived filter if provided
  if (archived !== undefined) {
    workspacesList = workspacesList.filter((ws) => ws.archived === archived);
  }

  // Apply limit if provided
  if (limit !== undefined && limit > 0) {
    workspacesList = workspacesList.slice(0, limit);
  }

  return workspacesList;
}

/**
 * Find a workspace by ID.
 */
export async function findById(id: Buffer): Promise<Workspace | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Find a workspace by ID with status fields.
 */
export async function findByIdWithStatus(id: Buffer): Promise<WorkspaceWithStatus | null> {
  const results = await executeSql(`
    SELECT
      w.id,
      w.task_id,
      w.container_ref,
      w.branch,
      w.setup_completed_at,
      w.created_at,
      w.updated_at,
      w.archived,
      w.pinned,
      w.name,
      w.worktree_deleted,
      CASE WHEN EXISTS (
        SELECT 1
        FROM sessions s
        JOIN execution_processes ep ON ep.session_id = s.id
        WHERE s.workspace_id = w.id
          AND ep.status = 'running'
          AND ep.run_reason IN ('setupscript','cleanupscript','codingagent')
        LIMIT 1
      ) THEN 1 ELSE 0 END AS is_running,
      CASE WHEN (
        SELECT ep.status
        FROM sessions s
        JOIN execution_processes ep ON ep.session_id = s.id
        WHERE s.workspace_id = w.id
          AND ep.run_reason IN ('setupscript','cleanupscript','codingagent')
        ORDER BY ep.created_at DESC
        LIMIT 1
      ) IN ('failed','killed') THEN 1 ELSE 0 END AS is_errored
    FROM workspaces w
    WHERE w.id = ?
  `, [id]);

  const row = results.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: Buffer.from(row.id as ArrayBuffer),
    taskId: row.task_id ? Buffer.from(row.task_id as ArrayBuffer) : null,
    containerRef: row.container_ref as string | null,
    branch: row.branch as string,
    setupCompletedAt: row.setup_completed_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    archived: Boolean(row.archived),
    pinned: Boolean(row.pinned),
    name: row.name as string | null,
    worktreeDeleted: Boolean(row.worktree_deleted),
    isRunning: Boolean(row.is_running),
    isErrored: Boolean(row.is_errored),
  };
}

/**
 * Create a new workspace.
 */
export async function create(input: CreateWorkspaceInput): Promise<Workspace> {
  const db = getDb();
  const id = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  const now = new Date().toISOString();

  const newWorkspace: NewWorkspace = {
    id,
    branch: input.branch,
    name: input.name ?? null,
    taskId: input.taskId ? Buffer.from(input.taskId.replace(/-/g, ''), 'hex') : null,
    containerRef: null,
    setupCompletedAt: null,
    createdAt: now,
    updatedAt: now,
    archived: false,
    pinned: false,
    worktreeDeleted: false,
  };

  const results = await db.insert(workspaces).values(newWorkspace).returning();
  return results[0];
}

/**
 * Update a workspace.
 * Only non-null values will be updated.
 * Pass empty string for name to clear it.
 */
export async function update(
  id: Buffer,
  input: UpdateWorkspaceInput
): Promise<Workspace | null> {
  const db = getDb();
  const now = new Date().toISOString();

  // Build update object with only provided fields
  const updateData: Partial<Workspace> = {
    updatedAt: now,
  };

  if (input.archived !== undefined) {
    updateData.archived = input.archived;
  }
  if (input.pinned !== undefined) {
    updateData.pinned = input.pinned;
  }
  if (input.name !== undefined) {
    // Empty string means clear the name (set to null)
    updateData.name = input.name === '' ? null : input.name;
  }

  const results = await db
    .update(workspaces)
    .set(updateData)
    .where(eq(workspaces.id, id))
    .returning();

  return results[0] ?? null;
}

/**
 * Delete a workspace.
 * Returns the number of rows affected.
 */
export async function remove(id: Buffer): Promise<number> {
  const db = getDb();
  const results = await db.delete(workspaces).where(eq(workspaces.id, id)).returning();
  return results.length;
}

/**
 * Check if a workspace has running processes.
 * Used to prevent deletion while processes are running.
 */
export async function hasRunningProcesses(id: Buffer): Promise<boolean> {
  const results = await executeSql(`
    SELECT COUNT(*) as count
    FROM sessions s
    JOIN execution_processes ep ON ep.session_id = s.id
    WHERE s.workspace_id = ?
      AND ep.status = 'running'
      AND ep.run_reason IN ('setupscript','cleanupscript','codingagent')
  `, [id]);

  const count = (results.rows[0] as any)?.count ?? 0;
  return count > 0;
}

/**
 * Count total workspaces.
 */
export async function countAll(): Promise<number> {
  const db = getDb();
  const results = await db.select({ count: sql<number>`count(*)` }).from(workspaces);
  return results[0]?.count ?? 0;
}

/**
 * Find repos associated with a workspace (via workspace_repos join table).
 * Returns repo records with their paths.
 */
export async function findReposForWorkspace(workspaceId: Buffer): Promise<Array<{ id: Buffer; path: string; name: string }>> {
  const db = getDb();
  const results = await db
    .select({ id: repos.id, path: repos.path, name: repos.name })
    .from(workspaceRepos)
    .innerJoin(repos, eq(workspaceRepos.repoId, repos.id))
    .where(eq(workspaceRepos.workspaceId, workspaceId));
  return results;
}

/**
 * Associate a workspace with a repo via the workspace_repos join table.
 */
export async function addRepoToWorkspace(workspaceId: Buffer, repoId: Buffer, targetBranch: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(workspaceRepos).values({
    id: Buffer.from(randomUUID().replace(/-/g, ''), 'hex'),
    workspaceId,
    repoId,
    targetBranch,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Mark a workspace's worktree as deleted or restored.
 */
export async function updateWorktreeDeleted(id: Buffer, deleted: boolean): Promise<Workspace | null> {
  const db = getDb();
  const now = new Date().toISOString();
  const results = await db
    .update(workspaces)
    .set({ worktreeDeleted: deleted, updatedAt: now })
    .where(eq(workspaces.id, id))
    .returning();
  return results[0] ?? null;
}