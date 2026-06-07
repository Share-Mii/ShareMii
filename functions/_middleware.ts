import { isBot, isStaticAsset } from '../worker/botDetect';
import { canonicalRedirectResponse } from '../worker/http/canonical';
import { injectSeoIntoHtml } from '../worker/html/shell';
import { resolveSeoMeta } from '../worker/routes/index';
import type { WorkerEnv } from '../worker/data/supabase';

interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
  env: WorkerEnv;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const redirect = canonicalRedirectResponse(context.request);
  if (redirect) {
    return redirect;
  }

  const url = new URL(context.request.url);
  const { pathname } = url;

  if (context.request.method !== 'GET') {
    return context.next();
  }

  if (isStaticAsset(pathname)) {
    return context.next();
  }

  if (!isBot(context.request)) {
    return context.next();
  }

  const seo = await resolveSeoMeta(context.env, context.request, pathname);
  if (!seo) {
    return context.next();
  }

  const baseResponse = await context.next();
  const contentType = baseResponse.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return baseResponse;
  }

  const html = await baseResponse.text();
  const injected = injectSeoIntoHtml(html, seo);
  const headers = new Headers(baseResponse.headers);
  if (seo.noindex) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return new Response(injected, {
    status: baseResponse.status,
    headers,
  });
};
