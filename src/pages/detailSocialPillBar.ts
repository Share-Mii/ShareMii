import '@/components/SocialPillBar/SocialPillBar.css';
import { navigateTo } from '@/utils/navigation';
import '@/components/IconActionButton/IconActionButton.css';
import '@/components/TileOverflowMenu/TileOverflowMenu.css';
import { createSocialPillBar } from '@/components/SocialPillBar/SocialPillBar';
import { createTileOverflowMenu } from '@/components/TileOverflowMenu/TileOverflowMenu';
import { showShareToast } from '@/components/ShareActions/ShareActions';
import { buildMiiShareUrl, shareNative } from '@/utils/share';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { openMiiEditModal } from '@/components/MiiEditModal/MiiEditModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { navigateToRemix } from '@/services/remixNavigate';
import { navigateToMiiMakerEdit } from '@/services/miiMakerNavigate';
import { requireGamertag } from '@/services/profileGate';
import { confirmDeleteMii } from '@/utils/miiDeleteConfirm';
import { openReportModal } from '@/components/ReportModal/ReportModal';
import type { IconActionButtonOptions } from '@/components/IconActionButton/IconActionButton';
import type { TileOverflowMenuItem } from '@/components/TileOverflowMenu/TileOverflowMenu';
import type { Mii } from '@/types';

export interface DetailSocialPillBarCallbacks {
  onMiiUpdated?: (mii: Mii) => void;
  onDeleted?: () => void;
}

function buildDetailOverflowItems(
  mii: Mii,
  isOwner: boolean,
  callbacks: DetailSocialPillBarCallbacks,
  extras: TileOverflowMenuItem[] = [],
): TileOverflowMenuItem[] {
  const items: TileOverflowMenuItem[] = [
    {
      label: 'Share',
      onSelect: async () => {
        const result = await shareNative({
          title: `${mii.name} on ShareMii`,
          text: 'Check out this Mii on ShareMii',
          url: buildMiiShareUrl(mii.id),
        });
        if (result === 'copied') showShareToast('Link copied!');
        else if (result === 'shared') showShareToast('Shared!');
      },
    },
    ...extras,
  ];

  if (isOwner) {
    items.push(
      { label: 'Edit Mii', onSelect: () => navigateToMiiMakerEdit(mii.id) },
      {
        label: 'Edit details',
        onSelect: () => {
          openMiiEditModal(mii, {
            onSaved: (updated) => {
              Object.assign(mii, updated);
              callbacks.onMiiUpdated?.(updated);
            },
          });
        },
      },
      {
        label: 'Delete',
        danger: true,
        onSelect: () => {
          confirmDeleteMii(mii, () => {
            callbacks.onDeleted?.();
            navigateTo('/uploads');
          });
        },
      },
    );
  } else {
    items.push(
      {
        label: 'Remix',
        onSelect: async () => {
          if (!isLoggedIn(await getAuthSession())) {
            openLoginModal();
            return;
          }
          if (!(await requireGamertag())) return;
          navigateToRemix(mii);
        },
      },
      {
        label: 'Report',
        danger: true,
        onSelect: () => {
          openReportModal({
            targetType: 'mii',
            targetId: mii.id,
            targetLabel: mii.name,
          });
        },
      },
    );
  }

  return items;
}

export function createDetailSocialPillBar(
  mii: Mii,
  isOwner: boolean,
  callbacks: DetailSocialPillBarCallbacks = {},
): HTMLElement {
  const items: IconActionButtonOptions[] = [
    {
      iconName: 'share-nodes',
      label: 'Share',
      onClick: async () => {
        const result = await shareNative({
          title: `${mii.name} on ShareMii`,
          text: 'Check out this Mii on ShareMii',
          url: buildMiiShareUrl(mii.id),
        });
        if (result === 'copied') showShareToast('Link copied!');
        else if (result === 'shared') showShareToast('Shared!');
      },
    },
  ];

  if (isOwner) {
    items.push(
      {
        iconName: 'pen-to-square',
        label: 'Edit Mii',
        onClick: () => navigateToMiiMakerEdit(mii.id),
      },
      {
        iconName: 'file-lines',
        label: 'Edit details',
        onClick: () => {
          openMiiEditModal(mii, {
            onSaved: (updated) => {
              Object.assign(mii, updated);
              callbacks.onMiiUpdated?.(updated);
            },
          });
        },
      },
      {
        iconName: 'trash',
        label: 'Delete',
        variant: 'danger',
        onClick: () => {
          confirmDeleteMii(mii, () => {
            callbacks.onDeleted?.();
            navigateTo('/uploads');
          });
        },
      },
    );
  } else {
    items.push(
      {
        iconName: 'wand-magic-sparkles',
        label: 'Remix',
        onClick: () => {
          void (async () => {
            if (!isLoggedIn(await getAuthSession())) {
              openLoginModal();
              return;
            }
            if (!(await requireGamertag())) return;
            navigateToRemix(mii);
          })();
        },
      },
      {
        iconName: 'flag',
        label: 'Report',
        onClick: () => {
          openReportModal({
            targetType: 'mii',
            targetId: mii.id,
            targetLabel: mii.name,
          });
        },
      },
    );
  }

  return createSocialPillBar({
    className: 'detail__social-pill detail__social-pill--desktop',
    items,
    toggleLabel: 'Mii actions',
  });
}

export function createDetailOverflowMenu(
  mii: Mii,
  isOwner: boolean,
  callbacks: DetailSocialPillBarCallbacks = {},
  extras: TileOverflowMenuItem[] = [],
): HTMLElement {
  const menu = createTileOverflowMenu(
    buildDetailOverflowItems(mii, isOwner, callbacks, extras),
    'Mii actions',
  );
  menu.classList.add('detail__overflow-menu');
  return menu;
}
