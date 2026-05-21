import './HeroPolaroids.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { iconSpan } from '@/utils/icon';
import { applyTileBackground } from '@/utils/tileBg';
import type { Mii } from '@/types';

const SLOTS = [
  { position: 'left', width: 132, z: 1, featured: false, renderWidth: 150 },
  { position: 'center', width: 158, z: 3, featured: true, renderWidth: 180 },
  { position: 'right', width: 132, z: 2, featured: false, renderWidth: 150 },
] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createHeroPolaroids(featured: Mii, sides: Mii[] = []): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'hero-polaroids';

  const composition = document.createElement('div');
  composition.className = 'hero-polaroids__composition';

  const hint = document.createElement('div');
  hint.className = 'hero-polaroids__hint';
  hint.innerHTML = `${iconSpan('qrcode')} Scan a QR code to add your Mii!`;

  const stack = document.createElement('div');
  stack.className = 'hero-polaroids__stack';

  const miiBySlot: (Mii | undefined)[] = [sides[0], featured, sides[1]];

  SLOTS.forEach((slot, i) => {
    const mii = miiBySlot[i];
    const card = document.createElement('div');
    card.className = `hero-polaroids__card hero-polaroids__card--${slot.position}`;
    card.style.setProperty('--card-width', `${slot.width}px`);
    card.style.zIndex = String(slot.z);

    if (!mii) {
      card.classList.add('hero-polaroids__card--empty');
      stack.appendChild(card);
      return;
    }

    const inner = document.createElement('div');
    inner.className = 'hero-polaroids__card-inner';

    const render = document.createElement('div');
    render.className = 'hero-polaroids__render';
    applyTileBackground(render, mii.id);
    render.appendChild(
      createMiiRenderer({
        miiData: mii.mii_data,
        width: slot.renderWidth,
        alt: mii.name,
        platform: mii.platform,
      }),
    );

    const chin = document.createElement('div');
    chin.className = 'hero-polaroids__chin';
    chin.innerHTML = `
      <p class="hero-polaroids__name">${escapeHtml(mii.name)}</p>
      <p class="hero-polaroids__creator">by ${escapeHtml(mii.creator_name || 'Unknown')}</p>
    `;

    if (slot.featured) {
      const badge = document.createElement('span');
      badge.className = 'hero-polaroids__badge';
      badge.innerHTML = `${iconSpan('star')} Featured`;
      render.appendChild(badge);
    }

    inner.append(render, chin);
    card.appendChild(inner);
    stack.appendChild(card);
  });

  composition.append(hint, stack);
  wrap.appendChild(composition);
  return wrap;
}
