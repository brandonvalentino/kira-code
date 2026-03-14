/**
 * Pi Session Manager - wraps the Pi SDK AgentSession for use in the local server.
 * Manages active sessions keyed by session ID and forwards agent events to the event bus.
 */
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createCodingTools,
  type AgentSession,
} from '@mariozechner/pi-coding-agent';
import { eventBus } from '../utils/event-bus.js';
import { kiraTools } from './tools.js';
import { getApiKeyForProvider, getLiteLLMBaseUrl } from '../auth/litellm.js';
import { getProfile, getDefaultProfile } from '../stores/model-profiles.js';

/**
 * Information about an active Pi session.
 */
export interface ActiveSession {
  session: AgentSession;
  workspaceId: string;
  cwd: string;
  unsubscribe: () => void;
}

/**
 * Map of session ID -> active Pi session.
 */
const activeSessions = new Map<string, ActiveSession>();

/**
 * Start a new Pi agent session for the given DB session ID.
 *
 * @param sessionId The session ID (UUID from local DB)
 * @param workspaceId The workspace ID (for event broadcasting)
 * @param cwd The working directory for the agent
 * @param options.sessionFilePath Optional path to an existing session file to resume
 * @param options.profile Optional profile name to select model (e.g. "quick", "normal", "pro")
 */
export async function startSession(
  sessionId: string,
  workspaceId: string,
  cwd: string,
  options: { sessionFilePath?: string; profile?: string } = {}
): Promise<void> {
  const { sessionFilePath, profile: profileName } = options;

  // Abort and clean up any existing session with this ID
  await stopSession(sessionId);

  // Set up auth storage. Support multiple auth methods:
  // 1. LiteLLM proxy virtual keys
  // 2. Anthropic OAuth token (from env)
  // 3. Pi SDK's built-in credential resolution (auth.json, env vars)
  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);

  // Check for LiteLLM proxy first
  const liteLLMBaseUrl = getLiteLLMBaseUrl();
  if (liteLLMBaseUrl) {
    const key = await getApiKeyForProvider('anthropic');
    if (key) {
      authStorage.setRuntimeApiKey('anthropic', key);
    }
  }

  // Check for Anthropic OAuth token (alternative to API key)
  const oauthToken = process.env.ANTHROPIC_OAUTH_TOKEN;
  if (oauthToken) {
    authStorage.setRuntimeApiKey('anthropic', oauthToken);
  }

  // Resolve model from profile using the model registry
  // (modelRegistry.find() works for any provider/model including custom ones)
  const profileData = profileName
    ? await getProfile(profileName)
    : await getDefaultProfile();

  let resolvedModel: Awaited<ReturnType<typeof modelRegistry.getAvailable>>[number] | undefined;
  let resolvedThinkingLevel: string | undefined;

  if (profileData) {
    const m = modelRegistry.find(profileData.provider, profileData.modelId);
    if (m) {
      resolvedModel = m;
      resolvedThinkingLevel = profileData.thinkingLevel ?? 'off';
    }
  }

  // Choose session manager: resume from file or start fresh
  const sessionManager = sessionFilePath
    ? SessionManager.open(sessionFilePath)
    : SessionManager.create(cwd);

  // Build settings
  const settingsManager = SettingsManager.create(cwd);

  const { session } = await createAgentSession({
    cwd,
    ...(resolvedModel ? { model: resolvedModel } : {}),
    ...(resolvedThinkingLevel !== undefined ? { thinkingLevel: resolvedThinkingLevel as any } : {}),
    tools: createCodingTools(cwd),
    customTools: kiraTools,
    authStorage,
    modelRegistry,
    sessionManager,
    settingsManager,
  });

  // Subscribe to agent events and forward them to the event bus
  const unsubscribe = session.subscribe((event) => {
    eventBus.broadcast({ type: 'agent_event', sessionId, event });
  });

  activeSessions.set(sessionId, { session, workspaceId, cwd, unsubscribe });
}

/**
 * Send an initial prompt to start the agent running.
 *
 * @param sessionId The session ID
 * @param text The prompt text
 */
export async function promptSession(sessionId: string, text: string): Promise<void> {
  const active = activeSessions.get(sessionId);
  if (!active) {
    throw new Error(`No active session for sessionId: ${sessionId}`);
  }

  if (active.session.isStreaming) {
    // Queue as a follow-up if already streaming
    await active.session.followUp(text);
  } else {
    await active.session.prompt(text);
  }
}

/**
 * Steer the agent mid-run.
 *
 * @param sessionId The session ID
 * @param text The steering message
 */
export async function steerSession(sessionId: string, text: string): Promise<void> {
  const active = activeSessions.get(sessionId);
  if (!active) {
    throw new Error(`No active session for sessionId: ${sessionId}`);
  }

  await active.session.steer(text);
}

/**
 * Abort the current agent run.
 *
 * @param sessionId The session ID
 */
export async function abortSession(sessionId: string): Promise<void> {
  const active = activeSessions.get(sessionId);
  if (!active) {
    return; // Nothing to abort
  }

  await active.session.abort();
}

/**
 * Stop and clean up a session entirely (remove from active map).
 *
 * @param sessionId The session ID
 */
export async function stopSession(sessionId: string): Promise<void> {
  const active = activeSessions.get(sessionId);
  if (!active) {
    return;
  }

  try {
    await active.session.abort();
    active.session.dispose();
  } catch {
    // Ignore errors during cleanup
  }

  active.unsubscribe();
  activeSessions.delete(sessionId);
}

/**
 * Resume a session from an existing session file.
 *
 * @param sessionId The session ID
 * @param workspaceId The workspace ID
 * @param cwd The working directory
 * @param sessionFilePath Path to the existing session JSONL file
 */
export async function resumeSession(
  sessionId: string,
  workspaceId: string,
  cwd: string,
  sessionFilePath: string,
  profile?: string
): Promise<void> {
  await startSession(sessionId, workspaceId, cwd, { sessionFilePath, profile });
}

/**
 * Get the active session info for a session ID.
 * Returns null if no session is active.
 */
export function getActiveSession(sessionId: string): ActiveSession | null {
  return activeSessions.get(sessionId) ?? null;
}

/**
 * Get the session file path for an active session.
 * Returns undefined if session is not active or uses in-memory storage.
 */
export function getSessionFilePath(sessionId: string): string | undefined {
  const active = activeSessions.get(sessionId);
  return active?.session.sessionFile;
}

/**
 * Check whether a session is currently streaming.
 */
export function isSessionStreaming(sessionId: string): boolean {
  const active = activeSessions.get(sessionId);
  return active?.session.isStreaming ?? false;
}
