import './pages.css';
import { navigateTo } from '@/utils/navigation';
import './CreatorDashboard.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import { fetchCreatorStats } from '@/services/creator';
import { isSupabaseConfigured } from '@/services/supabase';
import { icon } from '@/utils/icon';
import type { CreatorStats } from '@/types';
import { escapeHtml } from '@/utils/escapeHtml';

export function renderCreatorDashboard(container: HTMLElement): () => void {
  let abort = false;

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top creator-dashboard';
  page.innerHTML = '<p class="page-loading">Loading stats…</p>';
  container.replaceChildren(wrapPublicPage(page));

  async function init(): Promise<void> {
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

    let stats: CreatorStats;
    try {
      stats = await fetchCreatorStats(session!.user.id);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not load creator stats.';
      page.innerHTML = `<p class="page-error">${escapeHtml(msg)}</p>`;
      return;
    }
    if (abort) return;

    page.replaceChildren();
    const heading = document.createElement('h1');
    heading.className = 'page-title';
    heading.innerHTML = `${icon('chart-line')} Creator dashboard`;

    const grid = document.createElement('div');
    grid.className = 'creator-dashboard__grid';

    const cards: { label: string; value: string | number }[] = [
      { label: 'Uploads', value: stats.upload_count },
      { label: 'Public uploads', value: stats.public_upload_count },
      { label: 'Total yeahs', value: stats.total_yeahs },
      { label: 'Total views', value: stats.total_views },
      { label: 'Total downloads', value: stats.total_downloads },
      { label: 'Remixes received', value: stats.remix_received_count },
      { label: 'Followers', value: stats.follower_count },
      { label: 'Following', value: stats.following_count },
    ];

    for (const c of cards) {
      const card = document.createElement('div');
      card.className = 'creator-dashboard__card';
      card.innerHTML = `
        <span class="creator-dashboard__value">${c.value}</span>
        <span class="creator-dashboard__label">${c.label}</span>
      `;
      grid.appendChild(card);
    }

    const links = document.createElement('p');
    links.className = 'creator-dashboard__links';
    links.innerHTML =
      '<a href="/uploads" class="interactive">Manage uploads</a> · <a href="/collections" class="interactive">Collections</a>';

    page.append(heading, grid, links);
  }

  void init();

  return () => {
    abort = true;
  };
}
