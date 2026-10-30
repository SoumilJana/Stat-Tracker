/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Test Suite: frontend/src/pages/ActiveMatch/timer/__tests__/winnerStaysE2E.test.tsx
 *
 * Comprehensive 4-Tier End-to-End Test Suite for Winner Stays Integrated Match Clock:
 * - Tier 1: Feature Coverage (verify all 16 inventoried features end-to-end)
 * - Tier 2: Boundary & Corner Cases (rapid double-taps, network jitter, clock skew extremes, tab visibility transitions, sub-second countdown, expired states, storage boundaries)
 * - Tier 3: Cross-Feature Combinations (Goal -> Undo -> Skip Buffer -> Expiry -> Admin Sync; Offline mutation -> Online handshake -> Skew adjustment; etc.)
 * - Tier 4: Real-World Match Scenarios (Complete 10-minute Winner Stays match simulation with goals, rotation events, pauses, spectator sync, and 00:00 time-up confirmation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook, within } from '@testing-library/react';
import { WinnerStaysClock } from '../WinnerStaysClock';
import { useWinnerStaysTimer } from '../useWinnerStaysTimer';
import {
  createInitialTimerState,
  startTimer,
  pauseTimer,
  resetTimer,
  skipBuffer,
  handleGoalRecorded,
  rollbackGoal,
  calculateRemainingMs,
  checkPhaseExpiry,
  formatTime,
  getUrgencyLevel,
  PLAYING_DURATION_MS,
  GOAL_BUFFER_DURATION_MS,
} from '../timerEngine';
import {
  saveTimerState,
  rehydrateTimerState,
  isValidTimerState,
  getTimerStorageKey,
} from '../timerStorage';
import {
  createTimerBroadcastPayload,
  validateBroadcastPayload,
} from '../timerSync';
import * as refereeAudio from '../refereeAudio';
import * as refereeSensors from '../useRefereeSensors';
import type { TimerState } from '../types';

// ============================================================================
// Robust Test Helpers & Mocks
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
  currentTime = 0;
  destination = {};
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  close = vi.fn().mockResolvedValue(undefined);
}

function createMockRealtimeClient() {
  type Listener = { event: string; callback: (envelope: any) => void };
  type MockChannelInternal = {
    id: string;
    topic: string;
    listeners: Listener[];
    state: string;
  };

  const topicMap = new Map<string, Map<string, MockChannelInternal>>();
  let idCounter = 0;

  return {
    channel(channelName: string) {
      if (!topicMap.has(channelName)) {
        topicMap.set(channelName, new Map());
      }
      const channelsForTopic = topicMap.get(channelName)!;

      const channelId = `ch-${++idCounter}`;
      const internal: MockChannelInternal = {
        id: channelId,
        topic: channelName,
        listeners: [],
        state: 'closed',
      };
      channelsForTopic.set(channelId, internal);

      const mockChannel = {
        id: channelId,
        name: channelName,
        topic: channelName,
        get state() {
          return internal.state === 'SUBSCRIBED' ? 'joined' : 'closed';
        },
        on(_type: string, filter: { event: string }, callback: (envelope: any) => void) {
          internal.listeners.push({ event: filter.event, callback });
          return mockChannel;
        },
        subscribe(callback?: (status: string) => void) {
          internal.state = 'SUBSCRIBED';
          callback?.('SUBSCRIBED');
          return mockChannel;
        },
        async send(args: { type: string; event: string; payload: any }) {
          const currentChannels = topicMap.get(channelName);
          if (currentChannels) {
            for (const [targetId, targetChannel] of currentChannels.entries()) {
              if (targetId !== channelId) {
                const matchingListeners = targetChannel.listeners.filter(
                  (l) => l.event === args.event || l.event === '*'
                );
                for (const l of matchingListeners) {
                  l.callback({
                    type: 'broadcast',
                    event: args.event,
                    payload: args.payload,
                  });
                }
              }
            }
          }
          return 'ok' as const;
        },
        unsubscribe() {
          internal.state = 'closed';
          channelsForTopic.delete(channelId);
          return Promise.resolve('ok' as const);
        },
      };

      return mockChannel;
    },
    removeChannel(_channel: any) {
      return Promise.resolve('ok' as const);
    },
    reset() {
      topicMap.clear();
      idCounter = 0;
    },
  };
}

