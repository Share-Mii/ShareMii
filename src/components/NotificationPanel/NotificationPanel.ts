import './NotificationPanel.css';
import {
  fetchNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/supabase';
import type { NotificationRow, NotificationType } from '@/types';
import { escapeHtml } from '@/utils/escapeHtml';
import { icon, yeahIcon } from '@/utils/icon';

function typeIcon(type: NotificationType): string {
  switch (type) {
    case 'comment':
      return icon('comment');
    case 'yeah':
      return yeahIcon();
    case 'favorite':
      return icon('bookmark');
    default:
      return icon('bell');
  }
}

function typeMessage(n: NotificationRow): string {
  const who = escapeHtml(n.actor_username ?? 'Someone');
  const mii = escapeHtml(n.mii_name ?? 'your Mii');
  switch (n.type) {
    case 'comment':
      return `${who} commented on ${mii}`;
    case 'yeah':
      return `${who} yeahed ${mii}`;
    case 'favorite':
      return `${who} favorited ${mii}`;
    default:
      return 'New activity';
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

let panelEl: HTMLElement | null = null;

export function isNotificationPanelOpen(): boolean {
  return panelEl !== null;
}
let dismissBind: (() => void) | null = null;
let pollTimer: number | null = null;

export function closeNotificationPanel(): void {
  panelEl?.remove();
  panelEl = null;
  dismissBind?.();
  dismissBind = null;
}

export async function refreshNotificationBadge(
  badge: HTMLElement,
): Promise<void> {
  try {
    const count = await getUnreadNotificationCount();
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    badge.setAttribute('aria-label', `${count} unread notifications`);
  } catch {
    badge.hidden = true;
  }
}

export function openNotificationPanel(
  anchor: HTMLElement,
  onBadgeRefresh: () => void,
): void {
  closeNotificationPanel();

  const panel = document.createElement('div');
  panel.className = 'notification-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notifications');

  const header = document.createElement('div');
  header.className = 'notification-panel__header';

  const title = document.createElement('h2');
  title.className = 'notification-panel__title';
  title.textContent = 'Notifications';

  const headerActions = document.createElement('div');
  headerActions.className = 'notification-panel__header-actions';

  const settingsLink = document.createElement('a');
  settingsLink.href = '#/settings#notification-settings';
  settingsLink.className = 'notification-panel__settings interactive';
  settingsLink.setAttribute('aria-label', 'Notification settings');
  settingsLink.innerHTML = icon('gear');

  const markAllBtn = document.createElement('button');
  markAllBtn.type = 'button';
  markAllBtn.className = 'notification-panel__mark-all interactive';
  markAllBtn.textContent = 'Mark all read';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'notification-panel__close interactive';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('xmark');

  headerActions.append(settingsLink, markAllBtn, closeBtn);
  header.append(title, headerActions);

  const list = document.createElement('div');
  list.className = 'notification-panel__list';

  panel.append(header, list);
  document.body.appendChild(panel);

  const rect = anchor.getBoundingClientRect();
  panel.style.top = `${rect.bottom + 8}px`;
  panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

  panelEl = panel;

  const close = (): void => {
    closeNotificationPanel();
    onBadgeRefresh();
  };

  closeBtn.addEventListener('click', close);
  settingsLink.addEventListener('click', close);

  const onDocClick = (e: MouseEvent): void => {
    const t = e.target as Node;
    if (panel.contains(t) || anchor.contains(t)) return;
    close();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
  dismissBind = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  };

  async function renderList(): Promise<void> {
    list.innerHTML = '<p class="notification-panel__loading">Loading…</p>';
    try {
      const items = await fetchNotifications(40);
      list.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'notification-panel__empty';
        empty.textContent = 'No notifications yet.';
        list.appendChild(empty);
        return;
      }

      for (const n of items) {
        const row = document.createElement('a');
        row.href = `#/mii/${n.mii_id}`;
        row.className = `notification-panel__item interactive${n.read_at ? '' : ' notification-panel__item--unread'}`;
        row.innerHTML = `
          <span class="notification-panel__icon">${typeIcon(n.type)}</span>
          <span class="notification-panel__body">
            <span class="notification-panel__msg">${typeMessage(n)}</span>
            <span class="notification-panel__time">${relativeTime(n.created_at)}</span>
          </span>
        `;
        row.addEventListener('click', () => {
          if (!n.read_at) {
            void markNotificationRead(n.id).then(() => onBadgeRefresh());
          }
          close();
        });
        list.appendChild(row);
      }
    } catch {
      list.innerHTML =
        '<p class="notification-panel__empty">Could not load notifications.</p>';
    }
  }

  markAllBtn.addEventListener('click', async () => {
    try {
      await markAllNotificationsRead();
      await renderList();
      onBadgeRefresh();
    } catch {
      alert('Could not mark all as read');
    }
  });

  void renderList();
}

export function startNotificationPolling(
  onUpdate: () => void,
  intervalMs = 60000,
): () => void {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  const tick = (): void => {
    void onUpdate();
  };
  pollTimer = window.setInterval(tick, intervalMs);
  window.addEventListener('focus', tick);

  let realtimeCleanup: (() => void) | undefined;
  void import('@/services/auth').then(async ({ getAuthSession, isLoggedIn }) => {
    const session = await getAuthSession();
    if (!isLoggedIn(session)) return;
    const { getSupabaseClient } = await import('@/services/supabase');
    const channel = getSupabaseClient()
      .channel(`notifications:${session!.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${session!.user.id}`,
        },
        () => tick(),
      )
      .subscribe();
    realtimeCleanup = () => {
      void getSupabaseClient().removeChannel(channel);
    };
  });

  return () => {
    realtimeCleanup?.();
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    window.removeEventListener('focus', tick);
  };
}
