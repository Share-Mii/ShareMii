import './pages.css';
import './TagsIndex.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { fetchMiiTags } from '@/services/social';
import { isSupabaseConfigured } from '@/services/supabase';
import {
  DEFAULT_OG_IMAGE,
  getSiteOrigin,
  setPageMeta,
} from '@/utils/pageMeta';
import { TAG_PLATFORM_BLURB } from '@/config/seo';

export function renderTagsIndex(container: HTMLElement): () => void {
  let abort = false;

  const description = `Browse Mii QR code tags on ShareMii.net — celebrity, game, cosplay, funny, cute, and more. ${TAG_PLATFORM_BLURB}.`;

  setPageMeta({
    title: 'Mii QR Code Tags',
    description,
    url: `${getSiteOrigin()}/tags`,
    image: DEFAULT_OG_IMAGE,
  });

  const page = document.createElement('main');
  page.className =
    'page-content page-content--offset-top browse-page tags-index-page';
  page.innerHTML = '<p class="page-loading">Loading tags…</p>';
  container.replaceChildren(wrapPublicPage(page));

  void (async () => {
    if (abort) return;
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    let tags: { slug: string; label: string }[] = [];
    try {
      const rows = await fetchMiiTags();
      tags = rows.map((t) => ({ slug: t.slug, label: t.label }));
    } catch {
      page.innerHTML = '<p class="page-error">Could not load tags.</p>';
      return;
    }
    if (abort) return;

    const back = document.createElement('a');
    back.href = '/browse';
    back.className = 'legal-page__back interactive';
    back.textContent = '← Back to browse';

    const heading = document.createElement('h1');
    heading.className = 'browse-page__title';
    heading.textContent = 'Mii QR code tags';

    const intro = document.createElement('p');
    intro.className = 'browse-page__subtitle';
    intro.textContent = description;

    const list = document.createElement('ul');
    list.className = 'tags-index__list';

    for (const tag of tags) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `/tag/${encodeURIComponent(tag.slug)}`;
      a.className = 'tags-index__link interactive';
      a.textContent = tag.label;
      li.appendChild(a);
      list.appendChild(li);
    }

    page.replaceChildren(back, heading, intro, list);
  })();

  return () => {
    abort = true;
  };
}
