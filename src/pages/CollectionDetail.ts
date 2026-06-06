import './pages.css';
import { navigateTo } from '@/utils/navigation';
import './Collections.css';
import './Favorites.css';
import '@/components/shared.css';
import '@/components/IconActionButton/IconActionButton.css';
import '@/components/IconActionCluster/IconActionCluster.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { openConfirmModal } from '@/components/ConfirmModal/ConfirmModal';
import { openCollectionFormModal } from '@/components/CollectionFormModal/CollectionFormModal';
import {
  createShareActionCluster,
  showShareToast,
} from '@/components/ShareActions/ShareActions';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { fetchProfileById } from '@/services/profile';
import {
  deleteCollection,
  fetchCollectionById,
  fetchCollectionMiis,
  removeMiiFromCollection,
  type MiiCollection,
} from '@/services/social';
import { isSupabaseConfigured } from '@/services/supabase';
import type { Mii } from '@/types';
import { setPageMeta } from '@/utils/pageMeta';
import { buildCollectionShareUrl } from '@/utils/share';
import { escapeHtml } from '@/utils/escapeHtml';

export function renderCollectionDetail(
  container: HTMLElement,
  collectionId: string,
): () => void {
  let abort = false;

  const page = document.createElement('main');
  page.className =
    'page-content page-content--offset-top favorites-page collection-detail';
  page.innerHTML = '<p class="page-loading">Loading collection…</p>';
  container.replaceChildren(wrapPublicPage(page));

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    let collection: MiiCollection | null = null;
    try {
      collection = await fetchCollectionById(collectionId);
    } catch {
      if (abort) return;
      page.innerHTML =
        '<p class="page-error">Could not load collection. <a href="/">Go home</a></p>';
      return;
    }

    if (abort) return;

    if (!collection) {
      page.innerHTML =
        '<p class="page-error">Collection not found. <a href="/">Go home</a></p>';
      return;
    }

    const session = await getAuthSession();
    const viewerId = isLoggedIn(session) ? session!.user.id : null;
    const isOwner = viewerId === collection.user_id;

    if (!collection.is_public && !isOwner) {
      page.innerHTML =
        '<p class="page-error">This collection is private. <a href="/">Go home</a></p>';
      return;
    }

    let ownerUsername = '';
    try {
      const owner = await fetchProfileById(collection.user_id);
      ownerUsername = owner?.username ?? '';
    } catch {
      /* ignore */
    }

    let miis: Mii[] = [];
    try {
      miis = await fetchCollectionMiis(collectionId, { viewerIsOwner: isOwner });
    } catch {
      if (abort) return;
      page.innerHTML =
        '<p class="page-error">Could not load Miis in this collection.</p>';
      return;
    }

    if (abort) return;

    setPageMeta({
      title: collection.name,
      description:
        collection.description ||
        `A curated Mii collection${ownerUsername ? ` by ${ownerUsername}` : ''} on ShareMii`,
      type: 'website',
      url: buildCollectionShareUrl(collectionId),
    });

    page.replaceChildren();
    renderPage(page, collection, miis, isOwner, ownerUsername);
  }

  function renderPage(
    page: HTMLElement,
    collection: MiiCollection,
    miis: Mii[],
    isOwner: boolean,
    ownerUsername: string,
  ): void {
    const back = document.createElement('a');
    back.className = 'detail-back interactive';
    if (isOwner) {
      back.href = '/collections';
      back.textContent = '← My collections';
    } else if (ownerUsername) {
      back.href = `/u/${encodeURIComponent(ownerUsername)}`;
      back.textContent = `← ${ownerUsername}`;
    } else {
      back.href = '/';
      back.textContent = '← Home';
    }

    const panel = document.createElement('section');
    panel.className = 'collection-detail__panel';

    const header = document.createElement('header');
    header.className = 'collection-detail__header';

    const titleRow = document.createElement('div');
    titleRow.className = 'collection-detail__title-row';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'collection-detail__title-block';
    const title = document.createElement('h1');
    title.className = 'collection-detail__title';
    title.textContent = collection.name;

    if (ownerUsername && !isOwner) {
      const owner = document.createElement('p');
      owner.className = 'collection-detail__owner';
      owner.innerHTML = `Curated by <a href="/u/${encodeURIComponent(ownerUsername)}" class="interactive">${escapeHtml(ownerUsername)}</a>`;
      titleBlock.append(title, owner);
    } else {
      titleBlock.appendChild(title);
    }

    if (collection.description) {
      const desc = document.createElement('p');
      desc.className = 'collection-detail__desc';
      desc.textContent = collection.description;
      titleBlock.appendChild(desc);
    }

    const badge = document.createElement('span');
    badge.className = `collections-card__badge collections-card__badge--${collection.is_public ? 'public' : 'private'}`;
    badge.textContent = collection.is_public ? 'Public' : 'Private';
    titleBlock.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'collection-detail__actions';

    if (collection.is_public) {
      actions.appendChild(
        createShareActionCluster({
          title: `${collection.name} on ShareMii`,
          description: collection.description || 'A curated Mii collection',
          shareUrl: buildCollectionShareUrl(collection.id),
          layout: 'horizontal',
        }),
      );
    }

    if (isOwner) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'pill-btn pill-btn--outline interactive';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        openCollectionFormModal({
          userId: collection.user_id,
          collection,
          onSaved: () => void load(),
        });
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className =
        'pill-btn pill-btn--outline interactive confirm-modal__btn--danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        openConfirmModal({
          title: 'Delete collection?',
          message: `“${collection.name}” will be permanently removed. Miis themselves are not deleted.`,
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: async () => {
            await deleteCollection(collection.id);
            showShareToast('Collection deleted');
            navigateTo('/collections');
          },
        });
      });

      actions.append(editBtn, deleteBtn);
    }

    titleRow.append(titleBlock, actions);
    header.appendChild(titleRow);
    panel.appendChild(header);
    page.append(back, panel);

    if (!miis.length) {
      const empty = document.createElement('p');
      empty.className = 'collection-detail__empty';
      empty.innerHTML = isOwner
        ? 'No Miis in this collection yet. Open any Mii and choose <strong>Add to collection</strong>.'
        : 'This collection is empty.';
      page.appendChild(empty);
      return;
    }

    const paginated = createPaginatedList<Mii>({
      listClassName: 'collection-detail__grid list-pager__list',
      renderItem: (mii, i) => {
        const tile = createMiiTile(mii, i, { variant: 'grid' });
        if (!isOwner) return tile;

        const wrap = document.createElement('div');
        wrap.className = 'collection-detail__tile-wrap';
        wrap.appendChild(tile);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className =
          'pill-btn pill-btn--outline interactive collection-detail__remove';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          openConfirmModal({
            title: 'Remove from collection?',
            message: `Remove this Mii from “${collection.name}”?`,
            confirmLabel: 'Remove',
            onConfirm: async () => {
              await removeMiiFromCollection(collection.id, mii.id);
              void load();
            },
          });
        });
        wrap.appendChild(removeBtn);
        return wrap;
      },
    });

    paginated.setItems(miis);
    page.appendChild(paginated.root);
  }

  void load();

  return () => {
    abort = true;
  };
}
