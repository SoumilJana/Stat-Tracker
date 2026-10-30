/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/useWinnerStaysTimer.ts
 *
 * Reactive integration hook connecting the Core Timer Engine (timerEngine.ts)
 * with the existing match event stream, goal idempotency, Skip Buffer,
 * goal undo rollback, and 00:00 time-expiry confirmation.
 *
 * CRITICAL DIRECTIVES:
 * - 100% ADDITIVE & SELF-CONTAINED
 * - ZERO modifications to existing scoring, rotation logic, or Supabase schemas
 * - Purely reactive to match `events`
 * - Strict idempotency on `goalEventId`
 * - Safe goal undo rollback with themed confirmation
 * - Safe 00:00 time-expiry prompt for `onRecordTimeUp()` (prevents double rotations)
 */

import { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { ConfirmContext, type ConfirmOptions } from '../../../contexts/ConfirmContext';
import type { TimerState, TimerPhase, UrgencyLevel } from './types';
import {
  createInitialTimerState,
  calculateRemainingMs,
  startTimer,
  pauseTimer,
  resetTimer,
  skipBuffer,
  handleGoalRecorded,
  rollbackGoal,
  checkPhaseExpiry,
  formatTime,
  getUrgencyLevel,
} from './timerEngine';
import {
  saveTimerState,
  rehydrateTimerState,
} from './timerStorage';
import {
  setupTimerRealtimeSync,
  type TimerRealtimeSyncHandle,
} from './timerSync';

export interface UseWinnerStaysTimerOptions {
  /** Unique session ID for localStorage persistence and channel scoping */
  sessionId?: string;
  /** Session object from useActiveMatchData (e.g. { id, mode, status }) */
  session?: any;
  /** Realtime match events array sorted descending (events[0] = latest event) */
  events?: any[];
  /** Current logged in user profile (checks profile?.role === 'admin') */
  profile?: any;
  /** Callback invoking existing recordTimeUp() on confirmed 00:00 expiry */
  onRecordTimeUp?: () => Promise<void>;
  /** Optional audio/haptic callback invoked on phase expiration */
  onPhaseExpire?: (expiredPhase: TimerPhase) => void;
  /** Flag to toggle localStorage persistence (default: true) */
  storageEnabled?: boolean;
  /** Flag to toggle Supabase Realtime synchronization (default: true) */
  syncEnabled?: boolean;
  /** Optional custom Supabase client for Realtime (useful for testing or dependency injection) */
  supabaseClient?: any;
  /** Optional dependency injection for confirm dialog (used in headless unit tests) */
  confirmOverride?: (options: ConfirmOptions) => Promise<boolean>;
}

export interface UseWinnerStaysTimerReturn {
  /** Current authoritative timer state */
  state: TimerState;
  /** Remaining milliseconds in the current phase */
  remainingMs: number;
  /** Athletic MM:SS formatted string display */
  formattedTime: string;
  /** Urgency / stadium visual warning tier (NORMAL, WARNING_30, URGENT_10, EXPIRED) */
  urgencyLevel: UrgencyLevel;
  /** True if the active user possesses admin mutation authority */
  isAdmin: boolean;
  /** Starts or resumes the current countdown */
  start: () => void;
  /** Pauses the current countdown and preserves remaining time */
  pause: () => void;
  /** Resets the current phase to nominal duration (prompts confirm if running) */
  reset: () => Promise<boolean>;
  /** Skips the 60s buffer immediately into 10:00 playing countdown (admin only) */
  skip: () => void;
  /** Manually initiates goal undo rollback confirmation */
  rollback: () => Promise<boolean>;
}

export function useWinnerStaysTimer({
  sessionId,
  session,
  events = [],
  profile,
  onRecordTimeUp,
  onPhaseExpire,
  storageEnabled = true,
  syncEnabled = true,
  supabaseClient,
  confirmOverride,
}: UseWinnerStaysTimerOptions): UseWinnerStaysTimerReturn {
  // 1. Resolve Admin Authority
  const isAdmin = useMemo(() => profile?.role === 'admin', [profile?.role]);

  // 2. Resolve Safe Confirm Handler
  const confirmCtx = useContext(ConfirmContext);
  const confirm = confirmOverride ?? confirmCtx?.confirm ?? null;

  // 3. Initialize Timer State (rehydrate from LocalStorage or create initial 10:00 IDLE)
  const [state, setState] = useState<TimerState>(() => {
    if (sessionId && storageEnabled) {
      return rehydrateTimerState(sessionId);
    }
    return createInitialTimerState();
  });

  // Display remaining ms (updated on ticks and state changes)
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number>(() =>
    calculateRemainingMs(state)
  );

  // References to prevent race conditions, infinite prompt loops, and duplicate executions
  const stateRef = useRef<TimerState>(state);
  stateRef.current = state;

  const knownGoalIdsRef = useRef<Set<string>>(new Set());
  const promptedUndoIdRef = useRef<string | null>(null);
  const isPromptingTimeUpRef = useRef<boolean>(false);
  const isPromptingUndoRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);
  const currentSessionIdRef = useRef<string | undefined>(sessionId);

  // Persist state changes to storage
  const persistState = useCallback(
    (newState: TimerState) => {
      if (sessionId && storageEnabled) {
        saveTimerState(sessionId, newState);
      }
    },
    [sessionId, storageEnabled]
  );

  // Handle session ID changes
  useEffect(() => {
    if (sessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = sessionId;
      const rehydrated =
        sessionId && storageEnabled
          ? rehydrateTimerState(sessionId)
          : createInitialTimerState();
      setState(rehydrated);
      knownGoalIdsRef.current.clear();
      promptedUndoIdRef.current = null;
      isPromptingTimeUpRef.current = false;
      isPromptingUndoRef.current = false;
      isInitialMountRef.current = true;
    }
  }, [sessionId, storageEnabled]);

  // Synchronize display remaining time whenever state changes
  useEffect(() => {
    setDisplayRemainingMs(calculateRemainingMs(state));
  }, [state]);

  // ---------------------------------------------------------------------------
  // 3b. Supabase Realtime Synchronization & Admin Authority
  // ---------------------------------------------------------------------------
  const syncRef = useRef<TimerRealtimeSyncHandle | null>(null);

  useEffect(() => {
    if (!sessionId || !syncEnabled) return;

    const sync = setupTimerRealtimeSync({
      sessionId,
      isAdmin,
      profile,
      getCurrentState: () => stateRef.current,
      onSyncReceived: (syncState) => {
        setState(syncState);
        setDisplayRemainingMs(syncState.remainingMs);
        if (storageEnabled) {
          saveTimerState(sessionId, syncState);
        }
      },
      supabaseClient,
    });

    syncRef.current = sync;

    return () => {
      sync.cleanup();
      syncRef.current = null;
    };
  }, [sessionId, isAdmin, profile, storageEnabled, syncEnabled, supabaseClient]);

  // ---------------------------------------------------------------------------
  // 4. Reactive Match Events Integration (Goal Scored & Goal Undo)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Only operate for active Winner Stays sessions
    if (session?.mode && session.mode !== 'WINNER_STAYS') return;

    // Filter current goal events from the stream
    const currentGoalEvents = events.filter((e) => e && e.event_type === 'GOAL');
    const currentGoalIds = new Set(currentGoalEvents.map((e) => e.id));

    // A. Handle Initial Mount Seeding (prevent replaying historical goals on mount)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      currentGoalIds.forEach((id) => knownGoalIdsRef.current.add(id));

      // If the timer state had no goal recorded yet, seed lastGoalEventId from latest goal
      if (currentGoalEvents.length > 0 && !stateRef.current.lastGoalEventId) {
        const latestGoal = currentGoalEvents[0];
        setState((prev) => {
          const next = { ...prev, lastGoalEventId: latestGoal.id };
          persistState(next);
          return next;
        });
      }
      return;
    }

    // B. Detect New Goal Event (Strict Idempotency by Event ID)
    const latestGoal = currentGoalEvents.length > 0 ? currentGoalEvents[0] : null;

    if (
      latestGoal &&
      latestGoal.id !== stateRef.current.lastGoalEventId &&
      !knownGoalIdsRef.current.has(latestGoal.id)
    ) {
      // Register newly observed goal ID
      knownGoalIdsRef.current.add(latestGoal.id);

      setState((prev) => {
        const now = Date.now();
        const next = handleGoalRecorded(prev, latestGoal.id, now);
        persistState(next);
        if (isAdmin) {
          syncRef.current?.broadcastState(next);
        }
        return next;
      });
      return;
    }

    // C. Detect Goal Undo (Goal that triggered current transition was deleted)
    const activeGoalId = stateRef.current.lastGoalEventId;
    if (
      activeGoalId &&
      knownGoalIdsRef.current.has(activeGoalId) &&
      !currentGoalIds.has(activeGoalId)
    ) {
      // The goal associated with the current transition was undone/deleted
      knownGoalIdsRef.current.delete(activeGoalId);

      // Guard: Only prompt admin, and prompt at most once per undone goal ID
      if (
        isAdmin &&
        confirm &&
        promptedUndoIdRef.current !== activeGoalId &&
        !isPromptingUndoRef.current
      ) {
        promptedUndoIdRef.current = activeGoalId;
        isPromptingUndoRef.current = true;

        const prevSnapshot = stateRef.current.previousState;

        const executeUndoPrompt = async () => {
          try {
            if (prevSnapshot) {
              const previousPhaseLabel =
                prevSnapshot.phase === 'PLAYING'
                  ? '10:00 Playing Countdown'
                  : '60s Goal Buffer';
              const previousRemainingFormatted = formatTime(prevSnapshot.remainingMs);

              const shouldRollback = await confirm({
                title: 'Goal Undone — Revert Match Clock?',
                description: `The goal associated with this clock transition was undone. Would you like to restore the previous clock state (${previousPhaseLabel} at ${previousRemainingFormatted} paused)?`,
                confirmText: 'Rollback Clock',
                cancelText: 'Keep Current Clock',
                variant: 'warning',
              });

              if (shouldRollback) {
                setState((curr) => {
                  const now = Date.now();
                  const next = rollbackGoal(curr, activeGoalId, now);
                  persistState(next);
                  if (isAdmin) {
                    syncRef.current?.broadcastState(next);
                  }
                  return next;
                });
              } else {
                // Admin opted to keep current clock; clear previousState to prevent re-prompts
                setState((curr) => {
                  const next = { ...curr, previousState: null };
                  persistState(next);
                  if (isAdmin) {
                    syncRef.current?.broadcastState(next);
                  }
                  return next;
                });
              }
            } else {
              // Recovery action when no prior snapshot exists
              const shouldPause = await confirm({
                title: 'Goal Undone — Clock Adjustment',
                description:
                  'The goal was undone, but no previous clock snapshot is available. Would you like to pause the clock for manual referee adjustment?',
                confirmText: 'Pause Clock',
                cancelText: 'Keep Running',
                variant: 'warning',
              });

              if (shouldPause) {
                setState((curr) => {
                  const now = Date.now();
                  const next = pauseTimer(curr, now);
                  persistState(next);
                  if (isAdmin) {
                    syncRef.current?.broadcastState(next);
                  }
                  return next;
                });
              }
            }
          } finally {
            isPromptingUndoRef.current = false;
          }
        };

        executeUndoPrompt();
      }
    }
  }, [events, session?.mode, isAdmin, confirm, persistState]);

  // ---------------------------------------------------------------------------
  // 5. Authoritative Countdown Tick & Phase Expiry Engine
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== 'RUNNING') {
      return;
    }

    const checkTick = () => {
      const now = Date.now();
      const current = stateRef.current;
      if (current.status !== 'RUNNING') return;

      const { nextState, expiredPhase } = checkPhaseExpiry(current, now);

      if (expiredPhase !== null) {
        // Phase transition occurred
        setState(nextState);
        persistState(nextState);
        setDisplayRemainingMs(nextState.remainingMs);

        if (isAdmin) {
          syncRef.current?.broadcastState(nextState);
        }

        // Notify sound/whistle callback
        onPhaseExpire?.(expiredPhase);

        // If Playing countdown finished at 00:00, prompt admin to record NO_GOAL_TIME_UP
        if (
          expiredPhase === 'PLAYING' &&
          nextState.phase === 'TIME_EXPIRED' &&
          isAdmin &&
          onRecordTimeUp &&
          confirm &&
          !isPromptingTimeUpRef.current
        ) {
          isPromptingTimeUpRef.current = true;

          const executeTimeUpPrompt = async () => {
            try {
              const shouldRecord = await confirm({
                title: 'Full Time — Playing Clock Expired',
                description:
                  '10:00 playing time has expired with no goal scored. Record Time Up and rotate teams now?',
                confirmText: 'Record Time Up',
                cancelText: 'Keep Current Teams',
                variant: 'warning',
              });

              if (shouldRecord) {
                await onRecordTimeUp();
              }
            } catch (err) {
              console.error('[WinnerStaysTimer] Failed to record time up:', err);
            }
          };

          executeTimeUpPrompt();
        }
      } else {
        // Normal tick; update visual countdown
        setDisplayRemainingMs(calculateRemainingMs(current, now));
      }
    };

    // Frequent visual tick for smooth countdown display
    const intervalId = window.setInterval(checkTick, 250);

    // Immediate check on tab foregrounding (visibility change)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.status, isAdmin, onRecordTimeUp, onPhaseExpire, confirm, persistState]);

  // ---------------------------------------------------------------------------
  // 6. Admin Timer Controls
  // ---------------------------------------------------------------------------

  /**
   * Starts or resumes the current countdown phase.
   * Gated strictly by admin authority.
   */
  const start = useCallback(() => {
    if (!isAdmin) return;

    isPromptingTimeUpRef.current = false;

    setState((prev) => {
      const now = Date.now();
      // If previous phase was expired, reset to playing first
      const base = prev.phase === 'TIME_EXPIRED' ? resetTimer(prev, now) : prev;
      const next = startTimer(base, now);
      persistState(next);
      syncRef.current?.broadcastState(next);
      return next;
    });
  }, [isAdmin, persistState]);

  /**
   * Pauses the countdown, freezing remainingMs and clearing the deadline.
   */
  const pause = useCallback(() => {
    if (!isAdmin) return;

    setState((prev) => {
      const now = Date.now();
      const next = pauseTimer(prev, now);
      persistState(next);
      syncRef.current?.broadcastState(next);
      return next;
    });
  }, [isAdmin, persistState]);

  /**
   * Resets the current phase to nominal duration.
   * Shows a themed confirmation dialog if the timer is actively RUNNING.
   */
  const reset = useCallback(async (): Promise<boolean> => {
    if (!isAdmin) return false;

    const current = stateRef.current;
    if (current.status === 'RUNNING' && confirm) {
      const phaseLabel =
        current.phase === 'GOAL_BUFFER' ? '60-second Goal Buffer' : '10-minute Playing Clock';
      const confirmed = await confirm({
        title: 'Reset Match Clock?',
        description: `Are you sure you want to reset the ${phaseLabel}? The clock will stop and return to its initial time.`,
        confirmText: 'Reset Clock',
        cancelText: 'Cancel',
        variant: 'danger',
        isDestructive: true,
      });

      if (!confirmed) return false;
    }

    isPromptingTimeUpRef.current = false;

    setState((prev) => {
      const now = Date.now();
      const next = resetTimer(prev, now);
      persistState(next);
      syncRef.current?.broadcastState(next);
      return next;
    });
    return true;
  }, [isAdmin, confirm, persistState]);

  /**
   * Skips the remaining 60-second buffer and immediately starts 10:00 playing.
   * Admin only, no confirmation required.
   */
  const skip = useCallback(() => {
    if (!isAdmin) return;
    if (stateRef.current.phase !== 'GOAL_BUFFER') return;

    setState((prev) => {
      const now = Date.now();
      const next = skipBuffer(prev, now);
      persistState(next);
      syncRef.current?.broadcastState(next);
      return next;
    });

    onPhaseExpire?.('GOAL_BUFFER');
  }, [isAdmin, onPhaseExpire, persistState]);

  /**
   * Manually invokes goal undo rollback if an undone goal event is pending.
   */
  const rollback = useCallback(async (): Promise<boolean> => {
    if (!isAdmin) return false;
    const current = stateRef.current;
    if (!current.lastGoalEventId || !current.previousState) return false;

    setState((prev) => {
      const now = Date.now();
      const next = rollbackGoal(prev, prev.lastGoalEventId!, now);
      persistState(next);
      syncRef.current?.broadcastState(next);
      return next;
    });
    return true;
  }, [isAdmin, persistState]);

  // ---------------------------------------------------------------------------
  // 7. Memoized Return API
  // ---------------------------------------------------------------------------
  const urgencyLevel = useMemo(
    () => getUrgencyLevel(displayRemainingMs, state.phase),
    [displayRemainingMs, state.phase]
  );

  const formattedTime = useMemo(
    () => formatTime(displayRemainingMs),
    [displayRemainingMs]
  );

  return {
    state,
    remainingMs: displayRemainingMs,
    formattedTime,
    urgencyLevel,
    isAdmin,
    start,
    pause,
    reset,
    skip,
    rollback,
  };
}
