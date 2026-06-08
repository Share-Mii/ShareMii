import { SITE_URL } from '@/config/brand';
import { getSiteOrigin } from '@/utils/pageMeta';
import type { DecodedQrMii } from '@/types';

const DRAFT_STORAGE_KEY = 'sharemii.makerDraft';

export function saveMakerDraft(decoded: DecodedQrMii): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(decoded));
  } catch {
    /* quota / private mode */
  }
}

export function loadMakerDraft(): DecodedQrMii | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DecodedQrMii;
    if (
      typeof parsed?.miiDataBase64 !== 'string' ||
      !parsed.miiDataBase64.trim()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearMakerDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function buildPlazaUploadUrl(origin = getSiteOrigin()): string {
  return `${origin}/create?import=draft`;
}

/** Production embed URL for itch.io and other hosts. */
export const EMBED_MAKER_URL = `${SITE_URL}/embed/maker`;
