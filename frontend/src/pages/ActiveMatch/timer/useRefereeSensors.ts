/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/useRefereeSensors.ts
 *
 * Referee Physical Feedback & Display Management:
 * 1. Haptic Vibration API with pattern fallbacks.
 * 2. Screen Wake Lock API with automatic `visibilitychange` re-acquisition.
 * 3. Referee settings persistence (`stattracker_referee_settings`) in localStorage.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefereeSettings } from './types';

export const REFEREE_SETTINGS_STORAGE_KEY = 'stattracker_referee_settings';

export const DEFAULT_REFEREE_SETTINGS: RefereeSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  wakeLockEnabled: true,
};

/**
 * Standard tactile vibration patterns for referee signals (in milliseconds).
 */
export const HAPTIC_PATTERNS = {
  /** 1 quick pulse when Goal Buffer initiates */
  bufferStart: [150],
  /** 2 distinct pulses when Goal Buffer expires into Playing Countdown */
  bufferEnd: [140, 80, 180],
  /** 1 long authoritative pulse when Match Countdown reaches 00:00 */
  matchEnd: [600],
} as const;

/**
 * Loads persisted referee preferences from localStorage, falling back to defaults.
 */
export function loadRefereeSettings(): RefereeSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_REFEREE_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(REFEREE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REFEREE_SETTINGS };

    const parsed = JSON.parse(raw);
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
  } catch (err) {
    console.warn('[RefereeSensors] Failed to load referee settings from localStorage:', err);
    return { ...DEFAULT_REFEREE_SETTINGS };
  }
}

/**
 * Persists referee preferences to localStorage.
 */
export function saveRefereeSettings(settings: RefereeSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(REFEREE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[RefereeSensors] Failed to save referee settings to localStorage:', err);
  }
}

/**
 * React hook to manage and persist referee settings.
 */
export function useRefereeSettings(): {
  settings: RefereeSettings;
  updateSettings: (partial: Partial<RefereeSettings>) => void;
  toggleSound: () => void;
  toggleVibration: () => void;
  toggleWakeLock: () => void;
} {
  const [settings, setSettings] = useState<RefereeSettings>(loadRefereeSettings);

  const updateSettings = useCallback((partial: Partial<RefereeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveRefereeSettings(next);
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    updateSettings({ soundEnabled: !settings.soundEnabled });
  }, [settings.soundEnabled, updateSettings]);

  const toggleVibration = useCallback(() => {
    updateSettings({ vibrationEnabled: !settings.vibrationEnabled });
  }, [settings.vibrationEnabled, updateSettings]);

  const toggleWakeLock = useCallback(() => {
    updateSettings({ wakeLockEnabled: !settings.wakeLockEnabled });
  }, [settings.wakeLockEnabled, updateSettings]);

  return {
    settings,
    updateSettings,
    toggleSound,
    toggleVibration,
    toggleWakeLock,
  };
}

/**
 * Safely triggers haptic feedback via the Vibration API with defensive fallbacks.
 * Returns true if vibration pattern was dispatched to the device.
 */
export function triggerHaptic(pattern: number | number[] | readonly number[]): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (typeof navigator.vibrate !== 'function') {
    return false;
  }

  try {
    const vibrateArg = Array.isArray(pattern) ? [...pattern] : (pattern as number);
    return navigator.vibrate(vibrateArg);
  } catch (err) {
    console.warn('[RefereeSensors] Vibration API error:', err);
    return false;
  }
}

/**
 * Interface representing the status of the Screen Wake Lock.
 */
export interface UseWakeLockReturn {
  /** True if the Screen Wake Lock API is supported in the current browser */
  isSupported: boolean;
  /** True if the screen wake lock is actively held */
  isLocked: boolean;
  /** Error message if requesting the wake lock failed */
  error: string | null;
}

/**
 * React hook for Screen Wake Lock management.
 * Keeps the referee's device screen on during live matches, and automatically
 * re-acquires the lock if the user tabs away and returns (`visibilitychange`).
 */
export function useWakeLock(enabled: boolean): UseWakeLockReturn {
  const isSupported =
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    typeof (navigator as unknown as { wakeLock: { request: unknown } }).wakeLock?.request ===
      'function';

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reference to current active WakeLockSentinel
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const isEnabledRef = useRef<boolean>(enabled);
  isEnabledRef.current = enabled;

  const releaseLock = useCallback(async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {
        // Safe disposal
      } finally {
        sentinelRef.current = null;
        setIsLocked(false);
      }
    }
  }, []);

  const requestLock = useCallback(async () => {
    if (!isSupported || !isEnabledRef.current) return;

    // Do not request if already held and not released
    if (sentinelRef.current && !sentinelRef.current.released) {
      setIsLocked(true);
      return;
    }

    try {
      const lock = await navigator.wakeLock.request('screen');
      sentinelRef.current = lock;
      setIsLocked(true);
      setError(null);

      lock.addEventListener('release', () => {
        setIsLocked(false);
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to acquire wake lock';
      setError(errMsg);
      setIsLocked(false);
    }
  }, [isSupported]);

  // Handle enabled changes
  useEffect(() => {
    if (!isSupported) return;

    if (enabled) {
      requestLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [enabled, isSupported, requestLock, releaseLock]);

  // Handle document visibility change (re-acquire lock when returning to tab)
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isEnabledRef.current) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported, requestLock]);

  return {
    isSupported,
    isLocked,
    error,
  };
}
