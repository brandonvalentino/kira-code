/**
 * Model profiles store - named presets that map to specific models and thinking levels.
 *
 * Profiles let users pick a speed/quality tradeoff by name (e.g. "quick", "normal", "pro")
 * instead of specifying a provider and model ID directly.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { assetDir } from '../utils/assets.js';

// ============================================================================
// Schema
// ============================================================================

export const ThinkingLevelSchema = z
  .enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh'])
  .openapi({ description: 'Thinking/reasoning level' });

export const ModelProfileSchema = z.object({
  name: z.string().min(1).openapi({ description: 'Profile name (e.g. quick, normal, pro)' }),
  provider: z.string().min(1).openapi({ description: 'LLM provider (e.g. anthropic, google, openai)' }),
  modelId: z.string().min(1).openapi({ description: 'Model ID within the provider' }),
  thinkingLevel: ThinkingLevelSchema.optional().openapi({ description: 'Thinking level (default: off)' }),
  description: z.string().optional().openapi({ description: 'Optional description shown in UI' }),
});

export type ModelProfile = z.infer<typeof ModelProfileSchema>;

const ModelProfilesFileSchema = z.object({
  profiles: z.array(ModelProfileSchema),
  defaultProfile: z.string().optional(),
});

type ModelProfilesFile = z.infer<typeof ModelProfilesFileSchema>;

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_PROFILES: ModelProfile[] = [
  {
    name: 'quick',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5',
    thinkingLevel: 'off',
    description: 'Fast and cost-effective for simple tasks',
  },
  {
    name: 'normal',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    thinkingLevel: 'off',
    description: 'Balanced speed and capability',
  },
  {
    name: 'pro',
    provider: 'anthropic',
    modelId: 'claude-opus-4-5',
    thinkingLevel: 'medium',
    description: 'Most capable, best for complex tasks',
  },
];

const DEFAULT_FILE: ModelProfilesFile = {
  profiles: DEFAULT_PROFILES,
  defaultProfile: 'normal',
};

// ============================================================================
// Storage
// ============================================================================

function profilesPath(): string {
  return join(assetDir(), 'model-profiles.json');
}

async function ensureDir(): Promise<void> {
  const dir = assetDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function readFile_(): Promise<ModelProfilesFile> {
  const path = profilesPath();
  if (!existsSync(path)) {
    return { ...DEFAULT_FILE, profiles: [...DEFAULT_PROFILES] };
  }
  try {
    const content = await readFile(path, 'utf-8');
    return ModelProfilesFileSchema.parse(JSON.parse(content));
  } catch {
    return { ...DEFAULT_FILE, profiles: [...DEFAULT_PROFILES] };
  }
}

async function writeFile_(data: ModelProfilesFile): Promise<void> {
  await ensureDir();
  await writeFile(profilesPath(), JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List all profiles.
 */
export async function listProfiles(): Promise<ModelProfile[]> {
  const data = await readFile_();
  return data.profiles;
}

/**
 * Get a profile by name. Returns null if not found.
 */
export async function getProfile(name: string): Promise<ModelProfile | null> {
  const data = await readFile_();
  return data.profiles.find((p) => p.name === name) ?? null;
}

/**
 * Get the default profile name.
 */
export async function getDefaultProfileName(): Promise<string | null> {
  const data = await readFile_();
  return data.defaultProfile ?? null;
}

/**
 * Get the default profile. Falls back to the first profile if default name not found.
 */
export async function getDefaultProfile(): Promise<ModelProfile | null> {
  const data = await readFile_();
  const name = data.defaultProfile;
  if (name) {
    const found = data.profiles.find((p) => p.name === name);
    if (found) return found;
  }
  return data.profiles[0] ?? null;
}

/**
 * Create a new profile.
 * Throws if a profile with the same name already exists.
 */
export async function createProfile(profile: ModelProfile): Promise<ModelProfile> {
  const data = await readFile_();
  if (data.profiles.find((p) => p.name === profile.name)) {
    throw new Error(`Profile '${profile.name}' already exists`);
  }
  data.profiles.push(profile);
  await writeFile_(data);
  return profile;
}

/**
 * Update an existing profile by name.
 * Throws if the profile does not exist.
 */
export async function updateProfile(
  name: string,
  updates: Partial<Omit<ModelProfile, 'name'>>
): Promise<ModelProfile> {
  const data = await readFile_();
  const idx = data.profiles.findIndex((p) => p.name === name);
  if (idx === -1) throw new Error(`Profile '${name}' not found`);
  data.profiles[idx] = { ...data.profiles[idx], ...updates };
  await writeFile_(data);
  return data.profiles[idx];
}

/**
 * Delete a profile by name.
 * Throws if the profile does not exist.
 */
export async function deleteProfile(name: string): Promise<void> {
  const data = await readFile_();
  const idx = data.profiles.findIndex((p) => p.name === name);
  if (idx === -1) throw new Error(`Profile '${name}' not found`);
  data.profiles.splice(idx, 1);
  // Clear default if it was pointing to this profile
  if (data.defaultProfile === name) {
    data.defaultProfile = data.profiles[0]?.name;
  }
  await writeFile_(data);
}

/**
 * Set the default profile name.
 * Throws if the named profile does not exist.
 */
export async function setDefaultProfile(name: string): Promise<void> {
  const data = await readFile_();
  if (!data.profiles.find((p) => p.name === name)) {
    throw new Error(`Profile '${name}' not found`);
  }
  data.defaultProfile = name;
  await writeFile_(data);
}
