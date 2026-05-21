const STORAGE_PREFIX = 'sharemii:played:';

export function consumePageEntrance(pageId: string): boolean {
  try {
    const key = `${STORAGE_PREFIX}${pageId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}
