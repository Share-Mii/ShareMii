import './FeaturedMii.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { icon, yeahIcon } from '@/utils/icon';
import { applyTileBackground } from '@/utils/tileBg';
import type { Mii } from '@/types';

export function createFeaturedMiiCard(mii: Mii): HTMLElement {
  const link = document.createElement('a');
  link.className = 'featured-mii interactive';
  link.href = `#/mii/${mii.id}`;

  const media = document.createElement('div');
  media.className = 'featured-mii__media';

  const renderWrap = document.createElement('div');
  renderWrap.className = 'featured-mii__render-wrap';
  applyTileBackground(renderWrap, mii.id);
  renderWrap.appendChild(
    createMiiRenderer({
      miiData: mii.mii_data,
      width: 300,
      alt: mii.name,
      platform: mii.platform,
    }),
  );

  media.appendChild(renderWrap);

  const body = document.createElement('div');
  body.className = 'featured-mii__body';

  const desc =
    mii.description.trim() ||
    'A standout resident from the ShareMii community.';

  body.innerHTML = `
    <p class="featured-mii__label">FEATURED</p>
    <h3 class="featured-mii__name">${escapeHtml(mii.name)}</h3>
    <p class="featured-mii__creator">by <strong>${escapeHtml(mii.creator_name || 'Unknown')}</strong> ${icon('circle-check', 'featured-mii__verified')}</p>
    <p class="featured-mii__desc">${escapeHtml(desc)}</p>
    <div class="featured-mii__stats">
      <span class="featured-mii__stat">${yeahIcon()} ${mii.favorites}</span>
      <span class="featured-mii__stat">${icon('download')} ${mii.downloads}</span>
      <span class="featured-mii__stat">${icon('eye')} ${mii.views}</span>
    </div>
  `;

  link.append(media, body);
  return link;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
