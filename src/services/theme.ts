import { refreshTileBackgrounds } from '@/utils/tileBg';

const STORAGE_KEY = 'sharemii-theme';
const LEGACY_STORAGE_KEY = 'miishare-theme';

export type Theme = 'light' | 'dark';

export const THEME_CHANGE_EVENT = 'sharemii-theme-change';

export function getStoredTheme(): Theme | null {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw === 'light' || raw === 'dark') {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* private browsing */
  }
  return null;
}

export function getPreferredTheme(): Theme {
  return getStoredTheme() ?? 'dark';
}

export function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark';
}

function syncThemeColorMeta(theme: Theme): void {
  const content = theme === 'light' ? '#f3f1f8' : '#121214';
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  syncThemeColorMeta(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* private browsing */
  }
  refreshTileBackgrounds();
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
}

export function toggleTheme(): Theme {
  const next: Theme = isDarkTheme() ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initTheme(): void {
  applyTheme(getPreferredTheme());
  requestAnimationFrame(() => {
    document.documentElement.classList.add('theme-transitions-enabled');
  });
}
