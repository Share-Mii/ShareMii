import {
  ABOUT_SAFETY_BLURB,
  faqPageJsonLd,
  HELP_FAQ,
  itemListJsonLd,
  MII_FACE_OG_SIZE,
  OG_DEFAULT_HEIGHT,
  OG_DEFAULT_WIDTH,
  TAG_PLATFORM_BLURB,
} from '../../seo/content';
import { canonicalOrigin } from '../http/canonical';
import {
  BRAND_NAME,
  DEFAULT_DESCRIPTION,
  formatBrandTitle,
  organizationSameAs,
} from './brand';
import { buildRenderUrl } from './renderUrl';
import type { FeaturedMiiRow } from './supabase';

export { BRAND_NAME, DEFAULT_DESCRIPTION } from './brand';

export const DEFAULT_TITLE = BRAND_NAME;

export const DEFAULT_OG_IMAGE = 'https://sharemii.net/assets/og-default.png';

export type LegalPageId =
  | 'legal'
  | 'privacy'
  | 'terms'
  | 'child-safety'
  | 'delete-account';

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: 'website' | 'profile';
  noindex?: boolean;
  bodyHtml?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function formatTitle(title: string): string {
  return formatBrandTitle(title);
}

function homeJsonLd(
  origin: string,
  env?: { DISCORD_INVITE_URL?: string },
): Record<string, unknown>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: BRAND_NAME,
      url: origin,
      logo: DEFAULT_OG_IMAGE,
      description: DEFAULT_DESCRIPTION,
      sameAs: organizationSameAs(origin, env),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: BRAND_NAME,
      url: origin,
      description: DEFAULT_DESCRIPTION,
      publisher: { '@type': 'Organization', name: BRAND_NAME, url: origin },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${origin}/browse?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function withBreadcrumbs(
  primary: Record<string, unknown>,
  crumbs: { name: string; url: string }[],
): Record<string, unknown>[] {
  return [primary, breadcrumbJsonLd(crumbs)];
}

export function siteOrigin(env: { SITE_ORIGIN?: string }, request: Request): string {
  return env.SITE_ORIGIN?.replace(/\/$/, '') || canonicalOrigin(request);
}

export function homeMeta(
  origin: string,
  env?: { DISCORD_INVITE_URL?: string },
): SeoMeta {
  return {
    title: formatTitle(`${BRAND_NAME} — Browse, Share & Scan Mii QR Codes`),
    description: DEFAULT_DESCRIPTION,
    canonical: `${origin}/`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>${BRAND_NAME} — browse, share, &amp; collect Miis</h1>` +
      '<p>Community Mii QR code gallery and online Mii Maker for 3DS, Wii U, and Tomodachi Life.</p></main>',
    jsonLd: homeJsonLd(origin, env),
  };
}

export function aboutMeta(origin: string): SeoMeta {
  const description = `${ABOUT_SAFETY_BLURB} Browse, scan, and create Mii QR codes for 3DS, Wii U, and Tomodachi Life.`;
  return {
    title: formatTitle(`About ${BRAND_NAME} — Is ShareMii Safe?`),
    description,
    canonical: `${origin}/about`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>About ${BRAND_NAME}</h1>` +
      `<p>${escapeHtml(description)}</p></main>`,
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: `About ${BRAND_NAME}`,
        description: DEFAULT_DESCRIPTION,
        url: `${origin}/about`,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'About', url: `${origin}/about` },
      ],
    ),
  };
}

