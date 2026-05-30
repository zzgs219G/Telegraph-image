import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../src/lib/types';
import { getFileIdByUrl } from '../src/lib/d1';
import { getTelegramFileUrl } from '../src/lib/telegram';
import { cacheMatch, cachePut } from '../src/lib/cache';
import { getFileExtension, getContentType, CACHE_CONFIG } from '../src/lib/constants';

export const onRequestGet: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Pass-through for static assets and internal Astro routes
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/' ||
    // If the path equals the admin path, pass to Astro
    (env.ADMIN_PATH && url.pathname === `/${env.ADMIN_PATH}`)
  ) {
    return context.next();
  }

  // Strictly match /<timestamp>.<ext> pattern for images
  // For anything else, pass to Astro to handle (e.g. 404s)
  const imagePattern = /^\/\d+\.\w+$/;
  if (!imagePattern.test(url.pathname)) {
    return context.next();
  }

  const requestedUrl = request.url;

  const cachedResponse = await cacheMatch(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const fileId = await getFileIdByUrl(env.DB, requestedUrl);
  if (!fileId) {
    const notFoundResponse = new Response('资源不存在', { status: 404 });
    context.waitUntil(cachePut(request, notFoundResponse.clone()));
    return notFoundResponse;
  }

  const telegramFileUrl = await getTelegramFileUrl(fileId, env.TG_BOT_TOKEN);

  if (!telegramFileUrl) {
    const notFoundResponse = new Response('未找到FilePath', { status: 404 });
    context.waitUntil(cachePut(request, notFoundResponse.clone()));
    return notFoundResponse;
  }

  const response = await fetch(telegramFileUrl);
  if (!response.ok) {
    return new Response('获取文件内容失败', { status: 500 });
  }

  const fileExtension = getFileExtension(requestedUrl);
  const contentType = getContentType(fileExtension);

  const headers = new Headers(response.headers);
  headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', 'inline');
  headers.set('Cache-Control', `public, max-age=${CACHE_CONFIG.IMAGE}`);
  headers.set('CDN-Cache-Control', `public, max-age=${CACHE_CONFIG.IMAGE}`);

  const responseToCache = new Response(response.body, {
    status: response.status,
    headers
  });

  context.waitUntil(cachePut(request, responseToCache.clone()));
  return responseToCache;
};
