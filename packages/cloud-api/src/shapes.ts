/**
 * ElectricSQL shape definitions for cloud-api.
 * Each shape maps to a PostgreSQL table that electric syncs.
 */

export interface ShapeDefinition {
  /** PostgreSQL table name */
  table: string;
  /** Query parameters required to scope the shape */
  params: readonly string[];
  /** Route path for the authenticated shape proxy */
  path: string;
}

export const SHAPES = {
  organizations: {
    table: 'organizations',
    params: [] as const,
    path: '/v1/shape/organizations',
  },
  projects: {
    table: 'projects',
    params: ['organization_id'] as const,
    path: '/v1/shape/projects',
  },
  issues: {
    table: 'issues',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/issues',
  },
  issue_comments: {
    table: 'issue_comments',
    params: ['issue_id'] as const,
    path: '/v1/shape/issue/:issue_id/comments',
  },
  issue_assignees: {
    table: 'issue_assignees',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/issue_assignees',
  },
  issue_tags: {
    table: 'issue_tags',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/issue_tags',
  },
  tags: {
    table: 'tags',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/tags',
  },
  project_statuses: {
    table: 'project_statuses',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/project_statuses',
  },
  organization_members: {
    table: 'organization_member_metadata',
    params: ['organization_id'] as const,
    path: '/v1/shape/organization_members',
  },
  notifications: {
    table: 'notifications',
    params: ['organization_id', 'user_id'] as const,
    path: '/v1/shape/notifications',
  },
  pull_requests: {
    table: 'pull_requests',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/pull_requests',
  },
  issue_relationships: {
    table: 'issue_relationships',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/issue_relationships',
  },
  issue_followers: {
    table: 'issue_followers',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/issue_followers',
  },
  issue_comment_reactions: {
    table: 'issue_comment_reactions',
    params: ['issue_id'] as const,
    path: '/v1/shape/issue/:issue_id/reactions',
  },
  attachments: {
    table: 'attachments',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/attachments',
  },
  workspaces: {
    table: 'workspaces',
    params: ['project_id'] as const,
    path: '/v1/shape/project/:project_id/workspaces',
  },
} satisfies Record<string, ShapeDefinition>;

export type ShapeName = keyof typeof SHAPES;
