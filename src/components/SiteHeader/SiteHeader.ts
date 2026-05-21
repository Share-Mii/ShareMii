import './SiteHeader.css';
import { logoMark } from '@/utils/logo';
import '@/components/shared.css';
import type { Session } from '@supabase/supabase-js';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  bindUserMenuDismiss,
  createUserMenuButton,
  createUserMenuDropdown,
  type UserMenuItem,
} from '@/components/UserMenu/UserMenu';
import {
  closeNotificationPanel,
  isNotificationPanelOpen,
  openNotificationPanel,
  refreshNotificationBadge,
  startNotificationPolling,
} from '@/components/NotificationPanel/NotificationPanel';
import { getDiscordInviteUrl } from '@/config/community';
import {
  getAuthSession,
  getPrimedAuthSession,
  isLoggedIn,
  signOut,
  subscribeAuth,
} from '@/services/auth';
import { fetchProfileById } from '@/services/profile';
import { isDarkTheme, toggleTheme } from '@/services/theme';
import type { Profile } from '@/types';
import { fetchActiveAnnouncement } from '@/services/admin';
import { isStaff } from '@/utils/permissions';
import { icon, iconSpan } from '@/utils/icon';

interface NavLink {
  href: string;
  label: string;
  match: RegExp;
}

const NAV_LINKS: NavLink[] = [
  { href: '#/', label: 'Home', match: /^#\/$/ },
  { href: '#/browse', label: 'Browse', match: /^#\/browse/ },
  { href: '#/create', label: 'Mii Creator', match: /^#\/create/ },
];

function currentHash(): string {
  return window.location.hash || '#/';
}

let headerHashListenerBound = false;
let profileCache: Profile | null = null;
let stopPolling: (() => void) | null = null;

function bindHeaderHashListener(): void {
  if (headerHashListenerBound) return;
  headerHashListenerBound = true;
  window.addEventListener('hashchange', () => {
    const nav = document.querySelector<HTMLElement>('.site-header__nav');
    if (nav) renderNav(nav);
    closeUserMenu();
    closeNotificationPanel();
  });
  window.addEventListener('sharemii:profile-updated', () => {
    void reloadProfileForHeader();
  });
}

async function reloadProfileForHeader(): Promise<void> {
  const session = await getAuthSession();
  if (!isLoggedIn(session)) return;
  profileCache = await fetchProfileById(session!.user.id);
  const actions = document.querySelector<HTMLElement>('.site-header__actions');
  if (actions) renderHeaderActions(actions, session);
}

function renderNav(nav: HTMLElement): void {
  const hash = currentHash();
  nav.replaceChildren();

  for (const link of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    const active = link.match.test(hash);
    a.className = `app-tab interactive${active ? ' app-tab--active' : ''}`;
    a.textContent = link.label;
    if (active) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }

  const discordUrl = getDiscordInviteUrl();
  if (discordUrl) {
    const discord = document.createElement('a');
    discord.href = discordUrl;
    discord.target = '_blank';
    discord.rel = 'noopener noreferrer';
    discord.className = 'app-tab interactive site-header__discord';
    discord.textContent = 'Discord';
    nav.appendChild(discord);
  }
}

function createThemeToggle(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'pill-btn pill-btn--outline interactive site-header__theme-toggle';
  const syncThemeToggle = (): void => {
    const dark = isDarkTheme();
    btn.innerHTML = iconSpan(dark ? 'sun' : 'moon');
    btn.setAttribute(
      'aria-label',
      dark ? 'Switch to light mode' : 'Switch to dark mode',
    );
  };
  syncThemeToggle();
  btn.addEventListener('click', () => {
    toggleTheme();
    syncThemeToggle();
  });
  return btn;
}

let menuDismiss: (() => void) | null = null;
let menuDropdown: HTMLElement | null = null;
let menuTrigger: HTMLButtonElement | null = null;

function closeUserMenu(): void {
  menuDropdown?.remove();
  menuDropdown = null;
  menuDismiss?.();
  menuDismiss = null;
  if (menuTrigger) {
    menuTrigger.setAttribute('aria-expanded', 'false');
  }
}

function openUserMenu(trigger: HTMLButtonElement, profile: Profile): void {
  closeUserMenu();
  const wrap = trigger.closest('.user-menu');
  if (!wrap) return;

  const username = profile.username.trim();
  const items: UserMenuItem[] = [
    {
      href: username ? `#/u/${encodeURIComponent(username)}` : '#/settings',
      label: 'View Profile',
      icon: 'user',
    },
    { href: '#/favorites', label: 'My Favorites', icon: 'bookmark' },
    { href: '#/collections', label: 'My Collections', icon: 'folder' },
    { href: '#/uploads', label: 'My Uploads', icon: 'cloud-arrow-up' },
    { href: '#/settings', label: 'User Settings', icon: 'gear' },
  ];

  if (isStaff(profile)) {
    items.push({ href: '#/admin', label: 'Admin', icon: 'shield-halved' });
  }

  items.push({
    label: 'Log out',
    icon: 'right-from-bracket',
    action: async () => {
      const err = await signOut();
      if (err) alert(err);
      window.location.hash = '#/';
    },
  });

  menuDropdown = createUserMenuDropdown(items, closeUserMenu);
  wrap.appendChild(menuDropdown);
  menuTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  menuDismiss = bindUserMenuDismiss(trigger, menuDropdown, closeUserMenu);
}

function renderHeaderActions(
  actions: HTMLElement,
  session: Session | null,
): void {
  stopPolling?.();
  stopPolling = null;
  closeUserMenu();
  closeNotificationPanel();

  actions.replaceChildren();
  actions.appendChild(createThemeToggle());

  if (isLoggedIn(session)) {
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.setAttribute('data-scan-submit', '');
    submit.className = 'pill-btn pill-btn--outline interactive';
    submit.innerHTML = `${iconSpan('camera')} Scan QR`;

    const notifWrap = document.createElement('div');
    notifWrap.className = 'site-header__notif-wrap';

    const notifBtn = document.createElement('button');
    notifBtn.type = 'button';
    notifBtn.className =
      'pill-btn pill-btn--outline interactive site-header__notif-btn';
    notifBtn.setAttribute('aria-label', 'Notifications');
    notifBtn.innerHTML = icon('bell');

    const badge = document.createElement('span');
    badge.className = 'site-header__notif-badge';
    badge.hidden = true;
    badge.setAttribute('aria-live', 'polite');
    notifBtn.appendChild(badge);

    const refreshBadge = (): void => {
      void refreshNotificationBadge(badge);
    };

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isNotificationPanelOpen()) {
        closeNotificationPanel();
        return;
      }
      openNotificationPanel(notifBtn, refreshBadge);
    });

    notifWrap.appendChild(notifBtn);

    const userMenuWrap = document.createElement('div');
    userMenuWrap.className = 'user-menu';

    const trigger = createUserMenuButton(profileCache, (open) => {
      if (open && profileCache) {
        openUserMenu(trigger, profileCache);
      } else {
        closeUserMenu();
      }
    });

    userMenuWrap.appendChild(trigger);

    actions.append(submit, notifWrap, userMenuWrap);
    actions.classList.add('site-header__actions--auth');

    void refreshBadge();
    stopPolling = startNotificationPolling(refreshBadge);

    return;
  }

  profileCache = null;
  actions.classList.remove('site-header__actions--auth');

  const loginBtn = document.createElement('button');
  loginBtn.type = 'button';
  loginBtn.className =
    'pill-btn pill-btn--filled pill-btn--lg interactive site-header__login';
  loginBtn.setAttribute('aria-label', 'Log in');
  loginBtn.textContent = 'Log in';
  loginBtn.addEventListener('click', () => {
    openLoginModal();
  });
  actions.appendChild(loginBtn);
}

