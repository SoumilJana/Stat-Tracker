/**
 * Adversarial Stress Tests for Milestone 2:
 * Goal Undo Rollback, Prompt Dismissal, and 00:00 Expiry Rotation Coordination
 *
 * Path: frontend/src/pages/ActiveMatch/timer/__tests__/timerAdversarialM2.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWinnerStaysTimer } from '../useWinnerStaysTimer';

describe('useWinnerStaysTimer: Adversarial Challenge M2_2', () => {
  const BASE_TIME = 1_700_000_000_000;
  const adminProfile = { id: 'admin-referee', role: 'admin' };
  const spectatorProfile = { id: 'spectator-user', role: 'player' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('Focus 1: Undoing the Most Recent Goal', () => {
    it('restores exact pre-goal playing state in PAUSED status with null deadline', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-1',
          session: { id: 'session-adv-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      // Start playing and let 2m 15s elapse (remaining: 7m 45s = 465,000ms)
      act(() => {
        result.current.start();
        vi.advanceTimersByTime(135_000);
      });
      expect(result.current.formattedTime).toBe('07:45');
      expect(result.current.remainingMs).toBe(465_000);

      // Goal 1 scored
      events = [{ id: 'goal-primary-1', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.state.deadline).toBe(BASE_TIME + 135_000 + 60_000);

      // Advance 25s into 60s buffer
      act(() => {
        vi.advanceTimersByTime(25_000);
      });
      expect(result.current.remainingMs).toBe(35_000);

      // Admin deletes Goal 1
      events = [];
      rerender();

      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Goal Undone — Revert Match Clock?',
          confirmText: 'Rollback Clock',
          variant: 'warning',
        })
      );

      await act(async () => {
        await Promise.resolve();
      });

      // Clock must be reverted to PLAYING at 07:45, PAUSED, deadline NULL
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('PAUSED');
      expect(result.current.state.deadline).toBeNull();
      expect(result.current.remainingMs).toBe(465_000);
      expect(result.current.formattedTime).toBe('07:45');
      expect(result.current.state.previousState).toBeNull();

      // Advancing time while PAUSED must NOT change remainingMs
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.remainingMs).toBe(465_000);

      // Admin resumes play
      act(() => {
        result.current.start();
      });
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.state.deadline).toBe(BASE_TIME + 135_000 + 25_000 + 60_000 + 465_000);

      // Runs accurately from 07:45
      act(() => {
        vi.advanceTimersByTime(45_000);
      });
      expect(result.current.remainingMs).toBe(420_000);
      expect(result.current.formattedTime).toBe('07:00');
    });

    it('rolls back to pre-goal state even after buffer expired and play was ongoing', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-post-buf',
          session: { id: 'session-adv-post-buf', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      // Play 3 minutes
      act(() => {
        result.current.start();
        vi.advanceTimersByTime(180_000);
      });
      expect(result.current.remainingMs).toBe(420_000); // 07:00

      // Goal scored
      events = [{ id: 'goal-late-undo', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');

      // Buffer expires (60s) -> enters PLAYING countdown (10:00)
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.remainingMs).toBe(600_000);

      // Play 2 minutes into new match (08:00)
      act(() => {
        vi.advanceTimersByTime(120_000);
      });
      expect(result.current.remainingMs).toBe(480_000);

      // Referee discovers Goal was invalid and deletes it
      events = [];
      rerender();

      expect(confirmOverride).toHaveBeenCalledTimes(1);

      await act(async () => {
        await Promise.resolve();
      });

      // Rollback recovers original 07:00 (420_000ms) in PAUSED status!
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('PAUSED');
      expect(result.current.remainingMs).toBe(420_000);
      expect(result.current.formattedTime).toBe('07:00');
    });
  });

  describe('Focus 2: Undoing a Goal When Another Goal Has Already Been Scored', () => {
    it('does not trigger clock rollback when an older goal is deleted while a newer goal is active', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-multi',
          session: { id: 'session-adv-multi', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      // Goal 1 scored
      events = [{ id: 'goal-older-1', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.lastGoalEventId).toBe('goal-older-1');

      // Buffer expires into playing
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.state.phase).toBe('PLAYING');

      // Play for 100 seconds
      act(() => {
        vi.advanceTimersByTime(100_000);
      });
      expect(result.current.remainingMs).toBe(500_000);

      // Goal 2 scored
      events = [
        { id: 'goal-newer-2', event_type: 'GOAL' },
        { id: 'goal-older-1', event_type: 'GOAL' },
      ];
      rerender();
      expect(result.current.state.lastGoalEventId).toBe('goal-newer-2');
      expect(result.current.state.phase).toBe('GOAL_BUFFER');

      // Advance 10s into Goal 2 buffer
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(result.current.remainingMs).toBe(50_000);

      // Now undo Goal 1 (the older goal). Goal 2 is STILL active!
      events = [{ id: 'goal-newer-2', event_type: 'GOAL' }];
      rerender();

      // confirmOverride must NOT be called because active goal (goal-newer-2) was NOT undone!
      expect(confirmOverride).not.toHaveBeenCalled();

      // Clock continues Goal 2 buffer undisturbed
      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(50_000);
      expect(result.current.state.lastGoalEventId).toBe('goal-newer-2');

      // Now undo Goal 2 as well!
      events = [];
      rerender();

      // Now Goal 2 is undone -> confirmOverride MUST be called
      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Goal Undone — Revert Match Clock?',
        })
      );

      await act(async () => {
        await Promise.resolve();
      });

      // Rollback restores state prior to Goal 2 (500_000ms PAUSED)
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('PAUSED');
      expect(result.current.remainingMs).toBe(500_000);
    });
  });

  describe('Focus 3: Prompt Dismissal (Rejecting Rollback)', () => {
    it('clears previousState on cancellation, prevents repeat prompts, and allows countdown to proceed', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false); // Admin clicks "Keep Current Clock"
      let events: any[] = [];

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-dismiss',
          session: { id: 'session-adv-dismiss', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: adminProfile,
          confirmOverride,
          storageEnabled: false,
        })
      );

      events = [{ id: 'goal-dismiss-test', event_type: 'GOAL' }];
      rerender();
      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.previousState).toBeDefined();

      // Goal undone
      events = [];
      rerender();

      expect(confirmOverride).toHaveBeenCalledTimes(1);

      await act(async () => {
        await Promise.resolve();
      });

      // State remains in GOAL_BUFFER
      expect(result.current.state.phase).toBe('GOAL_BUFFER');
      expect(result.current.state.status).toBe('RUNNING');
      // previousState MUST be cleared to null
      expect(result.current.state.previousState).toBeNull();

      // Stress test: Trigger 5 subsequent re-renders with the same empty events array
      rerender();
      rerender();
      rerender();
      rerender();
      rerender();

      // confirmOverride must NOT be called again
      expect(confirmOverride).toHaveBeenCalledTimes(1);

      // Clock continues running and expires normally
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.state.phase).toBe('PLAYING');
      expect(result.current.state.status).toBe('RUNNING');
      expect(result.current.remainingMs).toBe(600_000);
    });
  });

  describe('Focus 4: 00:00 Expiry Prompt and onRecordTimeUp Callback Execution', () => {
    it('executes onRecordTimeUp exactly once on confirmation', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn().mockResolvedValue(undefined);
      const onPhaseExpire = vi.fn();

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-expiry',
          session: { id: 'session-adv-expiry', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
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

      act(() => {
        vi.advanceTimersByTime(600_000);
      });

      expect(result.current.state.phase).toBe('TIME_EXPIRED');
      expect(result.current.state.status).toBe('IDLE');
      expect(result.current.remainingMs).toBe(0);
      expect(result.current.formattedTime).toBe('00:00');
      expect(onPhaseExpire).toHaveBeenCalledWith('PLAYING');
      expect(confirmOverride).toHaveBeenCalledTimes(1);

      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
    });

    it('does not execute onRecordTimeUp if admin cancels the expiry prompt', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false);
      const onRecordTimeUp = vi.fn();

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-expiry-cancel',
          session: { id: 'session-adv-expiry-cancel', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
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

      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(onRecordTimeUp).not.toHaveBeenCalled();
      expect(result.current.state.phase).toBe('TIME_EXPIRED');
    });
  });

  describe('Focus 5: Prevention of Duplicate Rotations on 00:00 Expiry', () => {
    it('guarantees zero duplicate rotation calls across rapid ticks, re-renders, and visibility changes', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn().mockResolvedValue(undefined);

      const { result, rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-no-dup',
          session: { id: 'session-adv-no-dup', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
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
        vi.advanceTimersByTime(600_000); // 00:00
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);

      // Stress test: Sit at 00:00 for 120 seconds with ticks firing every 250ms
      act(() => {
        vi.advanceTimersByTime(120_000);
      });

      // Stress test: Trigger 10 component re-renders
      for (let i = 0; i < 10; i++) {
        rerender();
      }

      // Stress test: Simulate tab backgrounding and foregrounding
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // onRecordTimeUp and confirmOverride MUST NOT have been called again!
      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus 6: Non-Admin Protection & Exception Shielding', () => {
    it('spectator never receives undo confirmation or 00:00 rotation prompts', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn();
      let events: any[] = [];

      // Setup a running session in storage
      const sessionId = 'session-adv-spectator';
      const runningState = {
        phase: 'PLAYING' as const,
        status: 'RUNNING' as const,
        deadline: BASE_TIME + 1_000,
        remainingMs: 1_000,
        phaseDurationMs: 600_000,
        lastGoalEventId: null,
        version: 1,
        updatedAt: BASE_TIME,
        previousState: null,
      };
      localStorage.setItem(
        `stattracker:timer:${sessionId}`,
        JSON.stringify({
          schemaVersion: 1,
          sessionId,
          state: runningState,
          savedAt: BASE_TIME,
        })
      );

      const { rerender } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId,
          session: { id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
          events,
          profile: spectatorProfile,
          onRecordTimeUp,
          confirmOverride,
          storageEnabled: true,
        })
      );

      // Goal scored and then undone
      events = [{ id: 'goal-spec-1', event_type: 'GOAL' }];
      rerender();
      events = [];
      rerender();

      // No confirm prompt shown to spectator
      expect(confirmOverride).not.toHaveBeenCalled();

      // Advance timers to trigger 00:00 expiration
      act(() => {
        vi.advanceTimersByTime(2_000);
      });

      // Still no confirm prompt, and onRecordTimeUp never called
      expect(confirmOverride).not.toHaveBeenCalled();
      expect(onRecordTimeUp).not.toHaveBeenCalled();
    });

    it('gracefully shields uncaught errors thrown by onRecordTimeUp', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn().mockRejectedValue(new Error('Supabase network error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-error',
          session: { id: 'session-adv-error', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' },
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

      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WinnerStaysTimer] Failed to record time up:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
