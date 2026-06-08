import { createLiveMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { MII_STANDARD_VIEWS } from '@/services/miiViews';
import { MII_NAME_MAX } from '@/utils/miiName';

export interface MiiMakerPreviewHandle {
  root: HTMLElement;
  nameInput: HTMLInputElement;
  setMiiData: (base64: string) => void;
  flashUpdate: () => void;
  setGeneralMode: (enabled: boolean) => void;
}

const HERO_VIEW = MII_STANDARD_VIEWS[0]!;
const ANGLE_VIEWS = MII_STANDARD_VIEWS.slice(1);

export function createMiiMakerPreview(initialBase64: string): MiiMakerPreviewHandle {
  const card = document.createElement('div');
  card.className = 'mii-maker__preview-card';

  const bento = document.createElement('div');
  bento.className = 'mii-maker__preview-bento';

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
    width: 384,
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

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'mii-maker__name-input';
  nameInput.maxLength = MII_NAME_MAX;
  nameInput.placeholder = 'Mii name';
  nameInput.value = 'Mii';
  nameInput.setAttribute('aria-label', 'Mii name');

  bento.append(nameInput);
  card.appendChild(bento);

  function flashUpdate(): void {
    card.classList.remove('mii-maker__preview-card--updated');
    void card.offsetWidth;
    card.classList.add('mii-maker__preview-card--updated');
  }

  function setGeneralMode(enabled: boolean): void {
    card.classList.toggle('mii-maker__preview-card--general', enabled);
    heroLive.setType(enabled ? 'all_body' : 'face');
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
  };
}
