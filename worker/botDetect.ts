const BOT_UA =
  /googlebot|bingbot|yandex|duckduckbot|baiduspider|twitterbot|facebookexternalhit|discordbot|slackbot|linkedinbot|embedly|whatsapp|telegrambot|applebot|preview/i;

export function isBot(request: Request): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  if (BOT_UA.test(ua)) return true;
  return new URL(request.url).searchParams.has('_escaped_fragment_');
}

export function isStaticAsset(pathname: string): boolean {
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') return false;
  if (pathname.startsWith('/assets/')) return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}
