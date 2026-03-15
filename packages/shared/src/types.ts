/**
 * Shared domain types for cloud API and local server.
 * Ported from shared/remote-types.ts (was Rust-generated, now hand-written TS).
 */

export type JsonValue =
  | number
  | string
  | boolean
  | Array<JsonValue>
  | { [key in string]?: JsonValue }
  | null;

// ─── Core Entities ────────────────────────────────────────────────────────────

export type Organization = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
};

export type UserData = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

export type MemberRole = 'admin' | 'member';

export type OrganizationMember = {
  organization_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  last_seen_at: string | null;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  hidden: boolean;
  created_at: string;
};

export type Tag = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

// ─── Issues ───────────────────────────────────────────────────────────────────

export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low';

export type Issue = {
  id: string;
  project_id: string;
  issue_number: number;
  simple_id: string;
  status_id: string;
  title: string;
  description: string | null;
  priority: IssuePriority | null;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  sort_order: number;
  parent_issue_id: string | null;
  parent_issue_sort_order: number | null;
  extension_metadata: JsonValue;
  creator_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IssueAssignee = {
  id: string;
  issue_id: string;
  user_id: string;
  assigned_at: string;
};

export type IssueFollower = {
  id: string;
  issue_id: string;
  user_id: string;
};

export type IssueTag = {
  id: string;
  issue_id: string;
  tag_id: string;
};

export type IssueRelationshipType = 'blocking' | 'related' | 'has_duplicate';

export type IssueRelationship = {
  id: string;
  issue_id: string;
  related_issue_id: string;
  relationship_type: IssueRelationshipType;
  created_at: string;
};

export type IssueComment = {
  id: string;
  issue_id: string;
  author_id: string | null;
  parent_id: string | null;
  message: string;
  created_at: string;
  updated_at: string;
};

export type IssueCommentReaction = {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

// ─── Workspaces ───────────────────────────────────────────────────────────────

export type Workspace = {
  id: string;
  project_id: string;
  owner_user_id: string;
  issue_id: string | null;
  local_workspace_id: string | null;
  name: string | null;
  archived: boolean;
  files_changed: number | null;
  lines_added: number | null;
  lines_removed: number | null;
  created_at: string;
  updated_at: string;
};

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'IssueCommentAdded'
  | 'IssueStatusChanged'
  | 'IssueAssigneeChanged'
  | 'IssueDeleted';

export type Notification = {
  id: string;
  organization_id: string;
  user_id: string;
  notification_type: NotificationType;
  payload: JsonValue;
  issue_id: string | null;
  comment_id: string | null;
  seen: boolean;
  dismissed_at: string | null;
  created_at: string;
};

// ─── Pull Requests ────────────────────────────────────────────────────────────

export type PullRequestStatus = 'open' | 'merged' | 'closed';

export type PullRequest = {
  id: string;
  url: string;
  number: number;
  status: PullRequestStatus;
  merged_at: string | null;
  merge_commit_sha: string | null;
  target_branch_name: string;
  issue_id: string;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Attachments ─────────────────────────────────────────────────────────────

export type Blob = {
  id: string;
  project_id: string;
  blob_path: string;
  thumbnail_blob_path: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  hash: string;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  blob_id: string;
  issue_id: string | null;
  comment_id: string | null;
  created_at: string;
  expires_at: string | null;
};

export type AttachmentWithBlob = Attachment & {
  blob_path: string;
  thumbnail_blob_path: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  hash: string;
  width: number | null;
  height: number | null;
};

// ─── Relay Hosts ──────────────────────────────────────────────────────────────

export type RelayHost = {
  id: string;
  owner_user_id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
  agent_version: string | null;
  created_at: string;
  updated_at: string;
  access_role: string;
};

export type ListRelayHostsResponse = {
  hosts: RelayHost[];
};

export type RelaySession = {
  id: string;
  host_id: string;
  request_user_id: string;
  state: string;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  ended_at: string | null;
};

export type CreateRelaySessionResponse = {
  session: RelaySession;
};

export type RelaySessionAuthCodeResponse = {
  session_id: string;
  code: string;
};

// ─── Request/Response types ───────────────────────────────────────────────────

export type CreateProjectRequest = {
  id?: string;
  organization_id: string;
  name: string;
  color: string;
};

export type UpdateProjectRequest = {
  name?: string | null;
  color?: string | null;
  sort_order?: number | null;
};

export type CreateTagRequest = {
  id?: string;
  project_id: string;
  name: string;
  color: string;
};

export type UpdateTagRequest = {
  name?: string | null;
  color?: string | null;
};

export type CreateProjectStatusRequest = {
  id?: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  hidden: boolean;
};

export type UpdateProjectStatusRequest = {
  name?: string | null;
  color?: string | null;
  sort_order?: number | null;
  hidden?: boolean | null;
};

export type CreateIssueRequest = {
  id?: string;
  project_id: string;
  status_id: string;
  title: string;
  description: string | null;
  priority: IssuePriority | null;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  sort_order: number;
  parent_issue_id: string | null;
  parent_issue_sort_order: number | null;
  extension_metadata: JsonValue;
};

export type UpdateIssueRequest = {
  status_id?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: IssuePriority | null;
  start_date?: string | null;
  target_date?: string | null;
  completed_at?: string | null;
  sort_order?: number | null;
  parent_issue_id?: string | null;
  parent_issue_sort_order?: number | null;
  extension_metadata?: JsonValue | null;
};

export type CreateIssueAssigneeRequest = { id?: string; issue_id: string; user_id: string };
export type CreateIssueFollowerRequest = { id?: string; issue_id: string; user_id: string };
export type CreateIssueTagRequest = { id?: string; issue_id: string; tag_id: string };
export type CreateIssueRelationshipRequest = {
  id?: string;
  issue_id: string;
  related_issue_id: string;
  relationship_type: IssueRelationshipType;
};

export type CreateIssueCommentRequest = {
  id?: string;
  issue_id: string;
  message: string;
  parent_id: string | null;
};

export type UpdateIssueCommentRequest = {
  message?: string | null;
  parent_id?: string | null;
};

export type CreateIssueCommentReactionRequest = {
  id?: string;
  comment_id: string;
  emoji: string;
};

export type UpdateNotificationRequest = {
  seen?: boolean | null;
};

export type InitUploadRequest = {
  project_id: string;
  filename: string;
  size_bytes: number;
  hash: string;
};

export type InitUploadResponse = {
  upload_url: string;
  upload_id: string;
  expires_at: string;
  skip_upload: boolean;
  existing_blob_id: string | null;
};

export type ConfirmUploadRequest = {
  project_id: string;
  upload_id: string;
  filename: string;
  content_type?: string;
  size_bytes: number;
  hash: string;
  issue_id?: string;
  comment_id?: string;
};

export type CommitAttachmentsRequest = { attachment_ids: string[] };
export type CommitAttachmentsResponse = { attachments: AttachmentWithBlob[] };
export type AttachmentUrlResponse = { url: string };

// ─── Task Events ──────────────────────────────────────────────────────────────

export type TaskEventKind =
  | 'agent_started'
  | 'agent_stopped'
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export type TaskEvent = {
  id: string;
  task_id: string;
  kind: TaskEventKind;
  payload: JsonValue;
  created_at: string;
};

// ─── LiteLLM Token ────────────────────────────────────────────────────────────

export type LlmTokenResponse = {
  proxy_key: string;
  proxy_url: string;
  expires_at: string;
};
