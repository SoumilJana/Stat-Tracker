#!/usr/bin/env node
/**
 * StatTracker release helper — keeps the version in sync and commits.
 *
 * Usage (from repo root or frontend/):
 *   node scripts/release.mjs "feat: add weekly games"   # feat → major bump (X+1).0
 *   node scripts/release.mjs "fix: waitlist ordering"   # anything else → minor bump X.(Y+1)
 *   node scripts/release.mjs --major "refactor!: ..."   # force major / --minor to force minor
 *   node scripts/release.mjs --dry-run "fix: ..."       # show what would happen
 *   node scripts/release.mjs check                      # verify the 3 version files agree
 *
 * A release bumps frontend/src/version.ts, frontend/package.json and README.md,
 * stages ALL changes and creates one commit with the given message. It never pushes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  version: resolve(ROOT, 'frontend/src/version.ts'),
  pkg: resolve(ROOT, 'frontend/package.json'),
  readme: resolve(ROOT, 'README.md'),
};

const read = (p) => readFileSync(p, 'utf8');

export function readVersions() {
  const v = read(FILES.version).match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)'/);
  const p = JSON.parse(read(FILES.pkg)).version?.match(/^(\d+)\.(\d+)\.0$/);
  const r = read(FILES.readme).match(/version-v(\d+)\.(\d+)-/);
  const fmt = (m) => (m ? `${m[1]}.${m[2]}` : null);
  return { versionTs: fmt(v), packageJson: fmt(p), readme: fmt(r) };
}

export function bumpType(message, flags = {}) {
  if (flags.major) return 'major';
  if (flags.minor) return 'minor';
  // Conventional commits: feat / feat(scope) / any type with "!" = major feature
  return /^(feat(\(.+\))?|\w+(\(.+\))?!):/.test(message.trim()) ? 'major' : 'minor';
}

export function nextVersion(current, type) {
  const [x, y] = current.split('.').map(Number);
  return type === 'major' ? `${x + 1}.0` : `${x}.${y + 1}`;
}

function writeVersion(next) {
  const [x, y] = next.split('.');
  writeFileSync(FILES.version, read(FILES.version).replace(/APP_VERSION\s*=\s*'[\d.]+'/, `APP_VERSION = '${next}'`));
  writeFileSync(FILES.pkg, read(FILES.pkg).replace(/"version":\s*"[\d.]+"/, `"version": "${x}.${y}.0"`));
  writeFileSync(FILES.readme, read(FILES.readme).replace(/version-v[\d.]+-/, `version-v${next}-`));
}

function check() {
  const v = readVersions();
  const values = Object.values(v);
  if (values.some((x) => !x) || new Set(values).size !== 1) {
    console.error('✗ Version files are out of sync:', v);
    process.exit(1);
  }
  const escaped = v.versionTs.replace('.', '\\.');
  if (!new RegExp(`^### v${escaped}\\s*$`, 'm').test(read(FILES.readme))) {
    console.error(`✗ README.md has no changelog entry for v${v.versionTs}. Add a "### v${v.versionTs}" section with a few bullet points.`);
    process.exit(1);
  }
  console.log(`✓ Version v${v.versionTs} is in sync across version.ts, package.json and README.md, with a changelog entry`);
}

function main(argv) {
  if (argv[0] === 'check') return check();

  const flags = { major: argv.includes('--major'), minor: argv.includes('--minor'), dryRun: argv.includes('--dry-run') };
  const message = argv.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!message) {
    console.error('Usage: node scripts/release.mjs [--major|--minor] [--dry-run] "<commit message>"');
    process.exit(1);
  }

  const current = readVersions();
  if (new Set(Object.values(current)).size !== 1) {
    console.error('✗ Fix out-of-sync version files first:', current);
    process.exit(1);
  }

  const type = bumpType(message, flags);
  const next = nextVersion(current.versionTs, type);
  // Put the version in the commit subject, matching existing history ("fix: v5.4 ...")
  const subject = message.replace(/^([\w()!]+:\s*)(v\d+\.\d+\s+)?/, `$1v${next} `);

  console.log(`${type} bump: v${current.versionTs} → v${next}`);
  console.log(`commit: ${subject}`);
  if (flags.dryRun) return;

  writeVersion(next);
  execFileSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', subject], { cwd: ROOT, stdio: 'inherit' });
  console.log(`✓ Committed v${next}. Push when ready: git push origin main`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