export function helpMeta(origin: string): SeoMeta {
  const description =
    `How to use ShareMii.net: browse Mii QR codes, scan from 3DS/Wii U/Tomodachi Life, and create Miis online. Is ShareMii safe? Yes — moderated community site, not a save editor.`;
  return {
    title: formatTitle('How to Use ShareMii — Tutorial & FAQ'),
    description,
    canonical: `${origin}/help`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>How to use ${BRAND_NAME}</h1>` +
      `<p>${escapeHtml(description)}</p>` +
      HELP_FAQ.map(
        (f) =>
          `<h2>${escapeHtml(f.question)}</h2><p>${escapeHtml(f.answer)}</p>`,
      ).join('') +
      '</main>',
    jsonLd: [
      faqPageJsonLd(origin, HELP_FAQ),
      breadcrumbJsonLd([
        { name: 'Home', url: `${origin}/` },
        { name: 'Help', url: `${origin}/help` },
      ]),
    ],
  };
}

export function browseMeta(
  origin: string,
  featured: FeaturedMiiRow[] = [],
): SeoMeta {
  const description =
    'Search and browse Nintendo Mii QR codes shared by the community. Filter by 3DS, Wii U, Tomodachi Life, tags, and trending.';
  const itemList = featured.map((mii) => ({
    name: mii.name,
    url: `${origin}/mii/${mii.id}`,
  }));
  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Browse Mii QR Codes',
      description,
      url: `${origin}/browse`,
    },
    breadcrumbJsonLd([
      { name: 'Home', url: `${origin}/` },
      { name: 'Browse', url: `${origin}/browse` },
    ]),
  ];
  if (itemList.length) {
    jsonLd.push(itemListJsonLd(itemList));
  }
  const featuredLinks = featured
    .map(
      (mii) =>
        `<li><a href="${origin}/mii/${mii.id}">${escapeHtml(mii.name)}</a></li>`,
    )
    .join('');
  return {
    title: formatTitle('Browse Mii QR Codes & Community Miis'),
    description,
    canonical: `${origin}/browse`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      '<main><h1>Browse Mii QR Codes</h1>' +
      `<p>${escapeHtml(description)}</p>` +
      (featuredLinks ? `<ul>${featuredLinks}</ul>` : '') +
      '</main>',
    jsonLd,
  };
}

export function createMeta(origin: string): SeoMeta {
  const description =
    `Mii Maker — create and customize Nintendo Miis in your browser, export QR codes, and share with the ${BRAND_NAME} community. Works for 3DS, Wii U, and Tomodachi Life.`;
  return {
    title: formatTitle('Mii Maker — Create Mii QR Codes'),
    description,
    canonical: `${origin}/create`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      '<main><h1>Mii Maker</h1>' +
      `<p>${escapeHtml(description)}</p></main>`,
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: `${BRAND_NAME} Mii Maker`,
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Web browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description,
        url: `${origin}/create`,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Mii Maker', url: `${origin}/create` },
      ],
    ),
  };
}

export function embedMakerMeta(origin: string): SeoMeta {
  const description = `Create Nintendo Miis in your browser and export QR codes. Embeddable Mii Maker powered by ${BRAND_NAME}.`;
  return {
    title: formatTitle('Mii Maker'),
    description,
    canonical: `${origin}/embed/maker`,
    noindex: true,
    bodyHtml:
      '<main><h1>Mii Maker</h1>' +
      `<p>${escapeHtml(description)}</p></main>`,
  };
}

export function tagsIndexMeta(origin: string, tags: { slug: string; label: string }[]): SeoMeta {
  const description =
    `Browse Mii QR code tags on ${BRAND_NAME} — celebrity, game, cosplay, funny, cute, and more. ${TAG_PLATFORM_BLURB}.`;
  const tagLinks = tags
    .map(
      (tag) =>
        `<li><a href="${origin}/tag/${encodeURIComponent(tag.slug)}">${escapeHtml(tag.label)}</a></li>`,
    )
    .join('');
  return {
    title: formatTitle('Mii QR Code Tags'),
    description,
    canonical: `${origin}/tags`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      '<main><h1>Mii QR code tags</h1>' +
      `<p>${escapeHtml(description)}</p>` +
      (tagLinks ? `<ul>${tagLinks}</ul>` : '') +
      '</main>',
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Mii QR Code Tags',
        description,
        url: `${origin}/tags`,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Tags', url: `${origin}/tags` },
      ],
    ),
  };
}

export function collectionsBrowseMeta(origin: string): SeoMeta {
  const description =
    'Curated public Mii collections shared by the ShareMii community — themed lists of Mii QR codes.';
  return {
    title: formatTitle('Public Mii Collections'),
    description,
    canonical: `${origin}/collections/browse`,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      '<main><h1>Public collections</h1>' +
      `<p>${escapeHtml(description)}</p></main>`,
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Public Mii Collections',
        description,
        url: `${origin}/collections/browse`,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Collections', url: `${origin}/collections/browse` },
      ],
    ),
  };
}

const LEGAL_PAGES: Record<
  LegalPageId,
  { title: string; description: string; heading: string }
> = {
  legal: {
    title: 'Legal',
    description:
      'Legal information, policies, and contact details for ShareMii.net.',
    heading: 'Legal information',
  },
  privacy: {
    title: 'Privacy Policy',
    description:
      'How ShareMii.net collects, uses, and protects your personal information and Mii content.',
    heading: 'Privacy Policy',
  },
  terms: {
    title: 'Terms of Service',
    description:
      'Terms of Service for using ShareMii.net, the community Mii sharing website.',
    heading: 'Terms of Service',
  },
  'child-safety': {
    title: 'Child Safety',
    description:
      'ShareMii.net child safety standards, moderation practices, and reporting guidance.',
    heading: 'Child Safety standards',
  },
  'delete-account': {
    title: 'Delete Account',
    description:
      'How to delete your ShareMii.net account and what happens to your data.',
    heading: 'Delete your account',
  },
};

export function legalMeta(origin: string, id: LegalPageId): SeoMeta {
  const page = LEGAL_PAGES[id];
  const canonical = `${origin}/${id}`;
  return {
    title: formatTitle(page.title),
    description: page.description,
    canonical,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>${escapeHtml(page.heading)}</h1>` +
      `<p>${escapeHtml(page.description)}</p></main>`,
  };
}

