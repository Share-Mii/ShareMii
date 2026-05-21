import './TileOverflowMenu.css';
import { icon } from '@/utils/icon';

export interface TileOverflowMenuItem {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onSelect: () => void | Promise<void>;
}

export function createTileOverflowMenu(
  items: TileOverflowMenuItem[],
  ariaLabel = 'Options',
): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'tile-overflow-menu';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'tile-overflow-menu__btn interactive';
  toggle.setAttribute('aria-label', ariaLabel);
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = icon('ellipsis');

  const dropdown = document.createElement('div');
  dropdown.className = 'tile-overflow-menu__dropdown';
  dropdown.setAttribute('role', 'menu');
  dropdown.hidden = true;

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tile-overflow-menu__item interactive${item.danger ? ' tile-overflow-menu__item--danger' : ''}`;
    btn.setAttribute('role', 'menuitem');
    btn.textContent = item.label;
    if (item.disabled) btn.disabled = true;
    if (item.title) btn.title = item.title;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      setOpen(false);
      await item.onSelect();
    });
    dropdown.appendChild(btn);
  }

  let open = false;

  const onDocClick = (e: MouseEvent): void => {
    const t = e.target as Node;
    if (menu.contains(t)) return;
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false);
  };

  function setOpen(next: boolean): void {
    open = next;
    menu.classList.toggle('tile-overflow-menu--open', next);
    toggle.setAttribute('aria-expanded', String(next));
    dropdown.hidden = !next;
    if (next) {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onKey);
    } else {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    }
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  });

  menu.append(toggle, dropdown);
  return menu;
}
