import './FeedItem.css';
import '@/components/TileOverflowMenu/TileOverflowMenu.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { createTileOverflowMenu } from '@/components/TileOverflowMenu/TileOverflowMenu';
import type { ActivityFeedItem, ActivityEventType } from '@/services/activityFeed';
import { openReportModal } from '@/components/ReportModal/ReportModal';
import { escapeHtml } from '@/utils/escapeHtml';
import { icon, yeahIcon } from '@/utils/icon';

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

function typeIcon(type: ActivityEventType): string {
  switch (type) {
    case 'comment':
      return icon('comment');
    case 'yeah':
      return yeahIcon();
    case 'submit':
      return icon('share-nodes');
    case 'remix':
      return icon('wand-magic-sparkles');
    case 'collection_add':
      return icon('folder-plus');
    default:
      return icon('bell');
  }
}

function actorLabel(item: ActivityFeedItem): string {
  const who = item.actor_username?.trim();
  return who ? escapeHtml(who) : 'Someone';
}

function miiLabel(name: string | null): string {
  return escapeHtml(name?.trim() || 'a Mii');
}

function feedHref(item: ActivityFeedItem): string {
  switch (item.event_type) {
    case 'remix':
      if (item.related_mii_id) return `/mii/${item.related_mii_id}`;
      break;
    case 'collection_add':
      if (item.target_collection_id) {
        return `/collection/${item.target_collection_id}`;
      }
      break;
    default:
      break;
  }
  if (item.target_mii_id) return `/mii/${item.target_mii_id}`;
  if (item.related_mii_id) return `/mii/${item.related_mii_id}`;
  return '/feed';
}

function feedMessage(item: ActivityFeedItem): string {
  const who = actorLabel(item);
  const mii = miiLabel(item.target_mii_name);
  const remix = miiLabel(item.related_mii_name);
  const collection = escapeHtml(item.collection_name?.trim() || 'a collection');

  switch (item.event_type) {
    case 'yeah':
      return `${who} yeahed <strong>${mii}</strong>`;
    case 'submit':
      return `${who} shared <strong>${mii}</strong>`;
    case 'comment':
      return `${who} commented on <strong>${mii}</strong>`;
    case 'remix':
      return `${who} remixed <strong>${mii}</strong> → <strong>${remix}</strong>`;
    case 'collection_add':
      return `${who} added <strong>${mii}</strong> to <strong>${collection}</strong>`;
    default:
      return 'New activity';
  }
}

function thumbMiiData(item: ActivityFeedItem): string | null {
  if (item.event_type === 'remix' && item.related_mii_data) {
    return item.related_mii_data;
  }
  return item.target_mii_data;
}

export function createFeedItem(item: ActivityFeedItem): HTMLElement {
  const row = document.createElement('div');
  row.className = 'feed-item-wrap';

  const link = document.createElement('a');
  link.href = feedHref(item);
  link.className = 'feed-item interactive';

  const iconEl = document.createElement('span');
  iconEl.className = 'feed-item__icon';
  iconEl.innerHTML = typeIcon(item.event_type);

  const body = document.createElement('span');
  body.className = 'feed-item__body';
  body.innerHTML = `
    <span class="feed-item__msg">${feedMessage(item)}</span>
    <span class="feed-item__time">${relativeTime(item.created_at)}</span>
  `;

  const miiData = thumbMiiData(item);
  if (miiData) {
    const thumb = document.createElement('span');
    thumb.className = 'feed-item__thumb';
    thumb.appendChild(
      createMiiRenderer({
        miiData,
        width: 96,
        alt: '',
        className: 'feed-item__mii-render',
      }),
    );
    link.append(iconEl, body, thumb);
  } else {
    link.append(iconEl, body);
  }

  const reportTargetId = item.target_mii_id ?? item.related_mii_id ?? item.id;
  const openReport = (): void => {
    openReportModal({
      targetType: 'mii',
      targetId: reportTargetId,
      targetLabel: item.target_mii_name ?? 'Activity',
    });
  };

  const reportBtn = document.createElement('button');
  reportBtn.type = 'button';
  reportBtn.className = 'feed-item__report feed-item__report--desktop interactive';
  reportBtn.setAttribute('aria-label', 'Report activity');
  reportBtn.innerHTML = icon('flag');
  reportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openReport();
  });

  const menu = createTileOverflowMenu(
    [{ label: 'Report', danger: true, onSelect: openReport }],
    'Activity options',
  );
  menu.classList.add('feed-item__menu');

  row.append(link, reportBtn, menu);
  return row;
}
