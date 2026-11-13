import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isReloadUnsafe,
  handleNewVersion,
  applyPendingUpdate,
  isUpdatePending,
  subscribeUpdatePending,
  scheduleUpdateChecks,
  resetUpdateStateForTests,
  UPDATE_CHECK_INTERVAL_MS
} from '../appUpdate';

describe('automatic app updates', () => {
  beforeEach(() => resetUpdateStateForTests());
  afterEach(() => vi.useRealTimers());

  it('treats New Match and live match screens as unsafe to reload', () => {
    expect(isReloadUnsafe('/matches/new')).toBe(true);
    expect(isReloadUnsafe('/matches/abc-123')).toBe(true);
    expect(isReloadUnsafe('/matches')).toBe(false);
    expect(isReloadUnsafe('/payments')).toBe(false);
    expect(isReloadUnsafe('/')).toBe(false);
  });

  it('reloads straight away on a normal screen', () => {
    const reload = vi.fn();
    handleNewVersion('/payments', reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isUpdatePending()).toBe(false);
  });

  it('waits during a match, then reloads once the user leaves', () => {
    const reload = vi.fn();
    const listener = vi.fn();
    subscribeUpdatePending(listener);

    handleNewVersion('/matches/new', reload);
    expect(reload).not.toHaveBeenCalled();
    expect(isUpdatePending()).toBe(true);
    expect(listener).toHaveBeenCalled();

    applyPendingUpdate('/matches/abc', reload); // still on a match screen
    expect(reload).not.toHaveBeenCalled();

    applyPendingUpdate('/matches', reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isUpdatePending()).toBe(false);
  });

  it('does nothing on navigation when no update is waiting', () => {
    const reload = vi.fn();
    applyPendingUpdate('/payments', reload);
    expect(reload).not.toHaveBeenCalled();
  });

  it('checks for updates when the app comes back and on a timer', () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue(undefined);
    const stop = scheduleUpdateChecks({ update } as unknown as ServiceWorkerRegistration);

    // Just opened: a resume right away doesn't double-check
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2 * 60 * 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
