/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/timerSync.ts
 *
 * Realtime Synchronization & Admin Authority for Winner Stays Match Clock.
 * Ephemeral Supabase Realtime Broadcast channel: `match-timer:${sessionId}`.
 *
 * CRITICAL ARCHITECTURAL DIRECTIVES:
 * - 100% ADDITIVE & REACTIVE
 * - ZERO database schema alterations or database writes
 * - Ephemeral WebSocket broadcast communication only
 * - Monotonic version conflict resolution
 * - Strict Admin Authority gating (`senderRole === 'admin'`)
 * - Sub-100ms clock skew compensation
 */

import { supabase } from '../../../lib/supabase';
import type {
  TimerState,
  TimerBroadcastPayload,
  TimerRequestSyncPayload,
  SenderRole,
} from './types';
import { isValidTimerState } from './timerStorage';

export const TIMER_CHANNEL_PREFIX = 'match-timer:';

/**
 * Generates the dedicated Realtime Broadcast channel name for a match session.
 */
export function getTimerChannelName(sessionId: string): string {
  return `${TIMER_CHANNEL_PREFIX}${sessionId}`;
}

export interface BroadcastValidationResult {
  valid: boolean;
  reason?:
    | 'INVALID_PAYLOAD'
    | 'UNAUTHORIZED_SENDER'
    | 'SESSION_MISMATCH'
    | 'STALE_VERSION'
    | 'INVALID_VERSION'
    | 'INVALID_STATE';
  adjustedState: TimerState | null;
  /** Alias for adjustedState for ergonomic access */
  state: TimerState | null;
  /** Computed clock skew (hostTimestamp - receiveTimestamp) in ms */
  skew: number;
}

/**
 * Creates an authoritative broadcast payload from a TimerState.
 */
export function createTimerBroadcastPayload(
  state: TimerState,
  sessionId: string,
  profile?: { id?: string; role?: string } | null,
  now?: number
): TimerBroadcastPayload {
  const currentNow = now ?? Date.now();
  const senderRole: SenderRole =
    profile?.role === 'admin'
      ? 'admin'
      : profile?.role === 'player'
      ? 'player'
      : 'anonymous';
  const senderId = profile?.id ?? 'anonymous';

  return {
    sessionId,
    state: { ...state },
    senderRole,
    senderId,
    hostTimestamp: currentNow,
    version: state.version,
  };
}

/**
 * Validates an incoming broadcast payload against current state and authority rules.
 *
 * Rules:
 * 1. Rejects malformed payloads.
 * 2. Rejects non-admin senders (senderRole !== 'admin').
 * 3. Rejects mismatched session IDs (if expectedSessionId provided).
 * 4. Rejects stale or equal versions (payload.version <= currentState.version).
 * 5. Computes clock skew: skew = payload.hostTimestamp - receiveTimestamp.
 * 6. Adjusts deadline: adjustedDeadline = payload.state.deadline ? payload.state.deadline - skew : null.
 */
