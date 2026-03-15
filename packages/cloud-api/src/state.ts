import { S3Client } from '@aws-sdk/client-s3';
import type { Db } from './db/index.js';
import { JwtService } from './auth/jwt.js';
import type { RelayServer } from './relay/server.js';

export interface AppConfig {
  /** Postgres connection string */
  databaseUrl: string;
  /** JWT HS256 secret */
  jwtSecret: string;
  /** Server listen address e.g. 0.0.0.0:8081 */
  listenAddr: string;
  /** Public base URL (used in OAuth redirects) */
  publicBaseUrl: string;
  /** Internal ElectricSQL URL */
  electricUrl: string;
  /** Shared secret for internal endpoints */
  internalSecret: string;
}

export interface AppState {
  db: Db;
  jwt: JwtService;
  config: AppConfig;
  internalSecret: string;
  electricUrl: string;
  /** S3/R2 client for attachment uploads */
  s3: S3Client | null;
  /** Separate S3/R2 client for review uploads (may use different bucket/endpoint) */
  reviewS3: S3Client | null;
  /** Relay server for WebSocket host connections */
  relayServer: RelayServer | null;
}

export function createAppState(config: AppConfig, db: Db): AppState {
  const jwt = new JwtService(config.jwtSecret);

  // S3 client for attachments
  const s3 = createS3Client(
    process.env.R2_ENDPOINT,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
  );

  // S3 client for review artifacts (may differ from attachments)
  const reviewS3 = createS3Client(
    process.env.R2_REVIEW_ENDPOINT ?? process.env.R2_ENDPOINT,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
  );

  return {
    db,
    jwt,
    config,
    internalSecret: config.internalSecret,
    electricUrl: config.electricUrl,
    s3,
    reviewS3,
    relayServer: null, // set after HTTP server is created
  };
}

function createS3Client(
  endpoint: string | undefined,
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined,
): S3Client | null {
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}
