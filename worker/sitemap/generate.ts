import { SITEMAP_STATIC_LASTMOD } from '../../seo/content';
import { fetchSitemapIds, type WorkerEnv } from '../data/supabase';
import { siteOrigin } from '../data/meta';

const STATIC_PATHS: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/browse', changefreq: 'weekly', priority: '0.8' },
  { path: '/create', changefreq: 'weekly', priority: '0.8' },
  { path: '/tags', changefreq: 'weekly', priority: '0.7' },
  { path: '/collections/browse', changefreq: 'weekly', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/help', changefreq: 'monthly', priority: '0.6' },
  { path: '/legal', changefreq: 'monthly', priority: '0.3' },
  { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
  { path: '/terms', changefreq: 'monthly', priority: '0.3' },
  { path: '/child-safety', changefreq: 'monthly', priority: '0.3' },
  { path: '/delete-account', changefreq: 'monthly', priority: '0.3' },
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLastmod(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function urlEntry(
  loc: string,
  changefreq: string,
  priority: string,
  lastmod?: string,
): string {
  const lastmodTag = lastmod
    ? `<lastmod>${xmlEscape(lastmod)}</lastmod>`
    : '';
  return (
    '  <url>' +
    `<loc>${xmlEscape(loc)}</loc>` +
    lastmodTag +
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

  for (const { path, changefreq, priority } of STATIC_PATHS) {
    entries.push(
      urlEntry(
        `${origin}${path === '/' ? '/' : path}`,
        changefreq,
        priority,
        SITEMAP_STATIC_LASTMOD,
      ),
    );
  }

  for (const mii of data.miis) {
    entries.push(
      urlEntry(
        `${origin}/mii/${mii.id}`,
        'weekly',
        '0.7',
        formatLastmod(mii.updated_at ?? mii.created_at),
      ),
    );
  }

  for (const profile of data.profiles) {
    entries.push(
      urlEntry(
        `${origin}/u/${encodeURIComponent(profile.username)}`,
        'weekly',
        '0.6',
        formatLastmod(profile.updated_at),
      ),
    );
  }

  for (const tag of data.tags) {
    entries.push(
      urlEntry(
        `${origin}/tag/${encodeURIComponent(tag.slug)}`,
        'weekly',
        '0.6',
        formatLastmod(tag.created_at),
      ),
    );
  }

  for (const col of data.collections) {
    entries.push(
      urlEntry(
        `${origin}/collection/${col.id}`,
        'weekly',
        '0.5',
        formatLastmod(col.updated_at ?? col.created_at),
      ),
    );
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>'
  );
}
