import './ListPager.css';
import {
  appendMiiGridSkeleton,
  DEFAULT_SKELETON_GRID_COUNT,
} from '@/components/Skeleton/Skeleton';
import { iconSpan } from '@/utils/icon';

const LIST_PAGE_SIZE = 15;

export interface PaginatedListOptions<T> {
  listClassName?: string;
  pageSize?: number;
  renderItem: (item: T, indexInFullList: number) => HTMLElement;
}

export interface PaginatedListHandle<T> {
  root: HTMLElement;
  listEl: HTMLElement;
  setItems: (items: T[]) => void;
  resetPage: () => void;
  showMessage: (html: string) => void;
  showSkeletonGrid: (count?: number) => void;
}

export function createPaginatedList<T>(
  options: PaginatedListOptions<T>,
): PaginatedListHandle<T> {
  const pageSize = options.pageSize ?? LIST_PAGE_SIZE;
  let items: T[] = [];
  let currentPage = 0;

  const root = document.createElement('div');
  root.className = 'list-pager';

  const listEl = document.createElement('div');
  listEl.className = options.listClassName ?? 'list-pager__list';

  const controls = document.createElement('nav');
  controls.className = 'list-pager__controls';
  controls.setAttribute('aria-label', 'Page navigation');
  controls.hidden = true;

  root.append(listEl, controls);

  function totalPages(): number {
    return Math.max(1, Math.ceil(items.length / pageSize));
  }

  function renderControls(): void {
    controls.replaceChildren();
    if (items.length <= pageSize) {
      controls.hidden = true;
      return;
    }

    controls.hidden = false;
    const pages = totalPages();
    const safePage = Math.min(currentPage, pages - 1);
    currentPage = safePage;

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'list-pager__btn interactive';
    prev.disabled = safePage <= 0;
    prev.innerHTML = iconSpan('chevron-left');
    prev.setAttribute('aria-label', 'Previous page');

    const label = document.createElement('span');
    label.className = 'list-pager__label';
    label.textContent = `Page ${safePage + 1} of ${pages}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'list-pager__btn interactive';
    next.disabled = safePage >= pages - 1;
    next.innerHTML = iconSpan('chevron-right');
    next.setAttribute('aria-label', 'Next page');

    prev.addEventListener('click', () => {
      currentPage = Math.max(0, currentPage - 1);
      renderPage();
    });

    next.addEventListener('click', () => {
      currentPage = Math.min(totalPages() - 1, currentPage + 1);
      renderPage();
    });

    controls.append(prev, label, next);
  }

  function renderPage(): void {
    listEl.replaceChildren();
    if (items.length === 0) {
      controls.hidden = true;
      return;
    }

    const pages = totalPages();
    currentPage = Math.min(currentPage, pages - 1);
    const start = currentPage * pageSize;
    const slice = items.slice(start, start + pageSize);

    for (let i = 0; i < slice.length; i++) {
      const item = slice[i]!;
      listEl.appendChild(options.renderItem(item, start + i));
    }

    renderControls();
  }

  return {
    root,
    listEl,
    setItems(newItems: T[]) {
      items = newItems;
      currentPage = 0;
      renderPage();
    },
    resetPage() {
      currentPage = 0;
      renderPage();
    },
    showMessage(html: string) {
      items = [];
      controls.hidden = true;
      listEl.removeAttribute('aria-busy');
      listEl.removeAttribute('aria-label');
      listEl.innerHTML = html;
    },
    showSkeletonGrid(count = DEFAULT_SKELETON_GRID_COUNT) {
      items = [];
      controls.hidden = true;
      appendMiiGridSkeleton(listEl, count);
    },
  };
}
