import {
  browseMeta,
  collectionMeta,
  createMeta,
  homeMeta,
  miiMeta,
  notFoundMeta,
  profileMeta,
  tagMeta,
  type SeoMeta,
} from '../data/meta';
import {
  fetchPublicCollection,
  fetchPublicMii,
  fetchPublicProfile,
  fetchTag,
  type WorkerEnv,
} from '../data/supabase';
import { siteOrigin } from '../data/meta';

const NOINDEX_PREFIXES = [
  '/settings',
  '/uploads',
  '/favorites',
  '/dashboard',
  '/admin',
  '/edit/',
  '/profile',
];

export async function resolveSeoMeta(
  env: WorkerEnv,
  request: Request,
  pathname: string,
): Promise<SeoMeta | null> {
  const origin = siteOrigin(env, request);

  if (NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return { ...notFoundMeta(origin), noindex: true };
  }

  if (pathname === '/' || pathname === '') {
    return homeMeta(origin);
  }
  if (pathname === '/browse') {
    return browseMeta(origin);
  }
  if (pathname === '/create') {
    return createMeta(origin);
  }

  const miiMatch = pathname.match(/^\/mii\/([^/]+)$/);
  if (miiMatch) {
    const mii = await fetchPublicMii(env, miiMatch[1]!);
    if (!mii) return { ...notFoundMeta(origin), noindex: true };
    return miiMeta(origin, mii);
  }

  const userMatch = pathname.match(/^\/u\/([^/]+)$/);
  if (userMatch) {
    const profile = await fetchPublicProfile(
      env,
      decodeURIComponent(userMatch[1]!),
    );
    if (!profile) return { ...notFoundMeta(origin), noindex: true };
    return profileMeta(origin, profile);
  }

  const tagMatch = pathname.match(/^\/tag\/([^/]+)$/);
  if (tagMatch) {
    const slug = decodeURIComponent(tagMatch[1]!);
    const tag = await fetchTag(env, slug);
    const label = tag?.label ?? slug;
    return tagMeta(origin, slug, label);
  }

  const collectionMatch = pathname.match(/^\/collection\/([^/]+)$/);
  if (collectionMatch) {
    const collection = await fetchPublicCollection(env, collectionMatch[1]!);
    if (!collection) return { ...notFoundMeta(origin), noindex: true };
    return collectionMeta(origin, collection);
  }

  if (pathname === '/collections/browse') {
    return {
      title: 'Public collections · ShareMii',
      description: 'Curated Mii lists shared by the ShareMii community.',
      canonical: `${origin}/collections/browse`,
      bodyHtml:
        '<main><h1>Public collections</h1><p>Curated Mii lists from the community.</p></main>',
    };
  }

  return null;
}