export function validateBroadcastPayload(
  payload: unknown,
  currentState?: TimerState | null,
  now?: number,
  expectedSessionId?: string
): BroadcastValidationResult {
  const receiveTimestamp = now ?? Date.now();

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {
      valid: false,
      reason: 'INVALID_PAYLOAD',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  const p = payload as Record<string, unknown>;

  // 1. Role enforcement: Sender MUST be authoritative admin
  if (p.senderRole !== 'admin') {
    return {
      valid: false,
      reason: 'UNAUTHORIZED_SENDER',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  // 2. Session isolation
  if (typeof p.sessionId !== 'string' || !p.sessionId) {
    return {
      valid: false,
      reason: 'INVALID_PAYLOAD',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  if (expectedSessionId && p.sessionId !== expectedSessionId) {
    return {
      valid: false,
      reason: 'SESSION_MISMATCH',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  // 3. Version validation
  if (typeof p.version !== 'number' || !Number.isFinite(p.version)) {
    return {
      valid: false,
      reason: 'INVALID_VERSION',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  if (currentState && p.version <= currentState.version) {
    return {
      valid: false,
      reason: 'STALE_VERSION',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  // 4. State validation
  if (!isValidTimerState(p.state)) {
    return {
      valid: false,
      reason: 'INVALID_STATE',
      adjustedState: null,
      state: null,
      skew: 0,
    };
  }

  const rawState = p.state as TimerState;

  // 5. Host timestamp & clock skew computation
  const hostTimestamp =
    typeof p.hostTimestamp === 'number' && Number.isFinite(p.hostTimestamp)
      ? p.hostTimestamp
      : receiveTimestamp;

  const skew = hostTimestamp - receiveTimestamp;

  // 6. Deadline adjustment for clock skew
  const adjustedDeadline =
    rawState.deadline !== null ? rawState.deadline - skew : null;

  // Adjust remainingMs if running
  let adjustedRemainingMs = rawState.remainingMs;
  if (rawState.status === 'RUNNING' && adjustedDeadline !== null) {
    adjustedRemainingMs = Math.min(
      rawState.phaseDurationMs,
      Math.max(0, adjustedDeadline - receiveTimestamp)
    );
  }

  const adjustedState: TimerState = {
    ...rawState,
    deadline: adjustedDeadline,
    remainingMs: adjustedRemainingMs,
  };

  return {
    valid: true,
    adjustedState,
    state: adjustedState,
    skew,
  };
}

export interface SetupTimerRealtimeSyncOptions {
  /** Target match session ID */
  sessionId: string;
  /** True if the active user is an administrator with mutation authority */
  isAdmin: boolean;
  /** User profile object containing id and role */
  profile?: { id?: string; role?: string } | null;
  /** Callback returning latest local state (for admin responding to sync requests) */
  getCurrentState?: () => TimerState;
  /** Callback invoked when a valid, higher-version sync arrives */
  onSyncReceived?: (state: TimerState, payload: TimerBroadcastPayload) => void;
  /** Optional dependency injection for Supabase client (defaults to singleton) */
  supabaseClient?: any;
  /** Optional clock provider (defaults to Date.now) */
  now?: () => number;
}

export interface TimerRealtimeSyncHandle {
  /** Broadcasts authoritative state to all peers (admin only) */
  broadcastState: (state: TimerState) => Promise<boolean>;
  /** Dispatches TIMER_REQUEST_SYNC handshake to request current state */
  requestSync: () => Promise<boolean>;
  /** Unsubscribes and cleans up channel */
  cleanup: () => void;
  /** Underlying Realtime channel instance */
  channel: any;
}

/**
 * Sets up Supabase Realtime synchronization over dedicated broadcast channel `match-timer:${sessionId}`.
 *
 * Architecture:
 * - Subscribes to TIMER_STATE_BROADCAST, TIMER_REQUEST_SYNC, TIMER_SYNC.
 * - Non-admin automatically dispatches TIMER_REQUEST_SYNC on mount.
 * - Admin responds to TIMER_REQUEST_SYNC with TIMER_SYNC payload.
 * - Monotonic versioning guarantees higher versions always win; stale versions rejected.
 */
export function setupTimerRealtimeSync({
  sessionId,
  isAdmin,
  profile,
  getCurrentState,
  onSyncReceived,
  supabaseClient = supabase,
  now = Date.now,
}: SetupTimerRealtimeSyncOptions): TimerRealtimeSyncHandle {
  if (!sessionId) {
    return {
      broadcastState: async () => false,
      requestSync: async () => false,
      cleanup: () => {},
      channel: null,
    };
  }

  const channelName = getTimerChannelName(sessionId);
  const channel = supabaseClient.channel(channelName, {
    config: {
      broadcast: { ack: true, self: false },
    },
  });

  let latestSyncedState: TimerState | null = null;

  const handleStateBroadcast = (rawPayload: unknown) => {
    const current = getCurrentState?.() ?? latestSyncedState;
    const validation = validateBroadcastPayload(
      rawPayload,
      current,
      now(),
      sessionId
    );

    if (!validation.valid || !validation.adjustedState) {
      return;
    }

    latestSyncedState = validation.adjustedState;
    onSyncReceived?.(validation.adjustedState, rawPayload as TimerBroadcastPayload);
  };

  const handleRequestSyncMessage = async (rawPayload: unknown) => {
    // Only authoritative admin responds to sync handshake
    if (!isAdmin) return;

    if (
      typeof rawPayload === 'object' &&
      rawPayload !== null &&
      'sessionId' in rawPayload &&
      (rawPayload as any).sessionId !== sessionId
    ) {
      return;
    }

    const currentState = getCurrentState?.();
    if (!currentState) return;

    const syncPayload = createTimerBroadcastPayload(
      currentState,
      sessionId,
      profile,
      now()
    );

    try {
      await channel.send({
        type: 'broadcast',
        event: 'TIMER_SYNC',
        payload: syncPayload,
      });
    } catch (err) {
      console.warn('[TimerSync] Failed to respond to TIMER_REQUEST_SYNC:', err);
    }
  };

  // 1. Listen for broadcast state updates
  channel.on(
    'broadcast',
    { event: 'TIMER_STATE_BROADCAST' },
    (envelope: any) => {
      const raw = envelope?.payload ?? envelope;
      handleStateBroadcast(raw);
    }
  );

  // 2. Listen for sync handshake responses
  channel.on(
    'broadcast',
    { event: 'TIMER_SYNC' },
    (envelope: any) => {
      const raw = envelope?.payload ?? envelope;
      handleStateBroadcast(raw);
    }
  );

  // 3. Listen for sync requests from peers
  channel.on(
    'broadcast',
    { event: 'TIMER_REQUEST_SYNC' },
    (envelope: any) => {
      const raw = envelope?.payload ?? envelope;
      handleRequestSyncMessage(raw);
    }
  );

  /**
   * Broadcasts a new timer state to all connected peers.
   * Gated strictly by admin authority.
   */
  const broadcastState = async (state: TimerState): Promise<boolean> => {
    if (!isAdmin) {
      return false;
    }

    try {
      const payload = createTimerBroadcastPayload(
        state,
        sessionId,
        profile,
        now()
      );

      const res = await channel.send({
        type: 'broadcast',
        event: 'TIMER_STATE_BROADCAST',
        payload,
      });

      return (res as any) === 'ok' || (res as any)?.status === 'ok';
    } catch (err) {
      console.warn('[TimerSync] Failed to broadcast TIMER_STATE_BROADCAST:', err);
      return false;
    }
  };

  /**
   * Dispatches a handshake request for latest authoritative state.
   */
  const requestSync = async (): Promise<boolean> => {
    try {
      const reqPayload: TimerRequestSyncPayload = {
        sessionId,
        requesterId: profile?.id ?? 'anonymous',
        requesterRole:
          profile?.role === 'admin'
            ? 'admin'
            : profile?.role === 'player'
            ? 'player'
            : 'anonymous',
        timestamp: now(),
      };

      const res = await channel.send({
        type: 'broadcast',
        event: 'TIMER_REQUEST_SYNC',
        payload: reqPayload,
      });

      return (res as any) === 'ok' || (res as any)?.status === 'ok';
    } catch (err) {
      console.warn('[TimerSync] Failed to send TIMER_REQUEST_SYNC:', err);
      return false;
    }
  };

  // Subscribe channel and request sync on subscription
  try {
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' && !isAdmin) {
        requestSync().catch(() => {});
      }
    });
  } catch (err) {
    console.warn('[TimerSync] Subscription registration warning:', err);
  }

  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try {
      supabaseClient.removeChannel(channel);
    } catch (err) {
      console.warn('[TimerSync] Error during channel removal:', err);
    }
  };

  return {
    broadcastState,
    requestSync,
    cleanup,
    channel,
  };
}

/**
 * Standalone convenience helper for broadcasting state.
 */
export async function broadcastTimerState(
  sessionId: string,
  state: TimerState,
  profile?: { id?: string; role?: string } | null,
  client = supabase
): Promise<boolean> {
  const channel = client.channel(getTimerChannelName(sessionId));
  const payload = createTimerBroadcastPayload(state, sessionId, profile);
  try {
    const res = await channel.send({
      type: 'broadcast',
      event: 'TIMER_STATE_BROADCAST',
      payload,
    });
    return (res as any) === 'ok' || (res as any)?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Standalone convenience helper for subscribing to timer sync broadcasts.
 */
export function subscribeToTimerSync(
  sessionId: string,
  onSync: (state: TimerState) => void,
  client = supabase
): () => void {
  const sync = setupTimerRealtimeSync({
    sessionId,
    isAdmin: false,
    onSyncReceived: onSync,
    supabaseClient: client,
  });
  return sync.cleanup;
}
