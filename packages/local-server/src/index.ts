import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { registerHealthRoutes } from './routes/health.js';

const PORT = parseInt(process.env.BACKEND_PORT || '3000', 10);

// Create the app and register routes
const app = createApp();

// Register routes
registerHealthRoutes(app);

// Start the server
console.log(`Starting Kira Code server on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`Server running at http://localhost:${PORT}`);
console.log(`API documentation: http://localhost:${PORT}/scalar`);
console.log(`OpenAPI spec: http://localhost:${PORT}/doc`);