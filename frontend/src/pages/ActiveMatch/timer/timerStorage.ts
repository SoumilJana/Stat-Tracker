/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/timerStorage.ts
 *
 * LocalStorage persistence and rehydration layer for the Winner Stays Match Clock.
 * Enforces strict session isolation, corruption resilience, and exception shielding.
 */

import type { TimerState, TimerPhase, TimerStatus, RefereeSettings } from './types';
import { createInitialTimerState, PLAYING_DURATION_MS } from './timerEngine';

export const TIMER_STORAGE_VERSION = 1;
export const TIMER_STORAGE_KEY_PREFIX = 'stattracker_timer_';
export const REFEREE_SETTINGS_STORAGE_KEY = 'stattracker_referee_settings';

export const DEFAULT_REFEREE_SETTINGS: RefereeSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  wakeLockEnabled: false,
};

export interface PersistedTimerRecord {
  schemaVersion: number;
  sessionId: string;
  state: TimerState;
  savedAt: number;
}

/**
 * Returns the namespaced localStorage key for a session's timer.
 */
export function getTimerStorageKey(sessionId: string): string {
  return `${TIMER_STORAGE_KEY_PREFIX}${sessionId}`;
}

/**
 * Checks if window.localStorage is accessible and writable.
 */
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__stattracker_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for TimerPhase.
 */
export function isTimerPhase(val: unknown): val is TimerPhase {
  return val === 'GOAL_BUFFER' || val === 'PLAYING' || val === 'TIME_EXPIRED';
}

/**
 * Type guard for TimerStatus.
 */
export function isTimerStatus(val: unknown): val is TimerStatus {
  return val === 'RUNNING' || val === 'PAUSED' || val === 'IDLE';
}

/**
 * Pure runtime validator for TimerState objects.
 * Guarantees zero runtime crashes from corrupted or maliciously tampered localStorage data.
 */
