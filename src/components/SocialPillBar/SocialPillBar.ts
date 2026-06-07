import './SocialPillBar.css';
import '@/styles/chat-bubble.css';
import {
  createIconActionButton,
  type IconActionButtonOptions,
} from '@/components/IconActionButton/IconActionButton';
import { bindChatBubble } from '@/utils/chatBubble';
import { icon } from '@/utils/icon';

export type SocialPillBarOrientation = 'horizontal' | 'vertical';

export interface SocialPillBarOptions {
  items: IconActionButtonOptions[];
  toggleLabel?: string;
  className?: string;
  orientation?: SocialPillBarOrientation;
  toggleIcon?: string;
  bubblePlacement?: 'bottom' | 'left';
}

function stripInlineTooltip(btn: HTMLElement): void {
  btn.querySelector('.chat-tooltip')?.remove();
}

export function createSocialPillBar(opts: SocialPillBarOptions): HTMLElement {
  const orientation = opts.orientation ?? 'horizontal';
  const bubblePlacement =
    opts.bubblePlacement ?? (orientation === 'vertical' ? 'left' : 'bottom');
  const defaultToggleIcon =
    orientation === 'vertical' ? 'chevron-up' : 'chevron-left';
  const customToggleIcon = opts.toggleIcon != null;

  const root = document.createElement('div');
  root.className = [
    'social-pill-bar',
    orientation === 'vertical' ? 'social-pill-bar--vertical' : '',
    opts.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const track = document.createElement('div');
  track.className = 'social-pill-bar__track';
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', 'Social actions');

  const expand = document.createElement('div');
  expand.className = 'social-pill-bar__expand';
  expand.setAttribute('role', 'group');
  expand.setAttribute('aria-label', 'Actions');

  for (const item of opts.items) {
    const btn = createIconActionButton(item);
    stripInlineTooltip(btn);
    bindChatBubble(btn, item.label, { placement: bubblePlacement });
    expand.appendChild(btn);
  }
  track.appendChild(expand);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = [
    'social-pill-bar__toggle',
    'interactive',
    customToggleIcon ? 'social-pill-bar__toggle--custom' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const toggleTip = opts.toggleLabel ?? 'Actions';
  toggle.setAttribute('aria-label', toggleTip);
  toggle.setAttribute('aria-expanded', 'false');
  const closedToggleIcon = opts.toggleIcon ?? defaultToggleIcon;
  if (customToggleIcon) {
    toggle.dataset.closedIcon = closedToggleIcon;
  }
  toggle.innerHTML = icon(closedToggleIcon);

  let open = false;

  function updateToggleIcon(): void {
    if (open) {
      toggle.innerHTML = icon(
        orientation === 'vertical' ? 'chevron-down' : 'chevron-right',
      );
      return;
    }
    const iconName = customToggleIcon
      ? (toggle.dataset.closedIcon ?? closedToggleIcon)
      : closedToggleIcon;
    toggle.innerHTML = icon(iconName);
  }

  const onDocClick = (e: MouseEvent): void => {
    const t = e.target as Node;
    if (root.contains(t)) return;
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false);
  };

  bindChatBubble(
    toggle,
    () => toggle.getAttribute('aria-label') ?? toggleTip,
    { placement: bubblePlacement },
  );

  function setOpen(next: boolean): void {
    open = next;
    root.classList.toggle('social-pill-bar--open', next);
    toggle.setAttribute('aria-expanded', String(next));
    toggle.setAttribute(
      'aria-label',
      next ? 'Hide actions' : toggleTip,
    );
    updateToggleIcon();
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

  track.appendChild(toggle);
  root.appendChild(track);

  return root;
}
