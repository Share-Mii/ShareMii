import './BottomBar.css';
import '@/components/shared.css';
import { icon } from '@/utils/icon';
import { getAuthSession, isLoggedIn, subscribeAuth } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { fetchProfileById } from '@/services/profile';
import type { Profile } from '@/types';
import { getRoutePath, ROUTE_CHANGE_EVENT } from '@/utils/navigation';
import { scrollToTop } from '@/utils/scroll';

interface TabItem {
  href: string;
  label: string;
  icon: string;
  match: RegExp;
  requiresAuth?: boolean;
}

const TABS: TabItem[] = [
  { href: '/', label: 'Home', icon: 'house', match: /^\/$/ },
  {
    href: '/feed',
    label: 'Feed',
    icon: 'rss',
    match: /^\/feed/,
    requiresAuth: true,
  },
  { href: '/browse', label: 'Browse', icon: 'bars', match: /^\/browse/ },
  { href: '/create', label: 'Create', icon: 'wand-magic-sparkles', match: /^\/create/ },
  {
    href: '/settings',
    label: 'Profile',
    icon: 'user',
    match:
      /^\/(u\/|settings|favorites|uploads|collections|dashboard|collection\/)/,
  },
];

let profileHref = '/settings';
let loggedIn = false;

async function resolveProfileHref(): Promise<string> {
  const session = await getAuthSession();
  if (!isLoggedIn(session)) return '/settings';
  const profile: Profile | null = await fetchProfileById(session!.user.id);
  const username = profile?.username?.trim();
  return username ? `/u/${encodeURIComponent(username)}` : '/settings';
}

function renderTabs(nav: HTMLElement): void {
  const path = getRoutePath();
  nav.replaceChildren();

  for (const tab of TABS) {
    const href = tab.label === 'Profile' ? profileHref : tab.href;
    const a = document.createElement('a');
    a.href = href;
    const active = tab.match.test(path);
    const locked = Boolean(tab.requiresAuth && !loggedIn);
    a.className = `bottom-bar__tab interactive${active ? ' bottom-bar__tab--active' : ''}${locked ? ' bottom-bar__tab--locked' : ''}`;
    if (active) {
      a.setAttribute('aria-current', 'page');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToTop();
      });
    }
    if (locked) {
      a.setAttribute('aria-disabled', 'true');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
      });
    }
    a.innerHTML = `
      <span class="bottom-bar__tab-icon" aria-hidden="true">${icon(tab.icon)}</span>
      <span class="bottom-bar__tab-label">${tab.label}</span>
    `;
    nav.appendChild(a);
  }
}

let routeListenerBound = false;

export function createBottomBar(): HTMLElement {
  const bar = document.createElement('nav');
  bar.className = 'bottom-bar';
  bar.setAttribute('aria-label', 'Mobile');

  const inner = document.createElement('div');
  inner.className = 'bottom-bar__inner';

  const nav = document.createElement('div');
  nav.className = 'bottom-bar__tabs';

  async function refreshAuth(): Promise<void> {
    const session = await getAuthSession();
    loggedIn = isLoggedIn(session);
    profileHref = await resolveProfileHref();
    renderTabs(nav);
  }

  if (!routeListenerBound) {
    routeListenerBound = true;
    window.addEventListener(ROUTE_CHANGE_EVENT, () => {
      const tabs = document.querySelector<HTMLElement>('.bottom-bar__tabs');
      if (tabs) renderTabs(tabs);
    });
  }

  subscribeAuth(() => {
    void refreshAuth();
  });

  void refreshAuth();
  inner.appendChild(nav);
  bar.appendChild(inner);
  return bar;
}
