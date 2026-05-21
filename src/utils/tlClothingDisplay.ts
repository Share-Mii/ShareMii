import { icon } from '@/utils/icon';
import type { TomodachiClothingItem } from '@/services/tlClothing';

const HAT_ICON = 'hat-cowboy';

export function inferOutfitIcon(name: string): string {
  const n = name.toLowerCase();

  if (/shoe|boot|sandal|slipper|sneaker|footwear/.test(n)) {
    return 'shoe-prints';
  }
  if (
    /\bsuit\b|tux|blazer|formal|khakis|necktie|tracksuit|overalls/.test(n) ||
    /sous-chef|business/.test(n)
  ) {
    return 'user-tie';
  }
  if (/dress|gown|kimono|十二単|skirt|ballgown|maxi|cheongsam|chinese dress/.test(n)) {
    return 'person-dress';
  }
  if (/swim|bikini|trunks|beach/.test(n)) {
    return 'person-swimming';
  }
  if (/coat|jacket|hoodie|parka|puffy|tweed|cardigan|sweatshirt|sweater/.test(n)) {
    return 'vest';
  }
  if (/armor|knight|samurai|ninja|pirate|costume|outfit|uniform|jersey/.test(n)) {
    return 'vest-patches';
  }
  if (/chef|apron|cook|kitchen/.test(n)) {
    return 'utensils';
  }
  if (/witch|wizard|princess|elf|angel|devil|pumpkin|santa/.test(n)) {
    return 'wand-magic-sparkles';
  }

  return 'shirt';
}

export function iconForTomodachiItem(item: TomodachiClothingItem): string {
  return item.kind === 'hat' ? HAT_ICON : inferOutfitIcon(item.name);
}

export function labelForTomodachiKind(kind: TomodachiClothingItem['kind']): string {
  switch (kind) {
    case 'hat':
      return 'Hat';
    case 'outfit':
      return 'Outfit';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatClothingDisplayName(name: string): string {
  return name.replace(/(^|[\s&-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function renderTomodachiClothingList(items: TomodachiClothingItem[]): string {
  if (!items.length) return '';

  const pills = items
    .map((item) => {
      const fa = iconForTomodachiItem(item);
      const kindLabel = labelForTomodachiKind(item.kind);
      const label = formatClothingDisplayName(item.name);
      return `<li class="detail__clothing-pill" title="${escapeHtml(kindLabel)}">
        <span class="detail__clothing-pill-icon">${icon(fa, 'detail__clothing-fa')}</span>
        <span class="detail__clothing-pill-label">${escapeHtml(label)}</span>
      </li>`;
    })
    .join('');

  return `<ul class="detail__clothing-pills">${pills}</ul>`;
}
