import type { EditorCategoryId } from '@/services/miiEditor';
import { EDITOR_CATEGORIES } from '@/services/miiEditor';
import { miiEditorIconForCategory } from '@/services/miiEditorIcons';

export function createCategoryNav(
  activeId: EditorCategoryId,
  onSelect: (id: EditorCategoryId) => void,
): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'mii-maker__cat-rail';
  nav.setAttribute('aria-label', 'Mii editor categories');

  for (const cat of EDITOR_CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isGeneral = cat.id === 'general';
    btn.className = [
      'mii-maker__cat-btn',
      'interactive',
      cat.id === activeId ? 'mii-maker__cat-btn--active' : '',
      isGeneral ? 'mii-maker__cat-btn--general' : '',
    ]
      .filter(Boolean)
      .join(' ');
    btn.setAttribute('aria-label', cat.label);
    btn.setAttribute('title', cat.label);
    btn.setAttribute('aria-pressed', String(cat.id === activeId));
    btn.innerHTML = isGeneral
      ? `<span class="mii-maker__cat-btn-inner">${miiEditorIconForCategory(cat.id)}<span class="mii-maker__cat-label">General</span></span>`
      : miiEditorIconForCategory(cat.id);
    btn.addEventListener('click', () => onSelect(cat.id));
    nav.appendChild(btn);
  }

  return nav;
}

export function updateCategoryNav(
  nav: HTMLElement,
  activeId: EditorCategoryId,
): void {
  nav.querySelectorAll('.mii-maker__cat-btn').forEach((btn, i) => {
    const cat = EDITOR_CATEGORIES[i];
    if (!cat) return;
    const active = cat.id === activeId;
    btn.classList.toggle('mii-maker__cat-btn--active', active);
    btn.setAttribute('aria-pressed', String(active));
    if (cat.id === 'general') {
      btn.classList.add('mii-maker__cat-btn--general');
    }
  });
}
