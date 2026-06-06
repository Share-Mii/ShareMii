import './pages.css';
import './Collections.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { fetchPublicCollections } from '@/services/discovery';
import { fetchMiiById, isSupabaseConfigured } from '@/services/supabase';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { setPageMeta } from '@/utils/pageMeta';
import { icon } from '@/utils/icon';

export function renderCollectionsDiscover(container: HTMLElement): () => void {
  let abort = false;

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top';
  page.innerHTML = '<p class="page-loading">Loading collections…</p>';
  container.replaceChildren(wrapPublicPage(page));

  setPageMeta({
    title: 'Public collections',
    description: 'Curated Mii lists shared by the ShareMii community.',
  });

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    let collections: Awaited<ReturnType<typeof fetchPublicCollections>> = [];
    try {
      collections = await fetchPublicCollections(48);
    } catch {
      page.innerHTML = '<p class="page-error">Could not load collections.</p>';
      return;
    }
    if (abort) return;

    page.replaceChildren();
    const heading = document.createElement('h1');
    heading.className = 'page-title';
    heading.innerHTML = `${icon('folder-open')} Public collections`;

    const grid = document.createElement('div');
    grid.className = 'collections-discover-grid';

    if (!collections.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No public collections yet.';
      page.append(heading, empty);
      return;
    }

    for (const col of collections) {
      const card = document.createElement('a');
      card.href = `/collection/${col.id}`;
      card.className = 'collections-card interactive';

      const previews = document.createElement('div');
      previews.className = 'collections-card__previews';

      for (const miiId of col.preview_mii_ids.slice(0, 4)) {
        try {
          const mii = await fetchMiiById(miiId);
          if (mii) {
            const thumb = document.createElement('span');
            thumb.className = 'collections-card__preview';
            thumb.appendChild(
              createMiiRenderer({
                miiData: mii.mii_data,
                width: 72,
                alt: '',
              }),
            );
            previews.appendChild(thumb);
          }
        } catch {
          /* skip preview */
        }
      }

      const body = document.createElement('div');
      body.className = 'collections-card__body';
      body.innerHTML = `
        <h2 class="collections-card__name">${escapeHtml(col.name)}</h2>
        <p class="collections-card__meta">by ${escapeHtml(col.owner_username)} · ${col.item_count} Mii${col.item_count === 1 ? '' : 's'}</p>
      `;

      card.append(previews, body);
      grid.appendChild(card);
    }

    page.append(heading, grid);
  }

  void load();

  return () => {
    abort = true;
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
