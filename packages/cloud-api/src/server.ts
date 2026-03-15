import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppState } from './state.js';
import { proxyShape, assertOrgMember, assertProjectAccess } from './proxy/electric.js';

import { organizationsRouter } from './routes/organizations.js';
import { projectsRouter } from './routes/projects.js';
import { issuesRouter } from './routes/issues.js';
import { issueCommentsRouter } from './routes/issue-comments.js';
import { issueAssigneesRouter } from './routes/issue-assignees.js';
import { issueTagsRouter } from './routes/issue-tags.js';
import { tagsRouter } from './routes/tags.js';
import { projectStatusesRouter } from './routes/project-statuses.js';
import { organizationMembersRouter } from './routes/organization-members.js';
import { notificationsRouter } from './routes/notifications.js';
import { pullRequestsRouter } from './routes/pull-requests.js';
import { issueRelationshipsRouter } from './routes/issue-relationships.js';
import { issueFollowersRouter } from './routes/issue-followers.js';
import { issueCommentReactionsRouter } from './routes/issue-comment-reactions.js';
import { workspacesRouter } from './routes/workspaces.js';
import { identityRouter } from './routes/identity.js';
import { oauthPublicRouter, oauthProtectedRouter } from './routes/oauth.js';
import { hostsRouter } from './routes/hosts.js';
import { reviewRouter } from './routes/review.js';
import { githubAppPublicRouter, githubAppProtectedRouter } from './routes/github-app.js';
import { attachmentsRouter } from './routes/attachments.js';
import { migrationRouter } from './routes/migration.js';
import { tokensRouter } from './routes/tokens.js';
import { internalEventsRouter } from './routes/internal/events.js';
import { requireSession } from './auth/middleware.js';

export function createApp(state: AppState) {
  const app = new Hono();

  // ─── Global middleware ──────────────────────────────────────────────────────
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['X-Request-Id'],
    }),
  );

  // ─── Health ─────────────────────────────────────────────────────────────────
  app.get('/v1/health', (c) => c.json({ status: 'ok' }));

  // ─── Public OAuth & token routes ────────────────────────────────────────────
  app.route('/v1/oauth', oauthPublicRouter(state));
  app.route('/v1', oauthProtectedRouter(state));

  // ─── GitHub App public (webhook + install callback) ─────────────────────────
  app.route('/v1/github', githubAppPublicRouter(state));

  // ─── Protected API routes ───────────────────────────────────────────────────
  app.route('/v1/identity', identityRouter(state));
  app.route('/v1/organizations', organizationsRouter(state));
  app.route('/v1/projects', projectsRouter(state));
  app.route('/v1/issues', issuesRouter(state));
  app.route('/v1/issue_comments', issueCommentsRouter(state));
  app.route('/v1/issue_assignees', issueAssigneesRouter(state));
  app.route('/v1/issue_tags', issueTagsRouter(state));
  app.route('/v1/tags', tagsRouter(state));
  app.route('/v1/project_statuses', projectStatusesRouter(state));
  app.route('/v1/organization_members', organizationMembersRouter(state));
  app.route('/v1/notifications', notificationsRouter(state));
  app.route('/v1/pull_requests', pullRequestsRouter(state));
  app.route('/v1/issue_relationships', issueRelationshipsRouter(state));
  app.route('/v1/issue_followers', issueFollowersRouter(state));
  app.route('/v1/issue_comment_reactions', issueCommentReactionsRouter(state));
  app.route('/v1/workspaces', workspacesRouter(state));
  app.route('/v1/hosts', hostsRouter(state));
  app.route('/v1/review', reviewRouter(state));
  app.route('/v1/migration', migrationRouter(state));
  app.route('/v1/attachments', attachmentsRouter(state));
  app.route('/v1/user', tokensRouter(state));

  // ─── GitHub App protected routes ────────────────────────────────────────────
  app.route('/v1', githubAppProtectedRouter(state));

  // ─── Internal routes (secret auth) ──────────────────────────────────────────
  app.route('/v1/internal/tasks', internalEventsRouter(state));

  // ─── ElectricSQL shape proxy ─────────────────────────────────────────────────
  const auth = requireSession(state.jwt, state.db);

  // Shape proxy: /v1/shape/:table_name
  app.get('/v1/shape/:table', auth, async (c) => {
    const user = c.var.user;
    const table = c.req.param('table');
    const orgId = c.req.query('organization_id');
    const projectId = c.req.query('project_id');

    // Require org/project membership for scoped shapes
    if (orgId) {
      try {
        await assertOrgMember(state.db, user, orgId);
      } catch {
        return c.json({ error: 'Forbidden' }, 403);
      }
    } else if (projectId) {
      try {
        await assertProjectAccess(state.db, user, projectId);
      } catch {
        return c.json({ error: 'Forbidden' }, 403);
      }
    }

    let whereClause: string | undefined;
    let whereParams: string[] | undefined;

    if (orgId) {
      whereClause = '"organization_id" = $1';
      whereParams = [orgId];
    } else if (projectId) {
      whereClause = '"project_id" = $1';
      whereParams = [projectId];
    }

    const response = await proxyShape(c, {
      electricUrl: state.electricUrl,
      table,
      whereClause,
      whereParams,
    });

    return response;
  });

  // ─── 404 fallback ────────────────────────────────────────────────────────────
  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    console.error('[server error]', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
