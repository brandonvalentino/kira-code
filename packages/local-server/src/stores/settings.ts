/**
 * Settings store - CRUD operations for app configuration.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { assetDir } from '../utils/assets.js';
import { z } from 'zod';

/**
 * Config file schema.
 * This matches the Rust Config struct.
 */
export const ConfigSchema = z.object({
  // Editor settings
  editor: z.enum(['vscode', 'cursor', 'zed', 'windsurf', 'none']).default('vscode'),
  editorCommand: z.string().optional(),

  // Git settings
  gitBranchPrefix: z.string().default(''),

  // Agent settings
  executorProfile: z.string().default('CLAUDE_CODE'),

  // Feature flags
  autoCreateWorktree: z.boolean().default(true),
  autoCleanupWorktrees: z.boolean().default(true),
  autoOpenEditor: z.boolean().default(true),

  // UI settings
  theme: z.enum(['light', 'dark', 'system']).default('system'),

  // Sound settings
  soundEnabled: z.boolean().default(true),

  // Analytics
  analyticsEnabled: z.boolean().default(false),

  // Onboarding
  disclaimerAcknowledged: z.boolean().default(false),
  onboardingAcknowledged: z.boolean().default(false),

  // Remote/relay settings
  relayEnabled: z.boolean().default(false),
  relayHostName: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Config = {
  editor: 'vscode',
  gitBranchPrefix: '',
  executorProfile: 'CLAUDE_CODE',
  autoCreateWorktree: true,
  autoCleanupWorktrees: true,
  autoOpenEditor: true,
  theme: 'system',
  soundEnabled: true,
  analyticsEnabled: false,
  disclaimerAcknowledged: false,
  onboardingAcknowledged: false,
  relayEnabled: false,
};

/**
 * Get the path to the config file.
 */
export function configPath(): string {
  return join(assetDir(), 'config.json');
}

/**
 * Ensure the config directory exists.
 */
async function ensureConfigDir(): Promise<void> {
  const dir = assetDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Get the current configuration.
 * Returns defaults if config file doesn't exist.
 */
export async function getConfig(): Promise<Config> {
  const path = configPath();

  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    const config = ConfigSchema.parse(parsed);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error('Failed to parse config file, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Update the configuration.
 * Merges with existing config and persists to file.
 */
export async function updateConfig(updates: Partial<Config>): Promise<Config> {
  await ensureConfigDir();

  const existing = await getConfig();
  const updated = { ...existing, ...updates };

  // Validate
  const validated = ConfigSchema.parse(updated);

  // Persist to file
  const path = configPath();
  await writeFile(path, JSON.stringify(validated, null, 2), 'utf-8');

  return validated;
}

/**
 * User system info response.
 * Matches Rust's UserSystemInfo struct.
 */
export interface UserSystemInfo {
  version: string;
  config: Config;
  analyticsUserId: string;
  loginStatus: 'logged_in' | 'logged_out';
  environment: {
    osType: string;
    osVersion: string;
    osArchitecture: string;
    bitness: string;
  };
}

/**
 * Get user system info.
 */
export async function getUserSystemInfo(): Promise<UserSystemInfo> {
  const config = await getConfig();
  const os = await import('os');
  const platform = os.platform();
  const arch = os.arch();
  const release = os.release();

  return {
    version: '0.1.0', // TODO: Get from package.json
    config,
    analyticsUserId: 'local-user', // TODO: Generate and persist a unique ID
    loginStatus: 'logged_out', // TODO: Implement auth
    environment: {
      osType: platform,
      osVersion: release,
      osArchitecture: arch,
      bitness: arch.includes('64') ? '64' : '32',
    },
  };
}