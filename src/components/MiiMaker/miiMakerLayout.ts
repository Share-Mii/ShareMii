import type { MiiMakerPreviewHandle } from '@/components/MiiMaker/MiiMakerPreview';

export function attachMiiMakerLayout(
  studio: HTMLElement,
  _preview: MiiMakerPreviewHandle,
): () => void {
  const stage = studio.querySelector<HTMLElement>('.mii-maker__preview-stage');
  if (!stage) return () => {};

  const sync = (): void => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w < 1 || h < 1) return;
    const size = Math.floor(Math.min(w, h * 1.05));
    studio.style.setProperty('--mii-maker-preview-render', `${size}px`);
  };

  const ro = new ResizeObserver(() => sync());
  ro.observe(stage);
  sync();

  return () => ro.disconnect();
}
