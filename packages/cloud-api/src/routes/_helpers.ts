/**
 * Shared helpers for CRUD routes.
 */
import { eq, and } from 'drizzle-orm';
import type { AppState } from '../state.js';
import { organizationMembers, projects, issues } from '../db/schema.js';

export async function getOrgForProject(state: AppState, projectId: string) {
  return state.db
    .select({ organization_id: projects.organization_id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
    .then((r) => r[0]?.organization_id);
}

export async function getOrgForIssue(state: AppState, issueId: string) {
  const row = await state.db
    .select({ project_id: issues.project_id })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return undefined;
  return getOrgForProject(state, row.project_id);
}

export async function isMember(state: AppState, userId: string, orgId: string) {
  const m = await state.db
    .select({ organization_id: organizationMembers.organization_id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organization_id, orgId),
        eq(organizationMembers.user_id, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  return !!m;
}

export async function assertProjectMember(
  state: AppState,
  userId: string,
  projectId: string,
): Promise<string | null> {
  const orgId = await getOrgForProject(state, projectId);
  if (!orgId) return null;
  const ok = await isMember(state, userId, orgId);
  return ok ? orgId : null;
}

export async function assertIssueMember(
  state: AppState,
  userId: string,
  issueId: string,
): Promise<boolean> {
  const orgId = await getOrgForIssue(state, issueId);
  if (!orgId) return false;
  return isMember(state, userId, orgId);
}
