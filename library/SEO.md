# ShareMii — SEO implementation and Search Console setup

## Architecture

Crawler-facing SEO is handled at the edge:

- [`functions/_middleware.ts`](../functions/_middleware.ts) — bot detection and HTML injection
- [`worker/routes/index.ts`](../worker/routes/index.ts) — per-route meta resolution
- [`worker/data/meta.ts`](../worker/data/meta.ts) — titles, descriptions, canonicals, JSON-LD
- [`worker/sitemap/generate.ts`](../worker/sitemap/generate.ts) — dynamic `sitemap.xml`

Client-side meta for browsers is updated via [`src/utils/pageMeta.ts`](../src/utils/pageMeta.ts) on public pages.

Default social image: `https://sharemii.net/assets/og-default.png`

## Indexing rules

| Route pattern | Indexed |
| ------------- | ------- |
| `/`, `/browse`, `/create`, `/mii/:id`, `/u/:username`, `/tag/:slug`, `/collection/:id`, `/collections/browse` | Yes |
| `/about`, `/help` | Yes (brand disambiguation + how-to) |
| `/legal`, `/privacy`, `/terms`, `/child-safety`, `/delete-account` | Yes (low priority) |
| `/feed`, `/settings`, `/favorites`, `/uploads`, `/admin`, `/edit/*` | No (`noindex`) |

## Google Search Console setup

1. Open [Google Search Console](https://search.google.com/search-console) and add property **URL prefix**: `https://sharemii.net`
2. Verify ownership using one of:
   - **DNS TXT record** on the `sharemii.net` zone (recommended for Cloudflare)
   - **HTML file upload** to `public/` (rebuild and deploy)
   - **HTML meta tag** — add to `index.html` `<head>` if Google provides a verification string
3. Submit sitemap: `https://sharemii.net/sitemap.xml`
4. Use **URL Inspection** on:
   - `https://sharemii.net/`
   - `https://sharemii.net/create`
   - `https://sharemii.net/browse`
   - A sample public Mii URL (`/mii/{id}`)
5. Baseline report (save screenshots or export after 48–72 hours):
   - **Pages** → indexed vs not indexed
   - **Sitemaps** → discovered URLs and status
   - **Performance** → impressions, clicks, average position for target queries (`mii qr code`, `mii maker online`, etc.)
   - **Core Web Vitals** → LCP, INP, CLS on mobile

## Brand disambiguation

ShareMii.net competes for the query `sharemii` with the unrelated [Living the Dream save editor](https://sharemii.qwkuns.me/). On-site differentiation:

- Public brand string: **ShareMii.net** (titles, header, footer, schema)
- [`/about`](/about) and [`/help`](/help) explain what this site is vs the save tool
- Home hero disambiguation links to the other tool and to About/Help
- `Organization` + `WebSite` JSON-LD on the home page (`worker/data/meta.ts`)

Optional Cloudflare env var `DISCORD_INVITE_URL` adds Discord to `Organization.sameAs` for crawlers.

## Ongoing monitoring

- Review GSC Performance monthly; refine titles/descriptions where impressions are high but CTR is low
- Confirm `/feed` and private routes stay out of the index
- When public URL count approaches **50,000**, split the sitemap into a sitemap index with chunked child sitemaps

## Learning resources

- [Moz Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo)
- [Ahrefs Blog](https://ahrefs.com/blog/)
- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Backlinko Blog](https://backlinko.com/blog)
