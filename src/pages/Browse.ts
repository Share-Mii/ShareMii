import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { fetchMiis, isSupabaseConfigured } from '@/services/supabase';
import { createTagFilter } from '@/components/TagFilter/TagFilter';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';
import { icon } from '@/utils/icon';
import { bindFilterDrawer } from '@/utils/filterDrawer';
import { createEmptyState } from '@/utils/emptyState';
import type { Gender, Mii, Platform, SortOption } from '@/types';

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
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
  let sort: SortOption = 'newest';
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
  browseHead.innerHTML = `
    <div class="browse-section__title-wrap">
      <h1 class="browse-section__title page-title">${icon('users')} Browse all residents</h1>
      <p class="browse-section__subtitle" data-results>Discover and filter Mii characters from the community.</p>
    </div>
    <div class="browse-section__controls">
      <div class="browse-section__search-wrap">
        ${icon('magnifying-glass')}
        <input type="search" class="browse-section__search" placeholder="Search residents…" aria-label="Search residents" data-search />
      </div>
      <label class="browse-section__sort">
        Sort by:
        <span class="browse-section__sort-control" data-sort></span>
      </label>
    </div>
  `;

  const resultsMeta = browseHead.querySelector<HTMLElement>('[data-results]')!;
  const searchInput = browseHead.querySelector<HTMLInputElement>('[data-search]')!;
  const sortHost = browseHead.querySelector<HTMLElement>('[data-sort]')!;
  const sortSelect = createCustomSelect({
    options: SORTS.map((s) => ({ value: s.value, label: s.label })),
    value: sort,
    ariaLabel: 'Sort residents',
    variant: 'pill',
    onChange: (v) => {
      sort = v as SortOption;
      loadMiis();
    },
  });
  sortHost.appendChild(sortSelect.root);

  const layout = document.createElement('div');
  layout.className = 'residents-layout';

  const filterPanel = document.createElement('aside');
  filterPanel.className = 'filter-panel';
  filterPanel.innerHTML = `<h3 class="filter-panel__title">${icon('filter')} Filters</h3>`;

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
      loadMiis();
    },
  });
  tagGroup.append(tagLabel, tagHint, tagFilter.root);

  filterPanel.append(genderGroup, platformGroup, tagGroup);

  const residentsMain = document.createElement('div');
  residentsMain.className = 'residents-main';

  const paginated = createPaginatedList<Mii>({
    listClassName: 'mii-grid mii-grid--home list-pager__list',
    renderItem: (mii, i) => createMiiTile(mii, i, { variant: 'grid' }),
  });

  layout.append(filterPanel, residentsMain);
  residentsMain.appendChild(paginated.root);
  browseSection.append(browseHead, layout);
  content.appendChild(browseSection);

  const unbindFilterDrawer = bindFilterDrawer(
    layout,
    filterPanel,
    browseHead.querySelector('.browse-section__controls')!,
  );

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
    resultsMeta.textContent = `${count} ${noun} · Discover and filter Mii characters from the community.`;
  }

  async function loadMiis(): Promise<void> {
    setResultsMeta(true);
    paginated.showSkeletonGrid();

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

  renderGenderButtons();
  renderPlatformButtons();
  container.replaceChildren(wrapPublicPage(content));
  loadMiis();

  return () => {
    abort = true;
    window.clearTimeout(searchTimer);
    tagFilter.dispose();
    sortSelect.destroy();
    unbindFilterDrawer();
  };
}
