import './pages.css';
import './Collections.css';
import './Profile.css';
import { navigateTo } from '@/utils/navigation';
import '@/components/shared.css';
import '@/components/IconActionButton/IconActionButton.css';
import '@/components/IconActionCluster/IconActionCluster.css';
import { createProfilePageSkeleton } from '@/components/Skeleton/Skeleton';
import { wrapPublicPage } from '@/layout/pageShell';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { openMiiEditModal } from '@/components/MiiEditModal/MiiEditModal';
import {
  createTileOverflowMenu,
  type TileOverflowMenuItem,
} from '@/components/TileOverflowMenu/TileOverflowMenu';
import '@/components/TileOverflowMenu/TileOverflowMenu.css';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  fetchMiisByUserId,
  fetchPinnedMiis,
  isSupabaseConfigured,
  pinMii,
  unpinMii,
} from '@/services/supabase';
import {
  ensureProfile,
  fetchProfileById,
  fetchProfileByUsername,
  hasCompletedProfile,
  uploadProfileImage,
} from '@/services/profile';
import type { Mii, Profile } from '@/types';
import { navigateToMiiMakerEdit } from '@/services/miiMakerNavigate';
import { confirmDeleteMii } from '@/utils/miiDeleteConfirm';
import { iconSpan } from '@/utils/icon';
import { openReportModal } from '@/components/ReportModal/ReportModal';
import {
  createMiiTileCornerOverflowOnly,
  createProfileShareActionCluster,
} from '@/components/ShareActions/ShareActions';
import { getSiteOrigin, setPageMeta } from '@/utils/pageMeta';
import {
  fetchPublicCollectionsForUser,
  fetchUserCollections,
  followUser,
  isFollowing,
  unfollowUser,
  type MiiCollection,
} from '@/services/social';
import { blockUser, muteUser } from '@/services/safety';
import { fetchUserPublicActivity } from '@/services/activityFeed';
import { createFeedItem } from '@/components/FeedItem/FeedItem';

export type ProfileMode = 'edit' | 'public';

export interface RenderProfileOptions {
  mode: ProfileMode;
  username?: string;
}

export function renderProfile(
  container: HTMLElement,
  options: RenderProfileOptions,
): () => void {
  let abort = false;

  container.replaceChildren(
    wrapPublicPage(createProfilePageSkeleton()),
  );

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      container.innerHTML =
        '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    if (options.mode === 'edit') {
      const session = await getAuthSession();
      if (!isLoggedIn(session)) {
        openLoginModal();
        navigateTo('/');
        return;
      }

      const profile =
        (await fetchProfileById(session!.user.id)) ??
        (await ensureProfile(session!.user.id));
      if (abort) return;

      if (hasCompletedProfile(profile)) {
        navigateTo(`/u/${encodeURIComponent(profile.username)}`);
      } else {
        navigateTo('/settings');
      }
      return;
    }

    const username = options.username?.trim();
    if (!username) {
      navigateTo('/');
      return;
    }

    const profile = await fetchProfileByUsername(username);
    if (abort) return;

    if (!profile || !hasCompletedProfile(profile)) {
      container.replaceChildren(
        wrapPublicPage(
          Object.assign(document.createElement('main'), {
            className: 'page-content page-content--offset-top',
            innerHTML:
              '<p class="page-error">Profile not found. <a href="/">Go home</a></p>',
          }),
        ),
      );
      return;
    }

    const session = await getAuthSession();
    const viewerId = isLoggedIn(session) ? session!.user.id : null;
    const isOwner = viewerId === profile.id;

    const page = await buildPublicPage(profile, isOwner, viewerId);
    if (abort) return;

    setPageMeta({
      title: profile.username,
      description: profile.bio || `Miis shared by ${profile.username} on ShareMii`,
      type: 'profile',
      url: `${getSiteOrigin()}/u/${encodeURIComponent(profile.username)}`,
    });

    container.replaceChildren(wrapPublicPage(page));
  }

  load();

  return () => {
    abort = true;
  };
}

function avatarInitial(profile: Profile): string {
  const ch = profile.username?.trim()?.[0];
  return ch ? ch.toUpperCase() : '?';
}

