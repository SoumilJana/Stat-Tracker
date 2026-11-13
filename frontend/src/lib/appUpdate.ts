/**
 * Automatic app updates.
 *
 * The browser only looks for a new service worker when the app is opened
 * fresh, so a PWA resumed from the background could stay on an old version
 * for days. We also check whenever the app comes back to the screen and every
 * 30 minutes. When a new version takes over, the page reloads itself, except on
 * the New Match / live match screens, where a reload could wipe picked teams or
 * the clock. There the reload waits until the admin leaves the screen.
 */

export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MIN_CHECK_GAP_MS = 60 * 1000;

/** New Match and live match screens must not be reloaded mid-use */
export function isReloadUnsafe(pathname: string): boolean {
  return /^\/matches\/[^/]+/.test(pathname);
}

let updatePending = false;
const listeners = new Set<() => void>();

export function isUpdatePending(): boolean {
  return updatePending;
}

export function subscribeUpdatePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called when a new version has taken over. Reloads now, or once it's safe. */
export function handleNewVersion(
  pathname: string = window.location.pathname,
  reload: () => void = () => window.location.reload()
): void {
  if (!isReloadUnsafe(pathname)) {
    reload();
    return;
  }
  updatePending = true;
  listeners.forEach((l) => l());
}

/** Called on navigation: applies a waiting update once the user leaves a match screen. */
export function applyPendingUpdate(
  pathname: string,
  reload: () => void = () => window.location.reload()
): void {
  if (updatePending && !isReloadUnsafe(pathname)) {
    updatePending = false;
    reload();
  }
}

/** Ask the browser to look for a new version on resume and on a timer. */
export function scheduleUpdateChecks(registration: ServiceWorkerRegistration | undefined): () => void {
  if (!registration) return () => {};
  let lastCheck = Date.now();

  const check = () => {
    if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    lastCheck = Date.now();
    registration.update().catch(() => {
      /* offline or server hiccup: try again next time */
    });
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };

  const timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}

/** Test helper */
export function resetUpdateStateForTests(): void {
  updatePending = false;
  listeners.clear();
}
