import './pages.css';
import '@/components/shared.css';
import { wrapPublicPage } from '@/layout/pageShell';
import { createHeroFloaters } from '@/components/HeroFloaters/HeroFloaters';
import { createHeroPolaroids } from '@/components/HeroPolaroids/HeroPolaroids';
import { createSpotlightSection } from '@/components/MostLovedRow/MostLovedRow';
import { createPaginatedList } from '@/components/ListPager/ListPager';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { getAuthSession, isLoggedIn, subscribeAuth } from '@/services/auth';
import { fetchMiis, isSupabaseConfigured } from '@/services/supabase';
import {
  fetchHomeFollowingMiis,
  HOME_FOLLOWING_SLOTS,
} from '@/services/social';
import { icon, iconSpan } from '@/utils/icon';
import { consumePageEntrance } from '@/utils/motion';
import { scrollToTop, scrollToTopIfAtTop } from '@/utils/scroll';
import { bindFilterDrawer } from '@/utils/filterDrawer';
import { createEmptyState } from '@/utils/emptyState';
import { createTagFilter } from '@/components/TagFilter/TagFilter';
import { createCustomSelect } from '@/components/CustomSelect/CustomSelect';
import { getDiscordInviteUrl } from '@/config/community';
import type { Gender, SortOption, SourceFilter } from '@/types';
import { setPageMeta } from '@/utils/pageMeta';

const HOME_MOBILE_PREVIEW_COUNT = 8;
const MOBILE_HOME_MQ = '(max-width: 768px)';

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'favorites', label: "Most Yeah'd" },
  { value: 'downloads', label: 'Most Downloaded' },
];

const GENDERS: { value: Gender | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const SOURCES: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '3ds', label: '3DS' },
  { value: 'wiiu', label: 'Wii U' },
  { value: 'tomodachi', label: 'Tomodachi Life' },
];

function revealOnNextFrame(el: HTMLElement, className: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add(className));
  });
}

function createHeroPolaroidPlaceholder(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'hero-polaroids-placeholder';
  wrap.setAttribute('aria-hidden', 'true');
  const stack = document.createElement('div');
  stack.className = 'hero-polaroids-placeholder__stack';
  for (const position of ['left', 'center', 'right'] as const) {
    const card = document.createElement('div');
    card.className = `hero-polaroids-placeholder__card hero-polaroids-placeholder__card--${position}`;
    stack.appendChild(card);
  }
  wrap.appendChild(stack);
  return wrap;
}

