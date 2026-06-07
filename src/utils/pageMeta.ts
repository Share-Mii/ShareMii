import {
  BRAND_NAME,
  DEFAULT_PUBLIC_DESCRIPTION,
  formatBrandTitle,
  SITE_URL,
} from '@/config/brand';
import {
  MII_FACE_OG_SIZE,
  OG_DEFAULT_HEIGHT,
  OG_DEFAULT_WIDTH,
} from '@/config/seo';

export interface PageMetaOptions {
  title: string;
  description?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  url?: string;
  type?: 'website' | 'profile';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const DEFAULT_OG_IMAGE = 'https://sharemii.net/assets/og-default.png';

const DEFAULT_TITLE = BRAND_NAME;
const DEFAULT_DESCRIPTION = DEFAULT_PUBLIC_DESCRIPTION;
const JSON_LD_ID = 'sharemii-jsonld';

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

function upsertJsonLd(data?: Record<string, unknown> | Record<string, unknown>[]): void {
  document.getElementById(JSON_LD_ID)?.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.id = JSON_LD_ID;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  document.head.appendChild(script);
}

function isProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'sharemii.net' || host === 'www.sharemii.net';
}

export function getSiteOrigin(): string {
  if (typeof window !== 'undefined' && isProductionHost(window.location.hostname)) {
    return SITE_URL;
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return SITE_URL;
}

export function setPageMeta(opts: PageMetaOptions): void {
  const title = formatBrandTitle(opts.title);
  document.title = title;

  const description = opts.description?.trim() || DEFAULT_DESCRIPTION;
  const url =
    opts.url ??
    `${getSiteOrigin()}${typeof window !== 'undefined' ? window.location.pathname : '/'}`;

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
  const imageWidth = opts.imageWidth ?? (image === DEFAULT_OG_IMAGE ? OG_DEFAULT_WIDTH : MII_FACE_OG_SIZE);
  const imageHeight = opts.imageHeight ?? (image === DEFAULT_OG_IMAGE ? OG_DEFAULT_HEIGHT : MII_FACE_OG_SIZE);

  upsertMeta('property', 'og:image', image);
  upsertMeta('name', 'twitter:image', image);
  upsertMeta('property', 'og:image:width', String(imageWidth));
  upsertMeta('property', 'og:image:height', String(imageHeight));

  if (opts.noindex) {
    upsertMeta('name', 'robots', 'noindex, nofollow');
  } else {
    removeMeta('name', 'robots');
  }

  upsertJsonLd(opts.jsonLd);
}

export function resetPageMeta(): void {
  setPageMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: `${getSiteOrigin()}/`,
  });
}
