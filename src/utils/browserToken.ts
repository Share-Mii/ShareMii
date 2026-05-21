const STORAGE_KEY = 'sharemii:browser_token';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clearBrowserToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function getBrowserToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing && UUID_RE.test(existing)) {
      return existing.toLowerCase();
    }
    if (existing) {
      clearBrowserToken();
    }
  } catch {
    /* private mode */
  }

  const token = randomUuid();
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
  return token;
}
