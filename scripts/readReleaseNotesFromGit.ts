/**
 * Parse release notes from recent `git log` for Discord changelog posts.
 *
 * Commit message shape (update tool / release commits):
 *   Subject: <version only>, e.g. `0.2.0`
 *   Body:
 *     [Summary]
 *     Short headline for Discord.
 *
 *     [Changes]
 *     Full changelog — GFM Markdown.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function parseCommitBody(fullMessage: string): {
  summary: string;
  changesMd: string;
} {
  const s = fullMessage.replace(/\r\n/g, '\n');
  const sumTag = '[Summary]';
  const chTag = '[Changes]';
  const iSum = s.indexOf(sumTag);
  const iCh = s.indexOf(chTag);
  if (iSum === -1 || iCh === -1 || iCh <= iSum) {
    return { summary: '', changesMd: '' };
  }
  const summary = s.slice(iSum + sumTag.length, iCh).trim();
  const changesMd = s.slice(iCh + chTag.length).trim();
  return { summary, changesMd };
}

const MAX_COMMITS_TO_SCAN = 80;

function releaseNotesFromCommitMessage(
  fullMessage: string,
): { summary: string; changesMd: string } | null {
  const parsed = parseCommitBody(fullMessage);
  if (parsed.summary.trim().length === 0) {
    return null;
  }
  return parsed;
}

export function readReleaseNotesFromGit(repoRoot: string): {
  summary: string;
  changesMd: string;
} {
  const gitDir = path.join(repoRoot, '.git');
  if (!existsSync(gitDir)) {
    return { summary: '', changesMd: '' };
  }
  for (let skip = 0; skip < MAX_COMMITS_TO_SCAN; skip++) {
    let msg = '';
    try {
      msg = execSync(`git log -1 --skip=${skip} --format=%B`, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      break;
    }
    if (msg.replace(/\r\n/g, '\n').trim().length === 0) {
      break;
    }
    const hit = releaseNotesFromCommitMessage(msg);
    if (hit !== null) {
      return hit;
    }
  }
  return { summary: '', changesMd: '' };
}
