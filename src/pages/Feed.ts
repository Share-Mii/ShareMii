import './pages.css';
import { navigateTo } from '@/utils/navigation';
import './Feed.css';
import '@/components/shared.css';
import '@/components/FeedItem/FeedItem.css';
import '@/components/Skeleton/Skeleton.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createFeedItem } from '@/components/FeedItem/FeedItem';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import {
  appendFeedListSkeleton,
  appendMiiGridSkeleton,
  clearFeedListBusy,
} from '@/components/Skeleton/Skeleton';
import { getAuthSession, isLoggedIn } from '@/services/auth';
import { openLoginModal } from '@/components/LoginModal/LoginModal';
import {
  fetchActivityFeed,
  fetchFollowingCount,
  type ActivityFeedCursor,
  type ActivityFeedItem,
} from '@/services/activityFeed';
import { fetchFollowSuggestions } from '@/services/discovery';
import { fetchFollowingFeedMiis } from '@/services/social';
import { isSupabaseConfigured } from '@/services/supabase';
import { createEmptyState } from '@/utils/emptyState';
import { icon, iconSpan } from '@/utils/icon';
import {
  bindFilterDrawer,
  type FilterDrawerHandle,
} from '@/utils/filterDrawer';
import type { ActivityFeedFilter, Mii } from '@/types';
import { MOBILE_MQ } from '@/utils/viewport';

const PAGE_SIZE = 30;
const FEED_SKELETON_COUNT = 6;

const FILTERS: { value: ActivityFeedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'yeah', label: 'Yeahs' },
  { value: 'submit', label: 'Uploads' },
  { value: 'comment', label: 'Comments' },
  { value: 'remix', label: 'Remixes' },
  { value: 'collection_add', label: 'Collections' },
];

