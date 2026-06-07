import './pages.css';
import './Browse.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { fetchMiis, isSupabaseConfigured } from '@/services/supabase';
import { TAG_PLATFORM_BLURB } from '@/config/seo';
import { getSiteOrigin, setPageMeta } from '@/utils/pageMeta';
import type { Mii } from '@/types';

const TAG_LABELS: Record<string, string> = {
  cosplay: 'Cosplay',
  celebrity: 'Celebrity',
  game: 'Game character',
  original: 'Original',
  funny: 'Funny',
  cute: 'Cute',
};

export function renderTagBrowse(
  container: HTMLElement,
  slug: string,
): () => void {
  let abort = false;
  const label = TAG_LABELS[slug] ?? slug;

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top browse-page';
  page.innerHTML = '<p class="page-loading">Loading…</p>';
  container.replaceChildren(wrapPublicPage(page));

  setPageMeta({
    title: `${label} Mii QR Codes`,
    description: `Browse ${label} Mii QR codes on ShareMii.net. ${TAG_PLATFORM_BLURB} — download and share community Miis tagged ${label}.`,
    url: `${getSiteOrigin()}/tag/${slug}`,
  });

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    let miis: Mii[] = [];
    try {
      miis = await fetchMiis({ tagSlugs: [slug], sort: 'favorites' });
    } catch {
      page.innerHTML = '<p class="page-error">Could not load tag.</p>';
      return;
    }
    if (abort) return;

    page.replaceChildren();
    const heading = document.createElement('h1');
    heading.className = 'browse-section__title page-title';
    heading.textContent = `${label} residents`;

    const lead = document.createElement('p');
    lead.className = 'browse-section__lead';
    lead.textContent = `Miis tagged “${label}” in the plaza.`;

    const paginated = createPaginatedList<Mii>({
      listClassName: 'mii-grid mii-grid--home list-pager__list',
      pageSize: 24,
      renderItem: (mii, i) => createMiiTile(mii, i, { variant: 'grid' }),
    });
    if (!miis.length) {
      paginated.showMessage('<p class="page-error">No Miis with this tag yet.</p>');
    } else {
      paginated.setItems(miis);
    }

    page.append(heading, lead, paginated.root);
  }

  void load();

  return () => {
    abort = true;
  };
}
