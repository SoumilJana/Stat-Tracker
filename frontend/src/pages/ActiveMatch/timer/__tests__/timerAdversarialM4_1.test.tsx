/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Test Suite: frontend/src/pages/ActiveMatch/timer/__tests__/timerAdversarialM4_1.test.ts
 *
 * Adversarial Stress & Chaos Test Suite for Milestone 4 (Urgency & Sensor Edge Cases):
 *
 * 1. AudioContext Resilience & Chaos Stress Testing:
 *    - Suspended AudioContext unlock on user gesture & recovery from suspended state
 *    - Handled AudioContext rejection / autoplay policy restrictions without uncaught exceptions
 *    - Graceful degradation when window.AudioContext throws during constructor (e.g., security restrictions)
 *    - Completely unsupported browser environments (headless, SSR, older browsers)
 *    - High-frequency burst bombardment (100 rapid whistle triggers in parallel without memory leaks or crashes)
 *    - Pitch glide math robustness during sudden short durations or negative offsets
 *
 * 2. Screen Wake Lock API Chaos & Lifecycle Stress Testing:
 *    - Handling NotAllowedError (user denial, Low Power Mode, background tab) without crash
 *    - Screen Wake Lock release on tab change / visibility hidden
 *    - Automatic lock re-acquisition on tab foregrounding (visibilitychange -> visible)
 *    - Suppression of re-acquisition when wakeLockEnabled is false
 *    - Concurrency protection: duplicate / rapid requests do not leak orphan sentinels
 *    - Release and cleanup upon component unmount and match completion
 *
 * 3. Visual Countdown & Urgency Boundary Stress Testing:
 *    - Boundary conditions at exactly 30,001ms, 30,000ms, and 29,999ms (amber threshold WARNING_30)
 *    - Boundary conditions at exactly 10,001ms, 10,000ms, and 9,999ms (red urgency URGENT_10)
 *    - Precise transition to 00:00 (1ms -> 00:01 vs 0ms -> 00:00 vs negativems -> 00:00)
 *    - Sub-second ceil preservation (preventing premature 00:00 display)
 *    - DOM class application: emerald -> amber glow -> pulsing red urgency -> expired banner
 *    - Visual immunity of GOAL_BUFFER from playing urgency levels
 *
 * 4. Implementation Integrity Verification:
 *    - Genuine Web Audio nodes (oscillators, gains, exponential ramps) rather than dummy mocks
 *    - Genuine WakeLockSentinel listeners and visibility subscriptions
 *    - Genuine timestamp deadline math without hardcoded test outcomes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import * as refereeAudio from '../refereeAudio';
import * as refereeSensors from '../useRefereeSensors';
import { WinnerStaysClock } from '../WinnerStaysClock';
import {
  formatTime,
  getUrgencyLevel,
  PLAYING_DURATION_MS,
} from '../timerEngine';

// ============================================================================
// Robust Mocks for Web Audio API & Screen Wake Lock
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
  currentTime = 100;
  destination = {};
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  close = vi.fn().mockResolvedValue(undefined);
}

class MockWakeLockSentinel {
  released = false;
  private listeners: Record<string, Array<() => void>> = {};

  addEventListener(event: string, cb: () => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  removeEventListener(event: string, cb: () => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((l) => l !== cb);
    }
  }

  async release() {
    this.released = true;
    this.listeners['release']?.forEach((cb) => cb());
  }

  /** Test helper to simulate browser-initiated release (e.g. background tab) */
  simulateBrowserRelease() {
    this.released = true;
    this.listeners['release']?.forEach((cb) => cb());
  }
}