export function miiMeta(
  origin: string,
  mii: {
    id: string;
    name: string;
    description?: string | null;
    mii_data: string;
    creator_name?: string | null;
  },
): SeoMeta {
  const description =
    mii.description?.trim() ||
    `${mii.name} — shared on ${BRAND_NAME} by ${mii.creator_name || 'the community'}`;
  const image = buildRenderUrl(mii.mii_data, {
    type: 'face',
    width: MII_FACE_OG_SIZE,
  });
  const canonical = `${origin}/mii/${mii.id}`;
  return {
    title: formatTitle(`${mii.name} Mii QR Code`),
    description,
    canonical,
    image,
    imageWidth: MII_FACE_OG_SIZE,
    imageHeight: MII_FACE_OG_SIZE,
    bodyHtml:
      `<main><h1>${escapeHtml(mii.name)}</h1>` +
      `<p>${escapeHtml(description)}</p>` +
      `<img src="${escapeHtml(image)}" alt="${escapeHtml(mii.name)} Mii" width="256" height="256" />` +
      '</main>',
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: mii.name,
        description,
        image,
        url: canonical,
        author: mii.creator_name
          ? { '@type': 'Person', name: mii.creator_name }
          : undefined,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Browse', url: `${origin}/browse` },
        { name: mii.name, url: canonical },
      ],
    ),
  };
}

export function profileMeta(
  origin: string,
  profile: { username: string; bio?: string | null },
): SeoMeta {
  const description =
    profile.bio?.trim() ||
    `Miis shared by ${profile.username} on ${BRAND_NAME}`;
  const canonical = `${origin}/u/${encodeURIComponent(profile.username)}`;
  return {
    title: formatTitle(`${profile.username}'s Miis`),
    description,
    canonical,
    type: 'profile',
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>${escapeHtml(profile.username)}</h1>` +
      `<p>${escapeHtml(description)}</p></main>`,
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: profile.username,
          url: canonical,
        },
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: profile.username, url: canonical },
      ],
    ),
  };
}

export function tagMeta(
  origin: string,
  slug: string,
  label: string,
  featured: FeaturedMiiRow[] = [],
): SeoMeta {
  const canonical = `${origin}/tag/${encodeURIComponent(slug)}`;
  const description = `Browse ${label} Mii QR codes on ${BRAND_NAME}. ${TAG_PLATFORM_BLURB} — filter, download, and share community Miis tagged ${label}.`;
  const itemList = featured.map((mii) => ({
    name: mii.name,
    url: `${origin}/mii/${mii.id}`,
  }));
  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${label} Mii QR Codes`,
      description,
      url: canonical,
    },
    breadcrumbJsonLd([
      { name: 'Home', url: `${origin}/` },
      { name: 'Browse', url: `${origin}/browse` },
      { name: label, url: canonical },
    ]),
  ];
  if (itemList.length) {
    jsonLd.push(itemListJsonLd(itemList));
  }
  return {
    title: formatTitle(`${label} Mii QR Codes`),
    description,
    canonical,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>${escapeHtml(label)} Mii QR Codes</h1>` +
      `<p>${escapeHtml(description)}</p></main>`,
    jsonLd,
  };
}

export function collectionMeta(
  origin: string,
  collection: { id: string; name: string; description?: string | null },
): SeoMeta {
  const description =
    collection.description?.trim() ||
    `A curated Mii collection on ${BRAND_NAME}: ${collection.name}`;
  const canonical = `${origin}/collection/${collection.id}`;
  return {
    title: formatTitle(collection.name),
    description,
    canonical,
    image: DEFAULT_OG_IMAGE,
    imageWidth: OG_DEFAULT_WIDTH,
    imageHeight: OG_DEFAULT_HEIGHT,
    bodyHtml:
      `<main><h1>${escapeHtml(collection.name)}</h1>` +
      `<p>${escapeHtml(description)}</p></main>`,
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: collection.name,
        description,
        url: canonical,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Collections', url: `${origin}/collections/browse` },
        { name: collection.name, url: canonical },
      ],
    ),
  };
}

export function notFoundMeta(origin: string): SeoMeta {
  return {
    title: formatTitle('Page not found'),
    description: DEFAULT_DESCRIPTION,
    canonical: origin,
    noindex: true,
    bodyHtml: '<main><h1>Page not found</h1></main>',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
