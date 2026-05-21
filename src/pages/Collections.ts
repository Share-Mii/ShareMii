import './pages.css';
import './Collections.css';
import './Favorites.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { openConfirmModal } from '@/components/ConfirmModal/ConfirmModal';
import { openCollectionFormModal } from '@/components/CollectionFormModal/CollectionFormModal';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  deleteCollection,
  fetchCollectionPreviewMiis,
  fetchUserCollections,
  type MiiCollection,
} from '@/services/social';
import { buildRenderUrl } from '@/services/miiApi';
import { iconSpan } from '@/utils/icon';
import { createEmptyState } from '@/utils/emptyState';

export function renderCollections(container: HTMLElement): () => void {
  let abort = false;

  const page = document.createElement('main');
  page.className =
    'page-content page-content--offset-top favorites-page collections-page';
  page.innerHTML = '<p class="page-loading">Loading collections…</p>';
  container.replaceChildren(wrapPublicPage(page));

  async function load(): Promise<void> {
    const session = await getAuthSession();
    if (!isLoggedIn(session)) {
      openLoginModal();
      window.location.hash = '#/';
      return;
    }

    let collections: MiiCollection[] = [];
    try {
      collections = await fetchUserCollections(session!.user.id);
    } catch {
      if (abort) return;
      page.innerHTML =
        '<p class="page-error">Could not load collections. <a href="#/">Go home</a></p>';
      return;
    }

    if (abort) return;
    page.replaceChildren();
    renderList(page, collections, session!.user.id);
  }

  function renderList(
    page: HTMLElement,
    collections: MiiCollection[],
    userId: string,
  ): void {
    const header = document.createElement('div');
    header.className = 'collections-page__header';

    const intro = document.createElement('div');
    const heading = document.createElement('h1');
    heading.className = 'collections-page__title page-title';
    heading.textContent = 'My Collections';

    const lead = document.createElement('p');
    lead.className = 'collections-page__lead';
    lead.textContent =
      'Curated lists of Miis you can keep private or share publicly.';

    intro.append(heading, lead);

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'pill-btn pill-btn--filled pill-btn--lg interactive';
    newBtn.innerHTML = `${iconSpan('folder-plus')} New collection`;
    newBtn.addEventListener('click', () => {
      openCollectionFormModal({
        userId,
        onSaved: () => void load(),
      });
    });

    header.append(intro, newBtn);
    page.appendChild(header);

    if (!collections.length) {
      page.appendChild(
        createEmptyState(
          'folder',
          'No collections yet',
          'Create a collection, then add Miis from any Mii page with Add to collection.',
        ),
      );
      return;
    }

    const grid = document.createElement('ul');
    grid.className = 'collections-grid';

    for (const c of collections) {
      grid.appendChild(renderCollectionCard(c, userId, load));
    }

    page.appendChild(grid);
  }

  void load();

  return () => {
    abort = true;
  };
}

function renderCollectionCard(
  c: MiiCollection,
  userId: string,
  reload: () => void,
): HTMLElement {
  const li = document.createElement('li');
  const card = document.createElement('article');
  card.className = 'collections-card';

  const previews = document.createElement('div');
  previews.className = 'collections-card__previews';
  previews.setAttribute('aria-hidden', 'true');
  void loadCollectionPreviews(previews, c.id);

  const link = document.createElement('a');
  link.className = 'collections-card__link interactive';
  link.href = `#/collection/${c.id}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'collections-card__icon';
  iconEl.innerHTML = iconSpan('folder', 'collections-card__icon-inner');

  const body = document.createElement('div');
  body.className = 'collections-card__body';

  const name = document.createElement('h2');
  name.className = 'collections-card__name';
  name.textContent = c.name;
  body.appendChild(name);

  if (c.description) {
    const desc = document.createElement('p');
    desc.className = 'collections-card__desc';
    desc.textContent = c.description;
    body.appendChild(desc);
  }

  link.append(iconEl, body);

  const footer = document.createElement('div');
  footer.className = 'collections-card__footer';

  const meta = document.createElement('span');
  meta.className = 'collections-card__meta';
  const count = c.item_count ?? 0;
  meta.textContent = `${count} Mii${count === 1 ? '' : 's'}`;

  const badge = document.createElement('span');
  badge.className = `collections-card__badge collections-card__badge--${c.is_public ? 'public' : 'private'}`;
  badge.textContent = c.is_public ? 'Public' : 'Private';

  
  const actions = document.createElement('div');
  actions.className = 'collections-card__actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'pill-btn pill-btn--outline interactive';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openCollectionFormModal({
      userId,
      collection: c,
      onSaved: reload,
    });
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'pill-btn pill-btn--outline interactive';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openConfirmModal({
      title: 'Delete collection?',
      message: `"${c.name}" will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await deleteCollection(c.id);
        reload();
      },
    });
  });

  actions.append(editBtn, deleteBtn);
  footer.append(meta, badge, actions);
  card.append(previews, link, footer);
  li.appendChild(card);
  return li;
}

async function loadCollectionPreviews(
  strip: HTMLElement,
  collectionId: string,
): Promise<void> {
  try {
    const miis = await fetchCollectionPreviewMiis(collectionId, 3, {
      viewerIsOwner: true,
    });
    strip.replaceChildren();
    if (!miis.length) {
      strip.classList.add('collections-card__previews--empty');
      const placeholder = document.createElement('span');
      placeholder.className = 'collections-card__previews-placeholder';
      placeholder.innerHTML = iconSpan('folder');
      strip.appendChild(placeholder);
      return;
    }
    for (const mii of miis) {
      const img = document.createElement('img');
      img.className = 'collections-card__preview-thumb';
      img.src = buildRenderUrl(mii.mii_data, { type: 'face', width: 96 });
      img.alt = '';
      img.loading = 'lazy';
      img.width = 96;
      img.height = 72;
      strip.appendChild(img);
    }
  } catch {
    strip.remove();
  }
}
