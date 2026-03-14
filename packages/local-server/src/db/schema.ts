/**
 * Drizzle ORM schema for Kira Code local database.
 * Matches the Rust SQLite schema exactly for seamless migration.
 */
import { sqliteTable, text, integer, blob, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Repos
// ============================================================================

export const repos = sqliteTable('repos', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  path: text('path').notNull().unique(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  setupScript: text('setup_script'),
  cleanupScript: text('cleanup_script'),
  archiveScript: text('archive_script'),
  copyFiles: text('copy_files'),
  parallelSetupScript: integer('parallel_setup_script', { mode: 'boolean' }).notNull().default(false),
  devServerScript: text('dev_server_script'),
  defaultTargetBranch: text('default_target_branch'),
  defaultWorkingDir: text('default_working_dir'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const reposRelations = relations(repos, ({ many }) => ({
  workspaceRepos: many(workspaceRepos),
  projectRepos: many(projectRepos),
}));

// ============================================================================
// Projects
// ============================================================================

export const projects = sqliteTable('projects', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  name: text('name').notNull(),
  gitRepoPath: text('git_repo_path').notNull().default(''),
  defaultAgentWorkingDir: text('default_agent_working_dir'),
  remoteProjectId: text('remote_project_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  projectRepos: many(projectRepos),
}));

// ============================================================================
// Project Repos (junction table)
// ============================================================================

export const projectRepos = sqliteTable('project_repos', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  projectId: blob('project_id', { mode: 'buffer' }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  repoId: blob('repo_id', { mode: 'buffer' }).notNull().references(() => repos.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const projectReposRelations = relations(projectRepos, ({ one }) => ({
  project: one(projects, {
    fields: [projectRepos.projectId],
    references: [projects.id],
  }),
  repo: one(repos, {
    fields: [projectRepos.repoId],
    references: [repos.id],
  }),
}));

// ============================================================================
// Workspaces
// ============================================================================

export const workspaces = sqliteTable('workspaces', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  taskId: blob('task_id', { mode: 'buffer' }),
  containerRef: text('container_ref'),
  branch: text('branch').notNull(),
  setupCompletedAt: text('setup_completed_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  worktreeDeleted: integer('worktree_deleted', { mode: 'boolean' }).notNull().default(false),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  workspaceRepos: many(workspaceRepos),
  sessions: many(sessions),
  workspaceImages: many(workspaceImages),
  merges: many(merges),
}));

// ============================================================================
// Workspace Repos (junction table)
// ============================================================================

export const workspaceRepos = sqliteTable('workspace_repos', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  workspaceId: blob('workspace_id', { mode: 'buffer' }).notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  repoId: blob('repo_id', { mode: 'buffer' }).notNull().references(() => repos.id, { onDelete: 'cascade' }),
  targetBranch: text('target_branch').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const workspaceReposRelations = relations(workspaceRepos, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceRepos.workspaceId],
    references: [workspaces.id],
  }),
  repo: one(repos, {
    fields: [workspaceRepos.repoId],
    references: [repos.id],
  }),
}));

// ============================================================================
// Sessions
// ============================================================================

export const sessions = sqliteTable('sessions', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  workspaceId: blob('workspace_id', { mode: 'buffer' }).notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  executor: text('executor'),
  agentWorkingDir: text('agent_working_dir'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sessions.workspaceId],
    references: [workspaces.id],
  }),
  executionProcesses: many(executionProcesses),
  codingAgentTurns: many(codingAgentTurns),
}));

// ============================================================================
// Execution Processes
// ============================================================================

export const executionProcessRunReasons = [
  'setupscript',
  'cleanupscript',
  'archivescript',
  'codingagent',
  'devserver',
] as const;

export const executionProcessStatuses = [
  'running',
  'completed',
  'failed',
  'killed',
] as const;