let announcementEl: HTMLElement | null = null;

async function syncAnnouncement(): Promise<void> {
  if (!announcementEl) return;
  try {
    const ann = await fetchActiveAnnouncement();
    if (!ann?.message) {
      announcementEl.hidden = true;
      return;
    }
    announcementEl.hidden = false;
    announcementEl.className = `site-announcement site-announcement--${ann.severity}`;
    announcementEl.textContent = ann.message;
  } catch {
    announcementEl.hidden = true;
  }
}

export function createSiteHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'site-header';

  announcementEl = document.createElement('div');
  announcementEl.className = 'site-announcement site-announcement--info';
  announcementEl.hidden = true;
  announcementEl.setAttribute('role', 'status');
  void syncAnnouncement();
  window.addEventListener('sharemii:announcement-updated', () => {
    void syncAnnouncement();
  });

  const inner = document.createElement('div');
  inner.className = 'site-header__inner';

  const brand = document.createElement('a');
  brand.className = 'site-header__brand interactive';
  brand.href = '#/';
  brand.innerHTML = `
    <span class="site-header__logo" aria-hidden="true">${logoMark()}</span>
    <span>ShareMii</span>
  `;

  const nav = document.createElement('nav');
  nav.className = 'site-header__nav';
  nav.setAttribute('aria-label', 'Main');

  const actions = document.createElement('div');
  actions.className = 'site-header__actions';

  renderNav(nav);
  bindHeaderHashListener();

  const primed = getPrimedAuthSession();
  if (primed !== undefined) {
    renderHeaderActions(actions, primed);
    if (isLoggedIn(primed) && primed) {
      void fetchProfileById(primed.user.id).then((p) => {
        if (!p) return;
        profileCache = p;
        renderHeaderActions(actions, primed);
      });
    }
  }

  subscribeAuth(async (session) => {
    if (isLoggedIn(session)) {
      profileCache =
        (await fetchProfileById(session!.user.id)) ?? profileCache;
    } else {
      profileCache = null;
    }
    renderHeaderActions(actions, session);
  });

  inner.append(brand, nav, actions);
  header.append(announcementEl, inner);
  return header;
}
