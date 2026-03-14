import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Scalar } from '@scalar/hono-api-reference';

/**
 * Create and configure the Hono application.
 */
export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  // Logger middleware
  app.use(logger());

  // CORS middleware - allow localhost origins for development
  app.use(
    '*',
    cors({
      origin: (origin) => {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
        ];
        if (allowedOrigins.includes(origin)) {
          return origin;
        }
        return allowedOrigins[0];
      },
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // OpenAPI documentation endpoint
  app.doc('/doc', {
    openapi: '3.1.0',
    info: {
      title: 'Kira Code API',
      version: '1.0.0',
      description: 'Local HTTP API for Kira Code',
    },
  });

  // Scalar API reference UI at /scalar
  app.get(
    '/scalar',
    Scalar({
      url: '/doc',
      pageTitle: 'Kira Code API Reference',
      theme: 'default',
    })
  );

  return app;
}