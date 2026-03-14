/**
 * Repo store - CRUD operations for repos.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb, executeSql } from '../db/index.js';
import { repos, type Repo } from '../db/schema.js';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Update repo input.
 * Matches Rust's UpdateRepo struct with double-option semantics:
 * - undefined = don't update
 * - null = set to NULL
 * - value = set to value
 */
export interface UpdateRepoInput {
  displayName?: string | null;
  setupScript?: string | null;
  cleanupScript?: string | null;
  archiveScript?: string | null;
  copyFiles?: string | null;
  parallelSetupScript?: boolean | null;
  devServerScript?: string | null;
  defaultTargetBranch?: string | null;
  defaultWorkingDir?: string | null;
}

/**
 * Find all repos, sorted by display_name ASC.
 */
export async function listAll(): Promise<Repo[]> {
  const db = getDb();
  const results = await db
    .select()
    .from(repos)
    .orderBy(repos.displayName);
  return results;
}

/**
 * Find repos sorted by recent workspace usage.
 * This matches Rust's `list_by_recent_workspace_usage`.
 */
export async function listByRecentUsage(): Promise<Repo[]> {
  const results = await executeSql(`
    SELECT r.id, r.path, r.name, r.display_name, r.setup_script, r.cleanup_script,
           r.archive_script, r.copy_files, r.parallel_setup_script, r.dev_server_script,
           r.default_target_branch, r.default_working_dir, r.created_at, r.updated_at
    FROM repos r
    LEFT JOIN (
      SELECT repo_id, MAX(updated_at) AS last_used_at
      FROM workspace_repos
      GROUP BY repo_id
    ) wr ON wr.repo_id = r.id
    ORDER BY wr.last_used_at DESC, r.display_name ASC
  `);

  return results.rows.map((row) => ({
    id: Buffer.from(row.id as ArrayBuffer),
    path: row.path as string,
    name: row.name as string,
    displayName: row.display_name as string,
    setupScript: row.setup_script as string | null,
    cleanupScript: row.cleanup_script as string | null,
    archiveScript: row.archive_script as string | null,
    copyFiles: row.copy_files as string | null,
    parallelSetupScript: Boolean(row.parallel_setup_script),
    devServerScript: row.dev_server_script as string | null,
    defaultTargetBranch: row.default_target_branch as string | null,
    defaultWorkingDir: row.default_working_dir as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Find a repo by ID.
 */
export async function findById(id: Buffer): Promise<Repo | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(repos)
    .where(eq(repos.id, id))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Find repos by IDs (batch query).
 */
export async function findByIds(ids: Buffer[]): Promise<Repo[]> {
  if (ids.length === 0) {
    return [];
  }

  const db = getDb();
  const results = await db
    .select()
    .from(repos)
    .where(sql`${repos.id} IN ${ids}`);
  return results;
}

/**
 * Find or create a repo by path.
 * Matches Rust's `find_or_create` with ON CONFLICT behavior.
 */
export async function findOrCreate(
  path: string,
  displayName?: string
): Promise<Repo> {
  // Extract repo name from path
  const repoName = path.split('/').pop() ?? path;
  const name = displayName ?? repoName;

  const id = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  const now = new Date().toISOString();

  // Try to insert, ignore on conflict
  const results = await executeSql(`
    INSERT INTO repos (id, path, name, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET updated_at = updated_at
    RETURNING id, path, name, display_name, setup_script, cleanup_script,
              archive_script, copy_files, parallel_setup_script, dev_server_script,
              default_target_branch, default_working_dir, created_at, updated_at
  `, [id, path, repoName, name, now, now]);

  const row = results.rows[0];
  return {
    id: Buffer.from(row.id as ArrayBuffer),
    path: row.path as string,
    name: row.name as string,
    displayName: row.display_name as string,
    setupScript: row.setup_script as string | null,
    cleanupScript: row.cleanup_script as string | null,
    archiveScript: row.archive_script as string | null,
    copyFiles: row.copy_files as string | null,
    parallelSetupScript: Boolean(row.parallel_setup_script),
    devServerScript: row.dev_server_script as string | null,
    defaultTargetBranch: row.default_target_branch as string | null,
    defaultWorkingDir: row.default_working_dir as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Update a repo.
 * Handles double-option semantics:
 * - undefined = don't update
 * - null = set to NULL
 * - value = set to value
 */
export async function update(
  id: Buffer,
  input: UpdateRepoInput
): Promise<Repo | null> {
  const db = getDb();

  // First get existing repo
  const existing = await findById(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();

  // Build update with double-option semantics
  const displayName = input.displayName === undefined
    ? existing.displayName
    : (input.displayName ?? '');

  const updateData = {
    displayName,
    setupScript: input.setupScript === undefined ? existing.setupScript : input.setupScript,
    cleanupScript: input.cleanupScript === undefined ? existing.cleanupScript : input.cleanupScript,
    archiveScript: input.archiveScript === undefined ? existing.archiveScript : input.archiveScript,
    copyFiles: input.copyFiles === undefined ? existing.copyFiles : input.copyFiles,
    parallelSetupScript: input.parallelSetupScript === undefined
      ? existing.parallelSetupScript
      : (input.parallelSetupScript ?? false),
    devServerScript: input.devServerScript === undefined
      ? existing.devServerScript
      : input.devServerScript,
    defaultTargetBranch: input.defaultTargetBranch === undefined
      ? existing.defaultTargetBranch
      : input.defaultTargetBranch,
    defaultWorkingDir: input.defaultWorkingDir === undefined
      ? existing.defaultWorkingDir
      : input.defaultWorkingDir,
    updatedAt: now,
  };

  const results = await db
    .update(repos)
    .set(updateData)
    .where(eq(repos.id, id))
    .returning();

  return results[0] ?? null;
}

/**
 * Delete a repo.
 * Returns the number of rows affected.
 */
export async function remove(id: Buffer): Promise<number> {
  const db = getDb();
  const results = await db.delete(repos).where(eq(repos.id, id)).returning();
  return results.length;
}

/**
 * Get names of active (non-archived) workspaces that reference this repo.
 * Used for conflict detection when deleting a repo.
 */
export async function activeWorkspaceNames(id: Buffer): Promise<string[]> {
  const results = await executeSql(`
    SELECT w.name
    FROM workspaces w
    JOIN workspace_repos wr ON wr.workspace_id = w.id
    WHERE wr.repo_id = ?
      AND w.archived = 0
  `, [id]);

  return results.rows.map((row) =>
    (row.name as string | null) ?? 'Unnamed workspace'
  );
}

/**
 * Validate that a path is a git repository.
 */
export function isValidGitRepo(path: string): boolean {
  return existsSync(join(path, '.git'));
}