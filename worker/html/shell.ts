import type { SeoMeta } from '../data/meta';

function upsertMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const escaped = content.replace(/"/g, '&quot;');
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i',
  );
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function upsertLink(html: string, rel: string, href: string): string {
  const escaped = href.replace(/"/g, '&quot;');
  const re = new RegExp(
    `<link[^>]+rel=["']${rel}["'][^>]*>`,
    'i',
  );
  const tag = `<link rel="${rel}" href="${escaped}" />`;
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

export function injectSeoIntoHtml(html: string, meta: SeoMeta): string {
  let out = html;

  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeText(meta.title)}</title>`);

  out = upsertMeta(out, 'name', 'description', meta.description);
  out = upsertMeta(out, 'property', 'og:title', meta.title);
  out = upsertMeta(out, 'property', 'og:description', meta.description);
  out = upsertMeta(out, 'property', 'og:url', meta.canonical);
  out = upsertMeta(out, 'property', 'og:type', meta.type ?? 'website');
  out = upsertMeta(out, 'property', 'og:site_name', 'ShareMii.net');
  out = upsertMeta(out, 'name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary');
  out = upsertMeta(out, 'name', 'twitter:title', meta.title);
  out = upsertMeta(out, 'name', 'twitter:description', meta.description);

  if (meta.image) {
    out = upsertMeta(out, 'property', 'og:image', meta.image);
    out = upsertMeta(out, 'name', 'twitter:image', meta.image);
    if (meta.imageWidth) {
      out = upsertMeta(out, 'property', 'og:image:width', String(meta.imageWidth));
    }
    if (meta.imageHeight) {
      out = upsertMeta(out, 'property', 'og:image:height', String(meta.imageHeight));
    }
  }

  out = upsertLink(out, 'canonical', meta.canonical);

  if (meta.noindex) {
    out = upsertMeta(out, 'name', 'robots', 'noindex, nofollow');
  }

  if (meta.jsonLd) {
    const json = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
    const script = `<script type="application/ld+json">${json}</script>`;
    out = out.replace('</head>', `    ${script}\n  </head>`);
  }

  if (meta.bodyHtml) {
    const preview =
      `<div id="seo-preview" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">` +
      `${meta.bodyHtml}</div>`;
    out = out.replace('<div id="app">', `${preview}<div id="app">`);
  }

  return out;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
