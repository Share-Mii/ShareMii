export interface PageMetaOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'profile';
}

const DEFAULT_TITLE = 'ShareMii';
const DEFAULT_DESCRIPTION =
  'Browse, share, and create Nintendo Miis with the ShareMii community.';

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function removeMeta(attr: 'name' | 'property', key: string): void {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

export function getSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://sharemii.net';
}

export function setPageMeta(opts: PageMetaOptions): void {
  const title = opts.title.includes('ShareMii')
    ? opts.title
    : `${opts.title} · ShareMii`;
  document.title = title;

  const description = opts.description?.trim() || DEFAULT_DESCRIPTION;
  const url = opts.url ?? `${getSiteOrigin()}${window.location.pathname}`;

  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:type', opts.type ?? 'website');
  upsertMeta('property', 'og:site_name', 'ShareMii');
  upsertMeta('name', 'twitter:card', opts.image ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);

  if (opts.image) {
    upsertMeta('property', 'og:image', opts.image);
    upsertMeta('name', 'twitter:image', opts.image);
  } else {
    removeMeta('property', 'og:image');
    removeMeta('name', 'twitter:image');
  }
}

export function resetPageMeta(): void {
  setPageMeta({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION });
}
