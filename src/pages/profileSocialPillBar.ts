import '@/components/SocialPillBar/SocialPillBar.css';
import '@/components/IconActionButton/IconActionButton.css';
import '@/components/TileOverflowMenu/TileOverflowMenu.css';
import { createSocialPillBar } from '@/components/SocialPillBar/SocialPillBar';
import { createTileOverflowMenu } from '@/components/TileOverflowMenu/TileOverflowMenu';
import { showShareToast } from '@/components/ShareActions/ShareActions';
import {
  buildProfileShareUrl,
  copyToClipboard,
  shareNative,
} from '@/utils/share';
import { navigateTo } from '@/utils/navigation';
import { openReportModal } from '@/components/ReportModal/ReportModal';
import { followUser, unfollowUser } from '@/services/social';
import { blockUser, muteUser } from '@/services/safety';
import type { IconActionButtonOptions } from '@/components/IconActionButton/IconActionButton';
import type { TileOverflowMenuItem } from '@/components/TileOverflowMenu/TileOverflowMenu';
import type { Profile } from '@/types';

function buildProfileOverflowItems(
  profile: Profile,
  isOwner: boolean,
  viewerId: string | null,
  following: boolean,
): TileOverflowMenuItem[] {
  const items: TileOverflowMenuItem[] = [
    {
      label: 'Copy link',
      onSelect: async () => {
        if (await copyToClipboard(buildProfileShareUrl(profile.username))) {
          showShareToast('Link copied!');
        } else {
          showShareToast('Could not copy link');
        }
      },
    },
    {
      label: 'Share',
      onSelect: async () => {
        const result = await shareNative({
          title: `${profile.username} on ShareMii`,
          text: `Miis shared by ${profile.username}`,
          url: buildProfileShareUrl(profile.username),
        });
        if (result === 'copied') showShareToast('Link copied!');
        else if (result === 'shared') showShareToast('Shared!');
      },
    },
  ];

  if (isOwner) {
    items.push({
      label: 'Edit profile',
      onSelect: () => {
        navigateTo('/settings');
      },
    });
  } else if (viewerId) {
    let isFollowing = following;
    items.push({
      label: isFollowing ? 'Unfollow' : 'Follow',
      onSelect: async () => {
        try {
          if (isFollowing) {
            await unfollowUser(viewerId, profile.id);
            isFollowing = false;
          } else {
            await followUser(viewerId, profile.id);
            isFollowing = true;
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Could not update follow');
        }
      },
    });
    items.push(
      {
        label: 'Mute',
        onSelect: async () => {
          try {
            await muteUser(profile.id);
            alert(
              `${profile.username} muted — you will not get notifications from them.`,
            );
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not mute');
          }
        },
      },
      {
        label: 'Block',
        danger: true,
        onSelect: async () => {
          if (
            !window.confirm(
              `Block ${profile.username}? Their content will be hidden from you.`,
            )
          ) {
            return;
          }
          try {
            await blockUser(profile.id);
            navigateTo('/');
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not block');
          }
        },
      },
      {
        label: 'Report',
        danger: true,
        onSelect: () => {
          openReportModal({
            targetType: 'profile',
            targetId: profile.id,
            targetLabel: profile.username,
          });
        },
      },
    );
  } else {
    items.push({
      label: 'Report profile',
      danger: true,
      onSelect: () => {
        openReportModal({
          targetType: 'profile',
          targetId: profile.id,
          targetLabel: profile.username,
        });
      },
    });
  }

  return items;
}

export function createProfileSocialPillBar(
  profile: Profile,
  isOwner: boolean,
  viewerId: string | null,
  following: boolean,
): HTMLElement {
  const items: IconActionButtonOptions[] = [
    {
      iconName: 'link',
      label: 'Copy link',
      onClick: async () => {
        if (await copyToClipboard(buildProfileShareUrl(profile.username))) {
          showShareToast('Link copied!');
        } else {
          showShareToast('Could not copy link');
        }
      },
    },
    {
      iconName: 'share-nodes',
      label: 'Share',
      onClick: async () => {
        const result = await shareNative({
          title: `${profile.username} on ShareMii`,
          text: `Miis shared by ${profile.username}`,
          url: buildProfileShareUrl(profile.username),
        });
        if (result === 'copied') showShareToast('Link copied!');
        else if (result === 'shared') showShareToast('Shared!');
      },
    },
  ];

  if (isOwner) {
    items.push({
      iconName: 'pen-to-square',
      label: 'Edit profile',
      onClick: () => {
        navigateTo('/settings');
      },
    });
  } else if (viewerId) {
    let isFollowing = following;
    items.push({
      iconName: isFollowing ? 'user-minus' : 'user-plus',
      label: isFollowing ? 'Unfollow' : 'Follow',
      onClick: async () => {
        try {
          if (isFollowing) {
            await unfollowUser(viewerId, profile.id);
            isFollowing = false;
          } else {
            await followUser(viewerId, profile.id);
            isFollowing = true;
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Could not update follow');
        }
      },
    });
    items.push(
      {
        iconName: 'volume-xmark',
        label: 'Mute',
        onClick: async () => {
          try {
            await muteUser(profile.id);
            alert(
              `${profile.username} muted — you will not get notifications from them.`,
            );
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not mute');
          }
        },
      },
      {
        iconName: 'ban',
        label: 'Block',
        variant: 'danger',
        onClick: async () => {
          if (
            !window.confirm(
              `Block ${profile.username}? Their content will be hidden from you.`,
            )
          ) {
            return;
          }
          try {
            await blockUser(profile.id);
            navigateTo('/');
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not block');
          }
        },
      },
      {
        iconName: 'flag',
        label: 'Report',
        variant: 'danger',
        onClick: () => {
          openReportModal({
            targetType: 'profile',
            targetId: profile.id,
            targetLabel: profile.username,
          });
        },
      },
    );
  } else {
    items.push({
      iconName: 'flag',
      label: 'Report profile',
      variant: 'danger',
      onClick: () => {
        openReportModal({
          targetType: 'profile',
          targetId: profile.id,
          targetLabel: profile.username,
        });
      },
    });
  }

  return createSocialPillBar({
    className: 'profile-card__social-pill',
    items,
    toggleLabel: 'Profile actions',
  });
}

export function createProfileOverflowMenu(
  profile: Profile,
  isOwner: boolean,
  viewerId: string | null,
  following: boolean,
): HTMLElement {
  const menu = createTileOverflowMenu(
    buildProfileOverflowItems(profile, isOwner, viewerId, following),
    'Profile options',
  );
  menu.classList.add('profile-card__overflow');
  return menu;
}
