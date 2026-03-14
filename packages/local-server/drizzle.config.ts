import { defineConfig } from 'drizzle-kit';
import { homedir } from 'os';
import { join } from 'path';

// Use the same path as the app: ~/.local/share/kira-code/db.v2.sqlite
const dbPath = process.env.KIRA_ASSET_DIR
  ? join(process.env.KIRA_ASSET_DIR, 'db.v2.sqlite')
  : join(homedir(), '.local', 'share', 'kira-code', 'db.v2.sqlite');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
});