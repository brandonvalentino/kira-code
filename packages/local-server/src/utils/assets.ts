import { homedir } from 'os';
import { join } from 'path';

/**
 * Get the asset directory for Kira Code.
 * In development, uses ~/.local/share/kira-code
 * In production, could be configured via environment variable.
 */
export function assetDir(): string {
  const override = process.env.KIRA_ASSET_DIR;
  if (override) {
    return override;
  }

  const home = homedir();
  return join(home, '.local', 'share', 'kira-code');
}

/**
 * Get the database path.
 */
export function dbPath(): string {
  return join(assetDir(), 'db.v2.sqlite');
}