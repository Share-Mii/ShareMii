import type { Mii } from '@/types';

export function profileUrlForUsername(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export interface CreatorAttributionOptions {
  
  prefix?: string;
  unknownLabel?: string;
}

export function createCreatorAttribution(
  mii: Mii,
  className: string,
  options: CreatorAttributionOptions = {},
): HTMLElement {
  const el = document.createElement('p');
  el.className = className;

  const prefix = options.prefix ?? 'by ';
  const unknown = options.unknownLabel ?? 'Unknown';
  const name = mii.creator_name?.trim() || unknown;

  if (mii.user_id && mii.creator_name?.trim()) {
    if (prefix) el.append(document.createTextNode(prefix));
    const link = document.createElement('a');
    link.href = profileUrlForUsername(mii.creator_name);
    link.className = 'creator-link interactive';
    link.textContent = mii.creator_name;
    link.addEventListener('click', (e) => e.stopPropagation());
    el.appendChild(link);
  } else {
    el.textContent = prefix ? `${prefix}${name}` : name;
  }

  return el;
}
