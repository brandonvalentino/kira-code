import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';

// Health response schema
const HealthResponseSchema = z.object({
  status: z.literal('ok').openapi({
    example: 'ok',
    description: 'Health status',
  }),
});

// Health check route
export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Check if the server is running',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'Server is healthy',
    },
  },
});

/**
 * Register health check routes on the app.
 */
export function registerHealthRoutes(app: OpenAPIHono): void {
  app.openapi(healthRoute, (c) => {
    return c.json({
      status: 'ok' as const,
    });
  });
}