export function renderFeed(container: HTMLElement): () => void {
  let abort = false;
  let loadingMore = false;
  let loadingContent = false;
  let items: ActivityFeedItem[] = [];
  let nextCursor: ActivityFeedCursor | null = null;
  let followCount = 0;
  let eventFilter: ActivityFeedFilter = 'all';
  let activeTab: 'activity' | 'uploads' = 'activity';
  let pollTimer: number | null = null;
  let followingMiis: Mii[] = [];
  let shellReady = false;
  let filterDrawer: FilterDrawerHandle | null = null;

  const page = document.createElement('main');
  page.className = 'page-content page-content--offset-top feed-page';
  container.replaceChildren(wrapPublicPage(page));

  const tabs = document.createElement('div');
  tabs.className = 'feed-page__tabs';

  const filterBar = document.createElement('div');
  filterBar.className = 'feed-page__filter-bar';

  const filters = document.createElement('div');
  filters.className = 'feed-page__filters';

  const filterPanel = document.createElement('aside');
  filterPanel.className = 'filter-panel feed-page__filter-panel';
  filterPanel.setAttribute('role', 'dialog');
  filterPanel.setAttribute('aria-label', 'Activity filters');

  const filterPanelTitle = document.createElement('h3');
  filterPanelTitle.className = 'filter-panel__title';
  filterPanelTitle.innerHTML = `${icon('filter')} Filter activity`;

  const filterPanelOptions = document.createElement('div');
  filterPanelOptions.className = 'feed-page__filter-options';

  const filterApplyBar = document.createElement('div');
  filterApplyBar.className = 'filter-panel__apply-bar feed-page__filter-apply';
  const filterApplyBtn = document.createElement('button');
  filterApplyBtn.type = 'button';
  filterApplyBtn.className =
    'pill-btn pill-btn--filled interactive filter-panel__apply-btn';
  filterApplyBtn.textContent = 'Done';
  filterApplyBar.appendChild(filterApplyBtn);

  filterPanel.append(filterPanelTitle, filterPanelOptions, filterApplyBar);

  const list = document.createElement('div');
  list.className = 'feed-list';

  const uploadsPanel = document.createElement('div');
  uploadsPanel.className = 'feed-page__uploads';
  uploadsPanel.hidden = true;

  const suggestionsHost = document.createElement('div');
  suggestionsHost.className = 'feed-page__suggestions feed-page__suggestions-panel';

  const loadMoreWrap = document.createElement('div');
  loadMoreWrap.className = 'feed-page__load-more';
  loadMoreWrap.hidden = true;

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.type = 'button';
  loadMoreBtn.className = 'pill-btn interactive';
  loadMoreBtn.textContent = 'Load more';
  loadMoreWrap.appendChild(loadMoreBtn);

  function buildPageShell(): void {
    if (shellReady) return;
    shellReady = true;

    page.replaceChildren();

    const stickyHead = document.createElement('div');
    stickyHead.className = 'feed-page__sticky-head';

    const heading = document.createElement('h1');
    heading.className = 'feed-page__title page-title';
    heading.innerHTML = `${icon('rss')} Feed`;

    const lead = document.createElement('p');
    lead.className = 'feed-page__lead';
    lead.textContent =
      'Activity from people you follow, plus comments on Miis you save or upload. Use Latest uploads for a Mii grid from your follows.';

    renderTabs();
    renderFilterChips();
    filterBar.appendChild(filters);
    stickyHead.append(heading, lead, tabs, filterBar);
    page.append(
      stickyHead,
      filterPanel,
      suggestionsHost,
      list,
      uploadsPanel,
      loadMoreWrap,
    );

    filterDrawer = bindFilterDrawer(page, filterPanel, filterBar);
    filterDrawer.toggle.classList.add('feed-page__filter-toggle');
    filterDrawer.toggle.innerHTML = `${iconSpan('filter')} Filter`;
    filterApplyBtn.addEventListener('click', () => filterDrawer?.close());

    syncFeedAppClass();
    syncPanelVisibility();
  }

  function syncFeedAppClass(): void {
    const isMobile = window.matchMedia(MOBILE_MQ).matches;
    page.classList.toggle('feed-page--app', isMobile);
    filterPanel.classList.toggle('filter-panel--bottom-sheet', isMobile);
    filterDrawer?.setNavDock(isMobile);
    if (!isMobile) filterDrawer?.close();
  }

  const feedMq = window.matchMedia(MOBILE_MQ);
  feedMq.addEventListener('change', syncFeedAppClass);

  function showContentSkeleton(): void {
    loadMoreWrap.hidden = true;
    if (activeTab === 'activity') {
      appendFeedListSkeleton(list, FEED_SKELETON_COUNT);
    } else {
      uploadsPanel.replaceChildren();
      uploadsPanel.className = 'feed-page__uploads mii-grid mii-grid--home skeleton-grid';
      uploadsPanel.setAttribute('aria-busy', 'true');
      uploadsPanel.setAttribute('aria-label', 'Loading uploads');
      appendMiiGridSkeleton(uploadsPanel, 6);
    }
  }

  function clearUploadsSkeleton(): void {
    uploadsPanel.className = 'feed-page__uploads';
    uploadsPanel.removeAttribute('aria-busy');
    uploadsPanel.removeAttribute('aria-label');
  }

  function showContentError(message: string): void {
    const err = document.createElement('p');
    err.className = 'feed-page__error';
    err.textContent = message;
    if (activeTab === 'activity') {
      list.replaceChildren(err);
      clearFeedListBusy(list);
    } else {
      clearUploadsSkeleton();
      uploadsPanel.replaceChildren(err);
    }
    loadMoreWrap.hidden = true;
  }

  function renderFilterChips(): void {
    filters.replaceChildren();
    filterPanelOptions.replaceChildren();
    filterDrawer?.setBadgeCount(eventFilter === 'all' ? 0 : 1);

    for (const f of FILTERS) {
      const makeChip = (host: HTMLElement): void => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'feed-page__filter-chip interactive';
        if (f.value === eventFilter) {
          btn.classList.add('feed-page__filter-chip--active');
        }
        btn.textContent = f.label;
        btn.setAttribute('aria-pressed', String(f.value === eventFilter));
        btn.disabled = loadingContent;
        btn.addEventListener('click', () => {
          if (loadingContent || eventFilter === f.value) return;
          eventFilter = f.value;
          renderFilterChips();
          filterDrawer?.close();
          void reloadActivity();
        });
        host.appendChild(btn);
      };
      makeChip(filters);
      makeChip(filterPanelOptions);
    }
  }

  function syncPanelVisibility(): void {
    const onActivity = activeTab === 'activity';
    filters.hidden = !onActivity;
    list.hidden = !onActivity;
    suggestionsHost.hidden = !onActivity;
    uploadsPanel.hidden = onActivity;
    loadMoreWrap.hidden = !onActivity || !nextCursor || loadingContent;
  }

  function renderTabs(): void {
    tabs.replaceChildren();
    for (const t of [
      { id: 'activity' as const, label: 'Activity' },
      { id: 'uploads' as const, label: 'Latest uploads' },
    ]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'feed-page__tab interactive';
      if (activeTab === t.id) btn.classList.add('feed-page__tab--active');
      btn.textContent = t.label;
      btn.disabled = loadingContent;
      btn.addEventListener('click', () => {
        if (loadingContent || activeTab === t.id) return;
        activeTab = t.id;
        syncPanelVisibility();
        renderTabs();
        showContentSkeleton();
        void renderActiveTabContent();
      });
      tabs.appendChild(btn);
    }
  }

  function renderItems(): void {
    clearFeedListBusy(list);
    list.replaceChildren();
    for (const item of items) {
      list.appendChild(createFeedItem(item));
    }
    syncPanelVisibility();
  }

  function renderUploadsPanel(): void {
    clearUploadsSkeleton();
    uploadsPanel.replaceChildren();
    if (!followingMiis.length) {
      uploadsPanel.appendChild(
        createEmptyState(
          'users',
          'No uploads from follows yet',
          'Follow creators to see their latest Miis here.',
          '<p><a href="/browse" class="interactive">Browse residents</a></p>',
        ),
      );
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'mii-grid mii-grid--home';
    followingMiis.forEach((mii, i) => {
      grid.appendChild(createMiiTile(mii, i, { variant: 'grid' }));
    });
    uploadsPanel.appendChild(grid);
  }

  function showEmpty(): void {
    clearFeedListBusy(list);
    list.replaceChildren();
    if (followCount === 0) {
      list.appendChild(
        createEmptyState(
          'users',
          'Follow creators to fill your feed',
          'When you follow residents, their yeahs, uploads, and collection updates show up here.',
          '<p><a href="/browse" class="interactive">Browse residents</a></p>',
        ),
      );
    } else {
      list.appendChild(
        createEmptyState(
          'rss',
          'Nothing new yet',
          'Activity from people you follow will show up here.',
          '<p><a href="/browse" class="interactive">Browse the plaza</a></p>',
        ),
      );
    }
    syncPanelVisibility();
  }

  async function loadPage(cursor: ActivityFeedCursor | null): Promise<void> {
    const result = await fetchActivityFeed({
      limit: PAGE_SIZE,
      cursor,
      eventFilter,
    });
    if (abort) return;
    if (cursor) {
      items = [...items, ...result.items];
    } else {
      items = result.items;
    }
    nextCursor = result.nextCursor;
    if (!items.length) showEmpty();
    else renderItems();
  }

  async function reloadActivity(silent = false): Promise<void> {
    nextCursor = null;
    if (!silent) {
      showContentSkeleton();
      setLoadingContent(true);
    }
    try {
      await loadPage(null);
    } catch {
      if (!abort) showContentError('Could not load activity.');
    } finally {
      if (!silent) setLoadingContent(false);
    }
  }

  async function renderActiveTabContent(): Promise<void> {
    setLoadingContent(true);
    try {
      if (activeTab === 'uploads') {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (abort) return;
        renderUploadsPanel();
      } else if (!items.length && !nextCursor) {
        await loadPage(null);
      } else {
        renderItems();
      }
    } catch {
      if (!abort) showContentError('Could not load feed content.');
    } finally {
      setLoadingContent(false);
    }
  }

  function setLoadingContent(loading: boolean): void {
    loadingContent = loading;
    renderTabs();
    renderFilterChips();
    syncPanelVisibility();
  }

  async function loadSuggestions(): Promise<void> {
    suggestionsHost.replaceChildren();
    try {
      const suggestions = await fetchFollowSuggestions(6);
      if (!suggestions.length || abort) return;
      const wrap = document.createElement('section');
      wrap.className = 'feed-page__suggest';
      wrap.innerHTML = '<h2 class="feed-page__suggest-title">Suggested creators</h2>';
      const row = document.createElement('div');
      row.className = 'feed-page__suggest-row';
      for (const s of suggestions) {
        const a = document.createElement('a');
        a.href = `/u/${encodeURIComponent(s.username)}`;
        a.className = 'feed-page__suggest-card interactive';
        a.textContent = s.username;
        a.title = s.reason;
        row.appendChild(a);
      }
      wrap.appendChild(row);
      suggestionsHost.appendChild(wrap);
    } catch {
      /* optional */
    }
  }

  loadMoreBtn.addEventListener('click', () => {
    if (!nextCursor || loadingMore || loadingContent) return;
    loadingMore = true;
    loadMoreBtn.disabled = true;
    void loadPage(nextCursor).finally(() => {
      loadingMore = false;
      loadMoreBtn.disabled = false;
    });
  });

  function startPoll(): void {
    pollTimer = window.setInterval(() => {
      if (document.hidden || activeTab !== 'activity' || loadingContent) return;
      void reloadActivity(true);
    }, 60_000);
    document.addEventListener('visibilitychange', onVisible);
  }

  function onVisible(): void {
    if (!document.hidden && activeTab === 'activity' && !loadingContent) {
      void reloadActivity(true);
    }
  }

  async function init(): Promise<void> {
    if (!isSupabaseConfigured()) {
      page.innerHTML =
        '<p class="feed-page__error">Supabase is not configured.</p>';
      return;
    }

    const session = await getAuthSession();
    if (!isLoggedIn(session)) {
      openLoginModal();
      navigateTo('/');
      return;
    }

    buildPageShell();
    showContentSkeleton();
    setLoadingContent(true);

    try {
      const userId = session!.user.id;
      const [count, miis] = await Promise.all([
        fetchFollowingCount(userId),
        fetchFollowingFeedMiis(userId, 24),
      ]);
      if (abort) return;
      followCount = count;
      followingMiis = miis;

      await loadPage(null);
      if (abort) return;

      void loadSuggestions();
    } catch {
      if (abort) return;
      showContentError('Could not load feed. Try again in a moment.');
    } finally {
      setLoadingContent(false);
    }

    if (!abort) startPoll();
  }

  void init();

  return () => {
    abort = true;
    if (pollTimer) window.clearInterval(pollTimer);
    document.removeEventListener('visibilitychange', onVisible);
    feedMq.removeEventListener('change', syncFeedAppClass);
    filterDrawer?.destroy();
  };
}
