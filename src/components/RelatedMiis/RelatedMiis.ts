import './RelatedMiis.css';
import { createMiiTile } from '@/components/MiiTile/MiiTile';
import { fetchRelatedMiis } from '@/services/supabase';
import type { Mii } from '@/types';

const RELATED_ROW_MAX = 7;

export async function createRelatedMiisSection(
  mii: Mii,
): Promise<HTMLElement | null> {
  let related: Mii[] = [];
  try {
    related = await fetchRelatedMiis(mii, RELATED_ROW_MAX);
  } catch {
    return null;
  }
  if (!related.length) return null;

  const panel = document.createElement('section');
  panel.className = 'related-miis related-miis--panel';
  panel.setAttribute('aria-label', 'More like this');

  const heading = document.createElement('h3');
  heading.className = 'related-miis__title';
  heading.textContent = 'More like this';

  const row = document.createElement('div');
  row.className = 'related-miis__row mii-grid mii-grid--home';

  for (let i = 0; i < Math.min(related.length, RELATED_ROW_MAX); i++) {
    row.appendChild(createMiiTile(related[i]!, i, { variant: 'grid' }));
  }

  panel.append(heading, row);
  return panel;
}
