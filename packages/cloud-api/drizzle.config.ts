import { defineConfig } from 'drizzle-kit';

const dbUrl =
  process.env.SERVER_DATABASE_URL ??
  'postgres://remote:remote@localhost:5433/remote';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
  },
});
