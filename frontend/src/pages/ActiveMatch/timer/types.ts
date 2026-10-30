/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/types.ts
 *
 * Core TypeScript definitions for the Winner Stays Timer Engine.
 * Self-contained, pure, and additive.
 */

export type TimerPhase = 'GOAL_BUFFER' | 'PLAYING' | 'TIME_EXPIRED';

export type TimerStatus = 'RUNNING' | 'PAUSED' | 'IDLE';

export type UrgencyLevel = 'NORMAL' | 'WARNING_30' | 'URGENT_10' | 'EXPIRED';

/** Alias for backward compatibility across modules */
export type TimerWarningLevel = UrgencyLevel;

export interface TimerStateSnapshot {
  phase: TimerPhase;
  status: TimerStatus;
  remainingMs: number;
  phaseDurationMs: number;
  lastGoalEventId: string | null;
}

export interface TimerState {
  /** Current phase of the timer */
  phase: TimerPhase;
  /** Operational status: RUNNING, PAUSED, or IDLE */
  status: TimerStatus;
  /** Authoritative target epoch ms when the current running phase will expire; null if paused or idle */
  deadline: number | null;
  /** Remaining milliseconds in the current phase */
  remainingMs: number;
  /** Total nominal duration of the current phase in ms (60,000 for GOAL_BUFFER, 600,000 for PLAYING) */
  phaseDurationMs: number;
  /** Event ID of the most recently processed goal (used for strict idempotency & double-tap protection) */
  lastGoalEventId: string | null;
  /** Monotonically increasing revision counter for realtime broadcast and state synchronization */
  version: number;
  /** Epoch timestamp (ms) of the most recent state mutation */
  updatedAt: number;
  /** Optional snapshot of the state immediately prior to the latest goal transition (for goal undo rollback) */
  previousState?: TimerStateSnapshot | null;
}

export interface RefereeSettings {
  /** Procedural Web Audio API whistle playback */
  soundEnabled: boolean;
  /** Vibration API haptic pulses on supported devices */
  vibrationEnabled: boolean;
  /** Screen Wake Lock API to prevent display sleep during match */
  wakeLockEnabled: boolean;
}

export type TimerAction =
  | { type: 'START'; now?: number }
  | { type: 'PAUSE'; now?: number }
  | { type: 'RESET'; now?: number }
  | { type: 'SKIP_BUFFER'; now?: number }
  | { type: 'GOAL_SCORED'; goalEventId: string; now?: number }
  | { type: 'TICK'; now?: number }
  | { type: 'ROLLBACK_GOAL'; undoneGoalEventId: string; now?: number }
  | { type: 'SYNC'; state: TimerState };

export interface PhaseExpiryResult {
  /** The updated state following phase expiration check */
  nextState: TimerState;
  /** The phase that expired in this transition, or null if no expiry occurred */
  expiredPhase: TimerPhase | null;
}

export type SenderRole = 'admin' | 'player' | 'anonymous';

export type TimerSyncMessageType =
  | 'TIMER_STATE_BROADCAST'
  | 'TIMER_REQUEST_SYNC'
  | 'TIMER_SYNC';

export interface TimerBroadcastPayload {
  /** Unique match session ID */
  sessionId: string;
  /** Authoritative or synchronized TimerState */
  state: TimerState;
  /** Role of the broadcasting user ('admin' | 'player' | 'anonymous') */
  senderRole: SenderRole;
  /** User ID or profile UUID of the sender */
  senderId: string;
  /** Epoch timestamp (ms) on the sender's device when broadcast was created */
  hostTimestamp: number;
  /** Monotonically increasing revision version counter */
  version: number;
}

export interface TimerRequestSyncPayload {
  /** Target match session ID */
  sessionId: string;
  /** Identifier of the requesting client */
  requesterId: string;
  /** Role of the requester */
  requesterRole: SenderRole;
  /** Epoch timestamp (ms) when sync request was sent */
  timestamp: number;
}

export type TimerSyncPayload = TimerBroadcastPayload;

