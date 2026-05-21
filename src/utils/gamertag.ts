import { quickTextPolicyFailReason } from '@/utils/contentModeration';

const RESERVED = new Set([
  'admin',
  'moderator',
  'mod',
  'sharemii',
  'support',
  'help',
  'system',
  'null',
  'undefined',
]);

export interface GamertagValidation {
  ok: boolean;
  error?: string;
}

export function normalizeGamertag(value: string): string {
  return value.trim().toLowerCase();
}

export function validateGamertag(value: string): GamertagValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, error: 'Gamertag is required.' };
  }

  if (trimmed.length < 3 || trimmed.length > 15) {
    return { ok: false, error: 'Gamertag must be 3–15 characters.' };
  }

  if (trimmed !== value || /^\s|\s$/.test(value)) {
    return { ok: false, error: 'Gamertag cannot start or end with a space.' };
  }

  if (/\s{2,}/.test(trimmed)) {
    return { ok: false, error: 'Gamertag cannot contain consecutive spaces.' };
  }

  if (!/^[A-Za-z]/.test(trimmed)) {
    return { ok: false, error: 'Gamertag must start with a letter.' };
  }

  if (
    !/^[A-Za-z][A-Za-z0-9 ]*[A-Za-z0-9]$/.test(trimmed) &&
    !/^[A-Za-z]{3,15}$/.test(trimmed)
  ) {
    return {
      ok: false,
      error: 'Use only letters, numbers, and spaces (no trailing space).',
    };
  }

  const normalized = normalizeGamertag(trimmed);
  if (RESERVED.has(normalized)) {
    return { ok: false, error: 'This gamertag is not available.' };
  }

  const urlBlock = quickTextPolicyFailReason(trimmed);
  if (urlBlock) {
    return { ok: false, error: urlBlock };
  }

  return { ok: true };
}
