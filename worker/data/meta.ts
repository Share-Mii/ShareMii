import { buildRenderUrl } from './renderUrl';

export const DEFAULT_TITLE = 'ShareMii';
export const DEFAULT_DESCRIPTION =
  'Browse, share, and create Nintendo Miis with the ShareMii community.';

export const DEFAULT_OG_IMAGE = 'https://sharemii.net/assets/favicon.svg';

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
  return title.includes('ShareMii') ? title : `${title} · ShareMii`;
}

const PRODUCTION_ORIGIN = 'https://sharemii.net';

export function siteOrigin(env: { SITE_ORIGIN?: string }, request: Request): string {
  return (
    env.SITE_ORIGIN?.replace(/\/$/, '') ||
    PRODUCTION_ORIGIN ||
    new URL(request.url).origin
  );
}

export function homeMeta(origin: string): SeoMeta {
  return {
    title: formatTitle('ShareMii — Browse, Share & Scan Mii QR Codes'),
    description:
      'Browse, share, and scan Mii QR codes from 3DS, Wii U, and Tomodachi Life. Free online Mii Maker and community gallery.',
    canonical: `${origin}/`,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      '<main><h1>Browse, share, &amp; collect Miis</h1>' +
      '<p>Community Mii sharing — scan QR codes or use the in-browser Mii Maker.</p></main>',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ShareMii',
      url: origin,
      description: DEFAULT_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${origin}/browse?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
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
      'Create and customize Nintendo Miis in your browser. Export QR codes and share with the ShareMii community.',
    canonical: `${origin}/create`,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      '<main><h1>Online Mii Maker</h1><p>Create Miis in your browser and share them with the community.</p></main>',
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
    `${mii.name} — shared on ShareMii by ${mii.creator_name || 'the community'}`;
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
    jsonLd: {
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
  };
}

export function profileMeta(
  origin: string,
  profile: { username: string; bio?: string | null },
): SeoMeta {
  const description =
    profile.bio?.trim() ||
    `Miis shared by ${profile.username} on ShareMii`;
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
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: profile.username,
        url: canonical,
      },
    },
  };
}

export function tagMeta(origin: string, slug: string, label: string): SeoMeta {
  const canonical = `${origin}/tag/${encodeURIComponent(slug)}`;
  return {
    title: formatTitle(`${label} Mii QR Codes`),
    description: `Browse ShareMii residents tagged ${label}.`,
    canonical,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      `<main><h1>${escapeHtml(label)} Miis</h1>` +
      `<p>Browse community Miis tagged ${escapeHtml(label)}.</p></main>`,
  };
}

export function collectionMeta(
  origin: string,
  collection: { id: string; name: string; description?: string | null },
): SeoMeta {
  const description =
    collection.description?.trim() ||
    `A curated Mii collection on ShareMii: ${collection.name}`;
  const canonical = `${origin}/collection/${collection.id}`;
  return {
    title: formatTitle(collection.name),
    description,
    canonical,
    image: DEFAULT_OG_IMAGE,
    bodyHtml:
      `<main><h1>${escapeHtml(collection.name)}</h1>` +
      `<p>${escapeHtml(description)}</p></main>`,
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
