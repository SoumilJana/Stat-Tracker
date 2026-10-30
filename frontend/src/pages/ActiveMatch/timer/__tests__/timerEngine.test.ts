/**
 * Unit Tests for Winner Stays Core Timer Engine
 * Path: frontend/src/pages/ActiveMatch/timer/__tests__/timerEngine.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createInitialTimerState,
  startTimer,
  pauseTimer,
  resetTimer,
  skipBuffer,
  handleGoalRecorded,
  calculateRemainingMs,
  checkPhaseExpiry,
  rollbackGoal,
  formatTime,
  formatTimeRemaining,
  formatTimeDisplay,
  getUrgencyLevel,
  getTimerWarningLevel,
  timerReducer,
  PLAYING_DURATION_MS,
  GOAL_BUFFER_DURATION_MS,
} from '../timerEngine';

describe('timerEngine: State Machine & Authoritative Timestamp Math', () => {
  const BASE_TIME = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createInitialTimerState', () => {
    it('initializes in PLAYING phase with 10:00 (600,000ms) in IDLE status', () => {
      const state = createInitialTimerState(BASE_TIME);
      expect(state.phase).toBe('PLAYING');
      expect(state.status).toBe('IDLE');
      expect(state.remainingMs).toBe(PLAYING_DURATION_MS);
      expect(state.phaseDurationMs).toBe(PLAYING_DURATION_MS);
      expect(state.deadline).toBeNull();
      expect(state.lastGoalEventId).toBeNull();
      expect(state.version).toBe(1);
      expect(state.updatedAt).toBe(BASE_TIME);
      expect(state.previousState).toBeNull();
    });

    it('defaults to Date.now() when timestamp is omitted', () => {
      const state = createInitialTimerState();
      expect(state.updatedAt).toBe(BASE_TIME);
    });
  });

  describe('startTimer', () => {
    it('transitions IDLE to RUNNING and anchors deadline = now + remainingMs', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const running = startTimer(initial, BASE_TIME);

      expect(running.status).toBe('RUNNING');
      expect(running.deadline).toBe(BASE_TIME + PLAYING_DURATION_MS);
      expect(running.remainingMs).toBe(PLAYING_DURATION_MS);
      expect(running.version).toBe(initial.version + 1);
      expect(running.updatedAt).toBe(BASE_TIME);
    });

    it('is idempotent when already RUNNING', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const running1 = startTimer(initial, BASE_TIME);
      vi.advanceTimersByTime(5_000);

      const running2 = startTimer(running1, BASE_TIME + 5_000);
      expect(running2).toBe(running1);
      expect(running2.deadline).toBe(running1.deadline);
      expect(running2.version).toBe(running1.version);
    });

    it('does not start when phase is TIME_EXPIRED', () => {
      const expiredState = {
        ...createInitialTimerState(BASE_TIME),
        phase: 'TIME_EXPIRED' as const,
        status: 'IDLE' as const,
        remainingMs: 0,
      };

      const result = startTimer(expiredState, BASE_TIME);
      expect(result.status).toBe('IDLE');
      expect(result.deadline).toBeNull();
    });
  });

  describe('pauseTimer', () => {
    it('freezes remainingMs, clears deadline, and sets status to PAUSED', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const running = startTimer(initial, BASE_TIME);

      // Advance by 123,456 ms
      const pauseTime = BASE_TIME + 123_456;
      const paused = pauseTimer(running, pauseTime);

      expect(paused.status).toBe('PAUSED');
      expect(paused.deadline).toBeNull();
      expect(paused.remainingMs).toBe(PLAYING_DURATION_MS - 123_456);
      expect(paused.version).toBe(running.version + 1);
      expect(paused.updatedAt).toBe(pauseTime);
    });

    it('is idempotent when already PAUSED or IDLE', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const paused1 = pauseTimer(initial, BASE_TIME);
      expect(paused1).toBe(initial);

      const running = startTimer(initial, BASE_TIME);
      const paused2 = pauseTimer(running, BASE_TIME + 10_000);
      const paused3 = pauseTimer(paused2, BASE_TIME + 20_000);
      expect(paused3).toBe(paused2);
    });
  });

  describe('resetTimer', () => {
    it('resets PLAYING phase to full 10:00 duration and IDLE status', () => {
      const running = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      vi.advanceTimersByTime(250_000);

      const reset = resetTimer(running, BASE_TIME + 250_000);
      expect(reset.phase).toBe('PLAYING');
      expect(reset.status).toBe('IDLE');
      expect(reset.deadline).toBeNull();
      expect(reset.remainingMs).toBe(PLAYING_DURATION_MS);
      expect(reset.phaseDurationMs).toBe(PLAYING_DURATION_MS);
      expect(reset.version).toBe(running.version + 1);
    });

    it('resets GOAL_BUFFER phase to full 60s duration and IDLE status', () => {
      const buffer = handleGoalRecorded(createInitialTimerState(BASE_TIME), 'goal-1', BASE_TIME);
      vi.advanceTimersByTime(20_000);

      const reset = resetTimer(buffer, BASE_TIME + 20_000);
      expect(reset.phase).toBe('GOAL_BUFFER');
      expect(reset.status).toBe('IDLE');
      expect(reset.deadline).toBeNull();
      expect(reset.remainingMs).toBe(GOAL_BUFFER_DURATION_MS);
      expect(reset.phaseDurationMs).toBe(GOAL_BUFFER_DURATION_MS);
    });

    it('resets TIME_EXPIRED back to PLAYING at 10:00 in IDLE status', () => {
      const expiredState = {
        ...createInitialTimerState(BASE_TIME),
        phase: 'TIME_EXPIRED' as const,
        status: 'IDLE' as const,
        remainingMs: 0,
      };

      const reset = resetTimer(expiredState, BASE_TIME + 1_000);
      expect(reset.phase).toBe('PLAYING');
      expect(reset.status).toBe('IDLE');
      expect(reset.remainingMs).toBe(PLAYING_DURATION_MS);
      expect(reset.deadline).toBeNull();
    });
  });

  describe('handleGoalRecorded', () => {
    it('transitions to RUNNING 60s GOAL_BUFFER and snapshots previousState', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const running = startTimer(initial, BASE_TIME);

      // Play 2 minutes (120,000ms)
      const goalTime = BASE_TIME + 120_000;
      const bufferState = handleGoalRecorded(running, 'goal-uuid-1', goalTime);

      expect(bufferState.phase).toBe('GOAL_BUFFER');
      expect(bufferState.status).toBe('RUNNING');
      expect(bufferState.remainingMs).toBe(GOAL_BUFFER_DURATION_MS);
      expect(bufferState.phaseDurationMs).toBe(GOAL_BUFFER_DURATION_MS);
      expect(bufferState.deadline).toBe(goalTime + GOAL_BUFFER_DURATION_MS);
      expect(bufferState.lastGoalEventId).toBe('goal-uuid-1');
      expect(bufferState.version).toBe(running.version + 1);

      // Previous state snapshot verification
      expect(bufferState.previousState).toEqual({
        phase: 'PLAYING',
        status: 'RUNNING',
        remainingMs: PLAYING_DURATION_MS - 120_000,
        phaseDurationMs: PLAYING_DURATION_MS,
        lastGoalEventId: null,
      });
    });

    it('idempotently protects against duplicate taps with identical goalEventId', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const buffer1 = handleGoalRecorded(initial, 'goal-uuid-dup', BASE_TIME);
      vi.advanceTimersByTime(2_000);

      const buffer2 = handleGoalRecorded(buffer1, 'goal-uuid-dup', BASE_TIME + 2_000);
      expect(buffer2).toBe(buffer1); // Strict reference identity
    });

    it('ignores empty or falsy goalEventId', () => {
      const initial = createInitialTimerState(BASE_TIME);
      expect(handleGoalRecorded(initial, '', BASE_TIME)).toBe(initial);
    });
  });

  describe('skipBuffer', () => {
    it('immediately starts 10:00 PLAYING countdown from GOAL_BUFFER', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const buffer = handleGoalRecorded(initial, 'goal-1', BASE_TIME);
      vi.advanceTimersByTime(15_000);

      const skipped = skipBuffer(buffer, BASE_TIME + 15_000);
      expect(skipped.phase).toBe('PLAYING');
      expect(skipped.status).toBe('RUNNING');
      expect(skipped.remainingMs).toBe(PLAYING_DURATION_MS);
      expect(skipped.phaseDurationMs).toBe(PLAYING_DURATION_MS);
      expect(skipped.deadline).toBe(BASE_TIME + 15_000 + PLAYING_DURATION_MS);
      expect(skipped.version).toBe(buffer.version + 1);
    });

    it('is a no-op if not in GOAL_BUFFER phase', () => {
      const initial = createInitialTimerState(BASE_TIME);
      expect(skipBuffer(initial, BASE_TIME)).toBe(initial);

      const running = startTimer(initial, BASE_TIME);
      expect(skipBuffer(running, BASE_TIME)).toBe(running);
    });
  });

  describe('calculateRemainingMs', () => {
    it('returns exact millisecond difference when RUNNING', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const running = startTimer(initial, BASE_TIME);

      expect(calculateRemainingMs(running, BASE_TIME)).toBe(PLAYING_DURATION_MS);
      expect(calculateRemainingMs(running, BASE_TIME + 100_000)).toBe(PLAYING_DURATION_MS - 100_000);
      expect(calculateRemainingMs(running, BASE_TIME + PLAYING_DURATION_MS)).toBe(0);
      expect(calculateRemainingMs(running, BASE_TIME + PLAYING_DURATION_MS + 5_000)).toBe(0);
    });

    it('returns preserved remainingMs when PAUSED or IDLE regardless of elapsed time', () => {
      const initial = createInitialTimerState(BASE_TIME);
      expect(calculateRemainingMs(initial, BASE_TIME + 999_999)).toBe(PLAYING_DURATION_MS);

      const running = startTimer(initial, BASE_TIME);
      const paused = pauseTimer(running, BASE_TIME + 50_000);

      expect(calculateRemainingMs(paused, BASE_TIME + 500_000)).toBe(PLAYING_DURATION_MS - 50_000);
    });

    it('returns 0 when phase is TIME_EXPIRED', () => {
      const expiredState = {
        ...createInitialTimerState(BASE_TIME),
        phase: 'TIME_EXPIRED' as const,
        status: 'IDLE' as const,
        remainingMs: 0,
      };
      expect(calculateRemainingMs(expiredState, BASE_TIME)).toBe(0);
    });
  });

  describe('checkPhaseExpiry', () => {
    it('returns expiredPhase: null while phase is still running', () => {
      const running = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      const check = checkPhaseExpiry(running, BASE_TIME + 500_000);

      expect(check.expiredPhase).toBeNull();
      expect(check.nextState.phase).toBe('PLAYING');
      expect(check.nextState.remainingMs).toBe(100_000);
    });

    it('transitions GOAL_BUFFER to PLAYING at deadline and signals expiredPhase: GOAL_BUFFER', () => {
      const buffer = handleGoalRecorded(createInitialTimerState(BASE_TIME), 'goal-1', BASE_TIME);
      const expiryTime = BASE_TIME + GOAL_BUFFER_DURATION_MS;

      const result = checkPhaseExpiry(buffer, expiryTime);
      expect(result.expiredPhase).toBe('GOAL_BUFFER');
      expect(result.nextState.phase).toBe('PLAYING');
      expect(result.nextState.status).toBe('RUNNING');
      expect(result.nextState.remainingMs).toBe(PLAYING_DURATION_MS);
      expect(result.nextState.deadline).toBe(expiryTime + PLAYING_DURATION_MS);
    });

    it('transitions PLAYING to TIME_EXPIRED at deadline and signals expiredPhase: PLAYING', () => {
      const running = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      const expiryTime = BASE_TIME + PLAYING_DURATION_MS;

      const result = checkPhaseExpiry(running, expiryTime);
      expect(result.expiredPhase).toBe('PLAYING');
      expect(result.nextState.phase).toBe('TIME_EXPIRED');
      expect(result.nextState.status).toBe('IDLE');
      expect(result.nextState.deadline).toBeNull();
      expect(result.nextState.remainingMs).toBe(0);
    });

    it('does not re-trigger expiry after transitioning to TIME_EXPIRED', () => {
      const running = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      const firstCheck = checkPhaseExpiry(running, BASE_TIME + PLAYING_DURATION_MS);
      expect(firstCheck.expiredPhase).toBe('PLAYING');

      // Subsequent check
      const secondCheck = checkPhaseExpiry(firstCheck.nextState, BASE_TIME + PLAYING_DURATION_MS + 1_000);
      expect(secondCheck.expiredPhase).toBeNull();
      expect(secondCheck.nextState).toBe(firstCheck.nextState);
    });

    it('handles background jump during GOAL_BUFFER that also exceeds match countdown', () => {
      const buffer = handleGoalRecorded(createInitialTimerState(BASE_TIME), 'goal-1', BASE_TIME);
      // 15 minutes jump (buffer 1m + match 10m = 11m total)
      const jumpTime = BASE_TIME + 15 * 60 * 1000;

      const result = checkPhaseExpiry(buffer, jumpTime);
      expect(result.expiredPhase).toBe('GOAL_BUFFER');
      expect(result.nextState.phase).toBe('TIME_EXPIRED');
      expect(result.nextState.status).toBe('IDLE');
      expect(result.nextState.remainingMs).toBe(0);
    });
  });

  describe('rollbackGoal', () => {
    it('restores previous phase and remaining time in PAUSED status on matching undone goal', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const running = startTimer(initial, BASE_TIME);
      const goalTime = BASE_TIME + 200_000;
      const buffer = handleGoalRecorded(running, 'goal-to-undo', goalTime);

      const rollback = rollbackGoal(buffer, 'goal-to-undo', goalTime + 10_000);
      expect(rollback.phase).toBe('PLAYING');
      expect(rollback.status).toBe('PAUSED');
      expect(rollback.remainingMs).toBe(PLAYING_DURATION_MS - 200_000);
      expect(rollback.phaseDurationMs).toBe(PLAYING_DURATION_MS);
      expect(rollback.deadline).toBeNull();
      expect(rollback.lastGoalEventId).toBeNull();
      expect(rollback.previousState).toBeNull();
      expect(rollback.version).toBe(buffer.version + 1);
    });

    it('does not rollback if undoneGoalEventId does not match lastGoalEventId', () => {
      const initial = createInitialTimerState(BASE_TIME);
      const buffer = handleGoalRecorded(initial, 'goal-1', BASE_TIME);

      const rollback = rollbackGoal(buffer, 'different-goal-id', BASE_TIME + 5_000);
      expect(rollback).toBe(buffer);
    });

    it('does not rollback if previousState is null', () => {
      const state = {
        ...createInitialTimerState(BASE_TIME),
        lastGoalEventId: 'goal-1',
        previousState: null,
      };

      const rollback = rollbackGoal(state, 'goal-1', BASE_TIME);
      expect(rollback).toBe(state);
    });
  });

  describe('formatTime and Aliases', () => {
    it('formats times using Math.ceil athletic countdown rules', () => {
      expect(formatTime(600_000)).toBe('10:00');
      expect(formatTime(599_999)).toBe('10:00');
      expect(formatTime(599_000)).toBe('09:59');
      expect(formatTime(60_000)).toBe('01:00');
      expect(formatTime(59_000)).toBe('00:59');
      expect(formatTime(1_000)).toBe('00:01');
      expect(formatTime(500)).toBe('00:01');
      expect(formatTime(1)).toBe('00:01');
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(-500)).toBe('00:00');
    });

    it('formatTimeRemaining and formatTimeDisplay match formatTime', () => {
      expect(formatTimeRemaining(362_550)).toBe('06:03');
      expect(formatTimeDisplay(362_550)).toBe('06:03');
    });
  });

  describe('getUrgencyLevel and getTimerWarningLevel', () => {
    it('classifies urgency tiers correctly', () => {
      expect(getUrgencyLevel(35_000, 'PLAYING')).toBe('NORMAL');
      expect(getUrgencyLevel(30_000, 'PLAYING')).toBe('WARNING_30');
      expect(getUrgencyLevel(15_000, 'PLAYING')).toBe('WARNING_30');
      expect(getUrgencyLevel(10_000, 'PLAYING')).toBe('URGENT_10');
      expect(getUrgencyLevel(1_000, 'PLAYING')).toBe('URGENT_10');
      expect(getUrgencyLevel(0, 'PLAYING')).toBe('EXPIRED');
      expect(getUrgencyLevel(50_000, 'TIME_EXPIRED')).toBe('EXPIRED');
      expect(getUrgencyLevel(50_000, 'GOAL_BUFFER')).toBe('NORMAL');
    });

    it('supports inverted argument orders transparently', () => {
      expect(getTimerWarningLevel('PLAYING', 25_000)).toBe('WARNING_30');
      expect(getUrgencyLevel('PLAYING', 8_000)).toBe('URGENT_10');
    });
  });

  describe('timerReducer', () => {
    it('dispatches START, PAUSE, RESET, SKIP_BUFFER, GOAL_SCORED, TICK, ROLLBACK_GOAL', () => {
      let state = createInitialTimerState(BASE_TIME);

      // START
      state = timerReducer(state, { type: 'START', now: BASE_TIME });
      expect(state.status).toBe('RUNNING');

      // PAUSE
      state = timerReducer(state, { type: 'PAUSE', now: BASE_TIME + 10_000 });
      expect(state.status).toBe('PAUSED');
      expect(state.remainingMs).toBe(PLAYING_DURATION_MS - 10_000);

      // RESET
      state = timerReducer(state, { type: 'RESET', now: BASE_TIME + 20_000 });
      expect(state.status).toBe('IDLE');
      expect(state.remainingMs).toBe(PLAYING_DURATION_MS);

      // GOAL_SCORED
      state = timerReducer(state, { type: 'GOAL_SCORED', goalEventId: 'goal-1', now: BASE_TIME + 30_000 });
      expect(state.phase).toBe('GOAL_BUFFER');

      // SKIP_BUFFER
      state = timerReducer(state, { type: 'SKIP_BUFFER', now: BASE_TIME + 35_000 });
      expect(state.phase).toBe('PLAYING');
      expect(state.status).toBe('RUNNING');

      // TICK (expiry)
      state = timerReducer(state, { type: 'TICK', now: BASE_TIME + 35_000 + PLAYING_DURATION_MS });
      expect(state.phase).toBe('TIME_EXPIRED');

      // ROLLBACK_GOAL
      const preGoalRunning = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      const withGoal = handleGoalRecorded(preGoalRunning, 'goal-to-rollback', BASE_TIME + 50_000);
      const rolledBack = timerReducer(withGoal, {
        type: 'ROLLBACK_GOAL',
        undoneGoalEventId: 'goal-to-rollback',
        now: BASE_TIME + 60_000,
      });
      expect(rolledBack.phase).toBe('PLAYING');
      expect(rolledBack.status).toBe('PAUSED');
    });

    it('SYNC action only applies state with higher monotonic version', () => {
      const state = createInitialTimerState(BASE_TIME);
      const olderState = { ...state, version: 0 };
      const newerState = { ...state, version: 10, remainingMs: 123_456 };

      expect(timerReducer(state, { type: 'SYNC', state: olderState })).toBe(state);
      expect(timerReducer(state, { type: 'SYNC', state: newerState })).toBe(newerState);
    });
  });
});