export function renderHome(container: HTMLElement): () => void {
  setPageMeta({
    title: 'ShareMii — Browse, Share & Scan Mii QR Codes',
    description:
      'Browse, share, and scan Mii QR codes from 3DS, Wii U, and Tomodachi Life. Free online Mii Maker and community gallery.',
    url: `${window.location.origin}/`,
  });

  let sort: SortOption = 'newest';
  let gender: Gender | null = null;
  let source: SourceFilter = 'all';
  let tagSlugs: string[] = [];
  let search = '';
  let searchTimer = 0;
  let abort = false;
  let mobilePreview = window.matchMedia(MOBILE_HOME_MQ).matches;
  const content = document.createElement('main');
  content.className = 'page-content home-page';

  const heroSection = document.createElement('section');
  heroSection.className = 'hero';
  heroSection.appendChild(createHeroFloaters());

  const heroContent = document.createElement('div');
  heroContent.className = 'hero__content';
  heroContent.innerHTML = `
      <h1 class="hero__title">
        Browse, share, & collect <span class="hero__title-accent">Mii's</span>.
      </h1>
      <p class="hero__subtitle">
        Browse Mii characters shared by the community, or scan a QR code from your 3DS, Wii U, or Tomodachi Life to share them with everyone.
      </p>
      <div class="hero__actions" data-hero-actions>
        <a href="/" class="pill-btn pill-btn--filled pill-btn--lg interactive" data-browse-residents>${iconSpan('magnifying-glass')} Browse Residents</a>
      </div>
      <div class="hero__works">
        <span class="hero__works-label">Works with</span>
        <div class="hero__works-badges">
          <span class="hero__works-badge">3DS</span>
          <span class="hero__works-badge">Wii U</span>
          <span class="hero__works-badge">Tomodachi Life</span>
        </div>
      </div>
  `;

  const heroVisual = document.createElement('div');
  heroVisual.className = 'hero__visual';
  heroVisual.dataset.heroVisual = '';

  heroSection.append(heroContent, heroVisual);

  const heroPolaroidSlot = document.createElement('div');
  heroPolaroidSlot.className = 'hero__visual-slot';
  heroVisual.append(heroPolaroidSlot);
  const heroActions = heroSection.querySelector<HTMLElement>('[data-hero-actions]')!;
  const browseResidentsBtn =
    heroActions.querySelector<HTMLAnchorElement>('[data-browse-residents]')!;

  const heroOverflow = document.createElement('div');
  heroOverflow.className = 'hero__actions-overflow';
  heroActions.after(heroOverflow);

  const discordUrl = getDiscordInviteUrl();
  if (discordUrl) {
    const discordLink = document.createElement('a');
    discordLink.href = discordUrl;
    discordLink.target = '_blank';
    discordLink.rel = 'noopener noreferrer';
    discordLink.className =
      'pill-btn pill-btn--outline pill-btn--lg interactive hero__actions-secondary';
    discordLink.textContent = 'Join Discord';
    heroActions.appendChild(discordLink);
    const discordIcon = document.createElement('a');
    discordIcon.href = discordUrl;
    discordIcon.target = '_blank';
    discordIcon.rel = 'noopener noreferrer';
    discordIcon.className = 'pill-btn pill-btn--outline interactive';
    discordIcon.setAttribute('aria-label', 'Join Discord');
    discordIcon.innerHTML = iconSpan('comments');
    heroOverflow.appendChild(discordIcon);
  }
  let heroScanLink: HTMLAnchorElement | null = null;
  const playEntrance = consumePageEntrance('home');

  function updateHeroSubmit(
    session: import('@supabase/supabase-js').Session | null,
  ): void {
    if (isLoggedIn(session)) {
      if (!heroScanLink) {
        heroScanLink = document.createElement('a');
        heroScanLink.href = '#';
        heroScanLink.setAttribute('data-scan-submit', '');
        heroScanLink.className = `pill-btn pill-btn--outline pill-btn--lg interactive hero__actions-secondary${playEntrance ? ' pill-btn--enter' : ''}`;
        heroScanLink.innerHTML = `${iconSpan('camera')} Scan &amp; Submit`;
        heroActions.appendChild(heroScanLink);
        let scanIcon = heroOverflow.querySelector<HTMLAnchorElement>(
          '[data-hero-scan-icon]',
        );
        if (!scanIcon) {
          scanIcon = document.createElement('a');
          scanIcon.href = '#';
          scanIcon.setAttribute('data-scan-submit', '');
          scanIcon.setAttribute('data-hero-scan-icon', '');
          scanIcon.className = 'pill-btn pill-btn--outline interactive';
          scanIcon.setAttribute('aria-label', 'Scan and submit');
          scanIcon.innerHTML = iconSpan('camera');
          heroOverflow.appendChild(scanIcon);
        }
      }
      return;
    }
    heroScanLink?.remove();
    heroScanLink = null;
    heroOverflow.querySelector('[data-hero-scan-icon]')?.remove();
  }

  const unsubHeroAuth = subscribeAuth(updateHeroSubmit);

  const spotlightSlot = document.createElement('div');
  spotlightSlot.className = 'home-spotlight-slot';
  spotlightSlot.hidden = true;

  const followingSection = document.createElement('section');
  followingSection.className = 'plaza-section home-following';
  followingSection.hidden = true;

  void (async () => {
    const session = await getAuthSession();
    if (!isLoggedIn(session) || abort) return;
    try {
      const feed = await fetchHomeFollowingMiis(
        session!.user.id,
        HOME_FOLLOWING_SLOTS,
      );
      if (abort || !feed.length) return;
      followingSection.hidden = false;
      const head = document.createElement('div');
      head.className = 'home-following__head';
      const title = document.createElement('h2');
      title.className = 'section-title';
      title.textContent = 'From creators you follow';
      const seeAll = document.createElement('a');
      seeAll.href = '/feed';
      seeAll.className = 'home-following__see-all interactive';
      seeAll.textContent = 'See all activity';
      head.append(title, seeAll);
      const grid = document.createElement('div');
      grid.className = 'home-following__row scrollbar-hidden';
      for (let i = 0; i < feed.length; i++) {
        grid.appendChild(createMiiTile(feed[i]!, i, { variant: 'loved' }));
      }
      followingSection.append(head, grid);
    } catch {
      /* optional */
    }
  })();

  const residentsSection = document.createElement('section');
  residentsSection.id = 'residents';
  residentsSection.className = 'plaza-section browse-section';

  browseResidentsBtn.addEventListener('click', (e) => {
    if (mobilePreview) {
      return;
    }
    e.preventDefault();
    residentsSection.classList.add('browse-section--visible');
    residentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const browseHead = document.createElement('div');
  browseHead.className = 'browse-section__head';
  browseHead.innerHTML = `
    <div class="browse-section__title-wrap">
      <h2 class="browse-section__title">${icon('users')} Browse all residents</h2>
      <p class="browse-section__subtitle">Discover and filter Mii characters from the community.</p>
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

  const searchInput = browseHead.querySelector<HTMLInputElement>('[data-search]')!;
  const sortHost = browseHead.querySelector<HTMLElement>('[data-sort]')!;
  const sortSelect = createCustomSelect({
    options: SORTS.map((s) => ({ value: s.value, label: s.label })),
    value: sort,
    ariaLabel: 'Sort residents',
    variant: 'pill',
    onChange: (v) => {
      sort = v as SortOption;
      loadGrid();
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

  const sourceGroup = document.createElement('div');
  sourceGroup.className = 'filter-panel__group';
  const sourceLabel = document.createElement('span');
  sourceLabel.className = 'filter-panel__label';
  sourceLabel.textContent = 'Source';
  const sourcePills = document.createElement('div');
  sourcePills.className = 'pill-group';
  sourceGroup.append(sourceLabel, sourcePills);

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
      loadGrid();
    },
  });
  tagGroup.append(tagLabel, tagHint, tagFilter.root);

  filterPanel.append(genderGroup, sourceGroup, tagGroup);

  const residentsMain = document.createElement('div');
  residentsMain.className = 'residents-main';

  const paginated = createPaginatedList<import('@/types').Mii>({
    listClassName: 'mii-grid mii-grid--home list-pager__list',
    renderItem: (mii, i) => createMiiTile(mii, i, { variant: 'grid' }),
  });

  const mobileCta = document.createElement('div');
  mobileCta.className = 'browse-section__mobile-cta';
  mobileCta.innerHTML = `<a href="/browse" class="pill-btn pill-btn--filled pill-btn--lg interactive">${iconSpan('magnifying-glass')} See all in Browse</a>`;

  const browseTitle = browseHead.querySelector('.browse-section__title')!;

  layout.append(filterPanel, residentsMain);
  residentsMain.appendChild(paginated.root);
  residentsSection.append(browseHead, layout, mobileCta);

  function syncMobileHomeLayout(): void {
    const next = window.matchMedia(MOBILE_HOME_MQ).matches;
    if (next === mobilePreview) return;
    mobilePreview = next;
    heroSection.classList.toggle('hero--mobile-compact', mobilePreview);
    residentsSection.classList.toggle(
      'browse-section--mobile-preview',
      mobilePreview,
    );
    browseResidentsBtn.href = mobilePreview ? '/browse' : '/';
    if (mobilePreview) {
      browseTitle.innerHTML = `${icon('fire')} Trending residents`;
      browseResidentsBtn.innerHTML = `${iconSpan('magnifying-glass')} Browse Residents`;
    } else {
      browseTitle.innerHTML = `${icon('users')} Browse all residents`;
      browseResidentsBtn.innerHTML = `${iconSpan('magnifying-glass')} Browse Residents`;
    }
    void loadGrid();
  }

  heroSection.classList.toggle('hero--mobile-compact', mobilePreview);
  residentsSection.classList.toggle(
    'browse-section--mobile-preview',
    mobilePreview,
  );
  if (mobilePreview) {
    browseTitle.innerHTML = `${icon('fire')} Trending residents`;
    browseResidentsBtn.href = '/browse';
  }

  const mobileMq = window.matchMedia(MOBILE_HOME_MQ);
  mobileMq.addEventListener('change', syncMobileHomeLayout);

  const unbindFilterDrawer = bindFilterDrawer(
    layout,
    filterPanel,
    browseHead.querySelector('.browse-section__controls')!,
  );

  content.append(heroSection, spotlightSlot, followingSection, residentsSection);

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
        loadGrid();
      });
      genderPills.appendChild(btn);
    }
  }

  function renderSourceButtons(): void {
    sourcePills.replaceChildren();
    for (const s of SOURCES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `app-tab interactive${source === s.value ? ' app-tab--active' : ''}`;
      btn.textContent = s.label;
      btn.setAttribute('aria-pressed', String(source === s.value));
      btn.addEventListener('click', () => {
        source = s.value;
        renderSourceButtons();
        loadGrid();
      });
      sourcePills.appendChild(btn);
    }
  }

  function showHeroPlaceholder(): void {
    heroPolaroidSlot.replaceChildren(createHeroPolaroidPlaceholder());
  }

  function updateSpotlight(miis: import('@/types').Mii[]): void {
    if (miis.length === 0) {
      spotlightSlot.hidden = true;
      spotlightSlot.classList.remove('spotlight-section--enter');
      spotlightSlot.replaceChildren();
      showHeroPlaceholder();
      scrollToTopIfAtTop();
      return;
    }

    const byFavorites = [...miis].sort((a, b) => b.favorites - a.favorites);
    const featured = byFavorites[0]!;
    const heroSides = byFavorites
      .filter((m) => m.id !== featured.id)
      .slice(0, 2);
    const mostLoved = byFavorites
      .filter((m) => m.id !== featured.id)
      .slice(0, 3);

    heroPolaroidSlot.replaceChildren(createHeroPolaroids(featured, heroSides));
    const polaroids = heroPolaroidSlot.querySelector('.hero-polaroids');
    if (polaroids instanceof HTMLElement && playEntrance) {
      revealOnNextFrame(polaroids, 'hero-polaroids--enter');
    }

    spotlightSlot.classList.remove('spotlight-section--enter');
    spotlightSlot.replaceChildren(createSpotlightSection(featured, mostLoved));
    spotlightSlot.hidden = false;
    if (playEntrance) {
      revealOnNextFrame(spotlightSlot, 'spotlight-section--enter');
    }
    scrollToTopIfAtTop();
  }

  async function loadSpotlight(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const miis = await fetchMiis({ sort: 'favorites' });
      if (abort) return;
      updateSpotlight(miis);
    } catch {
      /* spotlight is optional on error */
    }
  }

  async function loadGrid(): Promise<void> {
    paginated.showSkeletonGrid();

    if (!isSupabaseConfigured()) {
      paginated.showMessage(
        '<p class="page-error">Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local</p>',
      );
      return;
    }

    try {
      const miis = await fetchMiis({ sort, gender, source, search, tagSlugs });
      if (abort) return;

      if (miis.length === 0) {
        paginated.showMessage(
          createEmptyState(
            'users',
            'No residents found',
            'Try adjusting your filters, tags, or search terms.',
            '<a href="#" class="pill-btn pill-btn--filled pill-btn--lg interactive" data-scan-submit>Scan &amp; submit a Mii</a>',
          ).outerHTML,
        );
        return;
      }

      const display = mobilePreview
        ? miis.slice(0, HOME_MOBILE_PREVIEW_COUNT)
        : miis;
      paginated.setItems(display);
      scrollToTopIfAtTop();
    } catch {
      if (!abort) {
        paginated.showMessage(
          '<p class="page-error">Failed to load residents. Check your Supabase setup.</p>',
        );
      }
    }
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      search = searchInput.value;
      loadGrid();
    }, 300);
  });

  renderGenderButtons();
  renderSourceButtons();
  showHeroPlaceholder();
  container.replaceChildren(wrapPublicPage(content));
  scrollToTop();

  if (playEntrance) {
    revealOnNextFrame(content, 'home-page--ready');
  } else {
    content.classList.add('home-page--ready', 'home-page--instant');
    residentsSection.classList.add('browse-section--visible');
  }

  const browseRevealTimer = playEntrance
    ? window.setTimeout(() => {
        residentsSection.classList.add('browse-section--visible');
        scrollToTopIfAtTop();
      }, 900)
    : 0;

  loadSpotlight();
  loadGrid();

  return () => {
    abort = true;
    window.clearTimeout(browseRevealTimer);
    unsubHeroAuth();
    window.clearTimeout(searchTimer);
    sortSelect.destroy();
    tagFilter.dispose();
    unbindFilterDrawer();
    mobileMq.removeEventListener('change', syncMobileHomeLayout);
  };
}
