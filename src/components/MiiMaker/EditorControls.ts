import type {
  EditorCategory,
  EditorControl,
  EditorCategoryId,
  MiiFields,
} from '@/services/miiEditor';
import {
  EDITOR_CATEGORIES,
  GRID_PAGE_SIZE,
  getNestedField,
} from '@/services/miiEditor';
import { getMiiSwatchColor } from '@/services/miiColorPalettes';
import {
  applyIconThemeVars,
  getPartIconSvg,
  hasPartIcon,
  loadMiiIcons,
  reorderOptionsForDisplay,
  type MiiIconsData,
} from '@/services/miiPartIcons';
import {
  miiEditorIconHtml,
  type MiiEditorIconKey,
} from '@/services/miiEditorIcons';
import { THEME_CHANGE_EVENT } from '@/services/theme';
import { iconSpan } from '@/utils/icon';
import { MII_NAME_MAX } from '@/utils/miiName';

let cachedIcons: MiiIconsData | null = null;

async function getMiiIcons(): Promise<MiiIconsData> {
  if (cachedIcons) return cachedIcons;
  cachedIcons = await loadMiiIcons();
  return cachedIcons;
}

export interface EditorControlsCallbacks {
  onChange: (fields: MiiFields, path: string, value: unknown) => void;
  getFields: () => MiiFields;
}

export interface EditorWorkspaceHandle {
  root: HTMLElement;
  resetPanels: () => void;

  sync: (fields: MiiFields) => void;
  destroy?: () => void;
}

