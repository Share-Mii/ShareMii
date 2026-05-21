import './UserMenu.css';
import type { Profile } from '@/types';
import { iconSpan } from '@/utils/icon';

export interface UserMenuItem {
  href?: string;
  label: string;
  icon?: string;
  action?: () => void | Promise<void>;
}

export function createUserMenuButton(
  profile: Profile | null,
  onToggle: (open: boolean) => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'user-menu__trigger interactive';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Account menu');

  if (profile?.avatar_url) {
    const img = document.createElement('img');
    img.className = 'user-menu__avatar';
    img.src = profile.avatar_url;
    img.alt = '';
    btn.appendChild(img);
  } else {
    const initial = document.createElement('span');
    initial.className = 'user-menu__avatar user-menu__avatar--initial';
    const ch = profile?.username?.trim()?.[0];
    initial.textContent = ch ? ch.toUpperCase() : '?';
    btn.appendChild(initial);
  }

  const chevron = document.createElement('span');
  chevron.className = 'user-menu__chevron';
  chevron.innerHTML = iconSpan('chevron-down', '');
  btn.appendChild(chevron);

  let open = false;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    btn.setAttribute('aria-expanded', String(open));
    onToggle(open);
  });

  return btn;
}

export function createUserMenuDropdown(
  items: UserMenuItem[],
  onClose: () => void,
): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'user-menu__dropdown';
  menu.setAttribute('role', 'menu');

  for (const item of items) {
    if (item.action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'user-menu__item interactive user-menu__item--action';
      btn.setAttribute('role', 'menuitem');
      if (item.icon) {
        btn.innerHTML = `<span class="user-menu__item-icon" aria-hidden="true">${iconSpan(item.icon, '')}</span><span class="user-menu__item-label">${item.label}</span>`;
      } else {
        btn.textContent = item.label;
      }
      btn.addEventListener('click', () => {
        onClose();
        void Promise.resolve(item.action!());
      });
      menu.appendChild(btn);
      continue;
    }

    const a = document.createElement('a');
    a.href = item.href ?? '#';
    a.className = 'user-menu__item interactive';
    a.setAttribute('role', 'menuitem');
    if (item.icon) {
      a.innerHTML = `<span class="user-menu__item-icon" aria-hidden="true">${iconSpan(item.icon, '')}</span><span class="user-menu__item-label">${item.label}</span>`;
    } else {
      a.textContent = item.label;
    }
    a.addEventListener('click', () => onClose());
    menu.appendChild(a);
  }

  return menu;
}

export function bindUserMenuDismiss(
  trigger: HTMLElement,
  dropdown: HTMLElement,
  onClose: () => void,
): () => void {
  const onDocClick = (e: MouseEvent): void => {
    const t = e.target as Node;
    if (trigger.contains(t) || dropdown.contains(t)) return;
    onClose();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') onClose();
  };

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);

  return () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  };
}
