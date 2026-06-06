import { fetchSitemapIds, type WorkerEnv } from '../data/supabase';
import { siteOrigin } from '../data/meta';

const STATIC_PATHS = [
  '/',
  '/browse',
  '/create',
  '/feed',
  '/collections/browse',
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(loc: string, changefreq: string, priority: string): string {
  return (
    '  <url>' +
    `<loc>${xmlEscape(loc)}</loc>` +
    `<changefreq>${changefreq}</changefreq>` +
    `<priority>${priority}</priority>` +
    '</url>'
  );
}

export async function generateSitemap(
  env: WorkerEnv,
  request: Request,
): Promise<string> {
  const origin = siteOrigin(env, request);
  const data = await fetchSitemapIds(env);
  const entries: string[] = [];

  for (const path of STATIC_PATHS) {
    entries.push(
      urlEntry(
        `${origin}${path === '/' ? '/' : path}`,
        path === '/' ? 'daily' : 'weekly',
        path === '/' ? '1.0' : '0.8',
      ),
    );
  }

  for (const mii of data.miis) {
    entries.push(
      urlEntry(`${origin}/mii/${mii.id}`, 'weekly', '0.7'),
    );
  }

  for (const profile of data.profiles) {
    entries.push(
      urlEntry(
        `${origin}/u/${encodeURIComponent(profile.username)}`,
        'weekly',
        '0.6',
      ),
    );
  }

  for (const tag of data.tags) {
    entries.push(
      urlEntry(
        `${origin}/tag/${encodeURIComponent(tag.slug)}`,
        'weekly',
        '0.6',
      ),
    );
  }

  for (const col of data.collections) {
    entries.push(
      urlEntry(`${origin}/collection/${col.id}`, 'weekly', '0.5'),
    );
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>'
  );
}
