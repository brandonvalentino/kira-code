/**
 * Session routes - API endpoints for session management.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema, UuidSchema } from '../utils/response.js';
import * as sessionStore from '../stores/sessions.js';
import * as workspaceStore from '../stores/workspaces.js';

// Helper functions
function uuidToBuffer(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bufferToUuid(buffer: Buffer): string {
  const hex = buffer.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function formatSession(session: any) {
  return {
    id: bufferToUuid(session.id),
    workspaceId: bufferToUuid(session.workspaceId),
    executor: session.executor,
    agentWorkingDir: session.agentWorkingDir,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

// Session schema
const SessionSchema = z.object({
  id: z.string().uuid().openapi({ description: 'Session ID' }),
  workspaceId: z.string().uuid().openapi({ description: 'Workspace ID' }),
  executor: z.string().nullable().openapi({ description: 'Executor type' }),
  agentWorkingDir: z.string().nullable().openapi({ description: 'Agent working directory' }),
  createdAt: z.string().openapi({ description: 'Creation timestamp' }),
  updatedAt: z.string().openapi({ description: 'Last update timestamp' }),
});

// Routes
const listSessionsRoute = createRoute({
  method: 'get',
  path: '/api/sessions',
  tags: ['Sessions'],
  summary: 'List sessions',
  description: 'Get sessions for a workspace',
  request: {
    query: z.object({
      workspaceId: UuidSchema.openapi({ description: 'Workspace ID to filter by' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.array(SessionSchema)),
        },
      },
      description: 'List of sessions',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid or missing workspaceId',
    },
  },
});

const getSessionRoute = createRoute({
  method: 'get',
  path: '/api/sessions/{id}',
  tags: ['Sessions'],
  summary: 'Get session',
  description: 'Get a single session by ID',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(SessionSchema),
        },
      },
      description: 'Session details',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid session ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Session not found',
    },
  },
});

const createSessionRoute = createRoute({
  method: 'post',
  path: '/api/sessions',
  tags: ['Sessions'],
  summary: 'Create session',
  description: 'Create a new session for a workspace',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            workspaceId: z.string().uuid().openapi({ description: 'Workspace ID' }),
            executor: z.string().optional().openapi({ description: 'Executor type' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(SessionSchema),
        },
      },
      description: 'Created session',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error or workspace not found',
    },
  },
});

export function registerSessionRoutes(app: OpenAPIHono): void {
  app.openapi(listSessionsRoute, async (c) => {
    const { workspaceId } = c.req.valid('query');
    const sessions = await sessionStore.findByWorkspaceId(uuidToBuffer(workspaceId));
    return c.json(success(sessions.map(formatSession)), 200);
  });

  app.openapi(getSessionRoute, async (c) => {
    const { id } = c.req.valid('param');
    const session = await sessionStore.findById(uuidToBuffer(id));
    if (!session) {
      return c.json(error('Session not found'), 404);
    }
    return c.json(success(formatSession(session)), 200);
  });

  app.openapi(createSessionRoute, async (c) => {
    const body = c.req.valid('json');
    const workspace = await workspaceStore.findById(uuidToBuffer(body.workspaceId));
    if (!workspace) {
      return c.json(error('Workspace not found'), 400);
    }
    const session = await sessionStore.create({
      workspaceId: uuidToBuffer(body.workspaceId),
      executor: body.executor,
    });
    return c.json(success(formatSession(session)), 200);
  });
}