function buildBanner(profile: Profile, editable: boolean): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'profile-card__banner-wrap';

  if (profile.banner_url) {
    const img = document.createElement('img');
    img.className = 'profile-card__banner';
    img.src = profile.banner_url;
    img.alt = '';
    wrap.appendChild(img);
  }

  if (editable) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.className = 'profile-page__hidden-input';
    input.id = 'profile-banner-input';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'pill-btn pill-btn--outline interactive profile-card__banner-btn';
    btn.innerHTML = `${iconSpan('image')} Change banner`;
    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      btn.setAttribute('disabled', 'true');
      try {
        const updated = await uploadProfileImage(profile.id, 'banner', file);
        Object.assign(profile, updated);
        const parent = wrap.parentElement;
        if (parent) {
          const newBanner = buildBanner(profile, true);
          wrap.replaceWith(newBanner);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        btn.removeAttribute('disabled');
        input.value = '';
      }
    });

    wrap.append(input, btn);
  }

  return wrap;
}

function buildAvatar(
  profile: Profile,
  editable: boolean,
  onUpdate?: (p: Profile) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'profile-card__avatar-wrap';

  if (profile.avatar_url) {
    const img = document.createElement('img');
    img.className = 'profile-card__avatar';
    img.src = profile.avatar_url;
    img.alt = `${profile.username} avatar`;
    wrap.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className =
      'profile-card__avatar profile-card__avatar--placeholder';
    placeholder.textContent = avatarInitial(profile);
    wrap.appendChild(placeholder);
  }

  if (editable) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.className = 'profile-page__hidden-input';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'pill-btn pill-btn--outline interactive profile-card__avatar-btn';
    btn.textContent = 'Change photo';
    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      btn.setAttribute('disabled', 'true');
      try {
        const updated = await uploadProfileImage(profile.id, 'avatar', file);
        onUpdate?.(updated);
        const newAvatar = buildAvatar(updated, true, onUpdate);
        wrap.replaceWith(newAvatar);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        btn.removeAttribute('disabled');
        input.value = '';
      }
    });

    wrap.append(input, btn);
  }

  return wrap;
}

function createOwnerTileMenu(
  mii: Mii,
  pinnedIds: Set<string>,
  pinCount: number,
  onChanged: () => void,
): HTMLElement {
  const isPinned = pinnedIds.has(mii.id);

  return createTileOverflowMenu(
    [
      {
        label: isPinned ? 'Unpin' : 'Pin',
        disabled: !isPinned && pinCount >= 6,
        title: !isPinned && pinCount >= 6 ? 'Maximum 6 pins' : undefined,
        onSelect: async () => {
          try {
            if (isPinned) {
              await unpinMii(mii.id);
            } else {
              await pinMii(mii.id);
            }
            onChanged();
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not update pin');
          }
        },
      },
      {
        label: 'Edit Mii',
        onSelect: () => {
          navigateToMiiMakerEdit(mii.id);
        },
      },
      {
        label: 'Edit details',
        onSelect: () => {
          openMiiEditModal(mii, {
            onSaved: (updated) => {
              Object.assign(mii, updated);
            },
          });
        },
      },
      {
        label: 'Delete',
        danger: true,
        onSelect: () => {
          confirmDeleteMii(mii, onChanged);
        },
      },
    ],
    'Mii options',
  );
}

function createPublicTileWrap(mii: Mii, index: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'profile-miis__tile-wrap';

  const tile = createMiiTile(mii, index, { variant: 'grid' });
  tile.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.mii-tile__corner-actions')) {
      e.preventDefault();
    }
  });

  wrap.appendChild(tile);
  return wrap;
}

function createOwnerTileWrap(
  mii: Mii,
  index: number,
  pinnedIds: Set<string>,
  pinCount: number,
  onChanged: () => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'profile-miis__tile-wrap';

  const tile = createMiiTile(mii, index, { variant: 'grid' });
  tile.addEventListener('click', (e) => {
    if (
      (e.target as HTMLElement).closest(
        '.mii-tile__corner-actions, .tile-overflow-menu',
      )
    ) {
      e.preventDefault();
    }
  });

  wrap.append(
    tile,
    createMiiTileCornerOverflowOnly(
      createOwnerTileMenu(mii, pinnedIds, pinCount, onChanged),
    ),
  );
  return wrap;
}

