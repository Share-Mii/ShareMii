#!/usr/bin/env node
/**
 * Applies supabase/sync.sql on every dev start.
 * Uses Supabase CLI (linked project or DATABASE_URL).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const syncFile = join(root, 'supabase', 'sync.sql');
const adminMigrationFiles = [
  join(root, 'supabase', 'migrations', '015_admin_foundation.sql'),
  join(root, 'supabase', 'migrations', '016_reports_and_moderation.sql'),
  join(root, 'supabase', 'migrations', '017_roadmap_features.sql'),
  join(root, 'supabase', 'migrations', '018_is_staff_anon_execute.sql'),
  join(root, 'supabase', 'migrations', '019_security_rls_pins_follows.sql'),
  join(root, 'supabase', 'migrations', '020_profile_private.sql'),
  join(root, 'supabase', 'migrations', '021_staff_rpc_grants.sql'),
  join(root, 'supabase', 'migrations', '022_comment_insert_visibility_and_rate_limit.sql'),
  join(root, 'supabase', 'migrations', '023_content_auto_moderation.sql'),
  join(root, 'supabase', 'migrations', '024_revoke_public_execute_definer_rpc.sql'),
];
const envLocal = join(root, '.env.local');

function loadEnvLocal() {
  if (!existsSync(envLocal)) return;
  const text = readFileSync(envLocal, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
    ...opts,
  });
  return r.status === 0;
}

loadEnvLocal();

const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!existsSync(syncFile)) {
  console.error('[db:sync] Missing supabase/sync.sql');
  process.exit(1);
}

const sqlFiles = [
  syncFile,
  ...adminMigrationFiles.filter((f) => existsSync(f)),
];

function applySqlFiles(extraArgs) {
  for (const file of sqlFiles) {
    const label = file.replace(root + '/', '');
    console.log(`[db:sync] Applying ${label}…`);
    const ok = run('supabase', ['db', 'query', '--file', file, ...extraArgs, '--yes']);
    if (!ok) return false;
  }
  return true;
}

console.log('[db:sync] Applying schema files…');

// 1) DATABASE_URL — direct Postgres (most reliable for repeat runs)
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const ok = applySqlFiles(['--db-url', dbUrl]);
  if (ok) {
    console.log('[db:sync] Done (DATABASE_URL).');
    process.exit(0);
  }
  console.warn('[db:sync] DATABASE_URL sync failed, trying linked project…');
}

// 2) Linked project via Management API (requires `supabase login` + link)
if (projectRef) {
  const linkedRef = join(root, '.supabase');
  if (!existsSync(linkedRef)) {
    const password = process.env.SUPABASE_DB_PASSWORD;
    const linkArgs = ['link', '--project-ref', projectRef, '--yes'];
    if (password) linkArgs.push('--password', password);
    run('supabase', linkArgs);
  }

  const ok = applySqlFiles(['--linked']);
  if (ok) {
    console.log('[db:sync] Done (linked project).');
    process.exit(0);
  }
}

// 3) Initial migration push (first-time setup only)
const okPush = run('supabase', ['db', 'push', '--linked', '--yes']);
if (okPush) {
  console.log('[db:sync] Applied via db push.');
  process.exit(0);
}

console.warn(`
[db:sync] Could not sync database automatically.

Add one of these to .env.local:

  DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres

  SUPABASE_DB_PASSWORD=your-database-password

Then run:  supabase login && npm run dev

Or apply SQL manually in Supabase Dashboard → SQL Editor (supabase/sync.sql).
`);
process.exit(0);
