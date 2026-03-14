/**
 * Events route - SSE endpoint for real-time event streaming.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { eventBus, type KiraEvent } from '../utils/event-bus.js';

// SSE event schema (for documentation purposes)
const SSEEventSchema = z.object({
  type: z.string().openapi({ description: 'Event type' }),
  timestamp: z.number().optional().openapi({ description: 'Event timestamp' }),
});

// SSE is a streaming endpoint, so the response schema is informational
const eventsRoute = createRoute({
  method: 'get',
  path: '/api/events',
  tags: ['Events'],
  summary: 'Event stream',
  description: 'Server-Sent Events endpoint for real-time event streaming. Returns a text/event-stream response.',
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: SSEEventSchema,
        },
      },
      description: 'SSE stream of events',
    },
  },
});

export function registerEventsRoutes(app: OpenAPIHono): void {
  app.openapi(eventsRoute, async (c) => {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ message: 'Connected to Kira Code event stream' }),
      });

      const keepAliveInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'keep-alive',
            data: JSON.stringify({ type: 'keep_alive', timestamp: Date.now() }),
          });
        } catch {
          // Stream closed
        }
      }, 30000);

      const unsubscribe = eventBus.subscribe(async (event: KiraEvent) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        } catch {
          // Stream closed
        }
      });

      try {
        await new Promise<void>((resolve) => {
          stream.onAbort(() => {
            resolve();
          });
        });
      } finally {
        clearInterval(keepAliveInterval);
        unsubscribe();
      }
    });
  });
}