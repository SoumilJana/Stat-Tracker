/**
 * Unit Tests for Winner Stays Timer Storage & Persistence Layer
 * Path: frontend/src/pages/ActiveMatch/timer/__tests__/timerStorage.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveTimerState,
  loadTimerState,
  clearTimerState,
  rehydrateTimerState,
  loadRefereeSettings,
  saveRefereeSettings,
  isValidTimerState,
  isTimerPhase,
  isTimerStatus,
  isLocalStorageAvailable,
  DEFAULT_REFEREE_SETTINGS,
  getTimerStorageKey,
} from '../timerStorage';
import {
  createInitialTimerState,
  startTimer,
  handleGoalRecorded,
  PLAYING_DURATION_MS,
} from '../timerEngine';

describe('timerStorage: Persistence, Validation & Rehydration', () => {
  const SESSION_A = 'session-uuid-111';
  const SESSION_B = 'session-uuid-222';
  const BASE_TIME = 1_700_000_000_000;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('isLocalStorageAvailable', () => {
    it('returns true under normal browser environment', () => {
      expect(isLocalStorageAvailable()).toBe(true);
    });

    it('returns false if localStorage throws (e.g. Safari private browsing)', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Access denied');
      });
      expect(isLocalStorageAvailable()).toBe(false);
      setItemSpy.mockRestore();
    });
  });

  describe('Type Guards', () => {
    it('isTimerPhase validates only allowed phase strings', () => {
      expect(isTimerPhase('GOAL_BUFFER')).toBe(true);
      expect(isTimerPhase('PLAYING')).toBe(true);
      expect(isTimerPhase('TIME_EXPIRED')).toBe(true);
      expect(isTimerPhase('INVALID')).toBe(false);
      expect(isTimerPhase(null)).toBe(false);
      expect(isTimerPhase(123)).toBe(false);
    });

    it('isTimerStatus validates only allowed status strings', () => {
      expect(isTimerStatus('RUNNING')).toBe(true);
      expect(isTimerStatus('PAUSED')).toBe(true);
      expect(isTimerStatus('IDLE')).toBe(true);
      expect(isTimerStatus('STOPPED')).toBe(false);
      expect(isTimerStatus(undefined)).toBe(false);
    });

    it('isValidTimerState validates conforming TimerState objects', () => {
      const valid = createInitialTimerState(BASE_TIME);
      expect(isValidTimerState(valid)).toBe(true);

      const withSnapshot = handleGoalRecorded(valid, 'goal-1', BASE_TIME);
      expect(isValidTimerState(withSnapshot)).toBe(true);
    });

    it('isValidTimerState rejects invalid, malformed, or missing properties', () => {
      expect(isValidTimerState(null)).toBe(false);
      expect(isValidTimerState('not an object')).toBe(false);
      expect(isValidTimerState([])).toBe(false);
      expect(isValidTimerState({})).toBe(false);

      const valid = createInitialTimerState(BASE_TIME);

      expect(isValidTimerState({ ...valid, phase: 'BOGUS' })).toBe(false);
      expect(isValidTimerState({ ...valid, status: 'BOGUS' })).toBe(false);
      expect(isValidTimerState({ ...valid, deadline: 'not-a-number' })).toBe(false);
      expect(isValidTimerState({ ...valid, deadline: -100 })).toBe(false);
      expect(isValidTimerState({ ...valid, remainingMs: -1 })).toBe(false);
      expect(isValidTimerState({ ...valid, remainingMs: NaN })).toBe(false);
      expect(isValidTimerState({ ...valid, phaseDurationMs: 0 })).toBe(false);
      expect(isValidTimerState({ ...valid, version: -5 })).toBe(false);
      expect(isValidTimerState({ ...valid, updatedAt: 0 })).toBe(false);
      expect(isValidTimerState({ ...valid, lastGoalEventId: 12345 })).toBe(false);
      expect(
        isValidTimerState({
          ...valid,
          previousState: { phase: 'INVALID', status: 'IDLE', remainingMs: 100 },
        })
      ).toBe(false);
    });
  });

  describe('Session Storage & Isolation', () => {
    it('saves and loads TimerState accurately for a session', () => {
      const state = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      const saved = saveTimerState(SESSION_A, state);
      expect(saved).toBe(true);

      const loaded = loadTimerState(SESSION_A);
      expect(loaded).toEqual(state);
    });

    it('strictly isolates timer state between different sessions', () => {
      const stateA = createInitialTimerState(BASE_TIME);
      const stateB = handleGoalRecorded(stateA, 'goal-xyz', BASE_TIME);

      saveTimerState(SESSION_A, stateA);
      saveTimerState(SESSION_B, stateB);

      expect(loadTimerState(SESSION_A)?.phase).toBe('PLAYING');
      expect(loadTimerState(SESSION_B)?.phase).toBe('GOAL_BUFFER');

      clearTimerState(SESSION_A);
      expect(loadTimerState(SESSION_A)).toBeNull();
      expect(loadTimerState(SESSION_B)).not.toBeNull();
    });

    it('returns null if session ID is empty or not in localStorage', () => {
      expect(loadTimerState('')).toBeNull();
      expect(loadTimerState('non-existent-session')).toBeNull();
    });

    it('supports direct (non-enveloped) TimerState legacy records', () => {
      const state = createInitialTimerState(BASE_TIME);
      window.localStorage.setItem(getTimerStorageKey(SESSION_A), JSON.stringify(state));

      const loaded = loadTimerState(SESSION_A);
      expect(loaded).toEqual(state);
    });
  });

  describe('Storage Corruption & Exception Shielding', () => {
    it('loadTimerState returns null on corrupted JSON string in localStorage', () => {
      window.localStorage.setItem(getTimerStorageKey(SESSION_A), '{"corrupted JSON string:');
      const loaded = loadTimerState(SESSION_A);
      expect(loaded).toBeNull();
    });

    it('rehydrateTimerState falls back to initial state on corrupted storage', () => {
      window.localStorage.setItem(getTimerStorageKey(SESSION_A), '{"phase": "CORRUPTED"}');
      const rehydrated = rehydrateTimerState(SESSION_A, BASE_TIME);
      expect(rehydrated.phase).toBe('PLAYING');
      expect(rehydrated.status).toBe('IDLE');
      expect(rehydrated.remainingMs).toBe(PLAYING_DURATION_MS);
    });

    it('catches and handles QuotaExceededError without throwing', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const err = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw err;
      });

      const state = createInitialTimerState(BASE_TIME);
      const success = saveTimerState(SESSION_A, state);
      expect(success).toBe(false); // Gracefully returns false
      setItemSpy.mockRestore();
    });
  });

  describe('Rehydration & Refresh Recovery', () => {
    it('restores RUNNING timer with remaining time recomputed from deadline', () => {
      const state = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      saveTimerState(SESSION_A, state);

      // Page reloads 45 seconds later
      const reloadTime = BASE_TIME + 45_000;
      const recovered = rehydrateTimerState(SESSION_A, reloadTime);

      expect(recovered.status).toBe('RUNNING');
      expect(recovered.phase).toBe('PLAYING');
      expect(recovered.deadline).toBe(state.deadline);
      expect(recovered.remainingMs).toBe(PLAYING_DURATION_MS - 45_000);
      expect(recovered.updatedAt).toBe(reloadTime);
    });

    it('preserves exact PAUSED state without elapsed time deduction', () => {
      const running = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      const paused = {
        ...running,
        status: 'PAUSED' as const,
        deadline: null,
        remainingMs: 450_000,
      };
      saveTimerState(SESSION_A, paused);

      // Page reloads 10 minutes later while paused
      const reloadTime = BASE_TIME + 600_000;
      const recovered = rehydrateTimerState(SESSION_A, reloadTime);

      expect(recovered.status).toBe('PAUSED');
      expect(recovered.deadline).toBeNull();
      expect(recovered.remainingMs).toBe(450_000); // Completely preserved!
    });

    it('recovers GOAL_BUFFER that expired while page was away into PLAYING phase', () => {
      const bufferState = handleGoalRecorded(createInitialTimerState(BASE_TIME), 'goal-1', BASE_TIME);
      saveTimerState(SESSION_A, bufferState); // 60s buffer deadline = BASE_TIME + 60_000

      // Page reloads 90s later (buffer expired 30s ago)
      const reloadTime = BASE_TIME + 90_000;
      const recovered = rehydrateTimerState(SESSION_A, reloadTime);

      expect(recovered.phase).toBe('PLAYING');
      expect(recovered.status).toBe('RUNNING');
      expect(recovered.remainingMs).toBe(PLAYING_DURATION_MS - 30_000); // 9m 30s remaining
      expect(recovered.deadline).toBe(bufferState.deadline! + PLAYING_DURATION_MS);
      expect(recovered.version).toBe(bufferState.version + 1);
    });

    it('recovers match that expired while away into TIME_EXPIRED', () => {
      const running = startTimer(createInitialTimerState(BASE_TIME), BASE_TIME);
      saveTimerState(SESSION_A, running);

      // Page reloads 12 minutes later
      const reloadTime = BASE_TIME + 720_000;
      const recovered = rehydrateTimerState(SESSION_A, reloadTime);

      expect(recovered.phase).toBe('TIME_EXPIRED');
      expect(recovered.status).toBe('IDLE');
      expect(recovered.remainingMs).toBe(0);
      expect(recovered.deadline).toBeNull();
    });

    it('recovers buffer where both buffer and playing countdown expired while away', () => {
      const bufferState = handleGoalRecorded(createInitialTimerState(BASE_TIME), 'goal-1', BASE_TIME);
      saveTimerState(SESSION_A, bufferState);

      // Reload 15 minutes later (both buffer and match expired)
      const reloadTime = BASE_TIME + 15 * 60 * 1000;
      const recovered = rehydrateTimerState(SESSION_A, reloadTime);

      expect(recovered.phase).toBe('TIME_EXPIRED');
      expect(recovered.status).toBe('IDLE');
      expect(recovered.remainingMs).toBe(0);
      expect(recovered.deadline).toBeNull();
    });
  });

  describe('Referee Settings Persistence', () => {
    it('returns default referee settings if none are saved', () => {
      const settings = loadRefereeSettings();
      expect(settings).toEqual(DEFAULT_REFEREE_SETTINGS);
    });

    it('saves and loads modified referee preferences', () => {
      const modified = { soundEnabled: false, vibrationEnabled: true, wakeLockEnabled: true };
      const saved = saveRefereeSettings(modified);
      expect(saved).toBe(true);

      const loaded = loadRefereeSettings();
      expect(loaded).toEqual(modified);
    });

    it('handles corrupted referee settings safely by falling back to defaults', () => {
      window.localStorage.setItem('stattracker_referee_settings', '{"corrupted');
      const loaded = loadRefereeSettings();
      expect(loaded).toEqual(DEFAULT_REFEREE_SETTINGS);
    });

    it('handles partial referee settings safely by preserving defaults for missing keys', () => {
      window.localStorage.setItem('stattracker_referee_settings', JSON.stringify({ soundEnabled: false }));
      const loaded = loadRefereeSettings();
      expect(loaded.soundEnabled).toBe(false);
      expect(loaded.vibrationEnabled).toBe(DEFAULT_REFEREE_SETTINGS.vibrationEnabled);
      expect(loaded.wakeLockEnabled).toBe(DEFAULT_REFEREE_SETTINGS.wakeLockEnabled);
    });
  });
});
