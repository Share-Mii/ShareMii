import { quickTextPolicyFailReason } from '@/utils/contentModeration';

export const MII_NAME_MAX = 32;

export function truncateMiiName(value: string): string {
  return value.trim().slice(0, MII_NAME_MAX);
}

export function validateMiiName(value: string): { ok: true } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter a name for your Mii.' };
  }
  if (trimmed.length > MII_NAME_MAX) {
    return {
      ok: false,
      error: `Mii name must be ${MII_NAME_MAX} characters or fewer.`,
    };
  }
  if (/[<>]/.test(trimmed)) {
    return { ok: false, error: 'Mii name cannot contain < or >.' };
  }
  const blocked = quickTextPolicyFailReason(trimmed);
  if (blocked) {
    return { ok: false, error: blocked };
  }
  return { ok: true };
}
