import { iconSpan } from '@/utils/icon';

export function bindFilterDrawer(
  layout: HTMLElement,
  filterPanel: HTMLElement,
  controlsEl: HTMLElement,
): () => void {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'pill-btn pill-btn--outline interactive filter-drawer-toggle';
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

  controlsEl.prepend(toggle);
  layout.prepend(backdrop);

  function open(): void {
    filterPanel.classList.add('filter-panel--open');
    backdrop.classList.add('filter-drawer-backdrop--open');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
  }

  function close(): void {
    filterPanel.classList.remove('filter-panel--open');
    backdrop.classList.remove('filter-drawer-backdrop--open');
    document.body.style.overflow = '';
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

  return () => {
    document.removeEventListener('keydown', onKey);
    close();
    toggle.remove();
    backdrop.remove();
    closeBtn.remove();
  };
}
