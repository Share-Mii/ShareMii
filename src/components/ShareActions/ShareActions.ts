import './ShareActions.css';
import '@/components/IconActionButton/IconActionButton.css';
import '@/components/IconActionCluster/IconActionCluster.css';
import { createIconActionCluster } from '@/components/IconActionCluster/IconActionCluster';
import type { IconActionButtonOptions } from '@/components/IconActionButton/IconActionButton';
import {
  buildEmbedHtml,
  buildMiiShareUrl,
  buildProfileShareUrl,
  copyToClipboard,
  shareNative,
} from '@/utils/share';
import { openEmbedModal } from '@/components/EmbedModal/EmbedModal';
import { buildRenderUrl } from '@/services/miiApi';
import type { Mii } from '@/types';

export interface ShareActionsOptions {
  title: string;
  description?: string;
  shareUrl: string;
  embedMiiId?: string;
  embedImageUrl?: string;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

export function showShareToast(msg: string): void {
  const el = document.createElement('div');
  el.className = 'share-toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('share-toast--visible'));
  window.setTimeout(() => {
    el.classList.remove('share-toast--visible');
    window.setTimeout(() => el.remove(), 300);
  }, 2200);
}

function toast(msg: string): void {
  showShareToast(msg);
}

export function createShareActionCluster(
  opts: ShareActionsOptions,
): HTMLElement {
  const buttons: IconActionButtonOptions[] = [
    {
      iconName: 'link',
      label: 'Copy link',
      onClick: async () => {
        if (await copyToClipboard(opts.shareUrl)) toast('Link copied!');
        else toast('Could not copy link');
      },
    },
    {
      iconName: 'share-nodes',
      label: 'Share',
      onClick: async () => {
        const result = await shareNative({
          title: opts.title,
          text: opts.description,
          url: opts.shareUrl,
        });
        if (result === 'copied') toast('Link copied!');
        else if (result === 'shared') toast('Shared!');
      },
    },
  ];

  if (opts.embedMiiId && opts.embedImageUrl) {
    buttons.push({
      iconName: 'code',
      label: 'Embed',
      className: 'icon-action--embed',
      onClick: () => {
        openEmbedModal(
          buildEmbedHtml(opts.embedMiiId!, opts.embedImageUrl!, 320),
        );
      },
    });
  }

  return createIconActionCluster({
    layout: opts.layout ?? 'vertical',
    className: opts.className,
    buttons,
  });
}

export function createMiiShareActionCluster(
  miiId: string,
  miiName: string,
  imageUrl: string,
  className?: string,
  layout: ShareActionsOptions['layout'] = 'vertical',
): HTMLElement {
  return createShareActionCluster({
    title: `${miiName} on ShareMii`,
    description: `Check out this Mii on ShareMii`,
    shareUrl: buildMiiShareUrl(miiId),
    embedMiiId: miiId,
    embedImageUrl: imageUrl,
    className,
    layout,
  });
}

export function createProfileShareActionCluster(
  username: string,
  className?: string,
): HTMLElement {
  return createShareActionCluster({
    title: `${username} on ShareMii`,
    description: `Miis shared by ${username}`,
    shareUrl: buildProfileShareUrl(username),
    className,
  });
}

function createMiiTileShareCluster(
  mii: Mii,
  className = 'mii-tile__share-cluster',
): HTMLElement {
  const imageUrl = buildRenderUrl(mii.mii_data, { type: 'face', width: 512 });
  return createMiiShareActionCluster(
    mii.id,
    mii.name,
    imageUrl,
    className,
    'horizontal',
  );
}

export function createMiiTileCornerActions(
  mii: Mii,
  overflowMenu?: HTMLElement,
): HTMLElement {
  const corner = document.createElement('div');
  corner.className = 'mii-tile__corner-actions';
  corner.setAttribute('role', 'group');
  corner.setAttribute('aria-label', 'Mii actions');
  corner.append(createMiiTileShareCluster(mii));
  if (overflowMenu) corner.append(overflowMenu);
  return corner;
}

export function createMiiTileCornerOverflowOnly(
  overflowMenu?: HTMLElement,
): HTMLElement {
  const corner = document.createElement('div');
  corner.className = 'mii-tile__corner-actions';
  corner.setAttribute('role', 'group');
  corner.setAttribute('aria-label', 'Mii actions');
  if (overflowMenu) corner.append(overflowMenu);
  return corner;
}
