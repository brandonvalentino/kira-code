/**
 * LiteLLM proxy integration.
 * Provides virtual key resolution and proxy configuration for Pi SDK.
 */
import { getVirtualKey } from './virtual-keys.js';

/**
 * LiteLLM proxy configuration read from environment.
 */
export interface LiteLLMConfig {
  url: string;
  apiKey: string;
}

/**
 * Get LiteLLM proxy config from environment variables.
 * Returns null if not configured.
 */
export function getLiteLLMConfig(): LiteLLMConfig | null {
  const url = process.env.LITELLM_URL;
  const apiKey = process.env.LITELLM_API_KEY;

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

/**
 * Check whether LiteLLM proxy is configured.
 */
export function isLiteLLMAvailable(): boolean {
  return getLiteLLMConfig() !== null;
}

/**
 * Get an API key for a given provider.
 * Returns the LiteLLM virtual key string if proxy is configured and a virtual key exists.
 * Returns null to let Pi SDK fall back to stored credentials.
 *
 * @param _provider Provider name (e.g. 'anthropic') - unused for LiteLLM proxy
 */
export async function getApiKeyForProvider(_provider: string): Promise<string | null> {
  const config = getLiteLLMConfig();
  if (!config) {
    return null;
  }

  const vk = await getVirtualKey();
  if (!vk) {
    return null;
  }

  return vk.key;
}

/**
 * Get the LiteLLM proxy base URL for use as an API base override.
 * Returns null if proxy is not configured.
 */
export function getLiteLLMBaseUrl(): string | null {
  const config = getLiteLLMConfig();
  return config ? config.url : null;
}
