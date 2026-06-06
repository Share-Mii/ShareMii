import './IconActionButton.css';
import { escapeHtml } from '@/utils/escapeHtml';
import { icon } from '@/utils/icon';

export type IconActionVariant = 'default' | 'accent' | 'danger';

export interface IconActionButtonOptions {
  iconName: string;
  label: string;
  variant?: IconActionVariant;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: (e: MouseEvent) => void;
}

export function createIconActionButton(
  opts: IconActionButtonOptions,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `icon-action interactive icon-action--${opts.variant ?? 'default'}`;
  if (opts.active) {
    btn.classList.add('icon-action--active');
    btn.setAttribute('aria-pressed', 'true');
  }
  if (opts.className) btn.classList.add(opts.className);
  btn.setAttribute('aria-label', opts.label);
  btn.disabled = opts.disabled ?? false;

  btn.innerHTML = `${icon(opts.iconName)}<span class="chat-tooltip" role="tooltip">${escapeHtml(opts.label)}</span>`;

  if (opts.onClick) {
    btn.addEventListener('click', opts.onClick);
  }

  return btn;
}
