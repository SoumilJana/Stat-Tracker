/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/timerEngine.ts
 *
 * Pure, side-effect-free state transition engine for the Winner Stays Match Clock.
 * Mathematical model based on authoritative timestamps for drift-free background tabs.
 */

import type {
  TimerPhase,
  TimerState,
  TimerAction,
  PhaseExpiryResult,
  UrgencyLevel,
  TimerStateSnapshot,
  RefereeSettings,
} from './types';

export const PLAYING_DURATION_MS = 10 * 60 * 1000; // 600,000 ms (10 minutes)
export const GOAL_BUFFER_DURATION_MS = 60 * 1000;  // 60,000 ms (60 seconds)
export const BUFFER_DURATION_MS = GOAL_BUFFER_DURATION_MS; // Alias for compatibility

export const DEFAULT_REFEREE_SETTINGS: RefereeSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  wakeLockEnabled: false,
};

/**
 * Creates the clean initial state for a Winner Stays match.
 * Initializes to PLAYING at 10:00 in IDLE status (awaits referee start).
 */
export function createInitialTimerState(now?: number): TimerState {
  const currentNow = now ?? Date.now();
  return {
    phase: 'PLAYING',
    status: 'IDLE',
    deadline: null,
    remainingMs: PLAYING_DURATION_MS,
    phaseDurationMs: PLAYING_DURATION_MS,
    lastGoalEventId: null,
    version: 1,
    updatedAt: currentNow,
    previousState: null,
  };
}

/**
 * Calculates accurate drift-free remaining milliseconds.
 * Clamps result between 0 and phaseDurationMs.
 */
export function calculateRemainingMs(state: TimerState, now?: number): number {
  if (state.phase === 'TIME_EXPIRED') {
    return 0;
  }

  if (state.status === 'RUNNING') {
    if (state.deadline === null) {
      return Math.min(state.phaseDurationMs, Math.max(0, state.remainingMs));
    }
    const currentNow = now ?? Date.now();
    return Math.min(state.phaseDurationMs, Math.max(0, state.deadline - currentNow));
  }

  return Math.min(state.phaseDurationMs, Math.max(0, state.remainingMs));
}

/**
 * Starts or resumes the current timer phase.
 * Calculates deadline = now + remainingMs.
 * Safe no-op if already running or if time expired.
 */
export function startTimer(state: TimerState, now?: number): TimerState {
  if (state.status === 'RUNNING' || state.phase === 'TIME_EXPIRED') {
    return state;
  }

  const effectiveRemaining = state.remainingMs <= 0 ? state.phaseDurationMs : state.remainingMs;

  if (effectiveRemaining <= 0) {
    return state;
  }

  const currentNow = now ?? Date.now();

  return {
    ...state,
    status: 'RUNNING',
    deadline: currentNow + effectiveRemaining,
    remainingMs: effectiveRemaining,
    version: state.version + 1,
    updatedAt: currentNow,
  };
}

/**
 * Pauses an active timer, freezing remainingMs and clearing the deadline.
 * Safe no-op if not running.
 */
export function pauseTimer(state: TimerState, now?: number): TimerState {
  if (state.status !== 'RUNNING') {
    return state;
  }

  const currentNow = now ?? Date.now();
  const remainingMs = calculateRemainingMs(state, currentNow);

  return {
    ...state,
    status: 'PAUSED',
    deadline: null,
    remainingMs,
    version: state.version + 1,
    updatedAt: currentNow,
  };
}

/**
 * Resets the current timer phase to its nominal duration in IDLE status.
 * Preserves phase (GOAL_BUFFER resets to 60s, PLAYING or TIME_EXPIRED resets to 10m).
 */
