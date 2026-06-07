/**
 * Dev-only: serves `/update` and JSON APIs to preview/commit/post release notes.
 * Never registered for production builds.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

import {
  buildChangelogDiscordEmbeds,
  parseDiscordEmbedColor,
} from '../../scripts/discordChangelogEmbeds';
import { parseCommitBody } from '../../scripts/readReleaseNotesFromGit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Bump = 'patch' | 'minor' | 'major';

type CommitPayload = {
  bump?: string;
  summary?: string;
  changes?: string;
};

function readPageHtml(): string {
  return readFileSync(path.join(__dirname, 'page.html'), 'utf-8');
}

function isLocalHost(host: string | undefined): boolean {
  if (host === undefined || host.length === 0) {
    return false;
  }
  const h = host.split(',')[0]?.trim().toLowerCase() ?? '';
  return (
    h.startsWith('localhost:') ||
    h.startsWith('127.0.0.1:') ||
    h.startsWith('[::1]:')
  );
}

function pathnameOnly(url: string | undefined): string {
  if (url === undefined) {
    return '';
  }
  return url.split('?', 1)[0] ?? '';
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      chunks.push(c);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function runRepoCmd(
  file: string,
  args: string[],
  cwd: string,
  what: string,
): void {
  const r = spawnSync(file, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });
  if (r.status !== 0) {
    const parts = [
      `${what} failed (exit ${r.status ?? 'unknown'}).`,
      `Command: ${file} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`,
      r.stderr?.trim() ? `stderr:\n${r.stderr.trim()}` : '',
      r.stdout?.trim() ? `stdout:\n${r.stdout.trim()}` : '',
    ].filter(Boolean);
    throw new Error(parts.join('\n\n'));
  }
}

function execGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function isBump(s: string): s is Bump {
  return s === 'patch' || s === 'minor' || s === 'major';
}

function nextVersion(cwd: string, cur: string, bump: Bump): string {
  return execFileSync(
    process.execPath,
    [path.join(cwd, 'scripts', 'release-version.mjs'), cur, bump],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

function assembleCommitMessage(
  version: string,
  summary: string,
  changes: string,
): string {
  return `${version}\n\n[Summary]\n${summary.trim()}\n\n[Changes]\n${changes.trim()}\n`;
}

function commitSubjectLine(fullMessage: string): string {
  const s = fullMessage.replace(/\r\n/g, '\n');
  const i = s.indexOf('\n');
  return (i === -1 ? s : s.slice(0, i)).trim();
}

function getTokenHeader(req: IncomingMessage): string | undefined {
  const v = req.headers['x-sharemii-update-token'];
  if (Array.isArray(v)) {
    return v[0];
  }
  return v;
}

function checkToken(
  required: string | undefined,
  req: IncomingMessage,
): boolean {
  if (required === undefined || required.length === 0) {
    return true;
  }
  return getTokenHeader(req) === required;
}

function buildPreviewEmbeds(
  next: string,
  summary: string,
  changes: string,
  options: {
    discordChangelogHeaderImageUrl?: string;
    discordChangelogFooterImageUrl?: string;
    discordChangelogEmbedColor?: string;
  },
) {
  const parsed = parseCommitBody(
    assembleCommitMessage(next, summary, changes),
  );
  return buildChangelogDiscordEmbeds({
    version: next,
    summaryPlain: parsed.summary,
    changesMd: parsed.changesMd,
    headerImageUrl: options.discordChangelogHeaderImageUrl,
    mainEmbedImageUrl: undefined,
    footerImageUrl: options.discordChangelogFooterImageUrl,
    embedColor: parseDiscordEmbedColor(options.discordChangelogEmbedColor),
  });
}

async function postDiscordWebhook(
  webhookUrl: string,
  embeds: ReturnType<typeof buildChangelogDiscordEmbeds>,
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'sharemii-update-tool/1.0',
    },
    body: JSON.stringify({ content: null, embeds, attachments: [] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(
      `Discord webhook failed: ${res.status} ${res.statusText}${t ? ` — ${t.slice(0, 500)}` : ''}`,
    );
  }
}

export function updateToolDevPlugin(options: {
  toolToken?: string;
  discordWebhookUrl?: string;
  discordChangelogHeaderImageUrl?: string;
  discordChangelogMainEmbedImageUrl?: string;
  discordChangelogFooterImageUrl?: string;
  discordChangelogEmbedColor?: string;
}): Plugin {
  const {
    toolToken,
    discordWebhookUrl,
    discordChangelogHeaderImageUrl,
    discordChangelogMainEmbedImageUrl,
    discordChangelogFooterImageUrl,
    discordChangelogEmbedColor,
  } = options;

  type Next = (err?: unknown) => void;

  return {
    name: 'sharemii-update-tool-dev',
    configureServer(server) {
      const repoRoot = path.resolve(server.config.root);

      const handler = (
        req: IncomingMessage,
        res: ServerResponse,
        next: Next,
      ): void => {
        if (!isLocalHost(req.headers.host)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('ShareMii update tool: localhost only.');
          return;
        }

        const p = pathnameOnly(req.url);
        if (p !== '/update' && !p.startsWith('/__update-tool/')) {
          next();
          return;
        }

        if (p === '/update' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(readPageHtml());
          return;
        }

        const api = '/__update-tool/api';
        if (!p.startsWith(api + '/')) {
          res.statusCode = 404;
          res.end();
          return;
        }

        const sub = p.slice((api + '/').length);

        if (sub === 'state' && req.method === 'GET') {
          try {
            const pkgPath = path.join(repoRoot, 'package.json');
            const version = (
              JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
            ).version;
            const branch = execGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
            const userName = execGit(['config', 'user.name'], repoRoot);
            const userEmail = execGit(['config', 'user.email'], repoRoot);
            const st = execGit(['status', '--porcelain'], repoRoot);
            const tokenRequired =
              toolToken !== undefined && toolToken.length > 0;
            const discordConfigured =
              discordWebhookUrl !== undefined && discordWebhookUrl.length > 0;
            json(res, 200, {
              version,
              branch,
              userName,
              userEmail,
              dirty: st.length > 0,
              tokenRequired,
              discordConfigured,
              repoRoot,
            });
          } catch (e) {
            json(res, 500, {
              error: e instanceof Error ? e.message : String(e),
            });
          }
          return;
        }

        void (async () => {
          if (sub === 'preview' && req.method === 'POST') {
            if (!checkToken(toolToken, req)) {
              json(res, 401, { error: 'Invalid or missing update tool token.' });
              return;
            }
            let body: CommitPayload;
            try {
              body = JSON.parse(await readBody(req)) as CommitPayload;
            } catch {
              json(res, 400, { error: 'Invalid JSON body.' });
              return;
            }
            const bump = body.bump ?? '';
            if (!isBump(bump)) {
              json(res, 400, { error: 'Invalid bump.' });
              return;
            }
            const summary = body.summary ?? '';
            const changes = body.changes ?? '';
            try {
              const pkgPath = path.join(repoRoot, 'package.json');
              const cur = (
                JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
              ).version;
              const next = nextVersion(repoRoot, cur, bump);
              const message = assembleCommitMessage(next, summary, changes);
              const parsed = parseCommitBody(message);
              const discordEmbeds = buildPreviewEmbeds(next, summary, changes, {
                discordChangelogHeaderImageUrl,
                discordChangelogFooterImageUrl,
                discordChangelogEmbedColor,
              });
              json(res, 200, {
                nextVersion: next,
                message,
                commitSubject: commitSubjectLine(message),
                summaryPlain: parsed.summary,
                changesMarkdown: parsed.changesMd,
                discordEmbeds,
              });
            } catch (e) {
              json(res, 500, {
                error: e instanceof Error ? e.message : String(e),
              });
            }
            return;
          }

          if (sub === 'commit' && req.method === 'POST') {
            if (!checkToken(toolToken, req)) {
              json(res, 401, { error: 'Invalid or missing update tool token.' });
              return;
            }
            if (discordWebhookUrl === undefined || discordWebhookUrl.length === 0) {
              json(res, 503, {
                error:
                  'DISCORD_WEBHOOK_URL_CHANGELOG is not set in .env.local — add it and restart the dev server.',
              });
              return;
            }
            let body: CommitPayload;
            try {
              body = JSON.parse(await readBody(req)) as CommitPayload;
            } catch {
              json(res, 400, { error: 'Invalid JSON body.' });
              return;
            }
            const bump = body.bump ?? '';
            if (!isBump(bump)) {
              json(res, 400, { error: 'Invalid bump.' });
              return;
            }
            const summary = body.summary ?? '';
            const changes = body.changes ?? '';
            if (summary.trim().length === 0) {
              json(res, 400, { error: 'Summary must not be empty.' });
              return;
            }
            const tmpDir = mkdtempSync(path.join(tmpdir(), 'sharemii-update-'));
            try {
              const pkgPath = path.join(repoRoot, 'package.json');
              const cur = (
                JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }
              ).version;
              const next = nextVersion(repoRoot, cur, bump);
              if (next === cur) {
                json(res, 400, {
                  error: `Computed next version equals current (${cur}). Pick a different bump.`,
                });
                return;
              }
              const message = assembleCommitMessage(next, summary, changes);
              const msgFile = path.join(tmpDir, 'COMMIT_EDITMSG');
              writeFileSync(msgFile, message, 'utf-8');

              const steps: string[] = [];
              steps.push(`npm version ${next} --no-git-tag-version`);
              runRepoCmd(
                'npm',
                ['version', next, '--no-git-tag-version'],
                repoRoot,
                'npm version',
              );
              steps.push('git add -A');
              runRepoCmd('git', ['add', '-A'], repoRoot, 'git add');

              const staged = spawnSync(
                'git',
                ['diff', '--cached', '--quiet'],
                { cwd: repoRoot, encoding: 'utf8' },
              );
              if (staged.status === 0) {
                spawnSync('git', ['checkout', '--', 'package.json'], {
                  cwd: repoRoot,
                  encoding: 'utf8',
                });
                spawnSync('git', ['checkout', '--', 'package-lock.json'], {
                  cwd: repoRoot,
                  encoding: 'utf8',
                });
                json(res, 409, {
                  error:
                    'Nothing new staged after npm version + git add -A. Reverted package.json if possible.',
                });
                return;
              }

              steps.push('git commit -F <message>');
              runRepoCmd(
                'git',
                ['commit', '-F', msgFile],
                repoRoot,
                'git commit',
              );
              const oneline = execGit(['log', '-1', '--oneline'], repoRoot);
              steps.push(`commit: ${oneline}`);

              let discordOk = false;
              let discordError: string | null = null;
              steps.push('post Discord changelog');
              try {
                const parsed = parseCommitBody(message);
                const embeds = buildChangelogDiscordEmbeds({
                  version: next,
                  summaryPlain: parsed.summary,
                  changesMd: parsed.changesMd,
                  headerImageUrl: discordChangelogHeaderImageUrl,
                  mainEmbedImageUrl: discordChangelogMainEmbedImageUrl,
                  footerImageUrl: discordChangelogFooterImageUrl,
                  embedColor: parseDiscordEmbedColor(discordChangelogEmbedColor),
                });
                await postDiscordWebhook(discordWebhookUrl, embeds);
                discordOk = true;
                steps.push('Discord: OK');
              } catch (e) {
                discordError = e instanceof Error ? e.message : String(e);
                steps.push(`Discord: FAILED — ${discordError}`);
              }

              let pushOk = true;
              let pushError: string | undefined;
              steps.push('git push');
              try {
                runRepoCmd('git', ['push'], repoRoot, 'git push');
                steps.push('git push: OK');
              } catch (e) {
                pushOk = false;
                pushError = e instanceof Error ? e.message : String(e);
                steps.push(`git push: FAILED — ${pushError}`);
              }

              let statusMessage: string;
              if (discordOk && pushOk) {
                statusMessage = 'Committed, published to Discord, and pushed.';
              } else if (discordOk && !pushOk) {
                statusMessage =
                  'Committed and published to Discord; git push failed — push manually.';
              } else if (!discordOk && pushOk) {
                statusMessage =
                  'Committed and pushed, but Discord failed — fix the webhook and post manually.';
              } else {
                statusMessage =
                  'Committed locally; Discord and git push failed — fix webhook, then push manually.';
              }

              json(res, 200, {
                ok: true,
                nextVersion: next,
                oneline,
                repoRoot,
                steps,
                pushOk,
                pushError: pushError ?? null,
                discordOk,
                discordError,
                message: statusMessage,
              });
            } catch (e) {
              json(res, 500, {
                error: e instanceof Error ? e.message : String(e),
              });
            } finally {
              rmSync(tmpDir, { recursive: true, force: true });
            }
            return;
          }

          res.statusCode = 404;
          res.end();
        })().catch((e: unknown) => {
          json(res, 500, { error: e instanceof Error ? e.message : String(e) });
        });
      };

      type Layer = { route: string; handle: typeof handler };
      const stack = (server.middlewares as unknown as { stack: Layer[] }).stack;
      stack.unshift({ route: '', handle: handler });
    },
  };
}

export function repoHasGit(root: string): boolean {
  return existsSync(path.join(root, '.git'));
}
