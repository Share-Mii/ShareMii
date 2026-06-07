import { iconSpan } from '@/utils/icon';
import { lockBodyScroll, unlockBodyScroll } from '@/utils/modalScrollLock';

export interface FilterDrawerOptions {
  /** Mount panel/backdrop on body and dock above the bottom nav (mobile sheets). */
  navDock?: boolean;
}

export interface FilterDrawerHandle {
  destroy: () => void;
  toggle: HTMLButtonElement;
  close: () => void;
  setBadgeCount: (count: number) => void;
  setNavDock: (enabled: boolean) => void;
}

export function bindFilterDrawer(
  layout: HTMLElement,
  filterPanel: HTMLElement,
  controlsEl: HTMLElement,
  options: FilterDrawerOptions = {},
): FilterDrawerHandle {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className =
    'pill-btn pill-btn--outline interactive filter-drawer-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Filters');
  toggle.innerHTML = `${iconSpan('filter')} Filters`;

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'filter-drawer-backdrop';
  backdrop.setAttribute('aria-label', 'Close filters');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'filter-panel__close';
  closeBtn.setAttribute('aria-label', 'Close filters');
  closeBtn.innerHTML = iconSpan('xmark');
  filterPanel.prepend(closeBtn);

  const badge = document.createElement('span');
  badge.className = 'browse-filter-badge';
  badge.hidden = true;
  toggle.appendChild(badge);

  controlsEl.prepend(toggle);

  let navDock = Boolean(options.navDock);
  let panelAnchor: HTMLElement | null = filterPanel.parentElement;
  let panelBefore: Node | null = filterPanel.nextSibling;

  function rememberPanelAnchor(): void {
    if (filterPanel.parentElement && filterPanel.parentElement !== document.body) {
      panelAnchor = filterPanel.parentElement;
      panelBefore = filterPanel.nextSibling;
    }
  }

  rememberPanelAnchor();

  function mountOverlay(): void {
    if (navDock) {
      if (backdrop.parentElement !== document.body) {
        document.body.appendChild(backdrop);
      }
      if (filterPanel.parentElement !== document.body) {
        document.body.appendChild(filterPanel);
      }
      backdrop.classList.add('filter-drawer-backdrop--nav-dock');
      return;
    }

    backdrop.classList.remove('filter-drawer-backdrop--nav-dock');
    if (backdrop.parentElement !== layout) {
      layout.prepend(backdrop);
    }
    if (filterPanel.parentElement === document.body && panelAnchor) {
      panelAnchor.insertBefore(filterPanel, panelBefore);
    }
  }

  function setNavDock(enabled: boolean): void {
    if (navDock === enabled) return;
    close();
    if (enabled) rememberPanelAnchor();
    navDock = enabled;
    mountOverlay();
  }

  mountOverlay();

  function setBadgeCount(count: number): void {
    if (count <= 0) {
      badge.hidden = true;
      badge.textContent = '';
      return;
    }
    badge.hidden = false;
    badge.textContent = count > 9 ? '9+' : String(count);
  }

  function open(): void {
    if (navDock) mountOverlay();
    filterPanel.classList.add('filter-panel--open');
    backdrop.classList.add('filter-drawer-backdrop--open');
    lockBodyScroll();
    toggle.setAttribute('aria-expanded', 'true');
  }

  function close(): void {
    filterPanel.classList.remove('filter-panel--open');
    backdrop.classList.remove('filter-drawer-backdrop--open');
    unlockBodyScroll();
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    if (filterPanel.classList.contains('filter-panel--open')) close();
    else open();
  });
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  function destroy(): void {
    document.removeEventListener('keydown', onKey);
    close();
    toggle.remove();
    backdrop.remove();
    if (filterPanel.parentElement === document.body) {
      filterPanel.remove();
    }
    closeBtn.remove();
  }

  return { destroy, toggle, close, setBadgeCount, setNavDock };
}
