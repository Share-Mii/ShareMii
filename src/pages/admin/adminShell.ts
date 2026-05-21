import './admin.css';
import '../pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import type { Profile } from '@/types';
import { isAdmin, roleLabel } from '@/utils/permissions';
import { escapeHtml } from '@/utils/escapeHtml';
import { icon } from '@/utils/icon';
import { logoMark } from '@/utils/logo';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV: AdminNavItem[] = [
  { href: '#/admin', label: 'Dashboard', icon: 'chart-line' },
  { href: '#/admin/reports', label: 'Reports', icon: 'flag' },
  { href: '#/admin/auto-flags', label: 'Auto-mod', icon: 'filter' },
  { href: '#/admin/users', label: 'Users', icon: 'users' },
  { href: '#/admin/audit', label: 'Audit log', icon: 'clock-rotate-left' },
  { href: '#/admin/settings', label: 'Settings', icon: 'gear', adminOnly: true },
];

export interface AdminPageOptions {
  subtitle?: string;
}

export function wrapAdminPage(
  profile: Profile,
  title: string,
  content: HTMLElement,
  options: AdminPageOptions = {},
): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'admin-layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';

  const brandBlock = document.createElement('div');
  brandBlock.className = 'admin-sidebar__brand';
  brandBlock.innerHTML = `
    <span class="admin-sidebar__logo" aria-hidden="true">${logoMark()}</span>
    <div>
      <span class="admin-sidebar__name">ShareMii</span>
      <span class="admin-sidebar__tag">Admin</span>
    </div>
  `;

  const nav = document.createElement('nav');
  nav.className = 'admin-nav';
  nav.setAttribute('aria-label', 'Admin');

  const hash = window.location.hash || '#/admin';

  for (const item of NAV) {
    if (item.adminOnly && !isAdmin(profile)) continue;
    const a = document.createElement('a');
    a.href = item.href;
    a.className = 'admin-nav__link interactive';
    const active =
      item.href === '#/admin'
        ? hash === '#/admin'
        : item.href === '#/admin/reports'
          ? hash === '#/admin/reports' ||
            hash.startsWith('#/admin/reports/')
          : hash.startsWith(item.href);
    if (active) a.classList.add('admin-nav__link--active');
    a.innerHTML = `${icon(item.icon, 'admin-nav__icon')}${item.label}`;
    nav.appendChild(a);
  }

  const userStrip = document.createElement('div');
  userStrip.className = 'admin-sidebar__user';
  userStrip.innerHTML = `
    <span class="admin-sidebar__user-name">${escapeHtml(profile.username || 'Staff')}</span>
    <span class="admin-role-badge admin-role-badge--${escapeHtml(profile.role)}">${escapeHtml(roleLabel(profile.role))}</span>
  `;

  sidebar.append(brandBlock, nav, userStrip);

  const main = document.createElement('div');
  main.className = 'admin-main';

  const head = document.createElement('header');
  head.className = 'admin-main__head';
  const h1 = document.createElement('h1');
  h1.className = 'admin-main__title';
  h1.textContent = title;
  head.appendChild(h1);
  if (options.subtitle) {
    const sub = document.createElement('p');
    sub.className = 'admin-main__subtitle';
    sub.textContent = options.subtitle;
    head.appendChild(sub);
  }

  const pageBody = document.createElement('div');
  pageBody.className = 'admin-page-body';
  pageBody.appendChild(content);

  main.append(head, pageBody);
  layout.append(sidebar, main);
  return wrapPublicPage(layout);
}

export function reportAgeClass(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours >= 72) return 'admin-table__row--urgent';
  if (hours >= 24) return 'admin-table__row--sla';
  return '';
}

export function formatReportAge(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
