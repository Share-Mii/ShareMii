import {
  BRAND_NAME,
  DEFAULT_DESCRIPTION,
  formatBrandTitle,
  organizationSameAs,
} from './brand';
import { buildRenderUrl } from './renderUrl';

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

const PRODUCTION_ORIGIN = 'https://sharemii.net';

export function siteOrigin(env: { SITE_ORIGIN?: string }, request: Request): string {
  return (
    env.SITE_ORIGIN?.replace(/\/$/, '') ||
    PRODUCTION_ORIGIN ||
    new URL(request.url).origin
  );
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
    bodyHtml:
      `<main><h1>${BRAND_NAME} — browse, share, &amp; collect Miis</h1>` +
      '<p>Community Mii QR code gallery and online Mii Maker for 3DS, Wii U, and Tomodachi Life.</p></main>',
    jsonLd: homeJsonLd(origin, env),
  };
}

export function aboutMeta(origin: string): SeoMeta {
  return {
    title: formatTitle(`About ${BRAND_NAME}`),
    description: DEFAULT_DESCRIPTION,
    canonical: `${origin}/about`,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      `<main><h1>About ${BRAND_NAME}</h1>` +
      '<p>Community Mii QR code gallery and online Mii Maker — not the Living the Dream save editor.</p></main>',
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
  return {
    title: formatTitle('How to Use ShareMii'),
    description: `Learn how to browse, scan, create, and share Mii QR codes on ${BRAND_NAME}.`,
    canonical: `${origin}/help`,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      `<main><h1>How to use ${BRAND_NAME}</h1>` +
      '<p>Browse Mii QR codes, scan and submit from your console, or create Miis in the online Mii Maker.</p></main>',
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `How to use ${BRAND_NAME}`,
        description: `Guide to using ${BRAND_NAME} for Mii QR codes.`,
        url: `${origin}/help`,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Help', url: `${origin}/help` },
      ],
    ),
  };
}

export function browseMeta(origin: string): SeoMeta {
  return {
    title: formatTitle('Browse Mii QR Codes & Community Miis'),
    description:
      'Search and browse Nintendo Mii characters shared by the community. Filter by platform, tags, and trending.',
    canonical: `${origin}/browse`,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      '<main><h1>Browse Mii QR Codes</h1><p>Discover community Miis from 3DS, Wii U, and Tomodachi Life.</p></main>',
  };
}

export function createMeta(origin: string): SeoMeta {
  return {
    title: formatTitle('Free Online Mii Maker'),
    description:
      `Create and customize Nintendo Miis in your browser. Export QR codes and share with the ${BRAND_NAME} community.`,
    canonical: `${origin}/create`,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      '<main><h1>Free Online Mii Maker</h1>' +
      '<p>Create and customize Nintendo Miis in your browser, then export QR codes for 3DS, Wii U, and Tomodachi Life.</p></main>',
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
  const image = buildRenderUrl(mii.mii_data, { type: 'face', width: 512 });
  const canonical = `${origin}/mii/${mii.id}`;
  return {
    title: formatTitle(`${mii.name} Mii QR Code`),
    description,
    canonical,
    image,
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

export function tagMeta(origin: string, slug: string, label: string): SeoMeta {
  const canonical = `${origin}/tag/${encodeURIComponent(slug)}`;
  return {
    title: formatTitle(`${label} Mii QR Codes`),
    description: `Browse ${BRAND_NAME} residents tagged ${label}.`,
    canonical,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      `<main><h1>${escapeHtml(label)} Miis</h1>` +
      `<p>Browse community Miis tagged ${escapeHtml(label)}.</p></main>`,
    jsonLd: withBreadcrumbs(
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${label} Mii QR Codes`,
        description: `Browse ${BRAND_NAME} residents tagged ${label}.`,
        url: canonical,
      },
      [
        { name: 'Home', url: `${origin}/` },
        { name: 'Browse', url: `${origin}/browse` },
        { name: label, url: canonical },
      ],
    ),
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
