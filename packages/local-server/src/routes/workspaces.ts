/**
 * Workspace routes - API endpoints for workspace management.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema, UuidSchema } from '../utils/response.js';
import * as workspaceStore from '../stores/workspaces.js';

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

export function registerWorkspaceRoutes(app: OpenAPIHono): void {
  app.openapi(listWorkspacesRoute, async (c) => {
    const { archived, limit } = c.req.valid('query');
    const archivedFilter = archived === 'true' ? true : archived === 'false' ? false : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const workspaces = await workspaceStore.findAllWithStatus(archivedFilter, limitNum);
    return c.json(success(workspaces.map(formatWorkspace)), 200);
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
}