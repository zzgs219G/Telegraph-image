import type { APIRoute } from 'astro';
import { getFileExtension, CONTENT_TYPE_MAP, extractConfig, CACHE_CONFIG, getContentType } from '../utils/_utils';

export const prerender = false;
export const ALL: APIRoute = async ({ request, locals, url }) => {
  const pathname = url.pathname;
  const extension = getFileExtension(pathname);

  // If it's not a known image/video type, return 404
  if (!CONTENT_TYPE_MAP[extension]) {
    return new Response('Not Found', { status: 404 });
  }

  const env = (locals as any).runtime.env;
  const config = extractConfig(env);

  const requestedUrl = url.origin + pathname;
  const cache = (caches as any).default;

  const cacheKey = new Request(requestedUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: CACHE_CONFIG.IMAGE
    }
  } as any);

  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;
  }

  try {
    const result: any = await config.database.prepare(
      'SELECT fileId FROM media WHERE url = ?'
    ).bind(requestedUrl).first();

    if (!result) {
      return new Response('Not Found', { status: 404 });
    }

    const fileId = result.fileId;
    let filePath;
    for (let attempts = 0; attempts < 3; attempts++) {
      const getFilePath = await fetch(
        `https://api.telegram.org/bot${config.tgBotToken}/getFile?file_id=${fileId}`
      );
      if (getFilePath.ok) {
        const fileData: any = await getFilePath.json();
        if (fileData.ok && fileData.result.file_path) {
          filePath = fileData.result.file_path;
          break;
        }
      }
    }

    if (!filePath) {
      const notFoundResponse = new Response('未找到FilePath', { status: 404 });
      if (cache) await cache.put(cacheKey, notFoundResponse.clone());
      return notFoundResponse;
    }

    const getFileResponse = `https://api.telegram.org/file/bot${config.tgBotToken}/${filePath}`;
    const response = await fetch(getFileResponse);
    if (!response.ok) {
      return new Response('获取文件内容失败', { status: 500 });
    }

    const contentType = getContentType(extension);
    const headers = new Headers(response.headers);

    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', 'inline');

    const longCacheAge = 2592000;
    headers.set('Cache-Control', `public, max-age=${longCacheAge}, immutable`);
    headers.set('CDN-Cache-Control', `public, max-age=${longCacheAge}`);
    headers.set('Access-Control-Allow-Origin', '*');

    const responseToCache = new Response(response.body, {
      status: response.status,
      headers
    });

    if (cache) await cache.put(cacheKey, responseToCache.clone());
    return responseToCache;
  } catch (e) {
    console.error("Error serving image:", e);
    return new Response('Internal Server Error', { status: 500 });
  }
};