async function buildMiiSections(
  profile: Profile,
  isOwner: boolean,
): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'profile-miis-sections';

  let pinned: Mii[] = [];
  let allMiis: Mii[] = [];
  let pinnedIds = new Set<string>();

  try {
    allMiis = await fetchMiisByUserId(profile.id);
  } catch {
    const err = document.createElement('p');
    err.className = 'profile-miis__empty';
    err.textContent = 'Could not load Miis.';
    container.appendChild(err);
    return container;
  }

  try {
    pinned = await fetchPinnedMiis(profile.id);
    pinnedIds = new Set(pinned.map((m) => m.id));
  } catch {
    pinned = [];
    pinnedIds = new Set();
  }

  const unpinned = allMiis.filter((m) => !pinnedIds.has(m.id));

  if (pinned.length) {
    const pinnedSection = document.createElement('section');
    pinnedSection.className = 'profile-miis profile-miis--pinned';

    const pinnedHeading = document.createElement('h2');
    pinnedHeading.className = 'profile-miis__title';
    pinnedHeading.textContent = 'Pinned Miis';

    const pinnedGrid = document.createElement('div');
    pinnedGrid.className = 'profile-miis__grid profile-miis__grid--pinned';

    const refresh = (): void => {
      void buildMiiSections(profile, isOwner).then((next) => {
        container.replaceWith(next);
      });
    };

    pinned.forEach((mii, i) => {
      if (isOwner) {
        pinnedGrid.appendChild(
          createOwnerTileWrap(mii, i, pinnedIds, pinned.length, refresh),
        );
      } else {
        pinnedGrid.appendChild(createPublicTileWrap(mii, i));
      }
    });

    pinnedSection.append(pinnedHeading, pinnedGrid);
    container.appendChild(pinnedSection);
  }

  const section = document.createElement('section');
  section.className = 'profile-miis';

  const heading = document.createElement('h2');
  heading.className = 'profile-miis__title';
  heading.textContent = isOwner ? 'My Miis' : `${profile.username}'s Miis`;

  section.appendChild(heading);

  if (!allMiis.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-miis__empty';
    empty.innerHTML = isOwner
      ? 'No Miis yet. <a href="/create" class="interactive">Create one in the Mii Maker</a> or <a href="#" data-scan-submit class="interactive">scan a QR code</a>.'
      : 'No Miis yet.';
    section.appendChild(empty);
    container.appendChild(section);
    return container;
  }

  if (!unpinned.length) {
    section.appendChild(
      Object.assign(document.createElement('p'), {
        className: 'profile-miis__empty',
        textContent: 'All Miis are pinned above.',
      }),
    );
    container.appendChild(section);
    return container;
  }

  const paginated = createPaginatedList<Mii>({
    listClassName: 'profile-miis__grid list-pager__list',
    renderItem: (mii, i) => {
      if (isOwner) {
        return createOwnerTileWrap(
          mii,
          i,
          pinnedIds,
          pinned.length,
          () => {
            void buildMiiSections(profile, isOwner).then((next) => {
              container.replaceWith(next);
            });
          },
        );
      }
      return createPublicTileWrap(mii, i);
    },
  });

  section.appendChild(paginated.root);
  paginated.setItems(unpinned);
  container.appendChild(section);

  return container;
}

