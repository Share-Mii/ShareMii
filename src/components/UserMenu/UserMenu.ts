import './UserMenu.css';
import type { Profile } from '@/types';
import { iconSpan } from '@/utils/icon';

export type UserMenuItem =
  | { kind: 'separator' }
  | { kind: 'header'; href: string; username: string; profile: Profile | null }
  | { kind: 'section'; label: string }
  | {
      kind?: 'item';
      href?: string;
      label: string;
      icon?: string;
      variant?: 'default' | 'danger';
      action?: () => void | Promise<void>;
    };

const MOBILE_MENU_MQ = '(max-width: 768px)';

function isMobileMenu(): boolean {
  return window.matchMedia(MOBILE_MENU_MQ).matches;
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

function appendMenuItem(
  menu: HTMLElement,
  item: UserMenuItem,
  onClose: () => void,
): void {
  if (item.kind === 'separator') {
    const sep = document.createElement('div');
    sep.className = 'user-menu__separator';
    sep.setAttribute('role', 'separator');
    menu.appendChild(sep);
    return;
  }

  if (item.kind === 'section') {
    const label = document.createElement('div');
    label.className = 'user-menu__section-label';
    label.textContent = item.label;
    menu.appendChild(label);
    return;
  }

  if (item.kind === 'header') {
    const header = document.createElement('a');
    header.href = item.href;
    header.className = 'user-menu__header interactive';
    header.setAttribute('role', 'menuitem');

    if (item.profile?.avatar_url) {
      const img = document.createElement('img');
      img.className = 'user-menu__header-avatar';
      img.src = item.profile.avatar_url;
      img.alt = '';
      header.appendChild(img);
    } else {
      const initial = document.createElement('span');
      initial.className =
        'user-menu__header-avatar user-menu__avatar--initial';
      const ch = item.username.trim()[0];
      initial.textContent = ch ? ch.toUpperCase() : '?';
      header.appendChild(initial);
    }

    const text = document.createElement('span');
    text.className = 'user-menu__header-text';
    text.innerHTML = `<span class="user-menu__header-username">@${item.username}</span><span class="user-menu__header-sub">View profile</span>`;
    header.appendChild(text);
    header.addEventListener('click', () => onClose());
    menu.appendChild(header);
    return;
  }

  const variantClass =
    item.variant === 'danger' ? ' user-menu__item--danger' : '';

  if (item.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `user-menu__item interactive user-menu__item--action${variantClass}`;
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
    return;
  }

  const a = document.createElement('a');
  a.href = item.href ?? '#';
  a.className = `user-menu__item interactive${variantClass}`;
  a.setAttribute('role', 'menuitem');
  if (item.href?.startsWith('http')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  if (item.icon) {
    a.innerHTML = `<span class="user-menu__item-icon" aria-hidden="true">${iconSpan(item.icon, '')}</span><span class="user-menu__item-label">${item.label}</span>`;
  } else {
    a.textContent = item.label;
  }
  a.addEventListener('click', () => onClose());
  menu.appendChild(a);
}

export function createUserMenuDropdown(
  items: UserMenuItem[],
  onClose: () => void,
): HTMLElement {
  const useSheet = isMobileMenu();

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'user-menu__backdrop';
  backdrop.setAttribute('aria-label', 'Close menu');
  backdrop.hidden = !useSheet;

  const panel = document.createElement('div');
  panel.className = useSheet
    ? 'user-menu__sheet'
    : 'user-menu__dropdown';
  panel.setAttribute('role', useSheet ? 'dialog' : 'menu');
  panel.setAttribute('aria-modal', useSheet ? 'true' : 'false');
  if (useSheet) {
    panel.setAttribute('aria-label', 'Account menu');
  }

  const menu = document.createElement('div');
  menu.className = 'user-menu__menu';

  for (const item of items) {
    appendMenuItem(menu, item, onClose);
  }

  panel.appendChild(menu);

  if (useSheet) {
    const shell = document.createElement('div');
    shell.className = 'user-menu__sheet-shell';
    shell.append(backdrop, panel);
    backdrop.addEventListener('click', onClose);
    requestAnimationFrame(() => {
      shell.classList.add('user-menu__sheet-shell--open');
    });
    return shell;
  }

  return panel;
}

export function bindUserMenuDismiss(
  trigger: HTMLElement,
  dropdown: HTMLElement,
  onClose: () => void,
): () => void {
  const panel = dropdown.classList.contains('user-menu__sheet-shell')
    ? dropdown.querySelector<HTMLElement>('.user-menu__sheet')!
    : dropdown;

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

  if (dropdown.classList.contains('user-menu__sheet-shell')) {
    const backdrop = dropdown.querySelector<HTMLButtonElement>(
      '.user-menu__backdrop',
    );
    const sheetClose = (): void => {
      dropdown.classList.remove('user-menu__sheet-shell--open');
      window.setTimeout(onClose, 180);
    };
    backdrop?.addEventListener('click', sheetClose);

    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      backdrop?.removeEventListener('click', sheetClose);
      dropdown.classList.remove('user-menu__sheet-shell--open');
    };
  }

  void panel;

  return () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  };
}
