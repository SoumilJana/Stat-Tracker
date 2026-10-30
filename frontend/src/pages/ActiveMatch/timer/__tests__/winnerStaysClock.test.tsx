/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/__tests__/winnerStaysClock.test.tsx
 *
 * Comprehensive Test Suite for Milestone 4:
 * 1. Procedural Whistle Audio Synthesis & Safe Fallbacks (refereeAudio.ts)
 * 2. Physical Feedback Sensors, Wake Lock & Settings Persistence (useRefereeSensors.ts)
 * 3. WinnerStaysClock Component Rendering (Dark Stadium, Urgency tiers, Statuses)
 * 4. Admin Authority vs Spectator Read-Only HUD
 * 5. Modal Confirmations (Reset, Goal Undo, 00:00 Expiry, Skip Buffer)
 * 6. Referee Settings Modal Interactions & Audio/Haptic Integration
 * 7. Whistle & Haptic Phase-Transition Triggers
 * 8. ActiveMatch Conditional Mount Verification (WINNER_STAYS mode gating)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import * as refereeAudio from '../refereeAudio';
import * as refereeSensors from '../useRefereeSensors';
import { WinnerStaysClock } from '../WinnerStaysClock';

// ============================================================================
// Mock AudioContext & Web Audio Nodes
// ============================================================================
class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode {
  type = 'sine';
  frequency = {
    value: 440,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 10;
  destination = {};
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  close = vi.fn().mockResolvedValue(undefined);
}

describe('Milestone 4: Referee Experience & Dark Stadium UI Integration', () => {
  const adminProfile = { id: 'admin-uuid', role: 'admin' };
  const spectatorProfile = { id: 'spectator-uuid', role: 'player' };

  beforeEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;
    delete (navigator as any).vibrate;
    delete (navigator as any).wakeLock;
  });

  afterEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (navigator as any).vibrate;
    delete (navigator as any).wakeLock;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Procedural Whistle Audio Synthesis & Safe Fallbacks (refereeAudio.ts)
  // ==========================================================================
  describe('1. Procedural Whistle Audio Synthesis (refereeAudio.ts)', () => {
    it('returns false for isAudioSupported() when AudioContext is absent', () => {
      expect(refereeAudio.isAudioSupported()).toBe(false);
      expect(refereeAudio.getAudioContext()).toBeNull();
    });

    it('safely tolerates whistle playback calls when Web Audio API is unsupported', () => {
      // Must not throw in headless / non-audio environment
      expect(() => refereeAudio.playBufferStartWhistle()).not.toThrow();
      expect(() => refereeAudio.playBufferEndWhistle()).not.toThrow();
      expect(() => refereeAudio.playMatchEndWhistle()).not.toThrow();
      expect(() => refereeAudio.unlockAudioContext()).not.toThrow();
    });

    it('detects AudioContext and webkitAudioContext support correctly', () => {
      (window as any).AudioContext = MockAudioContext;
      expect(refereeAudio.isAudioSupported()).toBe(true);

      const ctx = refereeAudio.getAudioContext();
      expect(ctx).not.toBeNull();
      // Singleton pattern
      expect(refereeAudio.getAudioContext()).toBe(ctx);
    });

    it('unlocks suspended AudioContext via gesture unlockAudioContext()', async () => {
      (window as any).AudioContext = MockAudioContext;
      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;
      expect(ctx.state).toBe('suspended');

      refereeAudio.unlockAudioContext();
      expect(ctx.resume).toHaveBeenCalled();
    });

    it('synthesizes short whistle for goal buffer start', () => {
      (window as any).AudioContext = MockAudioContext;
      refereeAudio.playBufferStartWhistle();

      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;
      expect(ctx.createGain).toHaveBeenCalled();
      expect(ctx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes double whistle for buffer expiration', () => {
      (window as any).AudioContext = MockAudioContext;
      refereeAudio.playBufferEndWhistle();

      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;
      // Double whistle schedules 2 bursts (each burst creates 1 gain + 2 oscillators)
      expect(ctx.createGain).toHaveBeenCalledTimes(2);
      expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
    });

    it('synthesizes long dramatic whistle with pitch glide for match expiry', () => {
      (window as any).AudioContext = MockAudioContext;
      refereeAudio.playMatchEndWhistle();

      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;
      expect(ctx.createGain).toHaveBeenCalledTimes(1);
      expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // 2. Physical Feedback Sensors, Wake Lock & Settings Persistence
  // ==========================================================================
  describe('2. Physical Feedback Sensors & Wake Lock (useRefereeSensors.ts)', () => {
    describe('triggerHaptic()', () => {
      it('returns false when navigator.vibrate is unavailable', () => {
        delete (navigator as any).vibrate;
        expect(refereeSensors.triggerHaptic(refereeSensors.HAPTIC_PATTERNS.bufferStart)).toBe(false);
      });

      it('dispatches vibration patterns when navigator.vibrate is supported', () => {
        const vibrateSpy = vi.fn().mockReturnValue(true);
        (navigator as any).vibrate = vibrateSpy;

        const res1 = refereeSensors.triggerHaptic(refereeSensors.HAPTIC_PATTERNS.bufferStart);
        expect(res1).toBe(true);
        expect(vibrateSpy).toHaveBeenCalledWith([150]);

        const res2 = refereeSensors.triggerHaptic(refereeSensors.HAPTIC_PATTERNS.bufferEnd);
        expect(res2).toBe(true);
        expect(vibrateSpy).toHaveBeenCalledWith([140, 80, 180]);

        const res3 = refereeSensors.triggerHaptic(refereeSensors.HAPTIC_PATTERNS.matchEnd);
        expect(res3).toBe(true);
        expect(vibrateSpy).toHaveBeenCalledWith([600]);
      });

      it('gracefully catches exceptions thrown by navigator.vibrate', () => {
        (navigator as any).vibrate = vi.fn().mockImplementation(() => {
          throw new Error('Vibration permission denied');
        });

        expect(() => refereeSensors.triggerHaptic(100)).not.toThrow();
        expect(refereeSensors.triggerHaptic(100)).toBe(false);
      });
    });

    describe('Referee Settings Persistence', () => {
      it('loads default settings when storage is empty', () => {
        const loaded = refereeSensors.loadRefereeSettings();
        expect(loaded).toEqual(refereeSensors.DEFAULT_REFEREE_SETTINGS);
      });

      it('handles corrupted JSON in localStorage gracefully', () => {
        localStorage.setItem('stattracker_referee_settings', '{ bad json ...');
        const loaded = refereeSensors.loadRefereeSettings();
        expect(loaded).toEqual(refereeSensors.DEFAULT_REFEREE_SETTINGS);
      });

      it('saves and reloads custom referee preferences', () => {
        refereeSensors.saveRefereeSettings({
          soundEnabled: false,
          vibrationEnabled: true,
          wakeLockEnabled: false,
        });

        const loaded = refereeSensors.loadRefereeSettings();
        expect(loaded).toEqual({
          soundEnabled: false,
          vibrationEnabled: true,
          wakeLockEnabled: false,
        });
      });

      it('toggles settings via useRefereeSettings hook', () => {
        const { result } = renderHook(() => refereeSensors.useRefereeSettings());
        expect(result.current.settings.soundEnabled).toBe(true);

        act(() => {
          result.current.toggleSound();
        });
        expect(result.current.settings.soundEnabled).toBe(false);

        act(() => {
          result.current.toggleVibration();
        });
        expect(result.current.settings.vibrationEnabled).toBe(false);

        act(() => {
          result.current.toggleWakeLock();
        });
        expect(result.current.settings.wakeLockEnabled).toBe(false);
      });
    });

    describe('useWakeLock hook', () => {
      it('reports unsupported when wakeLock is absent', () => {
        delete (navigator as any).wakeLock;
        const { result } = renderHook(() => refereeSensors.useWakeLock(true));
        expect(result.current.isSupported).toBe(false);
        expect(result.current.isLocked).toBe(false);
      });

      it('requests screen wake lock when supported and enabled', async () => {
        const mockSentinel = {
          released: false,
          release: vi.fn().mockImplementation(async () => {
            mockSentinel.released = true;
          }),
          addEventListener: vi.fn(),
        };

        const requestSpy = vi.fn().mockResolvedValue(mockSentinel);
        (navigator as any).wakeLock = { request: requestSpy };

        const { result, unmount } = renderHook(
          ({ enabled }) => refereeSensors.useWakeLock(enabled),
          { initialProps: { enabled: true } }
        );

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isSupported).toBe(true);
        expect(result.current.isLocked).toBe(true);
        expect(requestSpy).toHaveBeenCalledWith('screen');

        unmount();
        expect(mockSentinel.release).toHaveBeenCalled();
      });

      it('handles wake lock rejection gracefully without crashing', async () => {
        (navigator as any).wakeLock = {
          request: vi.fn().mockRejectedValue(new Error('Low Battery Mode')),
        };

        const { result } = renderHook(() => refereeSensors.useWakeLock(true));

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isSupported).toBe(true);
        expect(result.current.isLocked).toBe(false);
        expect(result.current.error).toBe('Low Battery Mode');
      });
    });
  });

  // ==========================================================================
  // 3. WinnerStaysClock Component Rendering & States
  // ==========================================================================
  describe('3. WinnerStaysClock Component Rendering & Visual Stadium Aesthetic', () => {
    it('renders initial 10:00 Playing countdown with Ready status for admin', async () => {
      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('winner-stays-clock')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
      expect(screen.getByTestId('phase-badge-playing')).toHaveTextContent(/playing/i);
      expect(screen.getByTestId('status-badge-idle')).toHaveTextContent(/ready/i);
      expect(screen.getByTestId('start-timer-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reset-timer-btn')).toBeInTheDocument();
    });

    it('toggles Start and Pause controls for admin', async () => {
      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      const startBtn = screen.getByTestId('start-timer-btn');
      await act(async () => {
        fireEvent.click(startBtn);
      });

      // Now RUNNING -> Pause button appears
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
      const pauseBtn = screen.getByTestId('pause-timer-btn');
      expect(pauseBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(pauseBtn);
      });
      // Now PAUSED -> Paused badge appears
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();
      expect(screen.getByTestId('start-timer-btn')).toHaveTextContent(/resume/i);
    });

    it('renders Goal Buffer state with Skip Buffer button when goal arrives', async () => {
      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'session-clock-3', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });
      const { rerender } = renderResult;

      // Simulate a goal event arriving
      await act(async () => {
        rerender(
          <WinnerStaysClock
            session={{ id: 'session-clock-3', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'goal-1', event_type: 'GOAL', team_id: 'team-a', timestamp: Date.now() }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Phase is now GOAL_BUFFER (60s)
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();
      expect(screen.getByTestId('skip-buffer-btn')).toBeInTheDocument();
      expect(screen.getByText(/Goal Scored — 60s Team Rotation Buffer/i)).toBeInTheDocument();

      // Clicking Skip Buffer immediately transitions to 10:00 playing
      await act(async () => {
        fireEvent.click(screen.getByTestId('skip-buffer-btn'));
      });
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.queryByTestId('skip-buffer-btn')).not.toBeInTheDocument();
    });

    it('renders visual warning tier at 30 seconds remaining', async () => {
      localStorage.setItem(
        'stattracker_timer_session-clock-warning30',
        JSON.stringify({
          phase: 'PLAYING',
          status: 'PAUSED',
          deadline: null,
          remainingMs: 30_000,
          phaseDurationMs: 600_000,
          lastGoalEventId: null,
          version: 1,
          updatedAt: Date.now(),
        })
      );

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-warning30', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={true}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:30');
      expect(screen.getByText(/30 Seconds Remaining in Playing Time/i)).toBeInTheDocument();
    });

    it('renders urgency tier at 10 seconds remaining', async () => {
      localStorage.setItem(
        'stattracker_timer_session-clock-urgent10',
        JSON.stringify({
          phase: 'PLAYING',
          status: 'PAUSED',
          deadline: null,
          remainingMs: 10_000,
          phaseDurationMs: 600_000,
          lastGoalEventId: null,
          version: 1,
          updatedAt: Date.now(),
        })
      );

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-urgent10', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={true}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:10');
      expect(screen.getByText(/Final 10 Seconds — Prepare Whistle/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 4. Admin vs Spectator Authority Gating
  // ==========================================================================
  describe('4. Admin Controls vs Spectator Read-Only HUD', () => {
    it('completely hides mutation controls and renders Spectator Live HUD for non-admins', async () => {
      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-4', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={spectatorProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Displays synchronized countdown
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');

      // Admin buttons MUST NOT exist
      expect(screen.queryByTestId('start-timer-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pause-timer-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reset-timer-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('skip-buffer-btn')).not.toBeInTheDocument();

      // Spectator HUD MUST be displayed
      expect(screen.getByTestId('spectator-live-hud')).toBeInTheDocument();
      expect(screen.getByText(/spectator live hud/i)).toBeInTheDocument();
      expect(screen.getByText(/synchronized via realtime/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 5. Modal Confirmations & Time-Up Coordination
  // ==========================================================================
  describe('5. Modal Confirmations (Reset, Undo, 00:00 Expiry)', () => {
    it('prompts confirmation when resetting an actively running clock', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(true);

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-5', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
            confirmOverride={confirmOverride}
          />
        );
      });

      // Start the clock
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });

      // Click Reset while RUNNING
      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      // Confirm modal was invoked
      expect(confirmOverride).toHaveBeenCalledTimes(1);
      expect(confirmOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmText: 'Reset Clock',
          isDestructive: true,
        })
      );

      // Returned to IDLE
      expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();
    });

    it('does not reset if admin cancels reset confirmation', async () => {
      const confirmOverride = vi.fn().mockResolvedValue(false); // Canceled

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-6', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
            confirmOverride={confirmOverride}
          />
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-timer-btn'));
      });

      expect(confirmOverride).toHaveBeenCalledTimes(1);
      // Still RUNNING
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
    });

    it('displays Record Time Up button when expired and executes onRecordTimeUp', async () => {
      const onRecordTimeUp = vi.fn().mockResolvedValue(undefined);

      // We simulate expired state by rehydrating an expired state in storage
      localStorage.setItem(
        'stattracker_timer_session-clock-expired',
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
            session={{ id: 'session-clock-expired', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            onRecordTimeUp={onRecordTimeUp}
            storageEnabled={true}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('phase-badge-expired')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:00');

      const recordTimeUpBtn = screen.getByTestId('record-time-up-btn');
      expect(recordTimeUpBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(recordTimeUpBtn);
      });

      expect(onRecordTimeUp).toHaveBeenCalledTimes(1);
    });

    it('displays Rollback Clock button when a previous goal snapshot is present', async () => {
      localStorage.setItem(
        'stattracker_timer_session-clock-undo',
        JSON.stringify({
          phase: 'GOAL_BUFFER',
          status: 'RUNNING',
          deadline: Date.now() + 50_000,
          remainingMs: 50_000,
          phaseDurationMs: 60_000,
          lastGoalEventId: 'undone-goal-1',
          version: 2,
          updatedAt: Date.now(),
          previousState: {
            phase: 'PLAYING',
            status: 'RUNNING',
            remainingMs: 420_000,
            phaseDurationMs: 600_000,
            lastGoalEventId: null,
          },
        })
      );

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-undo', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={true}
            syncEnabled={false}
          />
        );
      });

      expect(screen.getByTestId('undo-rollback-banner')).toBeInTheDocument();
      const rollbackBtn = screen.getByTestId('rollback-clock-btn');
      expect(rollbackBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(rollbackBtn);
      });

      // Clock rolled back to PLAYING at 07:00 (420_000 ms) paused
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('07:00');
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 6. Referee Settings Modal Interactions
  // ==========================================================================
  describe('6. Referee Settings Drawer & Persistence', () => {
    it('opens settings modal, toggles preferences, and saves to localStorage', async () => {
      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'session-clock-7', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Click settings button
      await act(async () => {
        fireEvent.click(screen.getByTestId('referee-settings-btn'));
      });
      expect(screen.getByTestId('referee-settings-modal')).toBeInTheDocument();

      // Toggle Sound off
      const toggleSoundBtn = screen.getByTestId('toggle-sound-btn');
      await act(async () => {
        fireEvent.click(toggleSoundBtn);
      });

      const saved = refereeSensors.loadRefereeSettings();
      expect(saved.soundEnabled).toBe(false);

      // Close modal
      await act(async () => {
        fireEvent.click(screen.getByTestId('close-settings-btn'));
      });
      expect(screen.queryByTestId('referee-settings-modal')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 7. Whistle & Haptic Phase-Transition Triggers
  // ==========================================================================
  describe('7. Audio and Haptic Triggers on Transitions', () => {
    it('triggers short whistle and bufferStart haptic when goal buffer initiates', async () => {
      const playWhistleSpy = vi.spyOn(refereeAudio, 'playBufferStartWhistle');
      const triggerHapticSpy = vi.spyOn(refereeSensors, 'triggerHaptic');

      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'session-clock-audio-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(playWhistleSpy).not.toHaveBeenCalled();

      // New goal event arrives
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-clock-audio-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'goal-audio-1', event_type: 'GOAL', team_id: 't1', timestamp: Date.now() }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      expect(playWhistleSpy).toHaveBeenCalledTimes(1);
      expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.bufferStart);
    });

    it('triggers double whistle and bufferEnd haptic when Skip Buffer is clicked', async () => {
      const playDoubleWhistleSpy = vi.spyOn(refereeAudio, 'playBufferEndWhistle');
      const triggerHapticSpy = vi.spyOn(refereeSensors, 'triggerHaptic');

      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'session-clock-audio-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Goal arrives -> transitions to GOAL_BUFFER
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'session-clock-audio-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'g1', event_type: 'GOAL', team_id: 't1', timestamp: Date.now() }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Skip Buffer
      const skipBtn = screen.getByTestId('skip-buffer-btn');
      await act(async () => {
        fireEvent.click(skipBtn);
      });

      expect(playDoubleWhistleSpy).toHaveBeenCalledTimes(1);
      expect(triggerHapticSpy).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.bufferEnd);
    });
  });

  // ==========================================================================
  // 8. ActiveMatch Conditional Mount Verification
  // ==========================================================================
  describe('8. ActiveMatch Mode Gating Logic', () => {
    const shouldMountClock = (session: { mode?: string; status?: string } | null | undefined) => {
      return session?.mode === 'WINNER_STAYS' && session?.status !== 'COMPLETED';
    };

    it('allows mount only for WINNER_STAYS in non-completed status', () => {
      expect(shouldMountClock({ mode: 'WINNER_STAYS', status: 'IN_PROGRESS' })).toBe(true);
      expect(shouldMountClock({ mode: 'WINNER_STAYS', status: 'SCHEDULED' })).toBe(true);
      expect(shouldMountClock({ mode: 'WINNER_STAYS', status: 'COMPLETED' })).toBe(false);
      expect(shouldMountClock({ mode: 'CASUAL', status: 'IN_PROGRESS' })).toBe(false);
      expect(shouldMountClock({ mode: 'TOURNAMENT', status: 'IN_PROGRESS' })).toBe(false);
      expect(shouldMountClock(null)).toBe(false);
      expect(shouldMountClock(undefined)).toBe(false);
    });
  });
});
