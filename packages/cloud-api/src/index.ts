import { serve } from '@hono/node-server';
import { createDb, runMigrations } from './db/index.js';
import { createAppState } from './state.js';
import { createApp } from './server.js';
import { RelayServer } from './relay/server.js';
import { createTaskEventWebSocketServer } from './routes/internal/events.js';

async function main() {
  const databaseUrl =
    process.env.SERVER_DATABASE_URL ??
    'postgres://remote:remote@localhost:5433/remote';

  const jwtSecret = process.env.KIRACODE_REMOTE_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('KIRACODE_REMOTE_JWT_SECRET environment variable is required');
  }

  const listenAddr = process.env.SERVER_LISTEN_ADDR ?? '0.0.0.0:8081';
  const [host, portStr] = listenAddr.split(':');
  const port = parseInt(portStr ?? '8081', 10);

  console.log('[cloud-api] Connecting to database...');
  const db = createDb(databaseUrl);

  console.log('[cloud-api] Running migrations...');
  await runMigrations(databaseUrl);

  const config = {
    databaseUrl,
    jwtSecret,
    listenAddr,
    publicBaseUrl: process.env.SERVER_PUBLIC_BASE_URL ?? 'http://localhost:3000',
    electricUrl: process.env.ELECTRIC_URL ?? 'http://localhost:3001',
    internalSecret: process.env.KIRA_INTERNAL_SECRET ?? 'changeme',
  };

  const state = createAppState(config, db);
  const app = createApp(state);

  // Start HTTP server
  const server = serve(
    { fetch: app.fetch, hostname: host, port },
    (info) => {
      console.log(`[cloud-api] Server listening on http://${info.address}:${info.port}`);
    },
  );

  // Attach relay server for WebSocket host connections
  const relayServer = new RelayServer(db, state.jwt);
  // @ts-expect-error — serve returns Node HTTP server
  relayServer.attachToServer(server);
  state.relayServer = relayServer;

  // Attach task event WebSocket server
  // @ts-expect-error — serve returns Node HTTP server
  createTaskEventWebSocketServer(state, server);

  console.log('[cloud-api] Ready');
}

main().catch((err) => {
  console.error('[cloud-api] Fatal error:', err);
  process.exit(1);
});
