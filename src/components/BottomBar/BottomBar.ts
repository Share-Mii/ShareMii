import './BottomBar.css';
import '@/components/shared.css';
import { icon } from '@/utils/icon';
import { getAuthSession, isLoggedIn, subscribeAuth } from '@/services/auth';
import { fetchProfileById } from '@/services/profile';
import type { Profile } from '@/types';

interface TabItem {
  href: string;
  label: string;
  icon: string;
  match: RegExp;
}

const TABS: TabItem[] = [
  { href: '#/', label: 'Home', icon: 'house', match: /^#\/$/ },
  { href: '#/browse', label: 'Browse', icon: 'bars', match: /^#\/browse/ },
  { href: '#/create', label: 'Create', icon: 'wand-magic-sparkles', match: /^#\/create/ },
  {
    href: '#/settings',
    label: 'Profile',
    icon: 'user',
    match: /^#\/(u\/|settings|favorites|uploads|collections)/,
  },
];

function currentHash(): string {
  return window.location.hash || '#/';
}

let profileHref = '#/settings';

async function resolveProfileHref(): Promise<string> {
  const session = await getAuthSession();
  if (!isLoggedIn(session)) return '#/settings';
  const profile: Profile | null = await fetchProfileById(session!.user.id);
  const username = profile?.username?.trim();
  return username ? `#/u/${encodeURIComponent(username)}` : '#/settings';
}

function renderTabs(nav: HTMLElement): void {
  const hash = currentHash();
  nav.replaceChildren();

  for (const tab of TABS) {
    const href = tab.label === 'Profile' ? profileHref : tab.href;
    const a = document.createElement('a');
    a.href = href;
    a.className = `bottom-bar__tab interactive${tab.match.test(hash) ? ' bottom-bar__tab--active' : ''}`;
    if (tab.match.test(hash)) a.setAttribute('aria-current', 'page');
    a.innerHTML = `
      <span class="bottom-bar__tab-icon" aria-hidden="true">${icon(tab.icon)}</span>
      <span class="bottom-bar__tab-label">${tab.label}</span>
    `;
    nav.appendChild(a);
  }
}

let hashListenerBound = false;

export function createBottomBar(): HTMLElement {
  const bar = document.createElement('nav');
  bar.className = 'bottom-bar';
  bar.setAttribute('aria-label', 'Mobile');

  const inner = document.createElement('div');
  inner.className = 'bottom-bar__inner';

  const nav = document.createElement('div');
  nav.className = 'bottom-bar__tabs';

  if (!hashListenerBound) {
    hashListenerBound = true;
    window.addEventListener('hashchange', () => {
      const tabs = document.querySelector<HTMLElement>('.bottom-bar__tabs');
      if (tabs) renderTabs(tabs);
    });
  }

  void resolveProfileHref().then((href) => {
    profileHref = href;
    renderTabs(nav);
  });

  subscribeAuth(() => {
    void resolveProfileHref().then((href) => {
      profileHref = href;
      renderTabs(nav);
    });
  });

  renderTabs(nav);
  inner.appendChild(nav);
  bar.appendChild(inner);
  return bar;
}
