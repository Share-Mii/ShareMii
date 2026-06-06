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
import { openBugReportModal } from '@/components/BugReportModal/BugReportModal';
import { icon, iconSpan } from '@/utils/icon';
import { getRoutePath, navigateTo, ROUTE_CHANGE_EVENT } from '@/utils/navigation';

interface NavLink {
  href: string;
  label: string;
  match: RegExp;
}

const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home', match: /^\/$/ },
  { href: '/feed', label: 'Feed', match: /^\/feed$/ },
  { href: '/browse', label: 'Browse', match: /^\/browse/ },
  { href: '/create', label: 'Mii Creator', match: /^\/create/ },
];

function currentPath(): string {
  return getRoutePath();
}

let headerHashListenerBound = false;
let profileCache: Profile | null = null;
let stopPolling: (() => void) | null = null;

function bindHeaderHashListener(): void {
  if (headerHashListenerBound) return;
  headerHashListenerBound = true;
  window.addEventListener(ROUTE_CHANGE_EVENT, () => {
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
  const hash = currentPath();
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
  const profileHref = username
    ? `/u/${encodeURIComponent(username)}`
    : '/settings';

  const discordUrl = getDiscordInviteUrl();

  const items: UserMenuItem[] = [
    {
      kind: 'header',
      href: profileHref,
      username: username || 'resident',
      profile,
    },
    { kind: 'section', label: 'Library' },
    { href: '/favorites', label: 'Favorites', icon: 'bookmark' },
    { href: '/collections', label: 'Collections', icon: 'folder' },
    { href: '/uploads', label: 'Uploads', icon: 'cloud-arrow-up' },
    { href: '/dashboard', label: 'Dashboard', icon: 'chart-line' },
    { kind: 'section', label: 'App' },
    { href: '/settings', label: 'Settings', icon: 'gear' },
    {
      label: 'Scan QR',
      icon: 'camera',
      action: () => {
        document
          .querySelector<HTMLElement>('[data-scan-submit]')
          ?.click();
      },
    },
    {
      label: 'Report a bug',
      icon: 'bug',
      action: () => {
        openBugReportModal();
      },
    },
  ];

  if (discordUrl) {
    items.push({
      href: discordUrl,
      label: 'Discord',
      icon: 'comments',
    });
  }

  items.push(
    { kind: 'section', label: 'Legal' },
    { href: '/legal', label: 'Legal & support', icon: 'scale-balanced' },
  );

  if (isStaff(profile)) {
    items.push(
      { kind: 'separator' },
      { href: '/admin', label: 'Admin', icon: 'shield-halved' },
    );
  }

  items.push(
    { kind: 'separator' },
    {
      label: 'Log out',
      icon: 'right-from-bracket',
      variant: 'danger',
      action: async () => {
        const err = await signOut();
        if (err) alert(err);
        navigateTo('/');
      },
    },
  );

  menuDropdown = createUserMenuDropdown(items, closeUserMenu);
  if (menuDropdown.classList.contains('user-menu__sheet-shell')) {
    document.body.appendChild(menuDropdown);
  } else {
    wrap.appendChild(menuDropdown);
  }
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
    submit.className =
      'pill-btn pill-btn--outline interactive site-header__scan';
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
  brand.href = '/';
  brand.innerHTML = `
    <span class="site-header__logo" aria-hidden="true">${logoMark()}</span>
    <span class="site-header__brand-text">ShareMii</span>
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
