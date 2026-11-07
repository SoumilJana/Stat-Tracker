# StatTracker Repository Guidelines

## Versioning & Release Protocol
1. **Source of Truth:**
   - The application version is tracked in `frontend/src/version.ts` (`export const APP_VERSION = 'X.Y';`), `frontend/package.json` (`"version": "X.Y.0"`), and root `README.md`.
   - The version is displayed live in the top bar beside the "StatTracker" title (both desktop sidebar and mobile header).
2. **Increment Rules on Every Push to GitHub:**
   - **Small Changes / Bugfixes / UI Polish:** Increment the minor number (`Y` increments: `X.Y` -> `X.(Y+1)`, e.g., `2.3` -> `2.4`).
   - **Major Changes / New Features / Added or Removed Sections:** Increment the major number and reset minor to 0 (`X` increments, `Y = 0`: `X.Y` -> `(X+1).0`, e.g., `2.x` -> `3.0`).
3. **Synchronization:**
   - Always keep `frontend/src/version.ts`, `frontend/package.json`, and root `README.md` in sync whenever committing and pushing to GitHub.
