/**
 * Internal event ingestion endpoint.
 * Authenticated via shared secret (KIRA_INTERNAL_SECRET), not user JWT.
 * Receives task events from the local server and:
 *   1. Persists them in the task_events table
 *   2. Fan-outs to any WebSocket subscribers (remote-web clients watching that task)
 */
import { Hono } from 'hono';
import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { z } from 'zod';
import type { AppState } from '../../state.js';
import { requireInternal } from '../../auth/middleware.js';
import { insertTaskEvent, getTaskEvents } from '../../stores/task-events.js';

const IngestEventSchema = z.object({
  kind: z.string(),
  payload: z.unknown().default({}),
});

/** Map from task_id -> set of connected WebSocket subscribers */
const taskSubscribers = new Map<string, Set<WebSocket>>();

export function internalEventsRouter(state: AppState) {
  const app = new Hono();
  const authInternal = requireInternal(state.internalSecret);

  /**
   * POST /v1/internal/tasks/:id/events
   * Ingest a single task event and fan-out to subscribers.
   */
  app.post('/:task_id/events', authInternal, async (c) => {
    const taskId = c.req.param('task_id');
    const data = IngestEventSchema.parse(await c.req.json());

    const event = await insertTaskEvent(state.db, {
      task_id: taskId,
      kind: data.kind,
      payload: data.payload as import('@kira/shared').JsonValue,
    });

    // Fan-out to WebSocket subscribers
    const subscribers = taskSubscribers.get(taskId);
    if (subscribers && subscribers.size > 0) {
      const msg = JSON.stringify({ type: 'task_event', event });
      for (const ws of subscribers) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }

    return c.json({ event_id: event.id });
  });

  /**
   * GET /v1/internal/tasks/:id/events
   * Retrieve all persisted events for a task.
   */
  app.get('/:task_id/events', authInternal, async (c) => {
    const taskId = c.req.param('task_id');
    const events = await getTaskEvents(state.db, taskId);
    return c.json({ events });
  });

  return app;
}

/**
 * WebSocket server for remote-web clients to subscribe to task events.
 * Attached to the HTTP server on the /ws/tasks/:task_id path.
 */
export function createTaskEventWebSocketServer(state: AppState, httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws/tasks/')) return;

    // Verify JWT from ?token= query param (WS can't set headers easily from browser)
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      state.jwt.verifyAccessToken(token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const taskId = url.pathname.replace('/ws/tasks/', '').split('/')[0];

    wss.handleUpgrade(req, socket, head, (ws) => {
      // Subscribe
      if (!taskSubscribers.has(taskId)) {
        taskSubscribers.set(taskId, new Set());
      }
      taskSubscribers.get(taskId)!.add(ws);

      // Send historical events
      void getTaskEvents(state.db, taskId).then((events) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'history', events }));
        }
      });

      ws.on('close', () => {
        taskSubscribers.get(taskId)?.delete(ws);
        if (taskSubscribers.get(taskId)?.size === 0) {
          taskSubscribers.delete(taskId);
        }
      });
    });
  });

  return wss;
}
