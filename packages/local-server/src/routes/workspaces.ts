/**
 * Workspace routes - API endpoints for workspace management.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema, UuidSchema } from '../utils/response.js';
import * as workspaceStore from '../stores/workspaces.js';
import * as sessionStore from '../stores/sessions.js';
import * as repoStore from '../stores/repos.js';
import {
  createWorktree,
  deleteWorktree,
  fetchPrBranch,
  parsePrUrl,
  getWorktreePath,
} from '../git/worktree.js';
import { startSession } from '../agent/pi-session.js';

// Helper functions
function uuidToBuffer(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bufferToUuid(buffer: Buffer): string {
  const hex = buffer.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function formatWorkspace(ws: any) {
  return {
    id: bufferToUuid(ws.id),
    taskId: ws.taskId ? bufferToUuid(ws.taskId) : null,
    containerRef: ws.containerRef,
    branch: ws.branch,
    setupCompletedAt: ws.setupCompletedAt,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
    archived: ws.archived,
    pinned: ws.pinned,
    name: ws.name,
    worktreeDeleted: ws.worktreeDeleted,
    ...(ws.isRunning !== undefined ? { isRunning: ws.isRunning, isErrored: ws.isErrored } : {}),
  };
}

// Workspace schema
const WorkspaceSchema = z.object({
  id: z.string().uuid().openapi({ description: 'Workspace ID' }),
  taskId: z.string().uuid().nullable().openapi({ description: 'Associated task ID' }),
  containerRef: z.string().nullable().openapi({ description: 'Container reference' }),
  branch: z.string().openapi({ description: 'Git branch name' }),
  setupCompletedAt: z.string().nullable().openapi({ description: 'Setup completion timestamp' }),
  createdAt: z.string().openapi({ description: 'Creation timestamp' }),
  updatedAt: z.string().openapi({ description: 'Last update timestamp' }),
  archived: z.boolean().openapi({ description: 'Whether workspace is archived' }),
  pinned: z.boolean().openapi({ description: 'Whether workspace is pinned' }),
  name: z.string().nullable().openapi({ description: 'Workspace name' }),
  worktreeDeleted: z.boolean().openapi({ description: 'Whether worktree is deleted' }),
  isRunning: z.boolean().optional().openapi({ description: 'Whether workspace has running processes' }),
  isErrored: z.boolean().optional().openapi({ description: 'Whether workspace has errors' }),
});

// Routes
const listWorkspacesRoute = createRoute({
  method: 'get',
  path: '/api/workspaces',
  tags: ['Workspaces'],
  summary: 'List workspaces',
  description: 'Get all workspaces with optional filtering',
  request: {
    query: z.object({
      archived: z.enum(['true', 'false']).optional().openapi({
        description: 'Filter by archived status',
        example: 'false',
      }),
      limit: z.string().optional().openapi({
        description: 'Maximum number of workspaces to return',
        example: '50',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.array(WorkspaceSchema)),
        },
      },
      description: 'List of workspaces',
    },
  },
});

const getWorkspaceRoute = createRoute({
  method: 'get',
  path: '/api/workspaces/{id}',
  tags: ['Workspaces'],
  summary: 'Get workspace',
  description: 'Get a single workspace by ID',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(WorkspaceSchema),
        },
      },
      description: 'Workspace details',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid workspace ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Workspace not found',
    },
  },
});

const createWorkspaceRoute = createRoute({
  method: 'post',
  path: '/api/workspaces',
  tags: ['Workspaces'],
  summary: 'Create workspace',
  description: 'Create a new workspace',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            branch: z.string().min(1).openapi({ description: 'Git branch name' }),
            name: z.string().optional().openapi({ description: 'Workspace name' }),
            taskId: z.string().uuid().optional().openapi({ description: 'Associated task ID' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(WorkspaceSchema),
        },
      },
      description: 'Created workspace',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error',
    },
  },
});

const updateWorkspaceRoute = createRoute({
  method: 'patch',
  path: '/api/workspaces/{id}',
  tags: ['Workspaces'],
  summary: 'Update workspace',
  description: 'Update workspace properties',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            archived: z.boolean().optional().openapi({ description: 'Archive status' }),
            pinned: z.boolean().optional().openapi({ description: 'Pin status' }),
            name: z.string().nullable().optional().openapi({ description: 'Workspace name' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(WorkspaceSchema),
        },
      },
      description: 'Updated workspace',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Workspace not found',
    },
  },
});

const deleteWorkspaceRoute = createRoute({
  method: 'delete',
  path: '/api/workspaces/{id}',
  tags: ['Workspaces'],
  summary: 'Delete workspace',
  description: 'Delete a workspace',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.object({ deleted: z.literal(true) })),
        },
      },
      description: 'Workspace deleted',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid workspace ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Workspace not found',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Cannot delete workspace with running processes',
    },
  },
});

// ============================================================================
// From-PR route
// ============================================================================

const fromPrRoute = createRoute({
  method: 'post',
  path: '/api/workspaces/from-pr',
  tags: ['Workspaces'],
  summary: 'Create workspace from GitHub PR',
  description: 'Fetch a PR branch, create a worktree, create a workspace, and start an agent session. Requires `gh` CLI.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            prUrl: z.string().url().openapi({ description: 'GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)' }),
            repoId: z.string().uuid().openapi({ description: 'ID of the local repo to use as the git origin' }),
            profile: z.string().optional().openapi({ description: 'Model profile for the agent session (quick/normal/pro)' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.object({
            workspace: WorkspaceSchema,
            session: z.object({ id: z.string(), workspaceId: z.string(), createdAt: z.string() }),
            worktreePath: z.string(),
            prNumber: z.number(),
            branch: z.string(),
          })),
        },
      },
      description: 'Workspace and session created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid PR URL or repo not found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Git or agent error',
    },
  },
});

// ============================================================================
// Delete worktree route
// ============================================================================

const deleteWorktreeRoute = createRoute({
  method: 'delete',
  path: '/api/workspaces/{id}/worktree',
  tags: ['Workspaces'],
  summary: 'Delete workspace worktree',
  description: 'Remove the git worktree for a workspace. Keeps the workspace DB record but marks worktreeDeleted=true.',
  request: {
    params: z.object({ id: UuidSchema }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.object({ worktreeDeleted: z.boolean(), worktreePath: z.string() })),
        },
      },
      description: 'Worktree deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Workspace not found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Git error',
    },
  },
});

export function registerWorkspaceRoutes(app: OpenAPIHono): void {
  app.openapi(listWorkspacesRoute, async (c) => {
    const { archived, limit } = c.req.valid('query');
    const archivedFilter = archived === 'true' ? true : archived === 'false' ? false : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const workspaces = await workspaceStore.findAllWithStatus(archivedFilter, limitNum);
    return c.json(success(workspaces.map(formatWorkspace)), 200);
  });

  // Register /from-pr BEFORE /:id routes to avoid param collision
  // Using app.post() directly because @hono/zod-openapi's openapi() method
  // loses the route in the router when doc() is called prior to registration.
  app.post('/api/workspaces/from-pr', async (c) => {
    let body: { prUrl: string; repoId: string; profile?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(error('Invalid JSON body'), 400);
    }

    const { prUrl, repoId, profile } = body;
    if (!prUrl || !repoId) {
      return c.json(error('prUrl and repoId are required'), 400);
    }

    let parsed: ReturnType<typeof parsePrUrl>;
    try {
      parsed = parsePrUrl(prUrl);
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : 'Invalid PR URL'), 400);
    }

    const repo = await repoStore.findById(uuidToBuffer(repoId));
    if (!repo) {
      return c.json(error('Repo not found'), 400);
    }

    const { prNumber } = parsed;
    const branchName = `pr/${prNumber}`;

    try {
      await fetchPrBranch({ repoPath: repo.path, prNumber, localBranch: branchName });
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : 'Failed to fetch PR branch'), 500);
    }

    const workspace = await workspaceStore.create({ branch: branchName, name: `PR #${prNumber}` });
    const workspaceId = bufferToUuid(workspace.id);

    // Associate the workspace with the repo so deleteWorktree can find the repo path later
    await workspaceStore.addRepoToWorkspace(workspace.id, uuidToBuffer(repoId), branchName);

    let worktreePath: string;
    try {
      worktreePath = await createWorktree({ repoPath: repo.path, workspaceId, branchName, createBranch: false });
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : 'Failed to create worktree'), 500);
    }

    const session = await sessionStore.create({ workspaceId: workspace.id });
    const sessionId = bufferToUuid(session.id);

    try {
      await startSession(sessionId, workspaceId, worktreePath, { profile });
    } catch (err: unknown) {
      console.error(`[from-pr] Warning: failed to auto-start agent: ${err instanceof Error ? err.message : err}`);
    }

    return c.json(success({ workspace: formatWorkspace(workspace), session: { id: sessionId, workspaceId, createdAt: session.createdAt }, worktreePath, prNumber, branch: branchName }));
  });

  // Also register the OpenAPI route for spec documentation (even if routing uses plain app.post above)
  app.openapi(fromPrRoute, async (c) => {
    // This handler is for OpenAPI spec documentation only - the plain post above handles actual requests
    return c.json(success({ workspace: {} as any, session: { id: '', workspaceId: '', createdAt: '' }, worktreePath: '', prNumber: 0, branch: '' }), 200);
  });

  app.openapi(getWorkspaceRoute, async (c) => {
    const { id } = c.req.valid('param');
    const workspace = await workspaceStore.findByIdWithStatus(uuidToBuffer(id));
    if (!workspace) {
      return c.json(error('Workspace not found'), 404);
    }
    return c.json(success(formatWorkspace(workspace)), 200);
  });

  app.openapi(createWorkspaceRoute, async (c) => {
    const body = c.req.valid('json');
    const workspace = await workspaceStore.create({
      branch: body.branch,
      name: body.name,
      taskId: body.taskId,
    });
    return c.json(success(formatWorkspace(workspace)), 200);
  });

  app.openapi(updateWorkspaceRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const workspace = await workspaceStore.update(uuidToBuffer(id), body);
    if (!workspace) {
      return c.json(error('Workspace not found'), 404);
    }
    return c.json(success(formatWorkspace(workspace)), 200);
  });

  app.openapi(deleteWorkspaceRoute, async (c) => {
    const { id } = c.req.valid('param');
    const idBuffer = uuidToBuffer(id);
    const hasRunning = await workspaceStore.hasRunningProcesses(idBuffer);
    if (hasRunning) {
      return c.json(error('Cannot delete workspace while processes are running'), 409);
    }
    const count = await workspaceStore.remove(idBuffer);
    if (count === 0) {
      return c.json(error('Workspace not found'), 404);
    }
    return c.json(success({ deleted: true } as const), 200);
  });

  app.openapi(deleteWorktreeRoute, async (c) => {
    const { id } = c.req.valid('param');
    const idBuffer = uuidToBuffer(id);

    const workspace = await workspaceStore.findById(idBuffer);
    if (!workspace) {
      return c.json(error('Workspace not found'), 404);
    }

    // Find the repo for this workspace to get its path
    const workspaceRepos = await workspaceStore.findReposForWorkspace(idBuffer);
    const repoPath = workspaceRepos[0]?.path ?? null;

    if (repoPath) {
      try {
        await deleteWorktree(repoPath, id);
      } catch (err: unknown) {
        return c.json(error(err instanceof Error ? err.message : 'Failed to delete worktree'), 500);
      }
    }

    // Mark worktree as deleted in DB
    await workspaceStore.updateWorktreeDeleted(idBuffer, true);

    return c.json(success({
      worktreeDeleted: true,
      worktreePath: getWorktreePath(id),
    }), 200);
  });
}