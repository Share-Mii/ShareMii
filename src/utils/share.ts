import { getSiteOrigin } from '@/utils/pageMeta';

export function buildShareUrl(routePath: string): string {
  const clean = routePath.replace(/^#\/?/, '').replace(/^\//, '');
  return `${getSiteOrigin()}/${clean}`;
}

export function buildMiiShareUrl(miiId: string): string {
  return buildShareUrl(`mii/${miiId}`);
}

export function buildProfileShareUrl(username: string): string {
  return buildShareUrl(`u/${encodeURIComponent(username)}`);
}

export function buildCollectionShareUrl(collectionId: string): string {
  return buildShareUrl(`collection/${collectionId}`);
}

export function buildEmbedHtml(
  miiId: string,
  imageUrl: string,
  width = 320,
): string {
  const url = buildMiiShareUrl(miiId);
  const wrap =
    'display:inline-block;line-height:0;border-radius:12px;overflow:hidden;' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.12);background:#f4f4f4;';
  const link = 'text-decoration:none;display:block;border:0;line-height:0';
  const img = `display:block;border:0;max-width:100%;height:auto;vertical-align:middle`;
  return (
    `<div style="${wrap}">` +
    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${link}">` +
    `<img src="${imageUrl}" width="${width}" alt="Mii on ShareMii" loading="lazy" style="${img}" />` +
    `</a></div>`
  );
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export async function shareNative(data: {
  title: string;
  text?: string;
  url: string;
}): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const copied = await copyToClipboard(data.url);
  return copied ? 'copied' : 'cancelled';
}
