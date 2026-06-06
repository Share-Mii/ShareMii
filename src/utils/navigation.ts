/** Client-side path routing (History API). Replaces legacy hash URLs. */

export const ROUTE_CHANGE_EVENT = 'sharemii:routechange';

export function normalizeRoutePath(path: string): string {
  if (!path || path === '/') return '/';
  let p = path.startsWith('/') ? path : `/${path}`;
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

/** Read current app route from pathname (migrates legacy `/…` URLs once). */
export function getRoutePath(): string {
  const hash = window.location.hash;
  if (hash.startsWith('/')) {
    const legacy = normalizeRoutePath(hash.slice(1) || '/');
    const target = `${legacy}${window.location.search}`;
    window.history.replaceState(null, '', target);
    window.location.hash = '';
    return legacy;
  }
  return normalizeRoutePath(window.location.pathname);
}

export function navigateTo(path: string, replace = false): void {
  const normalized = normalizeRoutePath(path);
  const url = `${normalized}${window.location.search}`;
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
}

export function pathHref(path: string): string {
  return normalizeRoutePath(path);
}
