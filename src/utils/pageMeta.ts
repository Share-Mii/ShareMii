import {
  BRAND_NAME,
  DEFAULT_PUBLIC_DESCRIPTION,
  formatBrandTitle,
} from '@/config/brand';

export interface PageMetaOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'profile';
  noindex?: boolean;
}

export const DEFAULT_OG_IMAGE = 'https://sharemii.net/assets/og-default.png';

const DEFAULT_TITLE = BRAND_NAME;
const DEFAULT_DESCRIPTION = DEFAULT_PUBLIC_DESCRIPTION;

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

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

export function getSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://sharemii.net';
}

export function setPageMeta(opts: PageMetaOptions): void {
  const title = formatBrandTitle(opts.title);
  document.title = title;

  const description = opts.description?.trim() || DEFAULT_DESCRIPTION;
  const url = opts.url ?? `${getSiteOrigin()}${window.location.pathname}`;

  upsertCanonical(url);
  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:type', opts.type ?? 'website');
  upsertMeta('property', 'og:site_name', BRAND_NAME);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);

  const image = opts.image ?? DEFAULT_OG_IMAGE;
  upsertMeta('property', 'og:image', image);
  upsertMeta('name', 'twitter:image', image);

  if (opts.noindex) {
    upsertMeta('name', 'robots', 'noindex, nofollow');
  } else {
    removeMeta('name', 'robots');
  }
}

export function resetPageMeta(): void {
  setPageMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: `${getSiteOrigin()}/`,
  });
}