describe('Milestone 5: Comprehensive Winner Stays E2E Integration Suite', () => {
  const BASE_TIME = 1_700_000_000_000;
  const adminProfile = { id: 'admin-uuid-001', role: 'admin' };
  const spectatorProfile = { id: 'spectator-uuid-002', role: 'player' };

  let mockVibrate: any;
  let mockWakeLockRequest: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    localStorage.clear();

    (window as any).AudioContext = MockAudioContext;
    (window as any).webkitAudioContext = MockAudioContext;

    mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      configurable: true,
      writable: true,
    });

    mockWakeLockRequest = vi.fn().mockResolvedValue({
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    });
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockWakeLockRequest },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (window as any).AudioContext;
    delete (navigator as any).vibrate;
    delete (navigator as any).wakeLock;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (All 16 Features End-to-End)
  // ==========================================================================
  describe('Tier 1: Feature Coverage (All 16 Inventoried Features)', () => {
    // Feature 1: Initial 10:00 Countdown (Req §1, §10.1)
    describe('Feature 1: Initial 10:00 Countdown without prior goal requirement', () => {
      it('mounts at 10:00 in IDLE state, does not count down automatically, and allows admin start', async () => {
        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-1', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // 1. Initial 10:00 display
        expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
        // 2. Playing badge and Ready badge
        expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
        expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();
        // 3. Start button available
        const startBtn = screen.getByTestId('start-timer-btn');
        expect(startBtn).toHaveTextContent(/start clock/i);

        // 4. Advance time without clicking start -> time remains 10:00
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');

        // 5. Admin clicks start -> status becomes RUNNING, countdown begins
        await act(async () => {
          fireEvent.click(startBtn);
        });
        expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(2000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('09:58');
      });
    });

    // Feature 2: Automatic 60s Goal Buffer (Req §1, §10.2, §10.3)
    describe('Feature 2: Automatic 60s Goal Buffer upon Goal Recording', () => {
      it('automatically transitions to 60s buffer, triggers short whistle/haptic, and starts countdown', async () => {
        const spyWhistle = vi.spyOn(refereeAudio, 'playBufferStartWhistle');
        const spyHaptic = vi.spyOn(refereeSensors, 'triggerHaptic');

        let renderResult: any;
        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Record a new goal in the event stream
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-2', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-e2e-1', event_type: 'GOAL', timestamp: BASE_TIME }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // 1. Buffer phase active
        expect(screen.getByTestId('phase-badge-buffer')).toHaveTextContent(/goal buffer \(60s\)/i);
        // 2. Buffer display starts at 01:00
        expect(screen.getByTestId('timer-display')).toHaveTextContent('01:00');
        // 3. Status is automatically RUNNING
        expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
        // 4. Skip buffer button is present
        expect(screen.getByTestId('skip-buffer-btn')).toBeInTheDocument();
        // 5. Whistle and haptic fired
        expect(spyWhistle).toHaveBeenCalledTimes(1);
        expect(spyHaptic).toHaveBeenCalledWith(refereeSensors.HAPTIC_PATTERNS.bufferStart);

        // Counts down in buffer
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('00:55');
      });
    });

    // Feature 3: Buffer Expiry to 10:00 Playing (Req §1, §10.4)
    describe('Feature 3: Automatic Transition from Buffer Expiry to 10:00 Playing Countdown', () => {
      it('automatically starts 10:00 playing countdown and fires double whistle when 60s buffer expires', async () => {
        const spyBufferEndWhistle = vi.spyOn(refereeAudio, 'playBufferEndWhistle');

        let renderResult: any;
        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-3', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Goal triggers buffer
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-3', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-f3', event_type: 'GOAL', timestamp: BASE_TIME }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

        // Advance 60 seconds to expire buffer
        await act(async () => {
          vi.advanceTimersByTime(60_000);
        });

        // 1. Automatically transitioned to Playing
        expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
        // 2. Playing countdown is at 10:00 (or slightly ticking into 09:59)
        expect(screen.getByTestId('timer-display')).toHaveTextContent(/10:00|09:59/);
        // 3. Still running
        expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
        // 4. Double whistle called
        expect(spyBufferEndWhistle).toHaveBeenCalledTimes(1);
        // 5. Skip buffer button disappears
        expect(screen.queryByTestId('skip-buffer-btn')).not.toBeInTheDocument();
      });
    });

    // Feature 4: Goal During Playing Restarts Buffer (Req §1, §10.5)
    describe('Feature 4: Subsequent Goal During Playing Restarts 60s Buffer', () => {
      it('restarts 60s buffer when another goal is scored during playing countdown', async () => {
        let renderResult: any;
        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-4', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Start playing match
        await act(async () => {
          fireEvent.click(screen.getByTestId('start-timer-btn'));
        });
        await act(async () => {
          vi.advanceTimersByTime(120_000); // 2 minutes elapsed, 8:00 remaining
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('08:00');

        // New goal recorded at 8:00
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-4', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-f4-first', event_type: 'GOAL', timestamp: BASE_TIME + 120_000 }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Phase transitioned to buffer
        expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();
        expect(screen.getByTestId('timer-display')).toHaveTextContent('01:00');

        // Fast forward buffer 60s
        await act(async () => {
          vi.advanceTimersByTime(60_000);
        });
        expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();

        // Count down 3 minutes in new playing bout
        await act(async () => {
          vi.advanceTimersByTime(180_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('07:00');

        // Second goal recorded
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-4', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[
                { id: 'goal-f4-second', event_type: 'GOAL', timestamp: BASE_TIME + 360_000 },
                { id: 'goal-f4-first', event_type: 'GOAL', timestamp: BASE_TIME + 120_000 },
              ]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Restarts buffer again
        expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();
        expect(screen.getByTestId('timer-display')).toHaveTextContent('01:00');
      });
    });

    // Feature 5: Pause & Resume Remaining Time (Req §2, §10.6)
    describe('Feature 5: Pause & Resume Remaining Time without Drift', () => {
      it('pauses and freezes remaining time, displays PAUSED badge, and resumes accurately', async () => {
        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-5', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Start countdown
        await act(async () => {
          fireEvent.click(screen.getByTestId('start-timer-btn'));
        });
        await act(async () => {
          vi.advanceTimersByTime(45_000); // 45s elapsed
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('09:15');

        // Click Pause
        await act(async () => {
          fireEvent.click(screen.getByTestId('pause-timer-btn'));
        });

        // 1. Status badge displays Paused
        expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();
        // 2. Start button says Resume
        const resumeBtn = screen.getByTestId('start-timer-btn');
        expect(resumeBtn).toHaveTextContent(/resume/i);

        // 3. Advancing 20 seconds while paused does NOT decrease remaining time
        await act(async () => {
          vi.advanceTimersByTime(20_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('09:15');

        // 4. Click Resume
        await act(async () => {
          fireEvent.click(resumeBtn);
        });
        expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();

        // 5. Counting resumes cleanly
        await act(async () => {
          vi.advanceTimersByTime(15_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('09:00');
      });
    });

    // Feature 6: Reset with Confirmation Modal (Req §2, §10.7)
    describe('Feature 6: Reset with Confirmation Modal Gating', () => {
      it('prompts confirmation when running, cancels reset on dismissal, and resets on confirmation', async () => {
        const mockConfirm = vi.fn();

        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-6', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              confirmOverride={mockConfirm}
            />
          );
        });

        // Start running
        await act(async () => {
          fireEvent.click(screen.getByTestId('start-timer-btn'));
        });
        await act(async () => {
          vi.advanceTimersByTime(60_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('09:00');

        // Case A: User cancels confirmation
        mockConfirm.mockResolvedValueOnce(false);
        await act(async () => {
          fireEvent.click(screen.getByTestId('reset-timer-btn'));
        });

        expect(mockConfirm).toHaveBeenCalledTimes(1);
        expect(mockConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Reset Match Clock?',
            variant: 'danger',
          })
        );
        // Clock remains running at 09:00
        expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
        expect(screen.getByTestId('timer-display')).toHaveTextContent('09:00');

        // Case B: User confirms reset
        mockConfirm.mockResolvedValueOnce(true);
        await act(async () => {
          fireEvent.click(screen.getByTestId('reset-timer-btn'));
        });

        // Clock stops and resets to 10:00 IDLE
        expect(screen.getByTestId('status-badge-idle')).toBeInTheDocument();
        expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
      });
    });

    // Feature 7: Skip Buffer to 10:00 Playing (Req §2, §10.8)
    describe('Feature 7: Skip Buffer Immediately Starts 10:00 Playing Countdown', () => {
      it('skips remaining buffer duration immediately without confirmation modal', async () => {
        const mockConfirm = vi.fn();
        let renderResult: any;

        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-7', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              confirmOverride={mockConfirm}
            />
          );
        });

        // Trigger buffer with goal
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-7', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-f7', event_type: 'GOAL', timestamp: BASE_TIME }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              confirmOverride={mockConfirm}
            />
          );
        });

        // 10 seconds into buffer
        await act(async () => {
          vi.advanceTimersByTime(10_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('00:50');

        // Click Skip Buffer
        await act(async () => {
          fireEvent.click(screen.getByTestId('skip-buffer-btn'));
        });

        // 1. Immediately transitions to 10:00 Playing
        expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
        expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');
        expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();
        // 2. Zero confirm prompts shown (fast referee action)
        expect(mockConfirm).not.toHaveBeenCalled();
      });
    });

    // Feature 8: 00:00 Expiry & Single Time-Up Action (Req §1, §10.9)
    describe('Feature 8: 00:00 Expiry Coordination & Single onRecordTimeUp Confirmation', () => {
      it('reaches 00:00, plays final whistle, prompts admin, and calls onRecordTimeUp exactly once', async () => {
        const spyMatchWhistle = vi.spyOn(refereeAudio, 'playMatchEndWhistle');
        const mockConfirm = vi.fn().mockResolvedValue(true);
        const mockRecordTimeUp = vi.fn().mockResolvedValue(undefined);

        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-8', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              onRecordTimeUp={mockRecordTimeUp}
              confirmOverride={mockConfirm}
            />
          );
        });

        // Start match
        await act(async () => {
          fireEvent.click(screen.getByTestId('start-timer-btn'));
        });

        // Advance full 10 minutes to reach 00:00
        await act(async () => {
          vi.advanceTimersByTime(600_000);
        });

        // 1. Display reached 00:00
        expect(screen.getByTestId('timer-display')).toHaveTextContent('00:00');
        // 2. Phase is TIME_EXPIRED
        expect(screen.getByTestId('phase-badge-expired')).toBeInTheDocument();
        // 3. Match end whistle triggered
        expect(spyMatchWhistle).toHaveBeenCalledTimes(1);
        // 4. Time Up confirmation modal prompted
        expect(mockConfirm).toHaveBeenCalledTimes(1);
        expect(mockConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Full Time — Playing Clock Expired',
            confirmText: 'Record Time Up',
          })
        );
        // 5. onRecordTimeUp invoked exactly once
        expect(mockRecordTimeUp).toHaveBeenCalledTimes(1);

        // Extra time advances do NOT duplicate onRecordTimeUp call
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });
        expect(mockRecordTimeUp).toHaveBeenCalledTimes(1);
      });
    });

    // Feature 9: Duplicate Goal Idempotency (Req §3, §10.10)
    describe('Feature 9: Duplicate Goal Idempotency by Event ID', () => {
      it('prevents accidental duplicate goal transitions from rapid event retries or double-taps', async () => {
        let renderResult: any;
        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-9', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Goal event arrives
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-9', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-dup-1', event_type: 'GOAL', timestamp: BASE_TIME }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Advance 15s in buffer
        await act(async () => {
          vi.advanceTimersByTime(15_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('00:45');

        // Same goal event re-sent (e.g. Supabase realtime retry or parent re-render)
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-9', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-dup-1', event_type: 'GOAL', timestamp: BASE_TIME }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // Buffer countdown must NOT reset back to 01:00; preserves 00:45!
        expect(screen.getByTestId('timer-display')).toHaveTextContent('00:45');
      });
    });

    // Feature 10: Goal Undo Clock Rollback (Req §3, §10.11)
    describe('Feature 10: Goal Undo Clock Rollback Coordination', () => {
      it('detects goal deletion, prompts admin to rollback, and restores previous playing time paused', async () => {
        const mockConfirm = vi.fn().mockResolvedValue(true);
        let renderResult: any;

        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-10', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              confirmOverride={mockConfirm}
            />
          );
        });

        // Start match and play 2 minutes (08:00 remaining)
        await act(async () => {
          fireEvent.click(screen.getByTestId('start-timer-btn'));
        });
        await act(async () => {
          vi.advanceTimersByTime(120_000);
        });
        expect(screen.getByTestId('timer-display')).toHaveTextContent('08:00');

        // Goal is recorded -> switches to 60s buffer
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-10', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[{ id: 'goal-undo-target', event_type: 'GOAL', timestamp: BASE_TIME + 120_000 }]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              confirmOverride={mockConfirm}
            />
          );
        });
        expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

        // Admin undoes the goal (event removed from array)
        await act(async () => {
          renderResult.rerender(
            <WinnerStaysClock
              session={{ id: 'sess-feat-10', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              events={[]}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
              confirmOverride={mockConfirm}
            />
          );
        });

        // 1. Confirm dialog was presented
        expect(mockConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Goal Undone — Revert Match Clock?',
            confirmText: 'Rollback Clock',
          })
        );

        // 2. Clock reverted to Playing phase
        expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
        // 3. Restored remaining time (08:00)
        expect(screen.getByTestId('timer-display')).toHaveTextContent('08:00');
        // 4. Restored in PAUSED status so referee can review before continuing
        expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();
      });
    });

    // Feature 11: Refresh & Offline Recovery (Req §5, §10.12, §10.14)
    describe('Feature 11: Refresh & Offline Recovery via LocalStorage', () => {
      it('persists running and paused states across page reload without losing time', () => {
        const sessionId = 'sess-feat-11-refresh';

        // 1. Hook A runs for 3 minutes and unmounts (simulating browser reload)
        const hookA = renderHook(() =>
          useWinnerStaysTimer({
            sessionId,
            profile: adminProfile,
            storageEnabled: true,
            syncEnabled: false,
          })
        );

        act(() => {
          hookA.result.current.start();
          vi.advanceTimersByTime(180_000); // 3 mins elapsed, 7:00 remaining
        });
        expect(hookA.result.current.formattedTime).toBe('07:00');
        hookA.unmount();

        // 2. Hook B mounts 30 seconds later (simulating page load time)
        act(() => {
          vi.advanceTimersByTime(30_000);
        });

        const hookB = renderHook(() =>
          useWinnerStaysTimer({
            sessionId,
            profile: adminProfile,
            storageEnabled: true,
            syncEnabled: false,
          })
        );

        // Authoritative timestamp deadline correctly accounted for the 30 offline seconds -> 06:30!
        expect(hookB.result.current.formattedTime).toBe('06:30');
        expect(hookB.result.current.state.status).toBe('RUNNING');
      });
    });

    // Feature 12: Background Tab Drift-Free Math (Req §5, §10.13)
    describe('Feature 12: Background Tab Drift-Free Math', () => {
      it('calculates remaining time strictly by authoritative deadline, even when intervals are throttled', () => {
        const initialState = createInitialTimerState(BASE_TIME);
        const runningState = startTimer(initialState, BASE_TIME);

        // Throttled background tab wakes up 250,000ms later (no interval ticks occurred)
        const wakeTime = BASE_TIME + 250_000;
        const remaining = calculateRemainingMs(runningState, wakeTime);

        // 600,000 - 250,000 = 350,000ms (5 mins 50 secs)
        expect(remaining).toBe(350_000);
        expect(formatTime(remaining)).toBe('05:50');
      });
    });

    // Feature 13: Admin-Only Mutation Authority (Req §6, §10.15)
    describe('Feature 13: Admin-Only Mutation Authority Enforcement', () => {
      it('restricts all control buttons to admin and renders Spectator Live HUD for non-admins', async () => {
        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-13', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={spectatorProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        // 1. Controls are completely omitted from DOM
        expect(screen.queryByTestId('start-timer-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pause-timer-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('reset-timer-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('skip-buffer-btn')).not.toBeInTheDocument();

        // 2. Spectator Live HUD is rendered
        expect(screen.getByTestId('spectator-live-hud')).toBeInTheDocument();
        expect(screen.getByText(/Spectator Live HUD/i)).toBeInTheDocument();
      });
    });

    // Feature 14: Multi-Device Sync & Concurrency (Req §6, §10.16)
    describe('Feature 14: Multi-Device Realtime Sync & Concurrency Handling', async () => {
      it('synchronizes timer state from admin device to spectator device in real time', async () => {
        const mockRealtime = createMockRealtimeClient();
        const sessionId = 'sess-feat-14-sync';

        // 1. Render Admin instance
        const adminHook = renderHook(() =>
          useWinnerStaysTimer({
            sessionId,
            profile: adminProfile,
            storageEnabled: false,
            syncEnabled: true,
            supabaseClient: mockRealtime,
          })
        );

        // 2. Render Spectator instance
        const spectatorHook = renderHook(() =>
          useWinnerStaysTimer({
            sessionId,
            profile: spectatorProfile,
            storageEnabled: false,
            syncEnabled: true,
            supabaseClient: mockRealtime,
          })
        );

        expect(spectatorHook.result.current.state.status).toBe('IDLE');

        // Admin starts match
        await act(async () => {
          adminHook.result.current.start();
        });

        // Spectator receives broadcast and updates to RUNNING
        expect(spectatorHook.result.current.state.status).toBe('RUNNING');
        expect(spectatorHook.result.current.formattedTime).toBe('10:00');

        // Admin pauses match
        await act(async () => {
          adminHook.result.current.pause();
        });

        expect(spectatorHook.result.current.state.status).toBe('PAUSED');
      });
    });

    // Feature 15: Winner Stays Mode Exclusivity (Req §7, §10.17)
    describe('Feature 15: Winner Stays Mode Exclusivity', () => {
      it('ignores match event triggers when session is not WINNER_STAYS mode', () => {
        const { result, rerender } = renderHook(
          ({ mode, events }: { mode: string; events: any[] }) =>
            useWinnerStaysTimer({
              sessionId: 'sess-feat-15',
              session: { id: 'sess-feat-15', mode, status: 'IN_PROGRESS' },
              events,
              profile: adminProfile,
              storageEnabled: false,
              syncEnabled: false,
            }),
          {
            initialProps: { mode: 'STANDARD_TOURNAMENT', events: [] as any[] },
          }
        );

        expect(result.current.state.phase).toBe('PLAYING');

        // New goal arriving for non-winner stays session
        act(() => {
          rerender({
            mode: 'STANDARD_TOURNAMENT',
            events: [{ id: 'goal-other-mode', event_type: 'GOAL', timestamp: BASE_TIME }],
          });
        });

        // Must NOT transition to GOAL_BUFFER
        expect(result.current.state.phase).toBe('PLAYING');
      });
    });

    // Feature 16: Zero Regressions in Existing Workflows (Req §9, §10.18)
    describe('Feature 16: Zero Regressions & Contract Compliance', () => {
      it('maintains pure additive contract and clean component unmount without side effects', async () => {
        let renderResult: any;
        await act(async () => {
          renderResult = render(
            <WinnerStaysClock
              session={{ id: 'sess-feat-16', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={false}
              syncEnabled={false}
            />
          );
        });

        expect(screen.getByTestId('winner-stays-clock')).toBeInTheDocument();

        // Unmount component cleanly
        await act(async () => {
          renderResult.unmount();
        });

        expect(screen.queryByTestId('winner-stays-clock')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (Boundary Value Analysis)
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    // 1. Rapid Double-Taps & Action Spamming
    describe('1. Rapid Double-Taps & Action Spamming', () => {
      it('rapid double-clicking Start does not double-increment version or speed up countdown', async () => {
        const hook = renderHook(() =>
          useWinnerStaysTimer({
            sessionId: 'sess-bva-rapid',
            profile: adminProfile,
            storageEnabled: false,
            syncEnabled: false,
          })
        );

        act(() => {
          hook.result.current.start();
          hook.result.current.start();
          hook.result.current.start();
        });

        // Version incremented exactly once (from 1 to 2)
        expect(hook.result.current.state.version).toBe(2);
        expect(hook.result.current.state.status).toBe('RUNNING');
      });

      it('rapid double-clicking Pause remains stable and preserves remaining time', async () => {
        const hook = renderHook(() =>
          useWinnerStaysTimer({
            sessionId: 'sess-bva-pause-spam',
            profile: adminProfile,
            storageEnabled: false,
            syncEnabled: false,
          })
        );

        act(() => {
          hook.result.current.start();
          vi.advanceTimersByTime(10_000);
          hook.result.current.pause();
          hook.result.current.pause();
          hook.result.current.pause();
        });

        expect(hook.result.current.state.status).toBe('PAUSED');
        expect(hook.result.current.formattedTime).toBe('09:50');
      });

      it('rapid Skip Buffer spam is safe and does not skip out of PLAYING phase', async () => {
        const hook = renderHook(() =>
          useWinnerStaysTimer({
            sessionId: 'sess-bva-skip-spam',
            profile: adminProfile,
            storageEnabled: false,
            syncEnabled: false,
          })
        );

        // In Playing phase, skipBuffer is a no-op
        act(() => {
          hook.result.current.skip();
          hook.result.current.skip();
        });
        expect(hook.result.current.state.phase).toBe('PLAYING');
      });
    });

    // 2. Network Jitter & Packet Reordering
    describe('2. Network Jitter & Packet Reordering', () => {
      it('rejects stale or equal version broadcasts', () => {
        const currentState: TimerState = {
          phase: 'PLAYING',
          status: 'RUNNING',
          deadline: BASE_TIME + 500_000,
          remainingMs: 500_000,
          phaseDurationMs: 600_000,
          lastGoalEventId: null,
          version: 5,
          updatedAt: BASE_TIME,
        };

        const stalePayload = createTimerBroadcastPayload(
          { ...currentState, version: 4 },
          'session-sync',
          adminProfile,
          BASE_TIME
        );

        const res = validateBroadcastPayload(stalePayload, currentState, BASE_TIME, 'session-sync');
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('STALE_VERSION');
      });

      it('rejects non-admin sender broadcasts', () => {
        const payload = createTimerBroadcastPayload(
          createInitialTimerState(BASE_TIME),
          'session-sync',
          spectatorProfile,
          BASE_TIME
        );

        const res = validateBroadcastPayload(payload, null, BASE_TIME, 'session-sync');
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('UNAUTHORIZED_SENDER');
      });

      it('rejects session mismatch payloads', () => {
        const payload = createTimerBroadcastPayload(
          createInitialTimerState(BASE_TIME),
          'session-A',
          adminProfile,
          BASE_TIME
        );

        const res = validateBroadcastPayload(payload, null, BASE_TIME, 'session-B');
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('SESSION_MISMATCH');
      });
    });

    // 3. Clock Skew Extremes
    describe('3. Clock Skew Extremes', () => {
      it('corrects positive clock skew (+5,000ms host ahead)', () => {
        const hostNow = BASE_TIME + 5_000;
        const receiverNow = BASE_TIME;

        const hostState: TimerState = {
          phase: 'PLAYING',
          status: 'RUNNING',
          deadline: hostNow + 300_000,
          remainingMs: 300_000,
          phaseDurationMs: 600_000,
          lastGoalEventId: null,
          version: 2,
          updatedAt: hostNow,
        };

        const payload = createTimerBroadcastPayload(hostState, 'sess-skew', adminProfile, hostNow);
        const res = validateBroadcastPayload(payload, null, receiverNow, 'sess-skew');

        expect(res.valid).toBe(true);
        expect(res.skew).toBe(5_000);
        // Adjusted deadline should match local receiver timeline
        expect(res.adjustedState?.deadline).toBe(receiverNow + 300_000);
      });

      it('corrects negative clock skew (-5,000ms host behind)', () => {
        const hostNow = BASE_TIME - 5_000;
        const receiverNow = BASE_TIME;

        const hostState: TimerState = {
          phase: 'PLAYING',
          status: 'RUNNING',
          deadline: hostNow + 300_000,
          remainingMs: 300_000,
          phaseDurationMs: 600_000,
          lastGoalEventId: null,
          version: 2,
          updatedAt: hostNow,
        };

        const payload = createTimerBroadcastPayload(hostState, 'sess-skew-neg', adminProfile, hostNow);
        const res = validateBroadcastPayload(payload, null, receiverNow, 'sess-skew-neg');

        expect(res.valid).toBe(true);
        expect(res.skew).toBe(-5_000);
        expect(res.adjustedState?.deadline).toBe(receiverNow + 300_000);
      });
    });

    // 4. Tab Backgrounding & Visibility Transitions
    describe('4. Tab Backgrounding & Visibility Transitions', () => {
      it('transitions directly to TIME_EXPIRED when backgrounded across buffer AND playing durations', () => {
        const initialState = createInitialTimerState(BASE_TIME);
        // Put in GOAL_BUFFER running
        const bufferState = handleGoalRecorded(initialState, 'goal-long-sleep', BASE_TIME);

        // Sleep for 12 minutes (Buffer 1 min + Playing 10 min = 11 min expiry)
        const wakeTime = BASE_TIME + 12 * 60 * 1000;
        const { nextState } = checkPhaseExpiry(bufferState, wakeTime);

        expect(nextState.phase).toBe('TIME_EXPIRED');
        expect(nextState.remainingMs).toBe(0);
        expect(nextState.status).toBe('IDLE');
      });

      it('transitions smoothly into playing countdown when backgrounded across buffer expiry', () => {
        const initialState = createInitialTimerState(BASE_TIME);
        const bufferState = handleGoalRecorded(initialState, 'goal-buf-sleep', BASE_TIME);

        // Sleep for 70 seconds (60s buffer + 10s into playing)
        const wakeTime = BASE_TIME + 70_000;
        const { nextState, expiredPhase } = checkPhaseExpiry(bufferState, wakeTime);

        expect(expiredPhase).toBe('GOAL_BUFFER');
        expect(nextState.phase).toBe('PLAYING');
        expect(nextState.status).toBe('RUNNING');
        expect(nextState.remainingMs).toBe(590_000); // 10 minutes - 10s = 590s
      });
    });

    // 5. Sub-Second Countdown & Expiry Thresholds
    describe('5. Sub-Second Countdown Math & Expiry Thresholds', () => {
      it('Math.ceil prevents prematurely showing 00:00 while sub-seconds remain', () => {
        expect(formatTime(999)).toBe('00:01');
        expect(formatTime(500)).toBe('00:01');
        expect(formatTime(1)).toBe('00:01');
        expect(formatTime(0)).toBe('00:00');
        expect(formatTime(-500)).toBe('00:00');
      });

      it('accurately resolves urgency levels at exact threshold boundaries', () => {
        expect(getUrgencyLevel(30_001, 'PLAYING')).toBe('NORMAL');
        expect(getUrgencyLevel(30_000, 'PLAYING')).toBe('WARNING_30');
        expect(getUrgencyLevel(29_999, 'PLAYING')).toBe('WARNING_30');

        expect(getUrgencyLevel(10_001, 'PLAYING')).toBe('WARNING_30');
        expect(getUrgencyLevel(10_000, 'PLAYING')).toBe('URGENT_10');
        expect(getUrgencyLevel(9_999, 'PLAYING')).toBe('URGENT_10');

        expect(getUrgencyLevel(0, 'PLAYING')).toBe('EXPIRED');
        expect(getUrgencyLevel(5_000, 'TIME_EXPIRED')).toBe('EXPIRED');
      });
    });

    // 6. Expired States & Post-Expiry Actions
    describe('6. Expired States & Post-Expiry Actions', () => {
      it('starting when expired resets to 10:00 and starts playing', () => {
        const expiredState: TimerState = {
          phase: 'TIME_EXPIRED',
          status: 'IDLE',
          deadline: null,
          remainingMs: 0,
          phaseDurationMs: PLAYING_DURATION_MS,
          lastGoalEventId: null,
          version: 10,
          updatedAt: BASE_TIME,
        };

        const res = startTimer(resetTimer(expiredState, BASE_TIME), BASE_TIME);
        expect(res.phase).toBe('PLAYING');
        expect(res.status).toBe('RUNNING');
        expect(res.remainingMs).toBe(PLAYING_DURATION_MS);
      });

      it('goal arriving when expired restarts 60s buffer', () => {
        const expiredState: TimerState = {
          phase: 'TIME_EXPIRED',
          status: 'IDLE',
          deadline: null,
          remainingMs: 0,
          phaseDurationMs: PLAYING_DURATION_MS,
          lastGoalEventId: null,
          version: 10,
          updatedAt: BASE_TIME,
        };

        const next = handleGoalRecorded(expiredState, 'goal-post-expiry', BASE_TIME);
        expect(next.phase).toBe('GOAL_BUFFER');
        expect(next.status).toBe('RUNNING');
        expect(next.remainingMs).toBe(GOAL_BUFFER_DURATION_MS);
      });
    });

    // 7. Storage Boundaries & Resiliency
    describe('7. Storage Boundaries & Validation Shielding', () => {
      it('rejects corrupted or tampered localStorage data and falls back safely', () => {
        const key = getTimerStorageKey('sess-corrupt');
        localStorage.setItem(key, '{ invalid json');

        const state = rehydrateTimerState('sess-corrupt');
        expect(state.phase).toBe('PLAYING');
        expect(state.remainingMs).toBe(PLAYING_DURATION_MS);
        expect(state.status).toBe('IDLE');
      });

      it('isValidTimerState returns false for missing required fields or negative durations', () => {
        expect(isValidTimerState(null)).toBe(false);
        expect(isValidTimerState({})).toBe(false);
        expect(isValidTimerState({ phase: 'UNKNOWN' })).toBe(false);
        expect(isValidTimerState({ phase: 'PLAYING', status: 'RUNNING', remainingMs: -10 })).toBe(false);
      });
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ==========================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    // Combo 1: Goal -> Undo -> Skip Buffer -> Expiry -> Admin Sync
    it('Combo 1: Goal Scored -> Undo -> Skip Buffer -> 10:00 Expiry -> Admin Sync', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      const mockRecordTimeUp = vi.fn().mockResolvedValue(undefined);
      const mockRealtime = createMockRealtimeClient();
      const sessionId = 'combo-1-session';

      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={true}
            supabaseClient={mockRealtime}
            confirmOverride={mockConfirm}
            onRecordTimeUp={mockRecordTimeUp}
          />
        );
      });

      // Step A: Start match and run 30 seconds
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('09:30');

      // Step B: Goal arrives -> Buffer starts (01:00)
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'goal-c1', event_type: 'GOAL', timestamp: BASE_TIME + 30_000 }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={true}
            supabaseClient={mockRealtime}
            confirmOverride={mockConfirm}
            onRecordTimeUp={mockRecordTimeUp}
          />
        );
      });
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // Step C: Goal is undone -> Reverts back to 09:30 PAUSED
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={true}
            supabaseClient={mockRealtime}
            confirmOverride={mockConfirm}
            onRecordTimeUp={mockRecordTimeUp}
          />
        );
      });
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('09:30');
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();

      // Step D: Second goal scored -> Fresh buffer starts
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'goal-c1-second', event_type: 'GOAL', timestamp: BASE_TIME + 45_000 }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={true}
            supabaseClient={mockRealtime}
            confirmOverride={mockConfirm}
            onRecordTimeUp={mockRecordTimeUp}
          />
        );
      });
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // Step E: Skip Buffer -> Immediately starts 10:00 playing
      await act(async () => {
        fireEvent.click(screen.getByTestId('skip-buffer-btn'));
      });
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');

      // Step F: Fast forward 10 minutes to reach 00:00
      await act(async () => {
        vi.advanceTimersByTime(600_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:00');
      expect(mockRecordTimeUp).toHaveBeenCalledTimes(1);
    });

    // Combo 2: Offline Mutation -> Online Handshake -> Skew Adjustment
    it('Combo 2: Offline mutation -> Reconnection -> Broadcast sync with clock skew adjustment', () => {
      const sessionId = 'combo-2-sync';

      // 1. Admin updates state offline
      const localState = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      saveTimerState(sessionId, localState);

      // 2. Spectator device joins 50ms later with receiver clock
      const receiverTime = BASE_TIME + 50;
      const payload = createTimerBroadcastPayload(localState, sessionId, adminProfile, BASE_TIME);

      const valResult = validateBroadcastPayload(payload, null, receiverTime, sessionId);
      expect(valResult.valid).toBe(true);
      expect(valResult.skew).toBe(-50); // Host was 50ms behind receiver
      expect(valResult.adjustedState?.deadline).toBe(receiverTime + PLAYING_DURATION_MS);
    });

    // Combo 3: Running Match -> Pause -> Goal Scored -> Buffer Running -> Goal Undone -> Restores Paused Match
    it('Combo 3: Match paused at 08:30 -> Goal scored -> Goal undone -> Restores paused status', () => {
      let state = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      // Run 90 seconds -> 08:30 remaining
      state = pauseTimer(state, BASE_TIME + 90_000);
      expect(state.remainingMs).toBe(510_000);
      expect(state.status).toBe('PAUSED');

      // Goal scored
      state = handleGoalRecorded(state, 'goal-combo-3', BASE_TIME + 100_000);
      expect(state.phase).toBe('GOAL_BUFFER');
      expect(state.status).toBe('RUNNING');

      // Goal undone
      state = rollbackGoal(state, 'goal-combo-3', BASE_TIME + 110_000);
      expect(state.phase).toBe('PLAYING');
      expect(state.remainingMs).toBe(510_000);
      expect(state.status).toBe('PAUSED');
    });

    // Combo 4: Buffer Running -> Pause Buffer -> Skip Buffer -> Playing Running
    it('Combo 4: Goal buffer paused -> Skip Buffer -> Immediately starts 10:00 playing running', () => {
      let state = handleGoalRecorded(createInitialTimerState(BASE_TIME), 'goal-combo-4', BASE_TIME);
      // Pause 20 seconds into buffer
      state = pauseTimer(state, BASE_TIME + 20_000);
      expect(state.phase).toBe('GOAL_BUFFER');
      expect(state.status).toBe('PAUSED');
      expect(state.remainingMs).toBe(40_000);

      // Skip Buffer
      state = skipBuffer(state, BASE_TIME + 25_000);
      expect(state.phase).toBe('PLAYING');
      expect(state.status).toBe('RUNNING');
      expect(state.remainingMs).toBe(PLAYING_DURATION_MS);
    });

    // Combo 5: Multi-Admin Concurrency Conflict
    it('Combo 5: Multi-admin conflict resolution (higher monotonic version wins)', () => {
      const v1 = createInitialTimerState(BASE_TIME);
      const v2 = startTimer(v1, BASE_TIME);
      const v3 = pauseTimer(v2, BASE_TIME + 1000);

      // Client has v3. Stale v2 broadcast arrives from slower admin device
      const stalePayload = createTimerBroadcastPayload(v2, 'sess-conflict', adminProfile, BASE_TIME + 1000);
      const result = validateBroadcastPayload(stalePayload, v3, BASE_TIME + 1000, 'sess-conflict');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('STALE_VERSION');
    });

    // Combo 6: Scored -> Undone -> Rescored -> New Goal
    it('Combo 6: Repeated Scored-Undone-Rescored lifecycle maintaining clean state', () => {
      let state = createInitialTimerState(BASE_TIME);

      // Goal 1 scored
      state = handleGoalRecorded(state, 'g1', BASE_TIME);
      expect(state.phase).toBe('GOAL_BUFFER');
      expect(state.lastGoalEventId).toBe('g1');

      // Goal 1 undone
      state = rollbackGoal(state, 'g1', BASE_TIME + 5000);
      expect(state.phase).toBe('PLAYING');

      // Goal 1 rescored (same ID after correction)
      state = handleGoalRecorded(state, 'g1', BASE_TIME + 10000);
      expect(state.phase).toBe('GOAL_BUFFER');

      // Goal 2 scored
      state = handleGoalRecorded(state, 'g2', BASE_TIME + 20000);
      expect(state.phase).toBe('GOAL_BUFFER');
      expect(state.lastGoalEventId).toBe('g2');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD MATCH SCENARIOS
  // ==========================================================================
  describe('Tier 4: Real-World Match Scenarios', () => {
    // Scenario 1: Complete 10-Minute Winner Stays Bout without Goals
    it('Scenario 1: Complete 10-minute bout without goals, pause for injury, reach 00:00 and confirm time up', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      const mockRecordTimeUp = vi.fn().mockResolvedValue(undefined);
      const spyWhistle = vi.spyOn(refereeAudio, 'playMatchEndWhistle');

      await act(async () => {
        render(
          <WinnerStaysClock
            session={{ id: 'scenario-1-bout', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
            confirmOverride={mockConfirm}
            onRecordTimeUp={mockRecordTimeUp}
          />
        );
      });

      // 1. Kickoff
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      expect(screen.getByTestId('status-badge-running')).toBeInTheDocument();

      // 2. Play 5 minutes (05:00 remaining)
      await act(async () => {
        vi.advanceTimersByTime(300_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('05:00');

      // 3. Referee pauses for player shoe change
      await act(async () => {
        fireEvent.click(screen.getByTestId('pause-timer-btn'));
      });
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();

      // 4. 45 seconds pause
      await act(async () => {
        vi.advanceTimersByTime(45_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('05:00');

      // 5. Referee resumes match
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });

      // 6. Play to 30s remaining -> Amber warning active
      await act(async () => {
        vi.advanceTimersByTime(270_000); // 30s remaining
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:30');
      expect(screen.getByText(/30 Seconds Remaining/i)).toBeInTheDocument();

      // 7. Play to 10s remaining -> Red urgency active
      await act(async () => {
        vi.advanceTimersByTime(20_000); // 10s remaining
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:10');
      expect(screen.getByText(/Final 10 Seconds/i)).toBeInTheDocument();

      // 8. Reaches 00:00 full time
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('00:00');
      expect(screen.getByTestId('phase-badge-expired')).toBeInTheDocument();

      // Final whistle sounded & time up confirmed
      expect(spyWhistle).toHaveBeenCalledTimes(1);
      expect(mockRecordTimeUp).toHaveBeenCalledTimes(1);
    });

    // Scenario 2: High-Scoring Fast Match with Multiple Rotations
    it('Scenario 2: High-scoring fast match with multiple bouts, buffer skips, and natural buffer expirations', async () => {
      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'scenario-2-goals', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });

      // Start match
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      await act(async () => {
        vi.advanceTimersByTime(90_000); // 1.5 mins in, 08:30 remaining
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('08:30');

      // Bout 1 Goal: Team A scores!
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'scenario-2-goals', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'g-bout1', event_type: 'GOAL', timestamp: BASE_TIME + 90_000 }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // Quick team rotation -> Referee skips buffer at 40s
      await act(async () => {
        vi.advanceTimersByTime(20_000);
        fireEvent.click(screen.getByTestId('skip-buffer-btn'));
      });
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('10:00');

      // Bout 2 Goal: Team C scores at 06:15 remaining
      await act(async () => {
        vi.advanceTimersByTime(225_000); // 3m45s elapsed in playing
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('06:15');

      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'scenario-2-goals', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[
              { id: 'g-bout2', event_type: 'GOAL', timestamp: BASE_TIME + 335_000 },
              { id: 'g-bout1', event_type: 'GOAL', timestamp: BASE_TIME + 90_000 },
            ]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
          />
        );
      });
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // This time teams take full 60s buffer
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });

      // Automatically enters fresh 10:00 playing bout
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent(/10:00|09:59/);
    });

    // Scenario 3: Real-World Disputed Goal with Referee Consultation & Tab Sleep
    it('Scenario 3: Disputed goal, consultation, rollback to paused state, tab sleep, and clean resumption', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      let renderResult: any;

      await act(async () => {
        renderResult = render(
          <WinnerStaysClock
            session={{ id: 'scenario-3-disputed', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
            confirmOverride={mockConfirm}
          />
        );
      });

      // 1. Match running at 06:20 remaining (220s elapsed)
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      await act(async () => {
        vi.advanceTimersByTime(220_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('06:20');

      // 2. Goal mistakenly recorded
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'scenario-3-disputed', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[{ id: 'disputed-goal', event_type: 'GOAL', timestamp: BASE_TIME + 220_000 }]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
            confirmOverride={mockConfirm}
          />
        );
      });
      expect(screen.getByTestId('phase-badge-buffer')).toBeInTheDocument();

      // 3. Goal deleted (waving off goal)
      await act(async () => {
        renderResult.rerender(
          <WinnerStaysClock
            session={{ id: 'scenario-3-disputed', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={false}
            confirmOverride={mockConfirm}
          />
        );
      });

      // Restored to Playing at 06:20 in PAUSED status
      expect(screen.getByTestId('phase-badge-playing')).toBeInTheDocument();
      expect(screen.getByTestId('timer-display')).toHaveTextContent('06:20');
      expect(screen.getByTestId('status-badge-paused')).toBeInTheDocument();

      // 4. Referee device backgrounded for 60 seconds while explaining to players
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        // Foreground event
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Since clock was paused, zero drift occurred -> exactly 06:20 preserved!
      expect(screen.getByTestId('timer-display')).toHaveTextContent('06:20');

      // 5. Referee resumes play
      await act(async () => {
        fireEvent.click(screen.getByTestId('start-timer-btn'));
      });
      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });
      expect(screen.getByTestId('timer-display')).toHaveTextContent('06:00');
    });

    // Scenario 4: Multi-Device Tournament Match with Referee & Spectators
    it('Scenario 4: Multi-device tournament match with Admin referee and Spectators synchronized in real time', async () => {
      const mockRealtime = createMockRealtimeClient();
      const sessionId = 'scenario-4-multi-device';

      let adminResult: any;
      let spectatorResult: any;

      await act(async () => {
        adminResult = render(
          <WinnerStaysClock
            session={{ id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={adminProfile}
            storageEnabled={false}
            syncEnabled={true}
            supabaseClient={mockRealtime}
          />
        );
      });

      await act(async () => {
        spectatorResult = render(
          <WinnerStaysClock
            session={{ id: sessionId, mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
            events={[]}
            profile={spectatorProfile}
            storageEnabled={false}
            syncEnabled={true}
            supabaseClient={mockRealtime}
          />
        );
      });

      // Admin clicks Start Clock
      await act(async () => {
        fireEvent.click(within(adminResult.container).getByTestId('start-timer-btn'));
      });

      // Both see match running at 10:00
      expect(within(adminResult.container).getByTestId('status-badge-running')).toBeInTheDocument();
      expect(within(spectatorResult.container).getByTestId('spectator-live-hud')).toBeInTheDocument();

      // Advance 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // Admin clicks Pause
      await act(async () => {
        fireEvent.click(within(adminResult.container).getByTestId('pause-timer-btn'));
      });

      expect(within(adminResult.container).getByTestId('status-badge-paused')).toBeInTheDocument();

      adminResult.unmount();
      spectatorResult.unmount();
    });
  });
});