export const executionProcesses = sqliteTable('execution_processes', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  sessionId: blob('session_id', { mode: 'buffer' }).notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  runReason: text('run_reason', { enum: executionProcessRunReasons }).notNull().default('setupscript'),
  executorAction: text('executor_action').notNull().default('{}'),
  status: text('status', { enum: executionProcessStatuses }).notNull().default('running'),
  exitCode: integer('exit_code', { mode: 'number' }),
  dropped: integer('dropped', { mode: 'boolean' }).notNull().default(false),
  startedAt: text('started_at').notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const executionProcessesRelations = relations(executionProcesses, ({ one, many }) => ({
  session: one(sessions, {
    fields: [executionProcesses.sessionId],
    references: [sessions.id],
  }),
  codingAgentTurns: many(codingAgentTurns),
  executionProcessRepoStates: many(executionProcessRepoStates),
}));

// ============================================================================
// Execution Process Repo States
// ============================================================================

export const executionProcessRepoStates = sqliteTable('execution_process_repo_states', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  executionProcessId: blob('execution_process_id', { mode: 'buffer' }).notNull().references(() => executionProcesses.id, { onDelete: 'cascade' }),
  repoId: blob('repo_id', { mode: 'buffer' }).notNull().references(() => repos.id, { onDelete: 'cascade' }),
  beforeHeadCommit: text('before_head_commit'),
  afterHeadCommit: text('after_head_commit'),
  mergeCommit: text('merge_commit'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const executionProcessRepoStatesRelations = relations(executionProcessRepoStates, ({ one }) => ({
  executionProcess: one(executionProcesses, {
    fields: [executionProcessRepoStates.executionProcessId],
    references: [executionProcesses.id],
  }),
  repo: one(repos, {
    fields: [executionProcessRepoStates.repoId],
    references: [repos.id],
  }),
}));

// ============================================================================
// Coding Agent Turns
// ============================================================================

export const codingAgentTurns = sqliteTable('coding_agent_turns', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  executionProcessId: blob('execution_process_id', { mode: 'buffer' }).notNull().references(() => executionProcesses.id, { onDelete: 'cascade' }),
  agentSessionId: text('agent_session_id'),
  prompt: text('prompt'),
  summary: text('summary'),
  seen: integer('seen', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const codingAgentTurnsRelations = relations(codingAgentTurns, ({ one }) => ({
  executionProcess: one(executionProcesses, {
    fields: [codingAgentTurns.executionProcessId],
    references: [executionProcesses.id],
  }),
}));

// ============================================================================
// Images
// ============================================================================

export const images = sqliteTable('images', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  filePath: text('file_path').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  hash: text('hash').notNull().unique(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const imagesRelations = relations(images, ({ many }) => ({
  workspaceImages: many(workspaceImages),
}));

// ============================================================================
// Workspace Images (junction table)
// ============================================================================

export const workspaceImages = sqliteTable('workspace_images', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  workspaceId: blob('workspace_id', { mode: 'buffer' }).notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  imageId: blob('image_id', { mode: 'buffer' }).notNull().references(() => images.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex('workspace_id_image_id_unique').on(table.workspaceId, table.imageId),
]);

export const workspaceImagesRelations = relations(workspaceImages, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceImages.workspaceId],
    references: [workspaces.id],
  }),
  image: one(images, {
    fields: [workspaceImages.imageId],
    references: [images.id],
  }),
}));

// ============================================================================
// Tags
// ============================================================================

export const tags = sqliteTable('tags', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  tagName: text('tag_name').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ============================================================================
// Scratch (temporary data storage)
// ============================================================================

export const scratchTypes = [
  'DRAFT_TASK',
  'DRAFT_FOLLOW_UP',
  'DRAFT_WORKSPACE',
  'DRAFT_ISSUE',
  'PREVIEW_SETTINGS',
  'WORKSPACE_NOTES',
  'UI_PREFERENCES',
  'PROJECT_REPO_DEFAULTS',
] as const;

export const scratch = sqliteTable('scratch', {
  id: blob('id', { mode: 'buffer' }).notNull().primaryKey(),
  scratchType: text('scratch_type', { enum: scratchTypes }).notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ============================================================================
// Merges
// ============================================================================

export const mergeTypes = ['direct', 'pr'] as const;
export const mergeStatuses = ['open', 'merged', 'closed', 'unknown'] as const;

export const merges = sqliteTable('merges', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  workspaceId: blob('workspace_id', { mode: 'buffer' }).notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  repoId: blob('repo_id', { mode: 'buffer' }).notNull().references(() => repos.id, { onDelete: 'cascade' }),
  mergeType: text('merge_type', { enum: mergeTypes }).notNull(),
  mergeCommit: text('merge_commit'),
  targetBranchName: text('target_branch_name'),
  prNumber: integer('pr_number'),
  prUrl: text('pr_url'),
  prStatus: text('pr_status', { enum: mergeStatuses }),
  prMergedAt: text('pr_merged_at'),
  prMergeCommitSha: text('pr_merge_commit_sha'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const mergesRelations = relations(merges, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [merges.workspaceId],
    references: [workspaces.id],
  }),
  repo: one(repos, {
    fields: [merges.repoId],
    references: [repos.id],
  }),
}));

// ============================================================================
// Migration State
// ============================================================================

export const migrationStates = ['pending', 'migrated', 'failed', 'skipped'] as const;

export const migrationState = sqliteTable('migration_state', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  localId: text('local_id').notNull(),
  remoteId: text('remote_id'),
  status: text('status', { enum: migrationStates }).notNull().default('pending'),
  errorMessage: text('error_message'),
  attemptCount: integer('attempt_count').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex('entity_type_local_id_unique').on(table.entityType, table.localId),
]);

// ============================================================================
// Virtual Keys (LiteLLM proxy key management)
// ============================================================================

export const virtualKeys = sqliteTable('virtual_keys', {
  id: blob('id', { mode: 'buffer' }).primaryKey(),
  key: text('key').notNull().unique(),
  budgetTokens: integer('budget_tokens'),
  usedTokens: integer('used_tokens').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceRepo = typeof workspaceRepos.$inferSelect;
export type NewWorkspaceRepo = typeof workspaceRepos.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ExecutionProcess = typeof executionProcesses.$inferSelect;
export type NewExecutionProcess = typeof executionProcesses.$inferInsert;
export type ExecutionProcessRepoState = typeof executionProcessRepoStates.$inferSelect;
export type CodingAgentTurn = typeof codingAgentTurns.$inferSelect;
export type Image = typeof images.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Scratch = typeof scratch.$inferSelect;
export type Merge = typeof merges.$inferSelect;
export type MigrationState = typeof migrationState.$inferSelect;
export type VirtualKey = typeof virtualKeys.$inferSelect;
export type NewVirtualKey = typeof virtualKeys.$inferInsert;