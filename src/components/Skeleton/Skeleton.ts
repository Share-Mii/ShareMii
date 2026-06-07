import './Skeleton.css';
import { MOBILE_MQ } from '@/utils/viewport';

export const DEFAULT_SKELETON_GRID_COUNT = 6;

function skeletonBlock(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `skeleton ${className}`.trim();
  return el;
}

export function createMiiTileSkeleton(): HTMLElement {
  const tile = document.createElement('div');
  tile.className = 'skeleton-tile';
  tile.setAttribute('aria-hidden', 'true');

  const render = document.createElement('div');
  render.className = 'skeleton-tile__render';

  const frame = skeletonBlock('skeleton-tile__render-frame');
  render.appendChild(frame);

  const chin = document.createElement('div');
  chin.className = 'skeleton-tile__chin';

  const nameLine = skeletonBlock('skeleton-tile__line');
  const creatorLine = skeletonBlock('skeleton-tile__line skeleton-tile__line--short');
  chin.append(nameLine, creatorLine);

  tile.append(render, chin);
  return tile;
}

export function createFeedItemSkeleton(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'feed-item-skeleton';
  row.setAttribute('aria-hidden', 'true');

  const icon = skeletonBlock('feed-item-skeleton__icon skeleton--circle');
  const body = document.createElement('div');
  body.className = 'feed-item-skeleton__body';
  body.append(
    skeletonBlock('feed-item-skeleton__line'),
    skeletonBlock('feed-item-skeleton__line feed-item-skeleton__line--short'),
  );
  const thumb = skeletonBlock('feed-item-skeleton__thumb');

  row.append(icon, body, thumb);
  return row;
}

export function appendFeedListSkeleton(
  container: HTMLElement,
  count = 5,
): void {
  container.replaceChildren();
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Loading activity');
  for (let i = 0; i < count; i++) {
    container.appendChild(createFeedItemSkeleton());
  }
}

export function clearFeedListBusy(container: HTMLElement): void {
  container.removeAttribute('aria-busy');
  container.removeAttribute('aria-label');
}

export function appendMiiGridSkeleton(
  container: HTMLElement,
  count = DEFAULT_SKELETON_GRID_COUNT,
): void {
  container.replaceChildren();
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Loading');

  for (let i = 0; i < count; i++) {
    container.appendChild(createMiiTileSkeleton());
  }
}

export function createDetailPageSkeleton(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'detail-page detail-skeleton';
  if (window.matchMedia(MOBILE_MQ).matches) {
    page.classList.add('detail-page--app');
  }

  const back = skeletonBlock('detail-skeleton__back skeleton--pill');
  page.appendChild(back);

  const panel = document.createElement('div');
  panel.className = 'detail-skeleton__panel';

  const left = document.createElement('div');
  const mainRender = skeletonBlock('detail-skeleton__render');
  left.appendChild(mainRender);

  const right = document.createElement('div');
  right.className = 'detail-skeleton__right';
  right.append(
    skeletonBlock('detail-skeleton__title'),
    skeletonBlock('detail-skeleton__subtitle'),
    skeletonBlock('detail-skeleton__body'),
  );

  const actions = document.createElement('div');
  actions.className = 'detail-skeleton__actions';
  actions.append(
    skeletonBlock('detail-skeleton__btn skeleton--pill'),
    skeletonBlock('detail-skeleton__btn skeleton--pill'),
    skeletonBlock('detail-skeleton__btn skeleton--pill'),
  );
  right.appendChild(actions);

  panel.append(left, right);
  page.appendChild(panel);
  return page;
}

export function createProfilePageSkeleton(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'profile-page profile-skeleton';

  const card = document.createElement('div');
  card.className = 'profile-skeleton__card';

  const banner = skeletonBlock('profile-skeleton__banner');
  const body = document.createElement('div');
  body.className = 'profile-skeleton__body';
  body.append(
    skeletonBlock('profile-skeleton__avatar skeleton--circle'),
    skeletonBlock('profile-skeleton__name'),
    skeletonBlock('profile-skeleton__bio'),
  );
  card.append(banner, body);

  const sectionTitle = skeletonBlock('profile-skeleton__section-title');
  const grid = document.createElement('div');
  grid.className = 'profile-skeleton__grid';
  for (let i = 0; i < 6; i++) {
    grid.appendChild(createMiiTileSkeleton());
  }

  page.append(card, sectionTitle, grid);
  return page;
}
