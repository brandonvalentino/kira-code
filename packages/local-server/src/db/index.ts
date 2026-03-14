/**
 * Database connection using libSQL.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { assetDir } from '../utils/assets.js';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import * as schema from './schema.js';

let db: LibSQLDatabase<typeof schema> | null = null;
let client: Client | null = null;

/**
 * Get the database directory path.
 */
export function dbDir(): string {
  return assetDir();
}

/**
 * Get the database file path.
 */
export function dbPath(): string {
  return join(dbDir(), 'db.v2.sqlite');
}

/**
 * Ensure the database directory exists.
 */
function ensureDbDir(): void {
  const dir = dbDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Initialize the database connection.
 * Creates the database directory if it doesn't exist.
 */
export function initDb(): LibSQLDatabase<typeof schema> {
  if (db) {
    return db;
  }

  ensureDbDir();

  const path = dbPath();
  client = createClient({
    url: `file:${path}`,
  });

  db = drizzle(client, { schema });

  return db;
}

/**
 * Get the database instance.
 * Throws if the database hasn't been initialized.
 */
export function getDb(): LibSQLDatabase<typeof schema> {
  if (!db) {
    return initDb();
  }
  return db;
}

/**
 * Get the raw libSQL client.
 * Useful for running raw SQL queries.
 */
export function getRawClient(): Client {
  if (!client) {
    initDb();
  }
  return client!;
}

/**
 * Execute a raw SQL query.
 */
export async function executeSql(query: string, params?: unknown[]) {
  const rawClient = getRawClient();
  if (params && params.length > 0) {
    return rawClient.execute({ sql: query, args: params as any[] });
  }
  return rawClient.execute(query);
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  if (client) {
    client.close();
    client = null;
    db = null;
  }
}

// Re-export schema types
export * from './schema.js';