/**
 * Event bus - Simple EventEmitter for real-time events.
 * Used to broadcast events from agent execution to SSE clients.
 */
import { EventEmitter } from 'events';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';

/**
 * Event types that can be broadcast.
 */
export type KiraEvent =
  | { type: 'workspace_created'; workspaceId: string }
  | { type: 'workspace_updated'; workspaceId: string }
  | { type: 'workspace_deleted'; workspaceId: string }
  | { type: 'session_created'; sessionId: string; workspaceId: string }
  | { type: 'execution_started'; executionId: string; sessionId: string }
  | { type: 'execution_completed'; executionId: string; sessionId: string }
  | { type: 'execution_failed'; executionId: string; sessionId: string }
  | { type: 'agent_event'; sessionId: string; event: AgentSessionEvent }
  | { type: 'review_requested'; sessionId: string; message: string }
  | { type: 'keep_alive' };

/**
 * Global event bus instance.
 */
class KiraEventBus extends EventEmitter {
  private static instance: KiraEventBus;

  private constructor() {
    super();
    // Increase max listeners for many SSE clients
    this.setMaxListeners(100);
  }

  static getInstance(): KiraEventBus {
    if (!KiraEventBus.instance) {
      KiraEventBus.instance = new KiraEventBus();
    }
    return KiraEventBus.instance;
  }

  /**
   * Broadcast an event to all listeners.
   */
  broadcast(event: KiraEvent): void {
    this.emit('event', event);
  }

  /**
   * Subscribe to all events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (event: KiraEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}

export const eventBus = KiraEventBus.getInstance();