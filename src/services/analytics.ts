

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string> }) => void;
  }
}

let loaded = false;

export function initAnalytics(): void {
  const scriptUrl = import.meta.env.VITE_ANALYTICS_SCRIPT_URL as
    | string
    | undefined;
  if (!scriptUrl || loaded) return;
  loaded = true;
  const s = document.createElement('script');
  s.defer = true;
  s.src = scriptUrl;
  document.head.appendChild(s);
}

export function trackEvent(
  name: string,
  props?: Record<string, string>,
): void {
  try {
    window.plausible?.(name, props ? { props } : undefined);
  } catch {
    /* optional */
  }
}
