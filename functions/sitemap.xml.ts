import { generateSitemap } from '../worker/sitemap/generate';
import type { WorkerEnv } from '../worker/data/supabase';

interface PagesContext {
  request: Request;
  env: WorkerEnv;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const xml = await generateSitemap(context.env, context.request);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
