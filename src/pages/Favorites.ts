import './pages.css';
import { navigateTo } from '@/utils/navigation';
import './Favorites.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  fetchUserFavoriteMiis,
  isSupabaseConfigured,
} from '@/services/supabase';
import type { Mii } from '@/types';

export function renderFavorites(container: HTMLElement): () => void {
  let abort = false;

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top favorites-page';
  page.innerHTML = '<p class="page-loading">Loading favorites…</p>';
  container.replaceChildren(wrapPublicPage(page));

  async function load(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML = '<p class="page-error">Supabase is not configured.</p>';
      return;
    }

    const session = await getAuthSession();
    if (!isLoggedIn(session)) {
      openLoginModal();
      navigateTo('/');
      return;
    }

    let miis: Mii[] = [];
    try {
      miis = await fetchUserFavoriteMiis();
    } catch {
      if (abort) return;
      page.innerHTML =
        '<p class="page-error">Could not load favorites. <a href="/">Go home</a></p>';
      return;
    }

    if (abort) return;

    page.replaceChildren();

    const heading = document.createElement('h1');
    heading.className = 'favorites-page__title';
    heading.textContent = 'My Favorites';

    const lead = document.createElement('p');
    lead.className = 'favorites-page__lead';
    lead.textContent = 'Miis you saved with the star button.';

    page.append(heading, lead);

    if (!miis.length) {
      const empty = document.createElement('p');
      empty.className = 'favorites-page__empty';
      empty.innerHTML =
        'No saved Miis yet. Browse the <a href="/browse" class="interactive">plaza</a> and star ones you like.';
      page.appendChild(empty);
      return;
    }

    const paginated = createPaginatedList<Mii>({
      listClassName: 'favorites-page__grid list-pager__list',
      renderItem: (mii, i) => createMiiTile(mii, i, { variant: 'grid' }),
    });

    paginated.setItems(miis);
    page.appendChild(paginated.root);
  }

  load();

  return () => {
    abort = true;
  };
}
