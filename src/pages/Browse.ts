import './pages.css';
import './Browse.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { fetchMiis, isSupabaseConfigured } from '@/services/supabase';
import { searchProfiles } from '@/services/discovery';
import { createTagFilter } from '@/components/TagFilter/TagFilter';
import { icon, iconSpan } from '@/utils/icon';
import { bindFilterDrawer } from '@/utils/filterDrawer';
import { createEmptyState } from '@/utils/emptyState';
import type { Gender, Mii, Platform, SortOption } from '@/types';
import { getSiteOrigin, setPageMeta } from '@/utils/pageMeta';
import { MOBILE_MQ } from '@/utils/viewport';
const DEFAULT_SORT: SortOption = 'newest';

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'favorites', label: "Most Yeah'd" },
  { value: 'downloads', label: 'Most Downloaded' },
  { value: 'views', label: 'Most Viewed' },
];

const GENDERS: { value: Gender | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS: { value: Platform | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'wii', label: 'Wii' },
  { value: '3ds', label: '3DS' },
  { value: 'wiiu', label: 'Wii U' },
  { value: 'switch', label: 'Switch' },
];

export function renderBrowse(container: HTMLElement): () => void {
  setPageMeta({
    title: 'Browse Mii QR Codes & Community Miis',
    description:
      'Search and browse Nintendo Mii QR codes shared by the community. Filter by 3DS, Wii U, Tomodachi Life, tags, and trending.',
    url: `${getSiteOrigin()}/browse`,
  });

  let sort: SortOption = DEFAULT_SORT;
  let gender: Gender | null = null;
  let platform: Platform | null = null;
  let tagSlugs: string[] = [];
  let search = '';
  let searchTimer = 0;
  let abort = false;

  const content = document.createElement('main');
  content.className = 'page-content page-content--offset-top browse-page';

  const browseSection = document.createElement('section');
  browseSection.className = 'plaza-section browse-section browse-section--page';

  const browseHead = document.createElement('div');
  browseHead.className = 'browse-section__head';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'browse-section__title-wrap';
  titleWrap.innerHTML = `
    <h1 class="browse-section__title page-title">${icon('users')} <span class="browse-section__title-text">Browse all residents</span></h1>
    <p class="browse-section__subtitle" data-results>Discover and filter Mii characters from the community.</p>
  `;

  const toolbar = document.createElement('div');
  toolbar.className = 'browse-section__toolbar';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'browse-section__search-wrap';
  searchWrap.innerHTML = `
    ${icon('magnifying-glass')}
    <input type="search" class="browse-section__search" placeholder="Search residents…" aria-label="Search residents" data-search />
  `;

  const toolbarActions = document.createElement('div');
  toolbarActions.className = 'browse-section__toolbar-actions';

  const mobileActions = document.createElement('div');
  mobileActions.className = 'browse-section__mobile-actions';

  toolbar.append(searchWrap, toolbarActions);

  const activeFilters = document.createElement('div');
  activeFilters.className = 'browse-section__active-filters';
  activeFilters.setAttribute('role', 'list');
  activeFilters.setAttribute('aria-label', 'Active filters');
  activeFilters.hidden = true;

  browseHead.append(titleWrap, toolbar, mobileActions, activeFilters);

  const resultsMeta = browseHead.querySelector<HTMLElement>('[data-results]')!;
  const searchInput = browseHead.querySelector<HTMLInputElement>('[data-search]')!;

  const layout = document.createElement('div');
  layout.className = 'residents-layout';

  const filterPanel = document.createElement('aside');
  filterPanel.className = 'filter-panel';
  filterPanel.setAttribute('role', 'dialog');
  filterPanel.setAttribute('aria-label', 'Filters');
  filterPanel.innerHTML = `<h3 class="filter-panel__title">${icon('filter')} Filters</h3>`;

  const sortGroup = document.createElement('div');
  sortGroup.className = 'filter-panel__group';
  const sortLabel = document.createElement('span');
  sortLabel.className = 'filter-panel__label';
  sortLabel.textContent = 'Sort by';
  const sortPills = document.createElement('div');
  sortPills.className = 'pill-group filter-panel__sort-pills';
  sortGroup.append(sortLabel, sortPills);

  const genderGroup = document.createElement('div');
  genderGroup.className = 'filter-panel__group';
  const genderLabel = document.createElement('span');
  genderLabel.className = 'filter-panel__label';
  genderLabel.textContent = 'Gender';
  const genderPills = document.createElement('div');
  genderPills.className = 'pill-group';
  genderGroup.append(genderLabel, genderPills);

  const platformGroup = document.createElement('div');
  platformGroup.className = 'filter-panel__group';
  const platformLabel = document.createElement('span');
  platformLabel.className = 'filter-panel__label';
  platformLabel.textContent = 'Platform';
  const platformPills = document.createElement('div');
  platformPills.className = 'pill-group';
  platformGroup.append(platformLabel, platformPills);

  const tagGroup = document.createElement('div');
  tagGroup.className = 'filter-panel__group';
  const tagLabel = document.createElement('span');
  tagLabel.className = 'filter-panel__label';
  tagLabel.textContent = 'Tags';
  const tagHint = document.createElement('p');
  tagHint.className = 'filter-panel__desc';
  tagHint.textContent = 'Search tags and add them to filter results.';
  const tagFilter = createTagFilter({
    onChange: (tags) => {
      tagSlugs = tags.map((t) => t.slug);
      renderActiveFilters();
      loadMiis();
    },
  });
  tagGroup.append(tagLabel, tagHint, tagFilter.root);

  const filterApplyBar = document.createElement('div');
  filterApplyBar.className = 'filter-panel__apply-bar';
  const filterApplyBtn = document.createElement('button');
  filterApplyBtn.type = 'button';
  filterApplyBtn.className = 'pill-btn pill-btn--filled interactive filter-panel__apply-btn';
  filterApplyBtn.textContent = 'Show results';
  filterApplyBar.appendChild(filterApplyBtn);
  filterPanel.append(sortGroup, genderGroup, platformGroup, tagGroup, filterApplyBar);

  const creatorResults = document.createElement('div');
  creatorResults.className = 'browse-creators';
  creatorResults.hidden = true;

  const residentsMain = document.createElement('div');
  residentsMain.className = 'residents-main';

  const paginated = createPaginatedList<Mii>({
    listClassName: 'mii-grid mii-grid--home list-pager__list',
    renderItem: (mii, i) => createMiiTile(mii, i, { variant: 'grid' }),
  });

  layout.append(filterPanel, residentsMain);
  residentsMain.appendChild(paginated.root);
  browseSection.append(browseHead, creatorResults, layout);
  content.append(browseSection);

  const filterDrawer = bindFilterDrawer(layout, filterPanel, mobileActions);

  filterApplyBtn.addEventListener('click', () => filterDrawer.close());

  function syncBrowseAppClass(): void {
    const isMobile = window.matchMedia(MOBILE_MQ).matches;
    content.classList.toggle('browse-page--app', isMobile);
    filterPanel.classList.toggle('filter-panel--bottom-sheet', isMobile);
    filterDrawer.setNavDock(isMobile);

    if (isMobile) {
      if (!mobileActions.contains(filterDrawer.toggle)) {
        mobileActions.append(filterDrawer.toggle);
      }
      filterDrawer.toggle.classList.add('browse-mobile-action-btn');
    } else {
      filterDrawer.close();
      if (!toolbarActions.contains(filterDrawer.toggle)) {
        toolbarActions.prepend(filterDrawer.toggle);
      }
      filterDrawer.toggle.classList.remove('browse-mobile-action-btn');
    }
  }

  syncBrowseAppClass();
  const browseMq = window.matchMedia(MOBILE_MQ);
  browseMq.addEventListener('change', syncBrowseAppClass);

  function activeFilterCount(): number {
    let n = 0;
    if (sort !== DEFAULT_SORT) n++;
    if (gender) n++;
    if (platform) n++;
    n += tagSlugs.length;
    return n;
  }

  function renderActiveFilters(): void {
    filterDrawer.setBadgeCount(activeFilterCount());
    activeFilters.replaceChildren();

    const chips: { label: string; clear: () => void }[] = [];

    if (sort !== DEFAULT_SORT) {
      const s = SORTS.find((x) => x.value === sort);
      chips.push({
        label: s?.label ?? 'Sort',
        clear: () => {
          sort = DEFAULT_SORT;
          renderSortButtons();
          renderActiveFilters();
          loadMiis();
        },
      });
    }

    if (gender) {
      const g = GENDERS.find((x) => x.value === gender);
      chips.push({
        label: g?.label ?? 'Gender',
        clear: () => {
          gender = null;
          renderGenderButtons();
          renderActiveFilters();
          loadMiis();
        },
      });
    }

    if (platform) {
      const p = PLATFORMS.find((x) => x.value === platform);
      chips.push({
        label: p?.label ?? 'Platform',
        clear: () => {
          platform = null;
          renderPlatformButtons();
          renderActiveFilters();
          loadMiis();
        },
      });
    }

    for (const slug of tagSlugs) {
      chips.push({
        label: `#${slug}`,
        clear: () => {
          tagFilter.removeBySlug(slug);
        },
      });
    }

    if (!chips.length) {
      activeFilters.hidden = true;
      return;
    }

    activeFilters.hidden = false;

    if (chips.length > 1) {
      const clearAll = document.createElement('button');
      clearAll.type = 'button';
      clearAll.className =
        'browse-active-filter browse-active-filter--clear interactive';
      clearAll.textContent = 'Clear all';
      clearAll.addEventListener('click', () => {
        sort = DEFAULT_SORT;
        gender = null;
        platform = null;
        tagSlugs = [];
        tagFilter.clearAll();
        renderSortButtons();
        renderGenderButtons();
        renderPlatformButtons();
        renderActiveFilters();
        loadMiis();
      });
      activeFilters.appendChild(clearAll);
    }

    for (const chip of chips) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'browse-active-filter interactive';
      el.setAttribute('role', 'listitem');
      el.innerHTML = `${escapeHtml(chip.label)} ${iconSpan('xmark', 'browse-active-filter__icon')}`;
      el.addEventListener('click', chip.clear);
      activeFilters.appendChild(el);
    }
  }

  function renderSortButtons(): void {
    sortPills.replaceChildren();
    for (const s of SORTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `app-tab interactive${sort === s.value ? ' app-tab--active' : ''}`;
      btn.textContent = s.label;
      btn.setAttribute('aria-pressed', String(sort === s.value));
      btn.addEventListener('click', () => {
        if (sort === s.value) return;
        sort = s.value;
        renderSortButtons();
        renderActiveFilters();
        loadMiis();
      });
      sortPills.appendChild(btn);
    }
  }

  function renderGenderButtons(): void {
    genderPills.replaceChildren();
    for (const g of GENDERS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `app-tab interactive${gender === g.value ? ' app-tab--active' : ''}`;
      btn.textContent = g.label;
      btn.setAttribute('aria-pressed', String(gender === g.value));
      btn.addEventListener('click', () => {
        gender = g.value;
        renderGenderButtons();
        renderActiveFilters();
        loadMiis();
      });
      genderPills.appendChild(btn);
    }
  }

  function renderPlatformButtons(): void {
    platformPills.replaceChildren();
    for (const p of PLATFORMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `app-tab interactive${platform === p.value ? ' app-tab--active' : ''}`;
      btn.textContent = p.label;
      btn.setAttribute('aria-pressed', String(platform === p.value));
      btn.addEventListener('click', () => {
        platform = p.value;
        renderPlatformButtons();
        renderActiveFilters();
        loadMiis();
      });
      platformPills.appendChild(btn);
    }
  }

  function setResultsMeta(loading: boolean, count?: number): void {
    if (loading) {
      resultsMeta.classList.add('skeleton', 'browse-section__subtitle--loading');
      resultsMeta.setAttribute('aria-busy', 'true');
      resultsMeta.textContent = '';
      return;
    }
    resultsMeta.classList.remove('skeleton', 'browse-section__subtitle--loading');
    resultsMeta.removeAttribute('aria-busy');
    if (count === undefined) {
      resultsMeta.textContent =
        'Discover and filter Mii characters from the community.';
      return;
    }
    const noun = count === 1 ? 'resident' : 'residents';
    resultsMeta.textContent = `${count} ${noun}`;
  }

  async function loadCreatorSearch(): Promise<void> {
    creatorResults.replaceChildren();
    if (search.trim().length < 2) {
      creatorResults.hidden = true;
      return;
    }
    try {
      const profiles = await searchProfiles(search, 8);
      if (!profiles.length) {
        creatorResults.hidden = true;
        return;
      }
      creatorResults.hidden = false;
      const title = document.createElement('h2');
      title.className = 'browse-creators__title';
      title.textContent = 'Creators';
      const row = document.createElement('div');
      row.className = 'browse-creators__row';
      for (const p of profiles) {
        const a = document.createElement('a');
        a.href = `/u/${encodeURIComponent(p.username)}`;
        a.className = 'browse-creators__card interactive';
        a.innerHTML = `<strong>${escapeHtml(p.username)}</strong>${p.trusted_creator ? ' <span class="browse-creators__trusted">Trusted</span>' : ''}`;
        row.appendChild(a);
      }
      creatorResults.append(title, row);
    } catch {
      creatorResults.hidden = true;
    }
  }

  async function loadMiis(): Promise<void> {
    setResultsMeta(true);
    paginated.showSkeletonGrid();
    void loadCreatorSearch();

    if (!isSupabaseConfigured()) {
      paginated.showMessage('<p class="page-error">Supabase is not configured.</p>');
      setResultsMeta(false);
      return;
    }

    try {
      const miis = await fetchMiis({ sort, gender, platform, search, tagSlugs });
      if (abort) return;

      setResultsMeta(false, miis.length);

      if (miis.length === 0) {
        paginated.showMessage(
          createEmptyState(
            'users',
            'No residents found',
            'Try adjusting your filters, tags, or search terms.',
          ).outerHTML,
        );
        return;
      }

      paginated.setItems(miis);
    } catch {
      if (!abort) {
        setResultsMeta(false);
        paginated.showMessage('<p class="page-error">Failed to load residents.</p>');
      }
    }
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      search = searchInput.value;
      loadMiis();
    }, 300);
  });

  renderSortButtons();
  renderGenderButtons();
  renderPlatformButtons();
  renderActiveFilters();
  container.replaceChildren(wrapPublicPage(content));
  loadMiis();

  return () => {
    abort = true;
    window.clearTimeout(searchTimer);
    browseMq.removeEventListener('change', syncBrowseAppClass);
    tagFilter.dispose();
    filterDrawer.destroy();
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