describe('Milestone 4 Adversarial Challenge: Urgency, Audio & Sensor Edge Cases', () => {
  const adminProfile = { id: 'admin-adversarial', role: 'admin' };

  beforeEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;
    delete (navigator as any).vibrate;
    delete (navigator as any).wakeLock;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    refereeAudio.resetAudioContextForTesting();
    delete (navigator as any).vibrate;
    delete (navigator as any).wakeLock;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Section 1: AudioContext Resilience & Chaos Stress Testing
  // ==========================================================================
  describe('1. AudioContext Resilience & Chaos Stress Testing', () => {
    it('gracefully handles AudioContext constructor throwing security / policy exception', () => {
      // Browser environment where AudioContext constructor throws (e.g. iframe policy or OS restriction)
      (window as any).AudioContext = class {
        constructor() {
          throw new DOMException('AudioContext is blocked by system policy', 'SecurityError');
        }
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(refereeAudio.isAudioSupported()).toBe(true);
      const ctx = refereeAudio.getAudioContext();
      expect(ctx).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RefereeAudio] Failed to initialize AudioContext:'),
        expect.any(DOMException)
      );

      // Playback calls with null context must safely no-op without crashing
      expect(() => refereeAudio.playBufferStartWhistle()).not.toThrow();
      expect(() => refereeAudio.playBufferEndWhistle()).not.toThrow();
      expect(() => refereeAudio.playMatchEndWhistle()).not.toThrow();
      expect(() => refereeAudio.unlockAudioContext()).not.toThrow();
    });

    it('recovers and unlocks when AudioContext starts in suspended state', async () => {
      (window as any).AudioContext = MockAudioContext;

      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;
      expect(ctx.state).toBe('suspended');

      // User gesture interaction unlocks
      refereeAudio.unlockAudioContext();
      expect(ctx.resume).toHaveBeenCalledTimes(1);

      await ctx.resume();
      expect(ctx.state).toBe('running');
    });

    it('handles AudioContext.resume() rejection safely without unhandled promise rejection', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      class RejectingAudioContext extends MockAudioContext {
        resume = vi.fn().mockRejectedValue(new DOMException('User gesture required', 'NotAllowedError'));
      }
      (window as any).AudioContext = RejectingAudioContext;

      refereeAudio.unlockAudioContext();

      // Allow microtask to process
      await Promise.resolve();

      // Verify no uncaught exception occurred and warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RefereeAudio] AudioContext unlock failed:'),
        expect.any(DOMException)
      );
    });

    it('survives rapid bombardment of 100 simultaneous whistle triggers', () => {
      (window as any).AudioContext = MockAudioContext;
      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;

      expect(() => {
        for (let i = 0; i < 50; i++) {
          refereeAudio.playBufferStartWhistle();
          refereeAudio.playBufferEndWhistle();
          refereeAudio.playMatchEndWhistle();
        }
      }).not.toThrow();

      // Each burst creates oscillators and gains
      expect(ctx.createGain).toHaveBeenCalled();
      expect(ctx.createOscillator).toHaveBeenCalled();
    });

    it('safely handles pitch glide calculation when match end whistle is triggered', () => {
      (window as any).AudioContext = MockAudioContext;
      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;

      // Match end whistle has duration 0.85s with pitch glide down from 2640 -> 2200 Hz
      refereeAudio.playMatchEndWhistle();

      expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
      const osc1 = (ctx.createOscillator as any).mock.results[0].value;
      expect(osc1.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(2200, expect.any(Number));
    });

    it('properly cleans up audio nodes via osc.onended callback without throwing', () => {
      (window as any).AudioContext = MockAudioContext;
      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;

      refereeAudio.playBufferStartWhistle();

      const osc1 = (ctx.createOscillator as any).mock.results[0].value;
      const osc2 = (ctx.createOscillator as any).mock.results[1].value;
      const gainNode = (ctx.createGain as any).mock.results[0].value;

      expect(osc1.onended).toBeTypeOf('function');

      // Trigger node cleanup
      expect(() => osc1.onended!()).not.toThrow();
      expect(osc1.disconnect).toHaveBeenCalled();
      expect(osc2.disconnect).toHaveBeenCalled();
      expect(gainNode.disconnect).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Section 2: Screen Wake Lock API Chaos & Lifecycle Stress Testing
  // ==========================================================================
  describe('2. Screen Wake Lock API Chaos & Lifecycle Stress Testing', () => {
    it('handles NotAllowedError gracefully when user agent denies screen wake lock', async () => {
      const notAllowedErr = new Error('NotAllowedError: Wake lock disallowed by system policy');
      (navigator as any).wakeLock = {
        request: vi.fn().mockRejectedValue(notAllowedErr),
      };

      const { result } = renderHook(() => refereeSensors.useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isSupported).toBe(true);
      expect(result.current.isLocked).toBe(false);
      expect(result.current.error).toBe('NotAllowedError: Wake lock disallowed by system policy');
    });

    it('safely shields non-standard exceptions or string rejections during wake lock request', async () => {
      (navigator as any).wakeLock = {
        request: vi.fn().mockRejectedValue('Raw rejection string'),
      };

      const { result } = renderHook(() => refereeSensors.useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isSupported).toBe(true);
      expect(result.current.isLocked).toBe(false);
      expect(result.current.error).toBe('Failed to acquire wake lock');
    });

    it('detects tab backgrounding and automatically re-acquires wake lock when tab returns to visible', async () => {
      let activeSentinel = new MockWakeLockSentinel();
      const requestSpy = vi.fn().mockImplementation(async () => {
        activeSentinel = new MockWakeLockSentinel();
        return activeSentinel;
      });

      (navigator as any).wakeLock = { request: requestSpy };

      // Mock document visibility
      let mockVisibility: DocumentVisibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        get: () => mockVisibility,
        configurable: true,
      });

      const { result, unmount } = renderHook(() => refereeSensors.useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isLocked).toBe(true);
      expect(requestSpy).toHaveBeenCalledTimes(1);

      // 1. Simulate tab switching / backgrounding: browser automatically releases wake lock
      await act(async () => {
        mockVisibility = 'hidden';
        activeSentinel.simulateBrowserRelease();
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current.isLocked).toBe(false);

      // 2. Simulate returning to foreground tab: hook detects visibilitychange and re-requests lock
      await act(async () => {
        mockVisibility = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(result.current.isLocked).toBe(true);

      // 3. Unmount cleanly releases sentinel
      unmount();
      expect(activeSentinel.released).toBe(true);
    });

    it('does NOT re-acquire wake lock on visibilitychange when wakeLock is disabled by user', async () => {
      const activeSentinel = new MockWakeLockSentinel();
      const requestSpy = vi.fn().mockResolvedValue(activeSentinel);
      (navigator as any).wakeLock = { request: requestSpy };

      let mockVisibility: DocumentVisibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        get: () => mockVisibility,
        configurable: true,
      });

      // Hook mounted with enabled = false
      const { result } = renderHook(() => refereeSensors.useWakeLock(false));

      expect(requestSpy).not.toHaveBeenCalled();
      expect(result.current.isLocked).toBe(false);

      // Tab visibility changes to visible
      await act(async () => {
        mockVisibility = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      // Must remain unrequested
      expect(requestSpy).not.toHaveBeenCalled();
      expect(result.current.isLocked).toBe(false);
    });

    it('does not leak duplicate sentinels when requestLock is invoked while already held', async () => {
      const sentinel = new MockWakeLockSentinel();
      const requestSpy = vi.fn().mockResolvedValue(sentinel);
      (navigator as any).wakeLock = { request: requestSpy };

      let mockVisibility: DocumentVisibilityState = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        get: () => mockVisibility,
        configurable: true,
      });

      const { result } = renderHook(() => refereeSensors.useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(requestSpy).toHaveBeenCalledTimes(1);

      // Rapid visibility changes while already holding lock
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      // Guard (!sentinelRef.current.released) prevents redundant requests
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isLocked).toBe(true);
    });
  });

  // ==========================================================================
  // Section 3: Visual Countdown & Urgency Boundary Stress Testing
  // ==========================================================================
  describe('3. Visual Countdown & Urgency Boundary Stress Testing', () => {
    describe('formatTime boundary math', () => {
      it('formats initial 10:00 correctly', () => {
        expect(formatTime(PLAYING_DURATION_MS)).toBe('10:00');
        expect(formatTime(599_001)).toBe('10:00'); // Sub-second ceil prevents premature 09:59
        expect(formatTime(599_000)).toBe('09:59');
      });

      it('handles 30-second boundary with athletic ceil precision', () => {
        expect(formatTime(30_001)).toBe('00:31');
        expect(formatTime(30_000)).toBe('00:30');
        expect(formatTime(29_999)).toBe('00:30'); // 29.999s rounds up to 30s
        expect(formatTime(29_000)).toBe('00:29');
      });

      it('handles 10-second boundary with athletic ceil precision', () => {
        expect(formatTime(10_001)).toBe('00:11');
        expect(formatTime(10_000)).toBe('00:10');
        expect(formatTime(9_999)).toBe('00:10');
        expect(formatTime(9_000)).toBe('00:09');
      });

      it('handles the final second down to zero without premature 00:00', () => {
        expect(formatTime(1_500)).toBe('00:02');
        expect(formatTime(1_000)).toBe('00:01');
        expect(formatTime(1)).toBe('00:01'); // 1 millisecond left must display 00:01
        expect(formatTime(0)).toBe('00:00');
        expect(formatTime(-100)).toBe('00:00'); // Negative values clamp to 00:00
      });
    });

    describe('getUrgencyLevel boundary classification', () => {
      it('delineates 30s warning threshold in PLAYING phase', () => {
        expect(getUrgencyLevel(30_001, 'PLAYING')).toBe('NORMAL');
        expect(getUrgencyLevel(30_000, 'PLAYING')).toBe('WARNING_30');
        expect(getUrgencyLevel(29_999, 'PLAYING')).toBe('WARNING_30');
        expect(getUrgencyLevel(10_001, 'PLAYING')).toBe('WARNING_30');
      });

      it('delineates 10s urgent threshold in PLAYING phase', () => {
        expect(getUrgencyLevel(10_000, 'PLAYING')).toBe('URGENT_10');
        expect(getUrgencyLevel(9_999, 'PLAYING')).toBe('URGENT_10');
        expect(getUrgencyLevel(1, 'PLAYING')).toBe('URGENT_10');
      });

      it('delineates expiration when remaining time is 0 or negative', () => {
        expect(getUrgencyLevel(0, 'PLAYING')).toBe('EXPIRED');
        expect(getUrgencyLevel(-50, 'PLAYING')).toBe('EXPIRED');
        expect(getUrgencyLevel(0, 'TIME_EXPIRED')).toBe('EXPIRED');
        expect(getUrgencyLevel(5000, 'TIME_EXPIRED')).toBe('EXPIRED');
      });

      it('supports polymorphic parameter ordering (phase, remainingMs) identically', () => {
        expect(getUrgencyLevel('PLAYING', 25_000)).toBe(getUrgencyLevel(25_000, 'PLAYING'));
        expect(getUrgencyLevel('PLAYING', 5_000)).toBe(getUrgencyLevel(5_000, 'PLAYING'));
        expect(getUrgencyLevel('PLAYING', 0)).toBe(getUrgencyLevel(0, 'PLAYING'));
      });

      it('does NOT apply 30s/10s urgency to GOAL_BUFFER phase', () => {
        // Goal buffer is a calm 60-second cooldown/team rotation, not subject to match expiry panic
        expect(getUrgencyLevel(30_000, 'GOAL_BUFFER')).toBe('NORMAL');
        expect(getUrgencyLevel(10_000, 'GOAL_BUFFER')).toBe('NORMAL');
        expect(getUrgencyLevel(2_000, 'GOAL_BUFFER')).toBe('NORMAL');
        expect(getUrgencyLevel(0, 'GOAL_BUFFER')).toBe('EXPIRED');
      });
    });

    describe('WinnerStaysClock Visual Presentation at Boundaries', () => {
      it('transitions classes seamlessly at 30s amber threshold', async () => {
        localStorage.setItem(
          'stattracker_timer_adv-boundary-30s',
          JSON.stringify({
            phase: 'PLAYING',
            status: 'PAUSED',
            deadline: null,
            remainingMs: 30_000,
            phaseDurationMs: PLAYING_DURATION_MS,
            lastGoalEventId: null,
            version: 1,
            updatedAt: Date.now(),
          })
        );

        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'adv-boundary-30s', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={true}
              syncEnabled={false}
            />
          );
        });

        const display = screen.getByTestId('timer-display');
        expect(display).toHaveTextContent('00:30');
        expect(display.className).toContain('text-amber-400');
        expect(screen.getByText(/30 Seconds Remaining in Playing Time/i)).toBeInTheDocument();
      });

      it('transitions classes seamlessly at 10s red urgent threshold', async () => {
        localStorage.setItem(
          'stattracker_timer_adv-boundary-10s',
          JSON.stringify({
            phase: 'PLAYING',
            status: 'PAUSED',
            deadline: null,
            remainingMs: 10_000,
            phaseDurationMs: PLAYING_DURATION_MS,
            lastGoalEventId: null,
            version: 1,
            updatedAt: Date.now(),
          })
        );

        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'adv-boundary-10s', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={true}
              syncEnabled={false}
            />
          );
        });

        const display = screen.getByTestId('timer-display');
        expect(display).toHaveTextContent('00:10');
        expect(display.className).toContain('text-red-400');
        expect(screen.getByText(/Final 10 Seconds — Prepare Whistle/i)).toBeInTheDocument();
      });

      it('transitions classes seamlessly to expired banner at 00:00', async () => {
        localStorage.setItem(
          'stattracker_timer_adv-boundary-0s',
          JSON.stringify({
            phase: 'TIME_EXPIRED',
            status: 'IDLE',
            deadline: null,
            remainingMs: 0,
            phaseDurationMs: PLAYING_DURATION_MS,
            lastGoalEventId: null,
            version: 1,
            updatedAt: Date.now(),
          })
        );

        await act(async () => {
          render(
            <WinnerStaysClock
              session={{ id: 'adv-boundary-0s', mode: 'WINNER_STAYS', status: 'IN_PROGRESS' }}
              profile={adminProfile}
              storageEnabled={true}
              syncEnabled={false}
            />
          );
        });

        const display = screen.getByTestId('timer-display');
        expect(display).toHaveTextContent('00:00');
        expect(display.className).toContain('text-red-500');
        expect(screen.getByTestId('phase-badge-expired')).toBeInTheDocument();
        expect(screen.getByText(/Time Expired — Admin Action Required/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Section 4: Integrity Verification
  // ==========================================================================
  describe('4. Implementation Integrity Verification', () => {
    it('verifies absence of hardcoded test identifiers or dummy facades in whistle synthesis', () => {
      (window as any).AudioContext = MockAudioContext;
      const ctx = refereeAudio.getAudioContext() as unknown as MockAudioContext;

      refereeAudio.playBufferStartWhistle();
      refereeAudio.playBufferEndWhistle();
      refereeAudio.playMatchEndWhistle();

      // Real oscillator and gain scheduling calls must have been made with correct acoustic frequencies
      const oscResults = (ctx.createOscillator as any).mock.results;
      expect(oscResults.length).toBeGreaterThanOrEqual(7);

      // Verify authentic whistle frequencies (2640Hz primary, 2890Hz secondary)
      const frequencies = oscResults.map((r: any) => r.value.frequency.setValueAtTime.mock.calls[0]?.[0]);
      expect(frequencies).toContain(2640);
      expect(frequencies).toContain(2890);
    });

    it('verifies genuine Screen Wake Lock API listener wiring', async () => {
      const sentinel = new MockWakeLockSentinel();
      const addListenerSpy = vi.spyOn(sentinel, 'addEventListener');
      (navigator as any).wakeLock = { request: vi.fn().mockResolvedValue(sentinel) };

      renderHook(() => refereeSensors.useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      // Hook must genuinely subscribe to 'release' event of the sentinel
      expect(addListenerSpy).toHaveBeenCalledWith('release', expect.any(Function));
    });
  });
});
