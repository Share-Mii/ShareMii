import type { MiiMakerPreviewHandle } from '@/components/MiiMaker/MiiMakerPreview';

export function attachMiiMakerLayout(
  studio: HTMLElement,
  _preview: MiiMakerPreviewHandle,
): { disconnect: () => void; sync: () => void } {
  const sync = (): void => {
    const sizeStudio = studio.querySelector<HTMLElement>('.mii-maker__size-studio');
    const sizeMii = studio.querySelector<HTMLElement>('.mii-maker__size-mii');
    const previewStage = studio.querySelector<HTMLElement>('.mii-maker__preview-stage');
    const inSizeStudio = Boolean(sizeStudio && !sizeStudio.hidden && sizeMii);
    const stage = inSizeStudio ? sizeMii : previewStage;
    if (!stage) return;

    const sizeHero = inSizeStudio
      ? sizeMii?.querySelector<HTMLElement>('.mii-maker__preview-hero')
      : null;
    const w = sizeHero?.clientWidth ?? stage.clientWidth;
    const h = sizeHero?.clientHeight ?? stage.clientHeight;
    if (w < 1 || h < 1) return;

    const size = inSizeStudio
      ? Math.floor(Math.min(w * 1.15, h * 0.95))
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
