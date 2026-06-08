import type { MiiMakerPreviewHandle } from '@/components/MiiMaker/MiiMakerPreview';

export function attachMiiMakerLayout(
  studio: HTMLElement,
  _preview: MiiMakerPreviewHandle,
): { disconnect: () => void; sync: () => void } {
  const sync = (): void => {
    const inGeneral = Boolean(
      studio.querySelector('.mii-maker__preview-card--general'),
    );
    const hero = studio.querySelector<HTMLElement>('.mii-maker__preview-hero');
    const stage = studio.querySelector<HTMLElement>('.mii-maker__preview-stage');
    const target = inGeneral && hero ? hero : stage;
    if (!target) return;

    const w = target.clientWidth;
    const h = target.clientHeight;
    if (w < 1 || h < 1) return;

    const size = inGeneral
      ? Math.floor(Math.min(w, h))
      : Math.floor(Math.min(w, h * 1.05));
    studio.style.setProperty('--mii-maker-preview-render', `${size}px`);
  };

  const ro = new ResizeObserver(() => sync());
  ro.observe(studio);
  sync();

  return {
    disconnect: () => ro.disconnect(),
    sync,
  };
}
