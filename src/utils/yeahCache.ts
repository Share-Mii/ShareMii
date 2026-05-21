
const STORAGE_KEY = 'sharemii:yeah-cache';

export function getYeahedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function isYeahedLocally(id: string): boolean {
  return getYeahedIds().has(id);
}

export function setYeahedLocally(id: string, active: boolean): void {
  const ids = getYeahedIds();
  if (active) ids.add(id);
  else ids.delete(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function migrateLegacyYeahStorage(): void {
  const legacy = 'sharemii:favorites';
  if (!localStorage.getItem(legacy)) return;
  try {
    const ids = JSON.parse(localStorage.getItem(legacy)!) as string[];
    const current = getYeahedIds();
    for (const id of ids) current.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    /* ignore */
  }
  localStorage.removeItem(legacy);
}
