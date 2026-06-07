#!/usr/bin/env node
/**
 * Computes next package.json version for release commits.
 * Usage: node scripts/release-version.mjs <current> <bump>
 * bump: patch | minor | major
 */

import semver from 'semver';

/** @param {string} current @param {string} bump */
function computeNextVersion(current, bump) {
  if (bump !== 'patch' && bump !== 'minor' && bump !== 'major') {
    throw new Error(`Invalid bump: ${bump} (expected patch, minor, or major)`);
  }
  const parsed = semver.parse(current);
  if (parsed === null) {
    throw new Error(`Invalid semver: ${current}`);
  }
  const n = semver.inc(current, bump);
  if (n === null) {
    throw new Error(`Could not bump ${current} with ${bump}`);
  }
  return n;
}

const [, , cur, bump] = process.argv;
if (cur === undefined || bump === undefined) {
  console.error('Usage: node scripts/release-version.mjs <current> <bump>');
  process.exit(1);
}
try {
  console.log(computeNextVersion(cur, bump));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
