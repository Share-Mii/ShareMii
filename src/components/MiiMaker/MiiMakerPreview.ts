import { createLiveMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { MII_STANDARD_VIEWS } from '@/services/miiViews';
import { miiEditorIconHtml } from '@/services/miiEditorIcons';
import { MII_NAME_MAX } from '@/utils/miiName';

export interface MiiMakerPreviewCallbacks {
  onSizeChange?: (path: 'general.height' | 'general.weight', value: number) => void;
  onViewportChange?: () => void;
}

export interface MiiMakerPreviewHandle {
  root: HTMLElement;
  nameInput: HTMLInputElement;
  setMiiData: (base64: string) => void;
  flashUpdate: () => void;
  setGeneralMode: (enabled: boolean) => void;
  syncSizeSliders: (height: number, weight: number) => void;
}

const HERO_VIEW = MII_STANDARD_VIEWS[0]!;
const ANGLE_VIEWS = MII_STANDARD_VIEWS.slice(1);
const SIZE_MIN = 0;
const SIZE_MAX = 127;
const SIZE_VIEW_H_MIN = 200;
const SIZE_VIEW_H_MAX = 420;
const SIZE_BODY_RENDER_WIDTH = 512;

export function createMiiMakerPreview(
  initialBase64: string,
  previewCallbacks: MiiMakerPreviewCallbacks = {},
): MiiMakerPreviewHandle {
  const card = document.createElement('div');
  card.className = 'mii-maker__preview-card';

  const bento = document.createElement('div');
  bento.className = 'mii-maker__preview-bento';

  const sizeStudio = document.createElement('div');
  sizeStudio.className = 'mii-maker__size-studio';
  sizeStudio.hidden = true;

  const heightRail = document.createElement('div');
  heightRail.className = 'mii-maker__size-rail mii-maker__size-rail--height';
  heightRail.setAttribute('aria-label', 'Height');

  const heightTop = document.createElement('span');
  heightTop.className = 'mii-maker__size-cap';
  heightTop.innerHTML = miiEditorIconHtml('scaleTall', 'mii-editor-icon mii-maker__size-cap-icon');
  heightTop.title = 'Taller';

  const heightSlider = document.createElement('input');
  heightSlider.type = 'range';
  heightSlider.className = 'mii-maker__size-slider mii-maker__size-slider--height';
  heightSlider.min = String(SIZE_MIN);
  heightSlider.max = String(SIZE_MAX);
  heightSlider.setAttribute('aria-label', 'Height');

  const heightBottom = document.createElement('span');
  heightBottom.className = 'mii-maker__size-cap';
  heightBottom.innerHTML = miiEditorIconHtml('scaleShort', 'mii-editor-icon mii-maker__size-cap-icon');
  heightBottom.title = 'Shorter';

  heightRail.append(heightTop, heightSlider, heightBottom);

  const sizeMii = document.createElement('div');
  sizeMii.className = 'mii-maker__size-mii';

  const weightRail = document.createElement('div');
  weightRail.className = 'mii-maker__size-rail mii-maker__size-rail--weight';
  weightRail.setAttribute('aria-label', 'Build');

  const weightLeft = document.createElement('span');
  weightLeft.className = 'mii-maker__size-cap';
  weightLeft.innerHTML = miiEditorIconHtml('scaleThin', 'mii-editor-icon mii-maker__size-cap-icon');
  weightLeft.title = 'Thinner';

  const weightSlider = document.createElement('input');
  weightSlider.type = 'range';
  weightSlider.className = 'mii-maker__size-slider mii-maker__size-slider--weight';
  weightSlider.min = String(SIZE_MIN);
  weightSlider.max = String(SIZE_MAX);
  weightSlider.setAttribute('aria-label', 'Build');

  const weightRight = document.createElement('span');
  weightRight.className = 'mii-maker__size-cap';
  weightRight.innerHTML = miiEditorIconHtml('scaleFat', 'mii-editor-icon mii-maker__size-cap-icon');
  weightRight.title = 'Heavier';

  weightRail.append(weightLeft, weightSlider, weightRight);

  const stage = document.createElement('div');
  stage.className = 'mii-maker__preview-stage';

  const grid = document.createElement('div');
  grid.className = 'mii-maker__preview-grid';

  const liveRenderers: Array<ReturnType<typeof createLiveMiiRenderer>> = [];

  const hero = document.createElement('div');
  hero.className = 'mii-maker__preview-hero';
  const heroLabel = document.createElement('span');
  heroLabel.className = 'mii-maker__preview-view-label';
  heroLabel.textContent = HERO_VIEW.label;
  const heroSlot = document.createElement('div');
  heroSlot.className = 'mii-maker__preview-slot mii-maker__preview-slot--hero';
  const heroLive = createLiveMiiRenderer({
    miiData: initialBase64,
    width: SIZE_BODY_RENDER_WIDTH,
    alt: `Mii preview, ${HERO_VIEW.label}`,
    type: 'face',
    view: HERO_VIEW,
    className: 'mii-maker__preview-render',
  });
  heroSlot.appendChild(heroLive.root);
  hero.append(heroLabel, heroSlot);
  liveRenderers.push(heroLive);

  const angles = document.createElement('div');
  angles.className = 'mii-maker__preview-angles';

  for (const view of ANGLE_VIEWS) {
    const cell = document.createElement('div');
    cell.className = 'mii-maker__preview-angle';

    const label = document.createElement('span');
    label.className = 'mii-maker__preview-view-label';
    label.textContent = view.label;

    const slot = document.createElement('div');
    slot.className = 'mii-maker__preview-slot mii-maker__preview-slot--angle';

    const live = createLiveMiiRenderer({
      miiData: initialBase64,
      width: 160,
      alt: `Mii preview, ${view.label}`,
      type: 'face',
      view,
      className: 'mii-maker__preview-render',
    });
    slot.appendChild(live.root);
    cell.append(label, slot);
    angles.appendChild(cell);
    liveRenderers.push(live);
  }

  grid.append(hero, angles);
  stage.appendChild(grid);
  bento.append(stage);

  sizeStudio.append(heightRail, sizeMii, weightRail);
  bento.append(sizeStudio);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'mii-maker__name-input';
  nameInput.maxLength = MII_NAME_MAX;
  nameInput.placeholder = 'Mii name';
  nameInput.value = 'Mii';
  nameInput.setAttribute('aria-label', 'Mii name');

  bento.append(nameInput);
  card.appendChild(bento);

  let generalMode = false;
  let syncingSliders = false;

  function clampSize(value: number): number {
    return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(value)));
  }

  function heightToViewHeight(height: number): number {
    const clamped = clampSize(height);
    return Math.round(
      SIZE_VIEW_H_MIN + (clamped / SIZE_MAX) * (SIZE_VIEW_H_MAX - SIZE_VIEW_H_MIN),
    );
  }

  function updateHeightViewport(height: number): void {
    const viewHeight = heightToViewHeight(height);
    sizeStudio.style.setProperty('--mii-maker-size-view-h', `${viewHeight}px`);
    requestAnimationFrame(() => previewCallbacks.onViewportChange?.());
  }

  function bindSizeSlider(
    slider: HTMLInputElement,
    path: 'general.height' | 'general.weight',
  ): void {
    slider.addEventListener('input', () => {
      if (syncingSliders) return;
      const value = clampSize(Number(slider.value));
      previewCallbacks.onSizeChange?.(path, value);
    });
  }

  bindSizeSlider(heightSlider, 'general.height');
  bindSizeSlider(weightSlider, 'general.weight');

  function flashUpdate(): void {
    card.classList.remove('mii-maker__preview-card--updated');
    void card.offsetWidth;
    card.classList.add('mii-maker__preview-card--updated');
  }

  function setGeneralMode(enabled: boolean): void {
    if (generalMode === enabled) return;
    generalMode = enabled;
    card.classList.toggle('mii-maker__preview-card--general', enabled);
    stage.hidden = enabled;
    sizeStudio.hidden = !enabled;

    if (enabled) {
      heroLabel.hidden = true;
      heroLive.setType('all_body');
      sizeMii.replaceChildren(hero);
      updateHeightViewport(Number(heightSlider.value));
    } else {
      heroLabel.hidden = false;
      heroLive.setType('face');
      sizeStudio.style.removeProperty('--mii-maker-size-view-h');
      grid.insertBefore(hero, angles);
    }
  }

  function syncSizeSliders(height: number, weight: number): void {
    syncingSliders = true;
    heightSlider.value = String(clampSize(height));
    weightSlider.value = String(clampSize(weight));
    syncingSliders = false;
    if (generalMode) {
      updateHeightViewport(height);
    }
  }

  return {
    root: card,
    nameInput,
    setMiiData: (data: string) => {
      for (const live of liveRenderers) {
        live.setMiiData(data);
      }
      flashUpdate();
    },
    flashUpdate,
    setGeneralMode,
    syncSizeSliders,
  };
}
