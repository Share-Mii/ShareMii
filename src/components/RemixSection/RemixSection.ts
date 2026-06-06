import './RemixSection.css';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import {
  fetchRemixChildren,
  fetchRemixSource,
} from '@/services/discovery';
import type { Mii } from '@/types';

export async function createRemixSection(mii: Mii): Promise<HTMLElement | null> {
  const [source, children] = await Promise.all([
    mii.remix_of_mii_id
      ? fetchRemixSource(mii.id)
      : Promise.resolve(null),
    fetchRemixChildren(mii.id, 8),
  ]);

  if (!source && !children.length) return null;

  const section = document.createElement('section');
  section.className = 'remix-section';
  section.setAttribute('aria-label', 'Remix lineage');

  const title = document.createElement('h3');
  title.className = 'remix-section__title';
  title.textContent = 'Remix family';
  section.appendChild(title);

  if (source) {
    const from = document.createElement('div');
    from.className = 'remix-section__group';
    from.innerHTML = '<p class="remix-section__label">Remixed from</p>';
    const row = document.createElement('div');
    row.className = 'remix-section__row mii-grid mii-grid--home';
    row.appendChild(createMiiTile(source, 0, { variant: 'grid' }));
    from.appendChild(row);
    section.appendChild(from);
  }

  if (children.length) {
    const kids = document.createElement('div');
    kids.className = 'remix-section__group';
    const label = document.createElement('p');
    label.className = 'remix-section__label';
    label.textContent = `Remixes (${children.length}${children.length >= 8 ? '+' : ''})`;
    kids.appendChild(label);
    const row = document.createElement('div');
    row.className = 'remix-section__row mii-grid mii-grid--home';
    children.forEach((child, i) => {
      row.appendChild(createMiiTile(child, i, { variant: 'grid' }));
    });
    kids.appendChild(row);
    section.appendChild(kids);
  }

  return section;
}
