import { SITE_URL } from '@/config/brand';
import { INDEXNOW_KEY } from '@/config/seo';

const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

/** Notify Bing/Yandex/etc. that URLs changed (fire-and-forget). */
export function notifyIndexNow(urls: string[]): void {
  const list = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!list.length) return;

  void fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'sharemii.net',
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: list,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function notifyPublicMiiUrl(miiId: string): void {
  notifyIndexNow([`${SITE_URL}/mii/${miiId}`]);
}
