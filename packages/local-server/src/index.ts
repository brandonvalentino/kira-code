import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { initDb } from './db/index.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerWorkspaceRoutes } from './routes/workspaces.js';
import { registerRepoRoutes } from './routes/repos.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerEventsRoutes } from './routes/events.js';
import { registerAgentRoutes } from './routes/agent.js';
import { registerModelProfileRoutes } from './routes/model-profiles.js';

const PORT = parseInt(process.env.BACKEND_PORT || '3000', 10);

// Initialize database
console.log('Initializing database...');
initDb();

// Create the app and register routes
const app = createApp();

// Register routes
registerHealthRoutes(app);
registerWorkspaceRoutes(app);
registerRepoRoutes(app);
registerSessionRoutes(app);
registerConfigRoutes(app);
registerEventsRoutes(app);
registerAgentRoutes(app);
registerModelProfileRoutes(app);

// Start the server
console.log(`Starting Kira Code server on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`Server running at http://localhost:${PORT}`);
console.log(`API documentation: http://localhost:${PORT}/scalar`);
console.log(`OpenAPI spec: http://localhost:${PORT}/doc`);