import { defineConfig } from 'drizzle-kit';
import { assetDir } from './src/utils/assets.js';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: `${assetDir()}/db.v2.sqlite`,
  },
});