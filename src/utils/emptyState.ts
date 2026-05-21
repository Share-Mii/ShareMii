import { icon } from '@/utils/icon';

export function createEmptyState(
  iconName: string,
  title: string,
  message: string,
  ctaHtml?: string,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'page-empty-state';
  el.innerHTML = `
    ${icon(iconName)}
    <h3 class="page-empty-state__title">${title}</h3>
    <p>${message}</p>
    ${ctaHtml ?? ''}
  `;
  return el;
}