export function isValidTimerState(obj: unknown): obj is TimerState {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const record = obj as Record<string, unknown>;

  if (!isTimerPhase(record.phase)) return false;
  if (!isTimerStatus(record.status)) return false;

  if (
    record.deadline !== null &&
    (typeof record.deadline !== 'number' || !Number.isFinite(record.deadline) || record.deadline < 0)
  ) {
    return false;
  }

  if (
    typeof record.remainingMs !== 'number' ||
    !Number.isFinite(record.remainingMs) ||
    record.remainingMs < 0
  ) {
    return false;
  }

  if (
    typeof record.phaseDurationMs !== 'number' ||
    !Number.isFinite(record.phaseDurationMs) ||
    record.phaseDurationMs <= 0
  ) {
    return false;
  }

  if (record.lastGoalEventId !== null && typeof record.lastGoalEventId !== 'string') {
    return false;
  }

  if (
    typeof record.version !== 'number' ||
    !Number.isFinite(record.version) ||
    record.version < 0
  ) {
    return false;
  }

  if (
    typeof record.updatedAt !== 'number' ||
    !Number.isFinite(record.updatedAt) ||
    record.updatedAt <= 0
  ) {
    return false;
  }

  if (record.previousState !== undefined && record.previousState !== null) {
    if (typeof record.previousState !== 'object' || Array.isArray(record.previousState)) {
      return false;
    }
    const prev = record.previousState as Record<string, unknown>;
    if (!isTimerPhase(prev.phase) || !isTimerStatus(prev.status)) {
      return false;
    }
    if (
      typeof prev.remainingMs !== 'number' ||
      !Number.isFinite(prev.remainingMs) ||
      prev.remainingMs < 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Safely writes the current TimerState to LocalStorage under the session namespace.
 * Never throws exceptions (handles QuotaExceededError or private browsing restrictions).
 */
export function saveTimerState(sessionId: string, state: TimerState): boolean {
  if (!sessionId || !isLocalStorageAvailable()) return false;

  try {
    const record: PersistedTimerRecord = {
      schemaVersion: TIMER_STORAGE_VERSION,
      sessionId,
      state,
      savedAt: Date.now(),
    };
    const key = getTimerStorageKey(sessionId);
    window.localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch (err) {
    console.warn('[TimerStorage] Failed to save timer state to localStorage:', err);
    return false;
  }
}

/**
 * Safely loads raw TimerState from LocalStorage.
 * Returns null if not found, corrupted, or schema invalid.
 */
export function loadTimerState(sessionId: string): TimerState | null {
  if (!sessionId || !isLocalStorageAvailable()) return null;

  try {
    const key = getTimerStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Handle enveloped record
    if ('state' in parsed && 'schemaVersion' in parsed) {
      const record = parsed as PersistedTimerRecord;
      if (record.sessionId !== sessionId) return null;
      if (isValidTimerState(record.state)) {
        return record.state;
      }
      return null;
    }

    // Direct state fallback (migration compatibility)
    if (isValidTimerState(parsed)) {
      return parsed;
    }

    return null;
  } catch (err) {
    console.warn('[TimerStorage] Failed to load timer state from localStorage:', err);
    return null;
  }
}

/**
 * Clears persisted timer state for a specific session.
 */
export function clearTimerState(sessionId: string): boolean {
  if (!sessionId || !isLocalStorageAvailable()) return false;

  try {
    const key = getTimerStorageKey(sessionId);
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn('[TimerStorage] Failed to clear timer state:', err);
    return false;
  }
}

/**
 * Rehydrates TimerState on page reload or tab wake-up.
 * Authoritatively accounts for time elapsed while page was closed/refreshing.
 */
export function rehydrateTimerState(sessionId: string, now?: number): TimerState {
  const currentNow = now ?? Date.now();
  const stored = loadTimerState(sessionId);
  if (!stored) {
    return createInitialTimerState(currentNow);
  }

  // If paused or idle, preserved remainingMs is authoritative and deadline is null
  if (stored.status === 'PAUSED' || stored.status === 'IDLE' || stored.deadline === null) {
    return {
      ...stored,
      deadline: null,
      updatedAt: currentNow,
    };
  }

  // If status was RUNNING, recompute remaining time from authoritative deadline
  const diff = stored.deadline - currentNow;

  // Case 1: Deadline is still in future -> continue running in same phase
  if (diff > 0) {
    return {
      ...stored,
      remainingMs: Math.min(diff, stored.phaseDurationMs),
      updatedAt: currentNow,
    };
  }

  // Case 2: Deadline elapsed while page was closed/reloading
  const overdueMs = Math.abs(diff);

  if (stored.phase === 'PLAYING') {
    // 10-minute match countdown finished while away
    return {
      ...stored,
      phase: 'TIME_EXPIRED',
      status: 'IDLE',
      deadline: null,
      remainingMs: 0,
      version: stored.version + 1,
      updatedAt: currentNow,
    };
  }

  if (stored.phase === 'GOAL_BUFFER') {
    // 60-second buffer expired while away. Does playing countdown still have time left?
    if (overdueMs < PLAYING_DURATION_MS) {
      const remainingPlayingMs = PLAYING_DURATION_MS - overdueMs;
      const newDeadline = stored.deadline + PLAYING_DURATION_MS;
      return {
        ...stored,
        phase: 'PLAYING',
        status: 'RUNNING',
        deadline: newDeadline,
        remainingMs: remainingPlayingMs,
        phaseDurationMs: PLAYING_DURATION_MS,
        version: stored.version + 1,
        updatedAt: currentNow,
      };
    } else {
      // Both buffer and match countdown finished while away
      return {
        ...stored,
        phase: 'TIME_EXPIRED',
        status: 'IDLE',
        deadline: null,
        remainingMs: 0,
        version: stored.version + 2,
        updatedAt: currentNow,
      };
    }
  }

  // Expired phase stays expired
  return {
    ...stored,
    status: 'IDLE',
    deadline: null,
    remainingMs: 0,
    updatedAt: currentNow,
  };
}

/**
 * Loads referee preferences from LocalStorage with safe fallback to defaults.
 */
export function loadRefereeSettings(): RefereeSettings {
  if (!isLocalStorageAvailable()) return { ...DEFAULT_REFEREE_SETTINGS };

  try {
    const raw = window.localStorage.getItem(REFEREE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REFEREE_SETTINGS };

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_REFEREE_SETTINGS };

    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_REFEREE_SETTINGS.soundEnabled,
      vibrationEnabled:
        typeof parsed.vibrationEnabled === 'boolean'
          ? parsed.vibrationEnabled
          : DEFAULT_REFEREE_SETTINGS.vibrationEnabled,
      wakeLockEnabled:
        typeof parsed.wakeLockEnabled === 'boolean'
          ? parsed.wakeLockEnabled
          : DEFAULT_REFEREE_SETTINGS.wakeLockEnabled,
    };
  } catch {
    return { ...DEFAULT_REFEREE_SETTINGS };
  }
}

/**
 * Saves referee preferences to LocalStorage safely.
 */
export function saveRefereeSettings(settings: RefereeSettings): boolean {
  if (!isLocalStorageAvailable()) return false;

  try {
    window.localStorage.setItem(REFEREE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.warn('[TimerStorage] Failed to save referee settings:', err);
    return false;
  }
}
