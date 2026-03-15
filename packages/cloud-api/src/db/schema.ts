/**
 * Drizzle ORM schema for cloud-api PostgreSQL database.
 * Tables mirror crates/remote/migrations/ but expressed as Drizzle schema.
 */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const memberRoleEnum = pgEnum('member_role', ['admin', 'member']);
export const issuePriorityEnum = pgEnum('issue_priority', ['urgent', 'high', 'medium', 'low']);
export const issueRelationshipTypeEnum = pgEnum('issue_relationship_type', [
  'blocking',
  'related',
  'has_duplicate',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'issue_comment_added',
  'issue_status_changed',
  'issue_assignee_changed',
  'issue_deleted',
]);
export const pullRequestStatusEnum = pgEnum('pull_request_status', ['open', 'merged', 'closed']);

// ─── Core tables ──────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  issue_prefix: varchar('issue_prefix', { length: 10 }).notNull().default('ISS'),
  is_personal: boolean('is_personal').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  username: text('username'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable(
  'organization_member_metadata',
  {
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.organization_id, t.user_id] }),
    index('idx_member_metadata_user').on(t.user_id),
    index('idx_member_metadata_org_role').on(t.organization_id, t.role),
  ],
);

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: varchar('color', { length: 20 }).notNull().default('0 0% 0%'),
    sort_order: integer('sort_order').notNull().default(0),
    issue_counter: integer('issue_counter').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_projects_org_name').on(t.organization_id, t.name)],
);

export const projectStatuses = pgTable('project_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  hidden: boolean('hidden').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
});

// ─── Issues ───────────────────────────────────────────────────────────────────

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    issue_number: integer('issue_number').notNull(),
    simple_id: varchar('simple_id', { length: 20 }).notNull(),
    status_id: uuid('status_id')
      .notNull()
      .references(() => projectStatuses.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    priority: issuePriorityEnum('priority'),
    start_date: timestamp('start_date', { withTimezone: true }),
    target_date: timestamp('target_date', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    sort_order: doublePrecision('sort_order').notNull().default(0),
    parent_issue_id: uuid('parent_issue_id'),
    parent_issue_sort_order: doublePrecision('parent_issue_sort_order'),
    extension_metadata: jsonb('extension_metadata').notNull().default({}),
    creator_user_id: uuid('creator_user_id').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('issues_project_issue_number_uniq').on(t.project_id, t.issue_number),
    index('idx_issues_project_id').on(t.project_id),
    index('idx_issues_status_id').on(t.status_id),
    index('idx_issues_simple_id').on(t.simple_id),
  ],
);

export const issueAssignees = pgTable('issue_assignees', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
});

export const issueFollowers = pgTable('issue_followers', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const issueTags = pgTable('issue_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  tag_id: uuid('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

export const issueRelationships = pgTable('issue_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  related_issue_id: uuid('related_issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  relationship_type: issueRelationshipTypeEnum('relationship_type').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const issueComments = pgTable('issue_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  parent_id: uuid('parent_id'),
  message: text('message').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const issueCommentReactions = pgTable('issue_comment_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  comment_id: uuid('comment_id')
    .notNull()
    .references(() => issueComments.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  owner_user_id: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  issue_id: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  local_workspace_id: uuid('local_workspace_id').unique(),
  name: text('name'),
  archived: boolean('archived').notNull().default(false),
  files_changed: integer('files_changed'),
  lines_added: integer('lines_added'),
  lines_removed: integer('lines_removed'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Pull Requests ────────────────────────────────────────────────────────────

export const pullRequests = pgTable('pull_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull().unique(),
  number: integer('number').notNull(),
  status: pullRequestStatusEnum('status').notNull().default('open'),
  merged_at: timestamp('merged_at', { withTimezone: true }),
  merge_commit_sha: varchar('merge_commit_sha', { length: 40 }),
  target_branch_name: text('target_branch_name').notNull(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  notification_type: notificationTypeEnum('notification_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  issue_id: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  comment_id: uuid('comment_id').references(() => issueComments.id, { onDelete: 'set null' }),
  seen: boolean('seen').notNull().default(false),
  dismissed_at: timestamp('dismissed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Task Events (agent event history) ───────────────────────────────────────

export const taskEvents = pgTable('task_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').notNull(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Auth tables ──────────────────────────────────────────────────────────────

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  session_secret_hash: text('session_secret_hash'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
});

export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  provider_user_id: text('provider_user_id').notNull(),
  email: text('email'),
  username: text('username'),
  display_name: text('display_name'),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const oauthHandoffs = pgTable('oauth_handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  state: text('state').notNull(),
  return_to: text('return_to').notNull(),
  app_challenge: text('app_challenge').notNull(),
  app_code_hash: text('app_code_hash'),
  status: text('status').notNull().default('pending'),
  error_code: text('error_code'),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  authorized_at: timestamp('authorized_at', { withTimezone: true }),
  redeemed_at: timestamp('redeemed_at', { withTimezone: true }),
  user_id: uuid('user_id').references(() => users.id),
  session_id: uuid('session_id').references(() => authSessions.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relay Hosts ──────────────────────────────────────────────────────────────

export const hosts = pgTable('hosts', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_user_id: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  shared_with_organization_id: uuid('shared_with_organization_id').references(
    () => organizations.id,
    { onDelete: 'set null' },
  ),
  machine_id: text('machine_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('offline'),
  last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
  agent_version: text('agent_version'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const relaySessions = pgTable('relay_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  host_id: uuid('host_id')
    .notNull()
    .references(() => hosts.id, { onDelete: 'cascade' }),
  request_user_id: uuid('request_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  state: text('state').notNull().default('requested'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  claimed_at: timestamp('claimed_at', { withTimezone: true }),
  ended_at: timestamp('ended_at', { withTimezone: true }),
});

// ─── Attachments / Blobs ──────────────────────────────────────────────────────

export const blobs = pgTable('blobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  blob_path: text('blob_path').notNull(),
  thumbnail_blob_path: text('thumbnail_blob_path'),
  original_name: text('original_name').notNull(),
  mime_type: text('mime_type'),
  size_bytes: integer('size_bytes').notNull(),
  hash: text('hash').notNull(),
  width: integer('width'),
  height: integer('height'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pendingUploads = pgTable('pending_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  uploader_user_id: uuid('uploader_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  size_bytes: integer('size_bytes').notNull(),
  hash: text('hash').notNull(),
  blob_path: text('blob_path').notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  blob_id: uuid('blob_id')
    .notNull()
    .references(() => blobs.id, { onDelete: 'cascade' }),
  issue_id: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  comment_id: uuid('comment_id').references(() => issueComments.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  owner_user_id: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  folder_path: text('folder_path'),
  worker_job_id: text('worker_job_id'),
  error_message: text('error_message'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── GitHub App ───────────────────────────────────────────────────────────────

export const githubAppInstallations = pgTable('github_app_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organization_id: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  installation_id: integer('installation_id').notNull().unique(),
  account_login: text('account_login').notNull(),
  account_type: text('account_type').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
