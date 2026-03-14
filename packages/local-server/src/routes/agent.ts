/**
 * Agent routes - HTTP endpoints for controlling Pi agent sessions.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema, UuidSchema } from '../utils/response.js';
import * as sessionStore from '../stores/sessions.js';
import * as workspaceStore from '../stores/workspaces.js';
import {
  startSession,
  promptSession,
  steerSession,
  abortSession,
  getActiveSession,
  getSessionFilePath,
  isSessionStreaming,
} from '../agent/pi-session.js';

// Helper functions
function uuidToBuffer(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bufferToUuid(buffer: Buffer): string {
  const hex = buffer.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

// Response schema for agent session status
const AgentSessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  isActive: z.boolean(),
  isStreaming: z.boolean(),
  sessionFile: z.string().nullable(),
});

// Routes

const startSessionRoute = createRoute({
  method: 'post',
  path: '/api/sessions/{id}/start',
  tags: ['Agent'],
  summary: 'Start agent session',
  description: 'Start a Pi agent session for the given session ID. Creates a new session or resumes an existing one.',
  request: {
    params: z.object({ id: UuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            sessionFilePath: z.string().optional().openapi({
              description: 'Path to existing session file to resume (optional)',
            }),
            profile: z.string().optional().openapi({
              description: 'Model profile name to use (e.g. quick, normal, pro). Uses default profile if omitted.',
            }),
          }),
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(AgentSessionStatusSchema) } },
      description: 'Session started',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Session or workspace not found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to start session',
    },
  },
});

const promptSessionRoute = createRoute({
  method: 'post',
  path: '/api/sessions/{id}/prompt',
  tags: ['Agent'],
  summary: 'Send prompt to agent',
  description: 'Send a prompt to the agent. If already streaming, the message is queued as a follow-up.',
  request: {
    params: z.object({ id: UuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            text: z.string().min(1).openapi({ description: 'Prompt text' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(z.object({ queued: z.boolean() })) } },
      description: 'Prompt sent or queued',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Session not active',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to send prompt',
    },
  },
});

const steerSessionRoute = createRoute({
  method: 'post',
  path: '/api/sessions/{id}/steer',
  tags: ['Agent'],
  summary: 'Steer agent mid-run',
  description: 'Send a steering message to interrupt the agent. Delivered after current tool execution, skips remaining tools.',
  request: {
    params: z.object({ id: UuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            text: z.string().min(1).openapi({ description: 'Steering message' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(z.object({ steered: z.boolean() })) } },
      description: 'Steering message sent',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Session not active',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to steer session',
    },
  },
});

const abortSessionRoute = createRoute({
  method: 'post',
  path: '/api/sessions/{id}/abort',
  tags: ['Agent'],
  summary: 'Abort agent session',
  description: 'Abort the currently running agent operation. The session remains active but stops processing.',
  request: {
    params: z.object({ id: UuidSchema }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(z.object({ aborted: z.boolean() })) } },
      description: 'Session aborted',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to abort session',
    },
  },
});

const getAgentStatusRoute = createRoute({
  method: 'get',
  path: '/api/sessions/{id}/status',
  tags: ['Agent'],
  summary: 'Get agent session status',
  description: 'Get the current status of an agent session.',
  request: {
    params: z.object({ id: UuidSchema }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(AgentSessionStatusSchema) } },
      description: 'Session status',
    },
  },
});

export function registerAgentRoutes(app: OpenAPIHono): void {
  app.openapi(startSessionRoute, async (c) => {
    const { id: sessionId } = c.req.valid('param');
    const body = await c.req.json().catch(() => ({})) as { sessionFilePath?: string; profile?: string };

    // Resolve session and workspace
    const session = await sessionStore.findById(uuidToBuffer(sessionId));
    if (!session) {
      return c.json(error('Session not found'), 400);
    }

    const workspace = await workspaceStore.findById(session.workspaceId);
    if (!workspace) {
      return c.json(error('Workspace not found'), 400);
    }

    // Resolve working directory from session or workspace
    const cwd = session.agentWorkingDir || process.cwd();
    const workspaceId = bufferToUuid(session.workspaceId);

    try {
      await startSession(sessionId, workspaceId, cwd, {
        sessionFilePath: body?.sessionFilePath,
        profile: body?.profile,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(error(`Failed to start session: ${message}`), 500);
    }

    return c.json(
      success({
        sessionId,
        isActive: true,
        isStreaming: false,
        sessionFile: getSessionFilePath(sessionId) ?? null,
      }),
      200
    );
  });

  app.openapi(promptSessionRoute, async (c) => {
    const { id: sessionId } = c.req.valid('param');
    const { text } = c.req.valid('json');

    const active = getActiveSession(sessionId);
    if (!active) {
      return c.json(error('No active agent session. Call /start first.'), 400);
    }

    const wasStreaming = isSessionStreaming(sessionId);

    try {
      await promptSession(sessionId, text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(error(`Failed to send prompt: ${message}`), 500);
    }

    return c.json(success({ queued: wasStreaming }), 200);
  });

  app.openapi(steerSessionRoute, async (c) => {
    const { id: sessionId } = c.req.valid('param');
    const { text } = c.req.valid('json');

    const active = getActiveSession(sessionId);
    if (!active) {
      return c.json(error('No active agent session.'), 400);
    }

    try {
      await steerSession(sessionId, text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(error(`Failed to steer session: ${message}`), 500);
    }

    return c.json(success({ steered: true }), 200);
  });

  app.openapi(abortSessionRoute, async (c) => {
    const { id: sessionId } = c.req.valid('param');

    try {
      await abortSession(sessionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(error(`Failed to abort session: ${message}`), 500);
    }

    return c.json(success({ aborted: true }), 200);
  });

  app.openapi(getAgentStatusRoute, async (c) => {
    const { id: sessionId } = c.req.valid('param');

    const active = getActiveSession(sessionId);

    return c.json(
      success({
        sessionId,
        isActive: active !== null,
        isStreaming: isSessionStreaming(sessionId),
        sessionFile: active ? (getSessionFilePath(sessionId) ?? null) : null,
      }),
      200
    );
  });
}
