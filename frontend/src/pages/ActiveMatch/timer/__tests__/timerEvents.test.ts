/**
 * Integration Tests for Winner Stays Match Event Integration & Goal Undo Hook
 * Path: frontend/src/pages/ActiveMatch/timer/__tests__/timerEvents.test.ts
 *
 * Verifies useWinnerStaysTimer reactive event integration:
 * - Initial mount & admin authorization gating
 * - Goal arrival & strict idempotency by event ID
 * - Skip buffer transition
 * - Automatic buffer expiration to 10:00 playing
 * - Subsequent goals during match countdown
 * - Goal undo detection & rollback confirmation
 * - 00:00 expiry & onRecordTimeUp invocation (with double-rotation prevention)
 * - Reset confirmation gating
 * - Browser refresh rehydration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWinnerStaysTimer } from '../useWinnerStaysTimer';
import { loadTimerState } from '../timerStorage';

describe('useWinnerStaysTimer: Match Event Integration & Goal Undo Hook', () => {
  const BASE_TIME = 1_700_000_000_000;
  const adminProfile = { id: 'admin-1', role: 'admin' };
  const spectatorProfile = { id: 'user-1', role: 'player' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('1. Initial Match Start & Admin Authorization', () => {
    it('initializes in PLAYING phase at 10:00 in IDLE status without requiring a prior goal', () => {
      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('IDLE');
      expect(result.current.remainingMs).toBe(600_000);
      expect(result.current.formattedTime).toBe('10:00');
      expect(result.current.urgencyLevel).toBe('NORMAL');
      expect(result.current.isAdmin).toBe(true);
    });

    it('blocks non-admin from controlling the timer', async () => {
      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: spectatorProfile,
          storageEnabled: false,
        })
      );

      expect(result.current.isAdmin).toBe(false);

      // Attempt to start
      act(() => {
        result.current.start();
      });
      expect(result.current.state.status).toBe('IDLE');

      // Attempt to pause
      act(() => {
        result.current.pause();
      });
      expect(result.current.state.status).toBe('IDLE');

      // Attempt to skip
      act(() => {
        result.current.skip();
      });
      expect(result.current.state.phase).toBe('PLAYING');

      // Attempt to reset
      let resetAllowed: boolean | undefined;
      await act(async () => {
        resetAllowed = await result.current.reset();
      });
      expect(resetAllowed).toBe(false);

      // Attempt to rollback
      let rollbackAllowed: boolean | undefined;
      await act(async () => {
        rollbackAllowed = await result.current.rollback();
      });
      expect(rollbackAllowed).toBe(false);
    });

    it('allows admin to start and pause the 10:00 countdown', () => {
      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      // Start timer
      act(() => {
        result.current.start();
      });
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.state.deadline).toBe(BASE_TIME + 600_000);

      // Advance by 15 seconds
      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      expect(result.current.remainingMs).toBe(585_000);
      expect(result.current.formattedTime).toBe('09:45');

      // Pause timer
      act(() => {
        result.current.pause();
      });
      expect(result.current.state.status).toBe('PAUSED');
      expect(result.current.state.deadline).toBeNull();
      expect(result.current.remainingMs).toBe(585_000);
    });
  });

  describe('2. Goal Event Detection & Strict Idempotency', () => {
    it('automatically transitions to 60s GOAL_BUFFER and snapshots previous playing state on goal event', () => {
      let events: any[] = [];
      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      // Start playing countdown
      act(() => {
        result.current.start();
        vi.advanceTimersByTime(30_000); // 30s into playing -> 09:30 remaining
      });
      expect(result.current.formattedTime).toBe('09:30');

      // Goal scored!
      events = [
        {
          id: 'goal-event-101',
          event_type: 'GOAL',
          team_id: 'team-a',
          player_id: 'player-1',
          timestamp: new Date().toISOString(),
        },
      ];

      rerender();

      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(60_000);
      expect(result.current.formattedTime).toBe('01:00');
      expect(result.current.state.lastGoalEventId).toBe('goal-event-101');
      expect(result.current.state.previousState).toBeDefined();
      expect(result.current.state.previousState?.phase).toBe('PLAYING');
      expect(result.current.state.previousState?.remainingMs).toBe(570_000);
    });

    it('protects against duplicate transitions: same goal event ID does not reset buffer countdown', () => {
      let events: any[] = [];
      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      // First goal arrives
      events = [{ id: 'goal-double-tap', event_type: 'GOAL' }];
      rerender();
      expect(result.current.remainingMs).toBe(60_000);

      // Advance 10s into buffer
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(result.current.remainingMs).toBe(50_000);
      expect(result.current.formattedTime).toBe('00:50');

      // Network retry or component re-render with identical goal event
      rerender();

      // Buffer must NOT reset to 60s
      expect(result.current.remainingMs).toBe(50_000);
      expect(result.current.formattedTime).toBe('00:50');
      expect(result.current.state.lastGoalEventId).toBe('goal-double-tap');
    });

    it('seeds past goals on initial mount without starting an erroneous buffer', () => {
      const historicalGoals = [
        { id: 'goal-past-2', event_type: 'GOAL' },
        { id: 'goal-past-1', event_type: 'GOAL' },
      ];

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: historicalGoals,
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      // Should remain at default PLAYING phase, NOT GOAL_BUFFER
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('IDLE');
      expect(result.current.state.lastGoalEventId).toBe('goal-past-2');
    });
  });

  describe('3. Skip Buffer Action', () => {
    it('immediately transitions from GOAL_BUFFER to 10:00 PLAYING countdown without confirmation', () => {
      const onPhaseExpire = vi.fn();
      let events: any[] = [];
      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          onPhaseExpire,
          storageEnabled: false,
        })
      );

      events = [{ id: 'goal-skip-test', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');

      // Admin clicks Skip Buffer
      act(() => {
        result.current.skip();
      });

      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(600_000);
      expect(result.current.formattedTime).toBe('10:00');
      expect(onPhaseExpire).toHaveBeenCalledWith('GOAL_BUFFER');
    });

    it('skip buffer is a no-op when not in GOAL_BUFFER phase', () => {
      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      expect(result.current.state.phase).toBe('PLAYING');

      act(() => {
        result.current.skip();
      });

      expect(result.current.state.phase).toBe('PLAYING');
    });
  });

  describe('4. Buffer Expiration to Playing Countdown', () => {
    it('automatically transitions from GOAL_BUFFER to 10:00 PLAYING countdown at 60s expiration', () => {
      const onPhaseExpire = vi.fn();
      let events: any[] = [];
      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          onPhaseExpire,
          storageEnabled: false,
        })
      );

      events = [{ id: 'goal-expire-test', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');

      // Advance fake timers by 60,000ms
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(600_000);
      expect(result.current.formattedTime).toBe('10:00');
      expect(onPhaseExpire).toHaveBeenCalledWith('GOAL_BUFFER');
    });
  });

  describe('5. Subsequent Goals During Match Countdown', () => {
    it('starts a fresh 60s buffer when a second goal is scored during playing countdown', () => {
      let events: any[] = [];
      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          storageEnabled: false,
        })
      );

      // Goal 1 scored
      events = [{ id: 'goal-seq-1', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');

      // Buffer expires into playing countdown
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.remainingMs).toBe(600_000);

      // Play 3 minutes into match
      act(() => {
        vi.advanceTimersByTime(180_000);
      });
      expect(result.current.remainingMs).toBe(420_000);
      expect(result.current.formattedTime).toBe('07:00');

      // Goal 2 scored!
      events = [
        { id: 'goal-seq-2', event_type: 'GOAL' },
        { id: 'goal-seq-1', event_type: 'GOAL' },
      ];
      rerender();

      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(60_000);
      expect(result.current.state.lastGoalEventId).toBe('goal-seq-2');
      expect(result.current.state.previousState?.remainingMs).toBe(420_000);
    });
  });

  describe('6. Goal Undo Detection & Rollback Confirmation', () => {
    it('prompts confirmation when goal is deleted from events and rolls back clock on confirm', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      // Start playing and advance by 2 minutes
      act(() => {
        result.current.start();
        vi.advanceTimersByTime(120_000); // 08:00 remaining
      });
      expect(result.current.formattedTime).toBe('08:00');

      // Goal recorded
      events = [{ id: 'goal-to-be-undone', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.lastGoalEventId).toBe('goal-to-be-undone');

      // Admin undid the goal in the timeline (goal event removed from events)
      events = [];
      rerender();

      // Hook detects removal and prompts confirmation
      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Goal Undone'),
          confirmText: 'Rollback Clock',
          variant: 'warning',
        })
      );

      // Wait for async confirmation promise to resolve
      await act(async () => {
        await Promise.resolve();
      });

      // Clock is rolled back to PLAYING paused at 08:00
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('PAUSED');
      expect(result.current.remainingMs).toBe(480_000);
      expect(result.current.formattedTime).toBe('08:00');
    });

    it('does not rollback clock and clears previous state if admin cancels goal undo prompt', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false);
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      // Goal recorded
      events = [{ id: 'goal-cancelled-undo', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');

      // Goal undone, but admin clicks Cancel
      events = [];
      rerender();

      await act(async () => {
        await Promise.resolve();
      });

      // Stays in GOAL_BUFFER, previousState cleared so no re-prompt loops
      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.previousState).toBeNull();

      // Subsequent re-render does not prompt again
      rerender();
      expect(confirmOverride).toHaveBeenCalledTimes(1);
    });

    it('prompts to pause clock if goal undone with no previousState snapshot', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      events = [{ id: 'goal-no-snapshot', event_type: 'GOAL' }];
      rerender();

      // Manually simulate stripped previousState (e.g. state clear)
      act(() => {
        result.current.state.previousState = null;
      });

      // Undo goal
      events = [];
      rerender();

      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Goal Undone — Clock Adjustment',
          confirmText: 'Pause Clock',
        })
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.state.status).toBe('PAUSED');
    });
  });

  describe('7. 00:00 Expiration & Time-Up Coordination', () => {
    it('stops countdown at 00:00, calls onPhaseExpire, and prompts admin to record Time Up', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn().mockResolvedValue(undefined);
      const onPhaseExpire = vi.fn();

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          onRecordTimeUp,
          onPhaseExpire,
          confirmOverride,
          storageEnabled: false,
        })
      );

      act(() => {
        result.current.start();
      });

      // Fast-forward full 10 minutes (600,000ms)
      act(() => {
        vi.advanceTimersByTime(600_000);
      });

      expect(result.current.state.phase).toBe('TIME_EXPIRED');
      expect(result.current.state.status).toBe('IDLE');
      expect(result.current.remainingMs).toBe(0);
      expect(result.current.formattedTime).toBe('00:00');
      expect(result.current.urgencyLevel).toBe('EXPIRED');
      expect(onPhaseExpire).toHaveBeenCalledWith('PLAYING');

      // Confirm prompt displayed
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Playing Clock Expired'),
          confirmText: 'Record Time Up',
        })
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
    });

    it('does not invoke onRecordTimeUp if admin cancels expiry prompt', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false);
      const onRecordTimeUp = vi.fn();

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          onRecordTimeUp,
          confirmOverride,
          storageEnabled: false,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(600_000);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordTimeUp).not.toHaveBeenCalled();
      expect(result.current.state.phase).toBe('TIME_EXPIRED');
    });
  });

  describe('8. Reset Confirmation Gating', () => {
    it('prompts confirmation when resetting an actively running clock and stops on confirm', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      act(() => {
        result.current.start();
        vi.advanceTimersByTime(60_000);
      });

      let resetResult: boolean | undefined;
      await act(async () => {
        resetResult = await result.current.reset();
      });

      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reset Match Clock?',
          variant: 'danger',
          isDestructive: true,
        })
      );
      expect(resetResult).toBe(true);
      expect(result.current.state.status).toBe('IDLE');
      expect(result.current.remainingMs).toBe(600_000);
      expect(result.current.formattedTime).toBe('10:00');
    });

    it('does not reset if admin cancels the reset confirmation dialog', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false);

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      act(() => {
        result.current.start();
        vi.advanceTimersByTime(60_000);
      });

      let resetResult: boolean | undefined;
      await act(async () => {
        resetResult = await result.current.reset();
      });

      expect(resetResult).toBe(false);
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(540_000);
    });

    it('resets an idle or paused clock without prompting confirmation', async () => {
      const confirmOverride = vi.fn();

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-1',
          session: { id: 'session-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      let resetResult: boolean | undefined;
      await act(async () => {
        resetResult = await result.current.reset();
      });

      expect(confirmOverride).not.toHaveBeenCalled();
      expect(resetResult).toBe(true);
    });
  });

  describe('9. Browser Refresh & LocalStorage Rehydration', () => {
    it('persists timer state to localStorage and rehydrates accurately on page reload', () => {
      const sessionId = 'session-rehydrate-test';

      // First session: start timer and advance 40 seconds
      const { result, unmount } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId,
          session: { id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          storageEnabled: true,
        })
      );

      act(() => {
        result.current.start();
        vi.advanceTimersByTime(40_000);
      });

      expect(result.current.remainingMs).toBe(560_000);

      // Verify persisted in storage
      const saved = loadTimerState(sessionId);
      expect(saved).not.toBeNull();
      expect(saved?.status).toBe('RUNNING');

      // Unmount hook (simulate page close)
      unmount();

      // Advance clock 20 seconds while page is closed (total 60s elapsed)
      vi.advanceTimersByTime(20_000);

      // Remount hook (simulate page reload)
      const { result: reloadedResult } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId,
          session: { id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events: [],
          profile: adminProfile,
          storageEnabled: true,
        })
      );

      // Should authoritatively account for the 20s elapsed while closed
      expect(reloadedResult.current.state.status).toBe('RUNNING');
      expect(reloadedResult.current.remainingMs).toBe(540_000);
      expect(reloadedResult.current.formattedTime).toBe('09:00');
    });
  });
});
