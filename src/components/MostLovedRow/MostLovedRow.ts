import './MostLovedRow.css';
import { createFeaturedMiiCard } from '@/components/FeaturedMii/FeaturedMii';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { icon, yeahIcon } from '@/utils/icon';
import type { Mii } from '@/types';

export function createSpotlightSection(featured: Mii, loved: Mii[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'spotlight-section';

  const grid = document.createElement('div');
  grid.className = 'spotlight-grid';

  const featuredCol = document.createElement('div');
  featuredCol.className = 'spotlight-featured';
  const featuredHead = document.createElement('div');
  featuredHead.className = 'spotlight-featured__head';
  featuredHead.innerHTML = `<h2 class="spotlight-featured__title section-title">${icon('crown')} Featured Mii</h2>`;
  featuredCol.append(featuredHead, createFeaturedMiiCard(featured));

  const lovedCol = document.createElement('div');
  lovedCol.className = 'spotlight-loved';

  const lovedHead = document.createElement('div');
  lovedHead.className = 'spotlight-loved__head';
  lovedHead.innerHTML = `
    <h2 class="spotlight-loved__title section-title">${yeahIcon()} Most Yeah'd this week</h2>
    <a href="#/browse" class="spotlight-loved__link interactive">View all →</a>
  `;

  const row = document.createElement('div');
  row.className = 'spotlight-loved__row scrollbar-hidden';

  loved.slice(0, 3).forEach((mii, i) => {
    row.appendChild(createMiiTile(mii, i, { variant: 'loved' }));
  });

  lovedCol.append(lovedHead, row);
  grid.append(featuredCol, lovedCol);
  section.appendChild(grid);
  return section;
}
