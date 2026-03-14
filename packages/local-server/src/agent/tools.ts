/**
 * Kira custom tools for the Pi agent.
 * These tools allow the agent to interact with the Kira task management system.
 */
import { Type, type Static } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { eventBus } from '../utils/event-bus.js';
import { getDb, workspaces } from '../db/index.js';
import { eq } from 'drizzle-orm';

// ============================================================================
// updateTaskStatus
// ============================================================================

const updateTaskStatusParams = Type.Object({
  workspaceId: Type.String({ description: 'The workspace ID to update' }),
  status: Type.String({
    description:
      'New status. Use one of: in_progress, completed, blocked, needs_review, interrupted',
  }),
  message: Type.Optional(
    Type.String({ description: 'Optional message explaining the status change' })
  ),
});

/**
 * updateTaskStatus tool - updates the status of the current workspace/task.
 * The agent calls this to signal progress: "in_progress", "completed", "blocked", etc.
 */
export const updateTaskStatusTool: ToolDefinition<typeof updateTaskStatusParams> = {
  name: 'updateTaskStatus',
  label: 'Update Task Status',
  description:
    'Update the status of the current task/workspace. Use this to signal task progress to the user.',
  promptSnippet: 'Update task status (in_progress, completed, blocked, needs_review, interrupted)',
  parameters: updateTaskStatusParams,
  execute: async (_toolCallId, params: Static<typeof updateTaskStatusParams>, _signal, _onUpdate, _ctx) => {
    const { workspaceId, status, message } = params;

    // Touch the workspace updated_at so clients know something changed
    const db = getDb();
    try {
      await db
        .update(workspaces)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(workspaces.id, Buffer.from(workspaceId.replace(/-/g, ''), 'hex')));
    } catch {
      // Workspace may not exist if workspaceId is invalid - continue anyway
    }

    // Broadcast event to SSE clients
    eventBus.broadcast({ type: 'workspace_updated', workspaceId });

    const resultText = message
      ? `Task status updated to '${status}': ${message}`
      : `Task status updated to '${status}'`;

    return {
      content: [{ type: 'text' as const, text: resultText }],
      details: { workspaceId, status, message },
    };
  },
};

// ============================================================================
// requestHumanReview
// ============================================================================

const requestHumanReviewParams = Type.Object({
  sessionId: Type.String({ description: 'The session ID requesting review' }),
  message: Type.String({
    description:
      'Explain what you have done and what you need the human to review or decide',
  }),
});

/**
 * requestHumanReview tool - pauses and requests a human to review the work.
 * Broadcasts a review_requested event so the frontend can notify the user.
 */
export const requestHumanReviewTool: ToolDefinition<typeof requestHumanReviewParams> = {
  name: 'requestHumanReview',
  label: 'Request Human Review',
  description:
    'Request a human to review the current state of work. Use this when you need feedback, approval, or when you are unsure how to proceed.',
  promptSnippet: 'Request human review with a message explaining what needs review',
  parameters: requestHumanReviewParams,
  execute: async (_toolCallId, params: Static<typeof requestHumanReviewParams>, _signal, _onUpdate, _ctx) => {
    const { sessionId, message } = params;

    // Broadcast review request event to SSE clients
    eventBus.broadcast({ type: 'review_requested', sessionId, message });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Human review requested. The user has been notified and will respond via the steering interface.\n\nYour message: ${message}`,
        },
      ],
      details: { sessionId, message },
    };
  },
};

// ============================================================================
// logToKanban
// ============================================================================

const logToKanbanParams = Type.Object({
  sessionId: Type.String({ description: 'The session ID creating this log entry' }),
  message: Type.String({ description: 'The message to log to the activity feed' }),
  level: Type.Optional(
    Type.Union(
      [
        Type.Literal('info'),
        Type.Literal('warning'),
        Type.Literal('error'),
        Type.Literal('success'),
      ],
      { description: 'Log level (default: info)' }
    )
  ),
});

/**
 * logToKanban tool - adds a log entry to the task activity feed.
 * The agent uses this to communicate progress and decisions.
 */
export const logToKanbanTool: ToolDefinition<typeof logToKanbanParams> = {
  name: 'logToKanban',
  label: 'Log to Kanban',
  description:
    'Add a log entry to the task activity feed. Use this to communicate progress, decisions, or findings to the user in real time.',
  promptSnippet: 'Log a message to the Kanban board activity feed',
  parameters: logToKanbanParams,
  execute: async (_toolCallId, params: Static<typeof logToKanbanParams>, _signal, _onUpdate, _ctx) => {
    const { sessionId, message, level = 'info' } = params;

    // Broadcast as an agent event via event bus so frontend can display it
    eventBus.broadcast({
      type: 'agent_event',
      sessionId,
      event: {
        type: 'message_end',
        message: {
          role: 'user',
          content: [{ type: 'text', text: `[${level.toUpperCase()}] ${message}` }],
          timestamp: Date.now(),
        },
      },
    });

    return {
      content: [{ type: 'text' as const, text: `Logged [${level}]: ${message}` }],
      details: { sessionId, message, level },
    };
  },
};

/**
 * All Kira custom tools.
 * Cast to the base ToolDefinition type for use with createAgentSession.
 */
export const kiraTools: ToolDefinition[] = [
  updateTaskStatusTool as unknown as ToolDefinition,
  requestHumanReviewTool as unknown as ToolDefinition,
  logToKanbanTool as unknown as ToolDefinition,
];