async function buildPublicPage(
  profile: Profile,
  isOwner: boolean,
  viewerId: string | null,
): Promise<HTMLElement> {
  const page = document.createElement('main');
  page.className = 'profile-page';

  const card = document.createElement('article');
  card.className = 'profile-card';

  const bannerWrap = buildBanner(profile, false);

  const cornerActions = document.createElement('div');
  cornerActions.className = 'profile-card__corner-actions';

  cornerActions.appendChild(
    createProfileShareActionCluster(
      profile.username,
      'profile-card__share-cluster',
    ),
  );

  const menuItems: TileOverflowMenuItem[] = [];

  if (isOwner) {
    menuItems.push({
      label: 'Edit profile',
      onSelect: () => {
        navigateTo('/settings');
      },
    });
  } else if (viewerId) {
    let following = false;
    try {
      following = await isFollowing(viewerId, profile.id);
    } catch {
      /* ignore */
    }

    menuItems.push({
      label: following ? 'Unfollow' : 'Follow',
      onSelect: async () => {
        try {
          if (following) {
            await unfollowUser(viewerId, profile.id);
            following = false;
          } else {
            await followUser(viewerId, profile.id);
            following = true;
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Could not update follow');
        }
      },
    });
    menuItems.push(
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
    menuItems.push({
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

  if (menuItems.length > 0) {
    const overflow = createTileOverflowMenu(menuItems, 'Profile options');
    overflow.classList.add('profile-card__overflow');
    cornerActions.appendChild(overflow);
  }

  bannerWrap.appendChild(cornerActions);

  const body = document.createElement('div');
  body.className = 'profile-card__body';

  body.appendChild(buildAvatar(profile, false));

  const head = document.createElement('div');
  head.className = 'profile-card__head';

  const nameWrap = document.createElement('div');
  nameWrap.className = 'profile-card__name-wrap';

  const nameEl = document.createElement('h1');
  nameEl.className = 'profile-card__name';
  nameEl.textContent = profile.username;
  nameWrap.appendChild(nameEl);

  if (profile.trusted_creator) {
    const trusted = document.createElement('span');
    trusted.className = 'profile-card__trusted';
    trusted.textContent = 'Trusted creator';
    nameWrap.appendChild(trusted);
  }

  head.appendChild(nameWrap);

  const bio = document.createElement('p');
  bio.className = 'profile-card__bio';
  if (profile.bio) {
    bio.textContent = profile.bio;
  } else {
    bio.classList.add('profile-card__bio--empty');
    bio.textContent = 'No bio yet.';
  }

  body.append(head, bio);
  card.append(bannerWrap, body);
  page.append(card);

  const collectionsSection = await buildCollectionsSection(profile, isOwner);
  if (collectionsSection) page.appendChild(collectionsSection);

  const miiSections = await buildMiiSections(profile, isOwner);
  page.appendChild(miiSections);

  const activitySection = await buildProfileActivitySection(profile.id);
  if (activitySection) page.appendChild(activitySection);

  return page;
}

async function buildProfileActivitySection(
  userId: string,
): Promise<HTMLElement | null> {
  try {
    const { items } = await fetchUserPublicActivity(userId, { limit: 12 });
    if (!items.length) return null;

    const section = document.createElement('section');
    section.className = 'profile-activity';
    const title = document.createElement('h2');
    title.className = 'profile-activity__title';
    title.textContent = 'Recent activity';
    const list = document.createElement('div');
    list.className = 'feed-list';
    for (const item of items) {
      list.appendChild(createFeedItem(item));
    }
    section.append(title, list);
    return section;
  } catch {
    return null;
  }
}

async function buildCollectionsSection(
  profile: Profile,
  isOwner: boolean,
): Promise<HTMLElement | null> {
  let collections: MiiCollection[] = [];
  try {
    collections = isOwner
      ? await fetchUserCollections(profile.id)
      : await fetchPublicCollectionsForUser(profile.id);
  } catch {
    return null;
  }

  const hasPublic = collections.some((c) => c.is_public);
  if (!hasPublic) return null;

  const section = document.createElement('section');
  section.className = 'profile-collections';

  
  const head = document.createElement('div');
  head.className = 'profile-collections__head';

  const title = document.createElement('h2');
  title.className = 'profile-collections__title';
  title.textContent = isOwner ? 'My Collections' : 'Collections';
  head.appendChild(title);

  if (isOwner) {
    const manage = document.createElement('a');
    manage.href = '/collections';
    manage.className = 'pill-btn pill-btn--outline interactive';
    manage.textContent = 'Manage all';
    head.appendChild(manage);
  }

  section.appendChild(head);

  const grid = document.createElement('div');

  grid.className = 'profile-collections__grid';

  for (const c of collections) {
    if (!isOwner && !c.is_public) continue;
    const card = document.createElement('a');
    card.className = 'profile-collections__card interactive';
    card.href = `/collection/${c.id}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'profile-collections__card-icon';
    iconEl.innerHTML = iconSpan('folder', 'profile-collections__card-icon-inner');

    const body = document.createElement('div');
    body.className = 'profile-collections__card-body';
    const strong = document.createElement('strong');
    strong.textContent = c.name;
    const span = document.createElement('span');
    const count = c.item_count ?? 0;
    span.textContent = `${c.is_public ? 'Public' : 'Private'} · ${count} Mii${count === 1 ? '' : 's'}`;
    body.append(strong, span);
    card.append(iconEl, body);
    grid.appendChild(card);
  }

  if (!grid.childElementCount) return null;

  const publicCards = collections.filter((c) => isOwner || c.is_public);
  if (publicCards.length > 2) {
    grid.classList.add('profile-collections__grid--preview');
    const viewAll = document.createElement('a');
    viewAll.href = isOwner ? '/collections' : `/u/${encodeURIComponent(profile.username)}`;
    viewAll.className =
      'profile-collections__view-all pill-btn pill-btn--outline interactive';
    viewAll.textContent = 'View all collections';
    section.append(grid, viewAll);
  } else {
    section.appendChild(grid);
  }

  return section;
}
