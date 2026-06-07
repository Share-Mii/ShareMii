export const CANONICAL_HOST = 'sharemii.net';
export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

const PRODUCTION_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

/** Always https://sharemii.net for production hosts; otherwise request origin. */
export function canonicalOrigin(request: Request): string {
  const url = new URL(request.url);
  if (isProductionHost(url.hostname)) {
    return CANONICAL_ORIGIN;
  }
  return url.origin;
}

/** 301 to https://sharemii.net when the request used http or www. */
export function canonicalRedirectResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (!isProductionHost(url.hostname)) {
    return null;
  }

  const needsHttps = url.protocol === 'http:';
  const needsApex = url.hostname.toLowerCase() === `www.${CANONICAL_HOST}`;
  if (!needsHttps && !needsApex) {
    return null;
  }

  url.protocol = 'https:';
  url.hostname = CANONICAL_HOST;
  return Response.redirect(url.toString(), 301);
}
