import './MiiTile.css';
import { createMiiRenderer } from '@/components/MiiRenderer/MiiRenderer';
import { icon, yeahIcon } from '@/utils/icon';
import { applyTileBackground } from '@/utils/tileBg';
import type { Mii } from '@/types';
import { createCreatorAttribution } from '@/utils/creatorLink';

export type MiiTileVariant = 'default' | 'compact' | 'loved' | 'grid';

export interface MiiTileOptions {
  compact?: boolean;
  variant?: MiiTileVariant;
}

export function createMiiTile(
  mii: Mii,
  staggerIndex = 0,
  options: MiiTileOptions = {},
): HTMLElement {
  const variant: MiiTileVariant =
    options.variant ?? (options.compact ? 'compact' : 'default');

  const link = document.createElement('a');
  link.className = `mii-tile interactive mii-tile--${variant}`;
  link.href = `#/mii/${mii.id}`;
  link.style.setProperty('--stagger-index', String(staggerIndex));

  const renderArea = document.createElement('div');
  renderArea.className = 'mii-tile__render';

  const renderer = createMiiRenderer({
    miiData: mii.mii_data,
    width: variant === 'loved' ? 240 : variant === 'grid' ? 280 : 256,
    alt: mii.name,
    platform: mii.platform,
  });

  if (variant === 'loved' || variant === 'grid') {
    const frame = document.createElement('div');
    frame.className = 'mii-tile__render-frame';
    applyTileBackground(frame, mii.id);
    frame.appendChild(renderer);
    renderArea.appendChild(frame);
  } else {
    applyTileBackground(renderArea, mii.id);
    renderArea.appendChild(renderer);
  }

  const chin = document.createElement('div');
  chin.className = 'mii-tile__chin';

  const name = document.createElement('p');
  name.className = 'mii-tile__name';
  name.textContent = mii.name;

  const withBy = variant === 'loved' || variant === 'grid';
  const creator = createCreatorAttribution(mii, 'mii-tile__creator', {
    prefix: withBy ? 'by ' : '',
    unknownLabel: withBy ? 'Unknown' : 'Unknown creator',
  });

  const stats = document.createElement('div');
  stats.className = 'mii-tile__stats';

  if (variant === 'grid') {
    stats.innerHTML = `
      <span class="mii-tile__stat" title="Yeahs">${yeahIcon()} ${mii.favorites}</span>
      <span class="mii-tile__stat" title="Downloads">${icon('download')} ${mii.downloads}</span>
    `;
  } else {
    stats.innerHTML = `
      <span class="mii-tile__stat" title="Yeahs">${yeahIcon()} ${mii.favorites}</span>
      <span class="mii-tile__stat" title="Downloads">${icon('download')} ${mii.downloads}</span>
      <span class="mii-tile__stat" title="Views">${icon('eye')} ${mii.views}</span>
    `;
  }

  chin.append(name, creator, stats);
  link.append(renderArea, chin);
  return link;
}