export function resetTimer(state: TimerState, now?: number): TimerState {
  const currentNow = now ?? Date.now();
  const isBuffer = state.phase === 'GOAL_BUFFER';
  const duration = isBuffer ? GOAL_BUFFER_DURATION_MS : PLAYING_DURATION_MS;

  return {
    ...state,
    phase: isBuffer ? 'GOAL_BUFFER' : 'PLAYING',
    status: 'IDLE',
    deadline: null,
    remainingMs: duration,
    phaseDurationMs: duration,
    version: state.version + 1,
    updatedAt: currentNow,
  };
}

/**
 * Handles a newly recorded goal event.
 * Transitions timer into automatically RUNNING 60-second GOAL_BUFFER.
 * Implements strict idempotency using goalEventId to protect against double taps.
 * Snapshots previous state to enable undo rollback.
 */
export function handleGoalRecorded(state: TimerState, goalEventId: string, now?: number): TimerState {
  if (!goalEventId || state.lastGoalEventId === goalEventId) {
    return state;
  }

  const currentNow = now ?? Date.now();
  const currentRemaining = calculateRemainingMs(state, currentNow);

  const snapshot: TimerStateSnapshot = {
    phase: state.phase,
    status: state.status,
    remainingMs: currentRemaining,
    phaseDurationMs: state.phaseDurationMs,
    lastGoalEventId: state.lastGoalEventId,
  };

  return {
    ...state,
    phase: 'GOAL_BUFFER',
    status: 'RUNNING',
    deadline: currentNow + GOAL_BUFFER_DURATION_MS,
    remainingMs: GOAL_BUFFER_DURATION_MS,
    phaseDurationMs: GOAL_BUFFER_DURATION_MS,
    lastGoalEventId: goalEventId,
    previousState: snapshot,
    version: state.version + 1,
    updatedAt: currentNow,
  };
}

/**
 * Skips the remainder of the 60s GOAL_BUFFER and immediately starts the 10:00 PLAYING countdown.
 * Safe no-op if not in GOAL_BUFFER phase.
 */
export function skipBuffer(state: TimerState, now?: number): TimerState {
  if (state.phase !== 'GOAL_BUFFER') {
    return state;
  }

  const currentNow = now ?? Date.now();

  return {
    ...state,
    phase: 'PLAYING',
    status: 'RUNNING',
    deadline: currentNow + PLAYING_DURATION_MS,
    remainingMs: PLAYING_DURATION_MS,
    phaseDurationMs: PLAYING_DURATION_MS,
    version: state.version + 1,
    updatedAt: currentNow,
  };
}

/**
 * Checks if the active running phase has expired at timestamp `now`.
 * Dual-phase transitions:
 * - When GOAL_BUFFER expires -> automatically transitions to PLAYING countdown (10:00, RUNNING).
 * - If asleep through both buffer and match countdown -> transitions to TIME_EXPIRED.
 * - When PLAYING expires -> transitions to TIME_EXPIRED (00:00, IDLE).
 * Returns { nextState, expiredPhase } to notify caller for sound/haptic triggers.
 */
export function checkPhaseExpiry(state: TimerState, now?: number): PhaseExpiryResult {
  if (state.status !== 'RUNNING' || state.deadline === null) {
    return { nextState: state, expiredPhase: null };
  }

  const currentNow = now ?? Date.now();

  // Phase not yet expired
  if (currentNow < state.deadline) {
    const remaining = calculateRemainingMs(state, currentNow);
    if (remaining !== state.remainingMs) {
      return {
        nextState: { ...state, remainingMs: remaining },
        expiredPhase: null,
      };
    }
    return { nextState: state, expiredPhase: null };
  }

  // Phase has expired (currentNow >= deadline)
  if (state.phase === 'GOAL_BUFFER') {
    const bufferDeadline = state.deadline;
    const playingDeadline = bufferDeadline + PLAYING_DURATION_MS;

    if (currentNow < playingDeadline) {
      // Buffer expired, playing phase currently running
      const remainingMs = Math.max(0, playingDeadline - currentNow);
      return {
        nextState: {
          ...state,
          phase: 'PLAYING',
          phaseDurationMs: PLAYING_DURATION_MS,
          status: 'RUNNING',
          deadline: playingDeadline,
          remainingMs,
          version: state.version + 1,
          updatedAt: currentNow,
        },
        expiredPhase: 'GOAL_BUFFER',
      };
    } else {
      // Both buffer and playing countdown expired while asleep
      return {
        nextState: {
          ...state,
          phase: 'TIME_EXPIRED',
          phaseDurationMs: PLAYING_DURATION_MS,
          status: 'IDLE',
          deadline: null,
          remainingMs: 0,
          version: state.version + 2,
          updatedAt: currentNow,
        },
        expiredPhase: 'GOAL_BUFFER',
      };
    }
  }

  if (state.phase === 'PLAYING') {
    return {
      nextState: {
        ...state,
        phase: 'TIME_EXPIRED',
        status: 'IDLE',
        deadline: null,
        remainingMs: 0,
        phaseDurationMs: PLAYING_DURATION_MS,
        version: state.version + 1,
        updatedAt: currentNow,
      },
      expiredPhase: 'PLAYING',
    };
  }

  return { nextState: state, expiredPhase: null };
}

