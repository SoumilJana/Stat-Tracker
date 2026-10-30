/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Test Suite: frontend/src/pages/ActiveMatch/timer/__tests__/timerAdversarialM4_2.test.tsx
 *
 * Adversarial Challenge Suite M4_2: Role Authority, Confirmation Gates & Expiry Coordination
 *
 * Focus 1: Admin vs Non-Admin DOM Isolation across diverse roles (player, spectator, null, undefined, casing)
 * Focus 2: Reset Confirmation Flow (prompt when RUNNING, zero-prompt when PAUSED/IDLE)
 * Focus 3: Goal Undo Prompt & Clock Rollback (dialog options, rollback restore, banner fallback, non-admin isolation)
 * Focus 4: 00:00 Expiry Prompt & Record Time Up (full time detection, whistle/haptic, onRecordTimeUp coordination, double-click lock)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import * as refereeAudio from '../refereeAudio';
import * as refereeSensors from '../useRefereeSensors';
import { WinnerStaysClock } from '../WinnerStaysClock';
import { useWinnerStaysTimer } from '../useWinnerStaysTimer';

describe('Adversarial Challenge M4_2: Role & Confirmations Verification', () => {
  const adminProfile = { id: 'admin-1', role: 'admin' };

  beforeEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (navigator as any).vibrate;
    delete (navigator as any).wakeLock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Focus 1: Admin vs Non-Admin DOM Isolation
  // ==========================================================================
  describe('Focus 1: Admin vs Non-Admin DOM & Mutation Isolation', () => {
    const nonAdminProfiles = [
      { desc: "role = 'player'", profile: { id: 'p1', role: 'player' } },
      { desc: "role = 'spectator'", profile: { id: 's1', role: 'spectator' } },
      { desc: "role = 'user'", profile: { id: 'u1', role: 'user' } },
      { desc: "role = 'coach'", profile: { id: 'c1', role: 'coach' } },
      { desc: "role = 'ADMIN' (uppercase)", profile: { id: 'a-up', role: 'ADMIN' } },
      { desc: "role = 'admin ' (trailing whitespace)", profile: { id: 'a-ws', role: 'admin ' } },
      { desc: 'role = undefined', profile: { id: 'no-role' } },
      { desc: 'role = null', profile: { id: 'null-role', role: null } },
      { desc: 'profile = null', profile: null },
      { desc: 'profile = undefined', profile: undefined },
    ];

    nonAdminProfiles.forEach(({ desc, profile }) => {
      it(`strictly omits all mutation buttons in DOM when ${desc}`, async () => {
        // Pre-populate storage with an expired state containing a previous snapshot to stress-test all conditional banners
        const stateKey = 'stattracker_timer_session-adv-dom';
        localStorage.setItem(
          stateKey,
          JSON.stringify({
            phase: 'GOAL_BUFFER',
            status: 'RUNNING',
            deadline: Date.now() + 30_000,
            remainingMs: 30_000,
            phaseDurationMs: 60_000,
            lastGoalEventId: 'g-test-1',
            version: 1,
            updatedAt: Date.now(),
            previousState: {
              phase: 'PLAYING',
              status: 'RUNNING',
              remainingMs: 300_000,
              phaseDurationMs: 600_000,
              lastGoalEventId: null,
            },
          })
        );

        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'session-adv-dom', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={profile}
              onRecordTimeUp={vi.fn()}
              storageEnabled={true}
              syncEnabled={false}
            />
          );
        });

        // 1. Core mutation buttons MUST NOT exist in DOM
        expect(screen.queryByTestId('start-timer-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pause-timer-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('reset-timer-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('skip-buffer-btn')).not.toBeInTheDocument();

        // 2. Goal Undo Rollback banner and button MUST NOT exist in DOM
        expect(screen.queryByTestId('undo-rollback-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('rollback-clock-btn')).not.toBeInTheDocument();

        // 3. Time Up Record button and banner MUST NOT exist in DOM
        expect(screen.queryByTestId('time-up-record-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('record-time-up-btn')).not.toBeInTheDocument();

        // 4. Spectator Live HUD MUST be rendered
        expect(screen.getByTestId('spectator-live-hud')).toBeInTheDocument();
        expect(screen.getByText(/Spectator Live HUD/i)).toBeInTheDocument();
        expect(screen.getByText(/Synchronized via Realtime/i)).toBeInTheDocument();
      });
    });

    it('blocks direct hook mutation method invocations for non-admin callers', async () => {
      const { result } = renderHook(() =>
        useWinnerStaysTimer({
          sessionId: 'session-adv-hook',
          session: { id: 'session-adv-hook', mode: 'WINNER_STAYS' },
          profile: { id: 'p1', role: 'player' },
          storageEnabled: false,
          syncEnabled: false,
        })
      );

      expect(result.current.isAdmin).toBe(false);
      const initialState = result.current.state;

      // Attempting start
      act(() => {
        result.current.start();
      });
      expect(result.current.state).toEqual(initialState);
      expect(result.current.state.status).toBe('IDLE');

      // Attempting pause
      act(() => {
        result.current.pause();
      });
      expect(result.current.state).toEqual(initialState);

      // Attempting reset
      let resetResult: boolean | undefined;
      await act(async () => {
        resetResult = await result.current.reset();
      });
      expect(resetResult).toBe(false);
      expect(result.current.state).toEqual(initialState);

      // Attempting skip buffer
      act(() => {
        result.current.skip();
      });
      expect(result.current.state).toEqual(initialState);
      expect(result.current.state.phase).toBe('PLAYING');

      // Attempting rollback
      let rollbackResult: boolean | undefined;
      await act(async () => {
        rollbackResult = await result.current.rollback();
      });
      expect(rollbackResult).toBe(false);
    });
  });

  // ==========================================================================
  // Focus 2: Reset Confirmation Flow
  // ==========================================================================
  describe('Focus 2: Reset Confirmation Flow', () => {
    it('prompts confirmation when resetting while actively RUNNING and resets on confirmation', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-adv-reset-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Start the clock
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();

      // Click Reset while RUNNING
      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reset Match Clock?',
          confirmText: 'Reset Clock',
          cancelText: 'Cancel',
          variant: 'danger',
          isDestructive: true,
          description: expect.stringContaining('10-minute Playing Clock'),
        })
      );

      // After confirmation, state returns to IDLE at 10:00
      expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
    });

    it('aborts reset when admin cancels the confirmation modal while RUNNING', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false); // User clicked Cancel

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-adv-reset-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      expect(confirmOverride).toHaveBeenCalledTimes(1);
      // Must remain in RUNNING status without resetting
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
      expect(screen.queryByTestId('status-badge-idle')).not.toBeInTheDocument();
    });

    it('resets IMMEDIATELY WITHOUT PROMPT when clock is PAUSED', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-adv-reset-paused', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Start clock
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      // Pause clock
      await act(async () => {
        fireEvent.click(screen.getByTestId('pause-timer-btn'));
      });
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();

      // Click Reset while PAUSED
      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      // ZERO prompts must be triggered!
      expect(confirmOverride).not.toHaveBeenCalled();
      // Resets immediately to IDLE 10:00
      expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
    });

    it('resets IMMEDIATELY WITHOUT PROMPT when clock is IDLE', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-adv-reset-idle', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();

      // Click Reset while IDLE
      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      // Confirm modal must NOT be called
      expect(confirmOverride).not.toHaveBeenCalled();
      expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();
    });

    it('customizes reset prompt description for 60s Goal Buffer phase when running', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);

      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'session-adv-reset-buf', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // A goal event arrives -> transitions to GOAL_BUFFER (RUNNING)
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-adv-reset-buf', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'g-buf-1', event_type: 'GOAL', timestamp: Date.now() }]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();

      // Click reset while running in Goal Buffer
      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('60-second Goal Buffer'),
        })
      );
    });
  });

  // ==========================================================================
  // Focus 3: Goal Undo Prompt & Clock Rollback
  // ==========================================================================
  describe('Focus 3: Goal Undo Prompt & Rollback Coordination', () => {
    it('prompts rollback when an active goal is deleted from events stream and restores previous playing clock', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true); // Admin accepts rollback

      let renderResult: any;
      const initialGoal = { id: 'goal-to-undo-1', event_type: 'GOAL', timestamp: Date.now() };

      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // 1. Goal scored -> transitions to GOAL_BUFFER at 60s
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[initialGoal]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // 2. Goal undone (events array becomes empty)
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Confirm dialog must be invoked with rollback options
      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Goal Undone — Revert Match Clock?',
          confirmText: 'Rollback Clock',
          cancelText: 'Keep Current Clock',
          variant: 'warning',
        })
      );

      // Rollback restores previous playing phase (10:00 PAUSED)
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
    });

    it('clears previousState and does not prompt repeatedly if admin cancels rollback prompt', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false); // Admin opts to keep current clock

      let renderResult: any;
      const initialGoal = { id: 'goal-to-undo-2', event_type: 'GOAL', timestamp: Date.now() };

      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Goal scored
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[initialGoal]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Goal undone
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(confirmOverride).toHaveBeenCalledTimes(1);

      // Kept in GOAL_BUFFER
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // Subsequent re-render with the same empty events array must NOT trigger second prompt
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-adv-undo-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            confirmOverride={confirmOverride}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(confirmOverride).toHaveBeenCalledTimes(1);
    });

    it('allows manual clock rollback from the dedicated rollback banner button', async () => {
      localStorage.setItem(
        'stattracker_timer_session-adv-banner-undo',
        JSON.stringify({
          phase: 'GOAL_BUFFER',
          status: 'RUNNING',
          deadline: Date.now() + 45_000,
          remainingMs: 45_000,
          phaseDurationMs: 60_000,
          lastGoalEventId: 'undone-goal-x',
          version: 2,
          updatedAt: Date.now(),
          previousState: {
            phase: 'PLAYING',
            status: 'RUNNING',
            remainingMs: 512_000, // 08:32
            phaseDurationMs: 600_000,
            lastGoalEventId: null,
          },
        })
      );

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-adv-banner-undo', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={true}
            syncEnabled={false}
          />
        );
      });

      const banner = screen.getByTestId('undo-rollback-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Goal undo detected/i);

      const rollbackBtn = screen.getByTestId('rollback-clock-btn');
      expect(rollbackBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(rollbackBtn);
      });

      // Restored to Playing at 08:32 (PAUSED)
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('08:32');
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();
      // Banner dismissed
      expect(screen.queryByTestId('undo-rollback-banner')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Focus 4: 00:00 Expiry Prompt & Record Time Up
  // ==========================================================================
  describe('Focus 4: 00:00 Expiry Prompt & onRecordTimeUp Coordination', () => {
    it('triggers whistle, haptic, and prompts admin to record time up when countdown reaches 00:00', async () => {
      const matchEndWhistleSpy = vi.spyOn(refereeAudio, 'playMatchEndWhistle');
      const triggerHapticSpy = vi.spyOn(refereeSensors, 'triggerHaptic');
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn().mockResolvedValue(undefined);

      vi.useFakeTimers();

      try {
        const { result } = renderHook(() =>
          useWinnerStaysTimer({
            sessionId: 'session-adv-expiry',
            session: { id: 'session-adv-expiry', mode: 'WINNER_STAYS' },
            profile: adminProfile,
            onRecordTimeUp,
            confirmOverride,
            onPhaseExpire: (expiredPhase) => {
              if (expiredPhase === 'PLAYING') {
                refereeAudio.playMatchEndWhistle();
                refereeSensors.triggerHaptic(refereeSensors.HAPTIC_PATTERNS.matchEnd);
              }
            },
            storageEnabled: false,
            syncEnabled: false,
          })
        );

        // Start clock
        act(() => {
          result.current.start();
        });
        expect(result.current.state.status).toBe('RUNNING');

        // Fast forward 10 minutes (600,000ms)
        await act(async () => {
          vi.advanceTimersByTime(600_000);
        });

        // 1. Sensory triggers executed
        expect(matchEndWhistleSpy).toHaveBeenCalledTimes(1);
        expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.matchEnd);

        // 2. Timer state transitioned to TIME_EXPIRED
        expect(result.current.state.phase).toBe('TIME_EXPIRED');
        expect(result.current.remainingMs).toBe(0);
        expect(result.current.formattedTime).toBe('00:00');

        // 3. Confirm modal was triggered
        expect(confirmOverride).toHaveBeenCalledTimes(1);
        expect(confirmOverride).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Full Time — Playing Clock Expired',
            confirmText: 'Record Time Up',
            cancelText: 'Keep Current Teams',
            variant: 'warning',
          })
        );

        // 4. onRecordTimeUp was called
        expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('renders prominent Time Up banner on 00:00 and invokes onRecordTimeUp with double-click guard', async () => {
      let resolvePromise: () => void;
      const deferredPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onRecordTimeUp = vi.fn().mockImplementation(() => deferredPromise);

      localStorage.setItem(
        'stattracker_timer_session-adv-timeup-banner',
        JSON.stringify({
          phase: 'TIME_EXPIRED',
          status: 'IDLE',
          deadline: null,
          remainingMs: 0,
          phaseDurationMs: 600_000,
          lastGoalEventId: null,
          version: 1,
          updatedAt: Date.now(),
        })
      );

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-adv-timeup-banner', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            onRecordTimeUp={onRecordTimeUp}
            storageEnabled={true}
            syncEnabled={false}
          />
        );
      });

      const banner = screen.getByTestId('time-up-record-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Match Countdown Reached 00:00/i);
      expect(banner).toHaveTextContent(/Record No-Goal Time Up to execute Winner Stays team rotation/i);

      const recordBtn = screen.getByTestId('record-time-up-btn');
      expect(recordBtn).toBeInTheDocument();
      expect(recordBtn).not.toBeDisabled();

      // First click
      await act(async () => {
        fireEvent.click(recordBtn);
      });

      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
      // While pending, button is disabled with text 'Recording...'
      expect(recordBtn).toBeDisabled();
      expect(recordBtn).toHaveTextContent(/Recording.../i);

      // Attempt second click while pending (must be ignored)
      await act(async () => {
        fireEvent.click(recordBtn);
      });
      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);

      // Resolve the operation
      await act(async () => {
        resolvePromise!();
      });

      expect(recordBtn).not.toBeDisabled();
      expect(recordBtn).toHaveTextContent(/Record Time Up/i);
    });

    it('does not trigger onRecordTimeUp prompt for non-admin viewers on 00:00 expiry', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);
      const onRecordTimeUp = vi.fn().mockResolvedValue(undefined);

      vi.useFakeTimers();

      try {
        renderHook(() =>
          useWinnerStaysTimer({
            sessionId: 'session-adv-spec-expiry',
            session: { id: 'session-adv-spec-expiry', mode: 'WINNER_STAYS' },
            profile: { id: 'spec-1', role: 'spectator' },
            onRecordTimeUp,
            confirmOverride,
            storageEnabled: false,
            syncEnabled: false,
          })
        );

        // Simulate state expiring
        act(() => {
          // Non-admin can't start, but tick might evaluate expiry
          vi.advanceTimersByTime(600_000);
        });

        // Non-admin must NEVER trigger confirm modal or recordTimeUp
        expect(confirmOverride).not.toHaveBeenCalled();
        expect(onRecordTimeUp).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
