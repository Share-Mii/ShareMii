import { pastelFromId } from '@/styles/pastelColors';

export function tileGradientFromId(id: string): string {
  const from = pastelFromId(id, 0);
  const to = pastelFromId(id, 1);
  return `linear-gradient(145deg, ${from} 0%, ${to} 100%)`;
}

export function applyTileBackground(el: HTMLElement, miiId: string): void {
  el.dataset.tileBg = miiId;
  el.style.background = tileGradientFromId(miiId);
}

export function refreshTileBackgrounds(): void {
  document.querySelectorAll<HTMLElement>('[data-tile-bg]').forEach((el) => {
    const id = el.dataset.tileBg;
    if (id) el.style.background = tileGradientFromId(id);
  });
}