function findCategory(id: EditorCategoryId): EditorCategory {
  const cat = EDITOR_CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: ${id}`);
  return cat;
}

function isColorControl(control: EditorControl): boolean {
  return (
    control.path.includes('.color') ||
    control.path.includes('favoriteColor') ||
    /color/i.test(control.label)
  );
}

function isTabbedChoice(control: EditorControl): boolean {
  return control.type === 'choice' && !isColorControl(control);
}

function nudgesForSlider(control: EditorControl): {
  editorIcon: MiiEditorIconKey;
  label: string;
  delta: number;
}[] {
  const path = control.path;
  if (path.endsWith('yPosition')) {
    return [
      { editorIcon: 'positionMoveUp', label: 'Up', delta: -1 },
      { editorIcon: 'positionMoveDown', label: 'Down', delta: 1 },
    ];
  }
  if (path === 'general.height') {
    return [
      { editorIcon: 'scaleShort', label: 'Shorter', delta: -1 },
      { editorIcon: 'scaleTall', label: 'Taller', delta: 1 },
    ];
  }
  if (path === 'general.weight') {
    return [
      { editorIcon: 'scaleThin', label: 'Thinner', delta: -1 },
      { editorIcon: 'scaleFat', label: 'Heavier', delta: 1 },
    ];
  }
  if (path.endsWith('size')) {
    return [
      { editorIcon: 'positionSizeDown', label: 'Smaller', delta: -1 },
      { editorIcon: 'positionSizeUp', label: 'Bigger', delta: 1 },
    ];
  }
  if (path.endsWith('distanceApart') || path.endsWith('xPosition')) {
    return [
      { editorIcon: 'positionPushIn', label: 'Closer', delta: -1 },
      { editorIcon: 'positionPushOut', label: 'Wider', delta: 1 },
    ];
  }
  if (path.endsWith('rotation')) {
    return [
      { editorIcon: 'positionRotateCCW', label: 'Left', delta: -1 },
      { editorIcon: 'positionRotateCW', label: 'Right', delta: 1 },
    ];
  }
  if (path.endsWith('squash')) {
    return [
      { editorIcon: 'positionSizeDown', label: 'Flatter', delta: -1 },
      { editorIcon: 'positionSizeUp', label: 'Stretch', delta: 1 },
    ];
  }
  return [
    { editorIcon: 'positionSizeDown', label: 'Less', delta: -1 },
    { editorIcon: 'positionSizeUp', label: 'More', delta: 1 },
  ];
}

function clampNumber(control: EditorControl, value: number): number {
  const min = control.min ?? 0;
  const max = control.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampSlider(control: EditorControl, value: number): number {
  const min = control.min ?? 0;
  const max = control.max ?? 127;
  return Math.min(max, Math.max(min, value));
}

function sliderLabelText(label: string, value: unknown, fallback = 0): string {
  const n = Number(value);
  const display = Number.isFinite(n) ? n : fallback;
  return `${label} (${display})`;
}

function setActiveOption(
  container: HTMLElement,
  cellSelector: string,
  activeClass: string,
  current: unknown,
): void {
  container.querySelectorAll<HTMLElement>(cellSelector).forEach((el) => {
    const raw = el.dataset.optionValue;
    const value =
      raw === 'true' ? true : raw === 'false' ? false : Number(raw);
    const active = value === current;
    el.classList.toggle(activeClass, active);
    el.setAttribute('aria-pressed', String(active));
  });
}

export function createEditorWorkspace(
  categoryId: EditorCategoryId,
  fields: MiiFields,
  callbacks: EditorControlsCallbacks,
): EditorWorkspaceHandle {
  const cat = findCategory(categoryId);
  const isGeneral = categoryId === 'general';
  const tabbedChoices = isGeneral
    ? []
    : cat.controls.filter(isTabbedChoice);
  const gridPages = new Map<string, number>();
  let activeTabIndex = 0;

  const root = document.createElement('div');
  root.className = 'mii-maker__workspace';

  const tabs = document.createElement('div');
  tabs.className = 'mii-maker__subtabs app-tab-bar';
  tabs.setAttribute('role', 'tablist');
  if (isGeneral) tabs.hidden = true;

  const body = document.createElement('div');
  body.className = 'mii-maker__workspace-body';

  const pickerHost = document.createElement('div');
  pickerHost.className = 'mii-maker__picker-host';

  const detailSidebar = document.createElement('aside');
  detailSidebar.className = 'mii-maker__detail-sidebar';
  detailSidebar.setAttribute('aria-label', 'Colors and adjustments');
  if (isGeneral) detailSidebar.hidden = true;

  body.append(pickerHost, detailSidebar);
  root.append(tabs, body);

  function sync(fields: MiiFields): void {
    applyIconThemeVars(pickerHost, fields);

    for (const section of root.querySelectorAll<HTMLElement>(
      '[data-control-path]',
    )) {
      const path = section.dataset.controlPath!;
      const control = cat.controls.find((c) => c.path === path);
      if (!control) continue;

      if (isColorControl(control)) {
        setActiveOption(
          section,
          '.mii-maker__swatch',
          'mii-maker__swatch--active',
          getNestedField(fields, path),
        );
      } else if (control.type === 'choice') {
        const value = getNestedField(fields, path);
        if (section.querySelector('.mii-maker__compact-option')) {
          setActiveOption(
            section,
            '.mii-maker__compact-option',
            'mii-maker__compact-option--active',
            value,
          );
        } else {
          setActiveOption(
            section,
            '.mii-maker__asset-cell',
            'mii-maker__asset-cell--active',
            value,
          );
        }
      } else if (control.type === 'toggle') {
        setActiveOption(
          section,
          '.mii-maker__toggle-option',
          'mii-maker__toggle-option--active',
          getNestedField(fields, path),
        );
      }
    }

    for (const block of root.querySelectorAll<HTMLElement>('[data-slider-path]')) {
      const path = block.dataset.sliderPath!;
      const control = cat.controls.find((c) => c.path === path);
      const labelEl = block.querySelector('.mii-maker__panel-label');
      if (labelEl && control?.type === 'slider') {
        labelEl.textContent = sliderLabelText(
          control.label,
          getNestedField(fields, path),
          control.min ?? 0,
        );
      }
    }

    for (const block of root.querySelectorAll<HTMLElement>('[data-range-path]')) {
      const path = block.dataset.rangePath!;
      const control = cat.controls.find((c) => c.path === path);
      const input = block.querySelector<HTMLInputElement>('.mii-maker__range-input');
      if (!input || control?.type !== 'slider') continue;
      const raw = getNestedField(fields, path);
      const n = Number(raw);
      input.value = String(Number.isFinite(n) ? clampSlider(control, n) : control.min ?? 0);
    }

    for (const block of root.querySelectorAll<HTMLElement>('[data-number-path]')) {
      const path = block.dataset.numberPath!;
      const input = block.querySelector<HTMLInputElement>('.mii-maker__birth-input');
      if (!input) continue;
      const raw = getNestedField(fields, path);
      const n = Number(raw);
      input.value = Number.isFinite(n) && n > 0 ? String(n) : '';
    }
  }

  function mountColorSection(control: EditorControl, host: HTMLElement): void {
    const section = document.createElement('div');
    section.className = 'mii-maker__control-section mii-maker__color-panel';
    section.dataset.controlPath = control.path;

    const heading = document.createElement('span');
    heading.className = 'mii-maker__panel-label';
    heading.textContent = control.label;

    const swatches = document.createElement('div');
    swatches.className = 'mii-maker__swatches';

    const options = reorderOptionsForDisplay(
      control.path,
      control.options ?? [],
    );

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mii-maker__swatch interactive';
      btn.dataset.optionValue = String(opt.value);
      btn.setAttribute('aria-label', `${control.label} ${opt.label}`);
      const idx = Number(opt.value);
      btn.style.backgroundColor = getMiiSwatchColor(control.path, idx);
      btn.addEventListener('click', () => {
        callbacks.onChange(callbacks.getFields(), control.path, opt.value);
      });
      swatches.appendChild(btn);
    }

    section.append(heading, swatches);
    host.appendChild(section);
  }

  function mountToggleSection(control: EditorControl, host: HTMLElement): void {
    const section = document.createElement('div');
    section.className = 'mii-maker__control-section';
    section.dataset.controlPath = control.path;

    const heading = document.createElement('span');
    heading.className = 'mii-maker__panel-label';
    heading.textContent = control.label;

    const group = document.createElement('div');
    group.className = 'mii-maker__toggle-grid mii-maker__toggle-grid--side';
    for (const opt of control.options ?? []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mii-maker__toggle-option interactive';
      btn.dataset.optionValue = String(opt.value);
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        callbacks.onChange(callbacks.getFields(), control.path, opt.value);
      });
      group.appendChild(btn);
    }

    section.append(heading, group);
    host.appendChild(section);
  }

  function mountTextSection(control: EditorControl, host: HTMLElement): void {
    const section = document.createElement('div');
    section.className = 'mii-maker__control-section';
    section.dataset.controlPath = control.path;

    const heading = document.createElement('span');
    heading.className = 'mii-maker__panel-label';
    heading.textContent = control.label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'mii-maker__name-input mii-maker__name-input--wide';
    input.maxLength = MII_NAME_MAX;
    input.value = String(getNestedField(callbacks.getFields(), control.path) ?? '');
    input.placeholder = 'Mii name';
    input.addEventListener('change', () => {
      callbacks.onChange(
        callbacks.getFields(),
        control.path,
        input.value.trim() || 'Mii',
      );
    });

    section.append(heading, input);
    host.appendChild(section);
  }

  function mountRangeSliderSection(
    control: EditorControl,
    host: HTMLElement,
    orientation: 'horizontal' | 'vertical' = 'horizontal',
  ): void {
    const block = document.createElement('div');
    block.className = [
      'mii-maker__control-section',
      'mii-maker__range-block',
      orientation === 'vertical' ? 'mii-maker__range-block--vertical' : '',
    ]
      .filter(Boolean)
      .join(' ');
    block.dataset.rangePath = control.path;

    const nudges = nudgesForSlider(control);
    const low = nudges[0];
    const high = nudges[1];

    const lowCap = document.createElement('span');
    lowCap.className = 'mii-maker__range-cap';
    if (low) {
      lowCap.innerHTML = miiEditorIconHtml(
        low.editorIcon,
        'mii-editor-icon mii-maker__range-cap-icon',
      );
      lowCap.title = low.label;
    }

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'mii-maker__range-input';
    input.min = String(control.min ?? 0);
    input.max = String(control.max ?? 127);
    input.setAttribute('aria-label', control.label);
    const raw = getNestedField(callbacks.getFields(), control.path);
    const n = Number(raw);
    input.value = String(
      Number.isFinite(n) ? clampSlider(control, n) : control.min ?? 0,
    );

    input.addEventListener('input', () => {
      callbacks.onChange(
        callbacks.getFields(),
        control.path,
        clampSlider(control, Number(input.value)),
      );
    });

    const highCap = document.createElement('span');
    highCap.className = 'mii-maker__range-cap';
    if (high) {
      highCap.innerHTML = miiEditorIconHtml(
        high.editorIcon,
        'mii-editor-icon mii-maker__range-cap-icon',
      );
      highCap.title = high.label;
    }

    const label = document.createElement('span');
    label.className = 'mii-maker__range-label';
    label.textContent = control.label;

    block.append(lowCap, input, highCap, label);
    host.appendChild(block);
  }

  function mountSliderSection(control: EditorControl, host: HTMLElement): void {
    const block = document.createElement('div');
    block.className = 'mii-maker__control-section mii-maker__adjust-block';
    block.dataset.sliderPath = control.path;

    const label = document.createElement('span');
    label.className = 'mii-maker__panel-label';
    label.textContent = sliderLabelText(
      control.label,
      getNestedField(callbacks.getFields(), control.path),
      control.min ?? 0,
    );

    const grid = document.createElement('div');
    grid.className = 'mii-maker__nudge-grid';

    for (const nudge of nudgesForSlider(control)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mii-maker__nudge-btn interactive';
      btn.title = nudge.label;
      btn.innerHTML = miiEditorIconHtml(nudge.editorIcon, 'mii-editor-icon mii-maker__nudge-icon');
      btn.addEventListener('click', () => {
        const cur = Number(
          getNestedField(callbacks.getFields(), control.path) ??
            control.min ??
            0,
        );
        callbacks.onChange(
          callbacks.getFields(),
          control.path,
          clampSlider(control, cur + nudge.delta),
        );
      });
      grid.appendChild(btn);
    }

    block.append(label, grid);
    host.appendChild(block);
  }

  function mountNumberInputSection(
    control: EditorControl,
    host: HTMLElement,
  ): void {
    const section = document.createElement('div');
    section.className = 'mii-maker__control-section mii-maker__birth-field';
    section.dataset.numberPath = control.path;

    const heading = document.createElement('span');
    heading.className = 'mii-maker__panel-label';
    heading.textContent = control.label;

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'bday-day';
    if (control.path.endsWith('birthMonth')) input.autocomplete = 'bday-month';
    if (control.path.endsWith('birthYear')) input.autocomplete = 'bday-year';
    input.className = 'mii-maker__birth-input';
    input.placeholder = control.placeholder ?? '';
    input.setAttribute('aria-label', control.label);
    const maxLen =
      control.max != null && control.max <= 31
        ? 2
        : control.max != null && control.max <= 9999
          ? 4
          : 6;
    input.maxLength = maxLen;

    const raw = getNestedField(callbacks.getFields(), control.path);
    const n = Number(raw);
    input.value = Number.isFinite(n) && n > 0 ? String(n) : '';

    const commit = () => {
      const trimmed = input.value.trim();
      if (!trimmed) {
        const cur = getNestedField(callbacks.getFields(), control.path);
        const curN = Number(cur);
        input.value =
          Number.isFinite(curN) && curN > 0 ? String(curN) : '';
        return;
      }
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed)) {
        input.value = '';
        return;
      }
      const clamped = clampNumber(control, parsed);
      input.value = String(clamped);
      callbacks.onChange(callbacks.getFields(), control.path, clamped);
    };

    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);

    section.append(heading, input);
    host.appendChild(section);
  }

  function mountCompactChoiceSection(
    control: EditorControl,
    host: HTMLElement,
  ): void {
    const section = document.createElement('div');
    section.className =
      'mii-maker__control-section mii-maker__compact-choice';
    section.dataset.controlPath = control.path;

    const heading = document.createElement('span');
    heading.className = 'mii-maker__panel-label';
    heading.textContent = control.label;

    const grid = document.createElement('div');
    grid.className = 'mii-maker__compact-grid';

    for (const opt of control.options ?? []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mii-maker__compact-option interactive';
      btn.dataset.optionValue = String(opt.value);
      btn.textContent = opt.label;
      btn.setAttribute('aria-label', `${control.label} ${opt.label}`);
      btn.addEventListener('click', () => {
        callbacks.onChange(callbacks.getFields(), control.path, opt.value);
      });
      grid.appendChild(btn);
    }

    section.append(heading, grid);
    host.appendChild(section);
  }

  function mountChoiceSection(
    control: EditorControl,
    host: HTMLElement,
    opts: { showLabel?: boolean } = {},
  ): void {
    const section = document.createElement('div');
    section.className = 'mii-maker__control-section mii-maker__choice-section';
    section.dataset.controlPath = control.path;

    const heading = document.createElement('span');
    heading.className = 'mii-maker__panel-label';
    heading.textContent = control.label;
    if (!(opts.showLabel ?? false)) heading.hidden = true;

    const options = reorderOptionsForDisplay(
      control.path,
      control.options ?? [],
    );
    const usePartIcons = hasPartIcon(control.path);
    const totalPages = Math.max(1, Math.ceil(options.length / GRID_PAGE_SIZE));

    const picker = document.createElement('div');
    picker.className = 'mii-maker__picker';

    const gridHost = document.createElement('div');
    gridHost.className = 'mii-maker__choice-grid-host';

    function renderGridPage(): void {
      const safePage = Math.min(
        gridPages.get(control.path) ?? 0,
        totalPages - 1,
      );
      gridPages.set(control.path, safePage);

      const slice = options.slice(
        safePage * GRID_PAGE_SIZE,
        safePage * GRID_PAGE_SIZE + GRID_PAGE_SIZE,
      );

      gridHost.replaceChildren();

      const pager = picker.querySelector('.mii-maker__pager');
      if (pager) {
        const prev = pager.querySelector<HTMLButtonElement>(
          '.mii-maker__pager-btn:first-child',
        );
        const next = pager.querySelector<HTMLButtonElement>(
          '.mii-maker__pager-btn:last-child',
        );
        const pageLabel = pager.querySelector('.mii-maker__pager-label');
        if (prev) prev.disabled = safePage <= 0;
        if (next) next.disabled = safePage >= totalPages - 1;
        if (pageLabel) {
          pageLabel.textContent = `Page ${safePage + 1} of ${totalPages}`;
        }
      }

      const grid = document.createElement('div');
      grid.className = 'mii-maker__asset-grid';

      const mountCells = (icons: MiiIconsData | null): void => {
        for (let cellIndex = 0; cellIndex < slice.length; cellIndex++) {
          const opt = slice[cellIndex]!;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mii-maker__asset-cell interactive';
          btn.dataset.optionValue = String(opt.value);
          btn.style.setProperty('--cell-index', String(cellIndex));
          btn.setAttribute('aria-label', `${control.label} ${opt.label}`);
          btn.addEventListener('click', () => {
            callbacks.onChange(callbacks.getFields(), control.path, opt.value);
          });

          if (usePartIcons && icons && typeof opt.value === 'number') {
            const svg = getPartIconSvg(icons, control.path, opt.value);
            if (svg) {
              const wrap = document.createElement('div');
              wrap.className = 'mii-maker__part-icon';
              wrap.innerHTML = svg;
              btn.appendChild(wrap);
            } else {
              const fallback = document.createElement('span');
              fallback.className = 'mii-maker__asset-thumb--num';
              fallback.textContent = opt.label;
              btn.appendChild(fallback);
            }
          } else {
            const fallback = document.createElement('span');
            fallback.className = 'mii-maker__asset-thumb--num';
            fallback.textContent = opt.label;
            btn.appendChild(fallback);
          }

          grid.appendChild(btn);
        }
        gridHost.appendChild(grid);
        sync(callbacks.getFields());
      };

      if (usePartIcons) {
        void getMiiIcons()
          .then((icons) => {
            if (!section.isConnected) return;
            mountCells(icons);
          })
          .catch(() => {
            if (!section.isConnected) return;
            mountCells(null);
          });
        return;
      }

      mountCells(null);
    }

    if (totalPages > 1) {
      const pager = document.createElement('div');
      pager.className = 'mii-maker__pager';

      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'mii-maker__pager-btn interactive';
      prev.innerHTML = iconSpan('chevron-left');
      prev.addEventListener('click', () => {
        const cur = gridPages.get(control.path) ?? 0;
        gridPages.set(control.path, Math.max(0, cur - 1));
        renderGridPage();
      });

      const pageLabel = document.createElement('span');
      pageLabel.className = 'mii-maker__pager-label';

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'mii-maker__pager-btn interactive';
      next.innerHTML = iconSpan('chevron-right');
      next.addEventListener('click', () => {
        const cur = gridPages.get(control.path) ?? 0;
        gridPages.set(control.path, Math.min(totalPages - 1, cur + 1));
        renderGridPage();
      });

      pager.append(prev, pageLabel, next);
      picker.append(gridHost, pager);
    } else {
      picker.appendChild(gridHost);
    }
    section.append(heading, picker);
    host.appendChild(section);
    renderGridPage();
  }

  function updateTabHighlight(): void {
    tabs.querySelectorAll('.app-tab').forEach((tab, i) => {
      const active = i === activeTabIndex;
      tab.classList.toggle('app-tab--active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function mountTabs(): void {
    tabs.replaceChildren();
    if (tabbedChoices.length <= 1) return;

    tabbedChoices.forEach((ctrl, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'app-tab interactive';
      tab.textContent = ctrl.label;
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', () => {
        if (activeTabIndex === i) return;
        activeTabIndex = i;
        updateTabHighlight();
        mountActivePicker();
        sync(callbacks.getFields());
      });
      tabs.appendChild(tab);
    });
    updateTabHighlight();
  }

  function mountActivePicker(): void {
    pickerHost.replaceChildren();
    if (activeTabIndex >= tabbedChoices.length) activeTabIndex = 0;
    const control = tabbedChoices[activeTabIndex];
    if (!control) return;
    mountChoiceSection(control, pickerHost);
  }

  function mountDetailSidebar(): void {
    detailSidebar.replaceChildren();
    let hasDetail = false;

    for (const control of cat.controls) {
      if (isTabbedChoice(control)) continue;
      if (isColorControl(control)) {
        mountColorSection(control, detailSidebar);
        hasDetail = true;
        continue;
      }
      switch (control.type) {
        case 'text':
          mountTextSection(control, detailSidebar);
          hasDetail = true;
          break;
        case 'toggle':
          mountToggleSection(control, detailSidebar);
          hasDetail = true;
          break;
        case 'slider':
          mountSliderSection(control, detailSidebar);
          hasDetail = true;
          break;
        case 'choice':
          mountCompactChoiceSection(control, detailSidebar);
          hasDetail = true;
          break;
      }
    }

    detailSidebar.hidden = !hasDetail;
    if (!hasDetail) {
      const empty = document.createElement('p');
      empty.className = 'mii-maker__detail-empty';
      empty.textContent = 'Pick a style to customize colors and position.';
      detailSidebar.appendChild(empty);
      detailSidebar.hidden = false;
    }
  }

  function controlByPath(path: string): EditorControl | undefined {
    return cat.controls.find((c) => c.path === path);
  }

  function mountGeneralRow(
    label: string,
    host: HTMLElement,
  ): HTMLElement {
    const row = document.createElement('section');
    row.className = 'mii-maker__general-row';

    const heading = document.createElement('h3');
    heading.className = 'mii-maker__general-row-label';
    heading.textContent = label;

    const rowBody = document.createElement('div');
    rowBody.className = 'mii-maker__general-row-body';
    row.append(heading, rowBody);
    host.appendChild(row);
    return rowBody;
  }

  function mountGeneralHub(): void {
    pickerHost.replaceChildren();
    body.classList.add('mii-maker__workspace-body--general');

    const studio = document.createElement('div');
    studio.className = 'mii-maker__general-studio';
    studio.setAttribute('aria-label', 'General Mii settings');

    const settings = document.createElement('div');
    settings.className = 'mii-maker__general-settings';

    const genderCtrl = controlByPath('general.gender');
    if (genderCtrl) {
      const rowBody = mountGeneralRow('Gender', settings);
      mountToggleSection(genderCtrl, rowBody);
      rowBody.querySelector('.mii-maker__panel-label')?.remove();
    }

    const favCtrl = controlByPath('general.favoriteColor');
    if (favCtrl) {
      const rowBody = mountGeneralRow('Favorite color', settings);
      mountColorSection(favCtrl, rowBody);
      rowBody.querySelector('.mii-maker__panel-label')?.remove();
      rowBody.querySelector('.mii-maker__swatches')?.classList.add(
        'mii-maker__swatches--favorite',
      );
    }

    const heightCtrl = controlByPath('general.height');
    const weightCtrl = controlByPath('general.weight');
    if (heightCtrl || weightCtrl) {
      const rowBody = mountGeneralRow('Size', settings);
      const sizeSliders = document.createElement('div');
      sizeSliders.className = 'mii-maker__general-size-sliders';
      if (heightCtrl) mountRangeSliderSection(heightCtrl, sizeSliders, 'vertical');
      if (weightCtrl) mountRangeSliderSection(weightCtrl, sizeSliders, 'horizontal');
      rowBody.appendChild(sizeSliders);
    }

    const monthCtrl = controlByPath('general.birthMonth');
    const dayCtrl = controlByPath('general.birthday');
    const yearCtrl = controlByPath('miic.birthYear');
    if (monthCtrl || dayCtrl || yearCtrl) {
      const rowBody = mountGeneralRow('Birthday', settings);
      const birthGrid = document.createElement('div');
      birthGrid.className = 'mii-maker__general-birth';
      if (monthCtrl) mountNumberInputSection(monthCtrl, birthGrid);
      if (dayCtrl) mountNumberInputSection(dayCtrl, birthGrid);
      if (yearCtrl) mountNumberInputSection(yearCtrl, birthGrid);
      rowBody.appendChild(birthGrid);
      for (const field of rowBody.querySelectorAll('.mii-maker__birth-field')) {
        field.querySelector('.mii-maker__panel-label')?.remove();
      }
    }

    studio.appendChild(settings);
    pickerHost.appendChild(studio);
  }

  function mountPanel(): void {
    applyIconThemeVars(pickerHost, callbacks.getFields());
    if (isGeneral) {
      mountGeneralHub();
      detailSidebar.hidden = true;
      return;
    }

    body.classList.remove('mii-maker__workspace-body--general');
    mountTabs();
    mountDetailSidebar();

    if (tabbedChoices.length === 0) {
      pickerHost.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'mii-maker__picker-empty';
      empty.textContent = 'No style options in this category.';
      pickerHost.appendChild(empty);
    } else {
      mountActivePicker();
    }
  }

  mountPanel();
  sync(fields);

  const onThemeChange = (): void => {
    applyIconThemeVars(pickerHost, callbacks.getFields());
  };
  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

  return {
    root,
    resetPanels: () => {
      activeTabIndex = 0;
      gridPages.clear();
      mountPanel();
      sync(callbacks.getFields());
    },
    sync,
    destroy: () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    },
  };
}
