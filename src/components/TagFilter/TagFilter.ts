import './TagFilter.css';
import { searchMiiTags, type MiiTag } from '@/services/social';
import { icon } from '@/utils/icon';

export interface TagFilterHandle {
  root: HTMLElement;
  getSelectedTags: () => MiiTag[];
  removeBySlug: (slug: string) => void;
  clearAll: () => void;
  dispose: () => void;
}

export function createTagFilter(options: {
  onChange: (tags: MiiTag[]) => void;
}): TagFilterHandle {
  const selected: MiiTag[] = [];
  let searchTimer = 0;
  let suggestionsAbort = 0;

  const root = document.createElement('div');
  root.className = 'tag-filter';

  const active = document.createElement('div');
  active.className = 'tag-filter__active';
  active.setAttribute('role', 'list');
  active.setAttribute('aria-label', 'Active tag filters');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'tag-filter__search-wrap';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'tag-filter__search';
  searchInput.placeholder = 'Search tags…';
  searchInput.setAttribute('aria-label', 'Search tags');
  searchInput.autocomplete = 'off';

  const suggestions = document.createElement('ul');
  suggestions.className = 'tag-filter__suggestions';
  suggestions.setAttribute('role', 'listbox');
  suggestions.hidden = true;

  searchWrap.append(searchInput, suggestions);
  root.append(active, searchWrap);

  function notify(): void {
    options.onChange([...selected]);
  }

  function renderActive(): void {
    active.replaceChildren();
    for (const tag of selected) {
      const pill = document.createElement('span');
      pill.className = 'tag-filter__pill';
      pill.setAttribute('role', 'listitem');

      const label = document.createElement('span');
      label.className = 'tag-filter__pill-label';
      label.textContent = tag.label;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-filter__remove interactive';
      removeBtn.setAttribute('aria-label', `Remove tag ${tag.label}`);
      removeBtn.innerHTML = icon('xmark', 'tag-filter__remove-icon');
      removeBtn.addEventListener('click', () => {
        const idx = selected.findIndex((t) => t.slug === tag.slug);
        if (idx >= 0) selected.splice(idx, 1);
        renderActive();
        notify();
        void loadSuggestions(searchInput.value);
      });

      pill.append(label, removeBtn);
      active.appendChild(pill);
    }
  }

  function hideSuggestions(): void {
    suggestions.hidden = true;
    suggestions.replaceChildren();
  }

  function addTag(tag: MiiTag): void {
    if (selected.some((t) => t.slug === tag.slug)) return;
    selected.push(tag);
    searchInput.value = '';
    hideSuggestions();
    renderActive();
    notify();
  }

  function renderSuggestions(matches: MiiTag[]): void {
    const filtered = matches.filter(
      (t) => !selected.some((s) => s.slug === t.slug),
    );
    suggestions.replaceChildren();
    if (!filtered.length) {
      hideSuggestions();
      return;
    }

    for (const tag of filtered) {
      const item = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-filter__suggestion interactive';
      btn.setAttribute('role', 'option');
      btn.textContent = tag.label;
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => addTag(tag));
      item.appendChild(btn);
      suggestions.appendChild(item);
    }
    suggestions.hidden = false;
  }

  async function loadSuggestions(query: string): Promise<void> {
    const run = ++suggestionsAbort;
    const term = query.trim();
    if (!term) {
      hideSuggestions();
      return;
    }

    try {
      const matches = await searchMiiTags(term, 12);
      if (run !== suggestionsAbort) return;
      renderSuggestions(matches);
    } catch {
      if (run !== suggestionsAbort) return;
      hideSuggestions();
    }
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void loadSuggestions(searchInput.value);
    }, 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSuggestions();
      searchInput.blur();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = suggestions.querySelector<HTMLButtonElement>(
      '.tag-filter__suggestion',
    );
    if (first) {
      first.click();
      return;
    }
    void (async () => {
      const matches = await searchMiiTags(searchInput.value.trim(), 1);
      if (matches[0]) addTag(matches[0]);
    })();
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) void loadSuggestions(searchInput.value);
  });

  const onDocumentClick = (e: MouseEvent): void => {
    if (!root.contains(e.target as Node)) hideSuggestions();
  };
  document.addEventListener('click', onDocumentClick);

  return {
    root,
    getSelectedTags: () => [...selected],
    removeBySlug: (slug: string) => {
      const idx = selected.findIndex((t) => t.slug === slug);
      if (idx < 0) return;
      selected.splice(idx, 1);
      renderActive();
      notify();
    },
    clearAll: () => {
      if (!selected.length) return;
      selected.length = 0;
      renderActive();
      notify();
    },
    dispose: () => {
      window.clearTimeout(searchTimer);
      document.removeEventListener('click', onDocumentClick);
    },
  };
}