/**
 * Reverts a timer transition caused by an undone goal.
 * Restores the previous phase and remaining time in PAUSED status so the referee
 * can verify and resume safely.
 */
export function rollbackGoal(state: TimerState, undoneGoalEventId: string, now?: number): TimerState {
  if (!undoneGoalEventId || state.lastGoalEventId !== undoneGoalEventId || !state.previousState) {
    return state;
  }

  const currentNow = now ?? Date.now();
  const prev = state.previousState;

  return {
    ...state,
    phase: prev.phase,
    status: 'PAUSED',
    deadline: null,
    remainingMs: prev.remainingMs,
    phaseDurationMs: prev.phaseDurationMs,
    lastGoalEventId: prev.lastGoalEventId,
    previousState: null,
    version: state.version + 1,
    updatedAt: currentNow,
  };
}

/**
 * Formats milliseconds into standard athletic MM:SS countdown format.
 * Uses Math.ceil to prevent prematurely displaying 00:00 while sub-second time remains.
 */
export function formatTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const formatTimeRemaining = formatTime;
export const formatTimeDisplay = formatTime;

/**
 * Returns visual urgency / stadium theme warning tier based on remaining time.
 * Supports polymorphic argument orders: (remainingMs, phase) or (phase, remainingMs).
 */
export function getUrgencyLevel(
  arg1: number | TimerPhase,
  arg2: TimerPhase | number
): UrgencyLevel {
  const remainingMs = typeof arg1 === 'number' ? arg1 : (arg2 as number);
  const phase = typeof arg1 === 'string' ? arg1 : (arg2 as TimerPhase);

  if (phase === 'TIME_EXPIRED' || remainingMs <= 0) {
    return 'EXPIRED';
  }
  if (phase === 'PLAYING') {
    if (remainingMs <= 10_000) return 'URGENT_10';
    if (remainingMs <= 30_000) return 'WARNING_30';
  }
  return 'NORMAL';
}

export const getTimerWarningLevel = getUrgencyLevel;

/**
 * Pure reducer dispatching TimerAction to transition functions.
 */
export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'START':
      return startTimer(state, action.now);
    case 'PAUSE':
      return pauseTimer(state, action.now);
    case 'RESET':
      return resetTimer(state, action.now);
    case 'SKIP_BUFFER':
      return skipBuffer(state, action.now);
    case 'GOAL_SCORED':
      return handleGoalRecorded(state, action.goalEventId, action.now);
    case 'TICK': {
      const { nextState } = checkPhaseExpiry(state, action.now);
      return nextState;
    }
    case 'ROLLBACK_GOAL':
      return rollbackGoal(state, action.undoneGoalEventId, action.now);
    case 'SYNC':
      // Accept incoming state only if it has a higher monotonic version
      if (action.state.version > state.version) {
        return action.state;
      }
      return state;
    default:
      return state;
  }
}
