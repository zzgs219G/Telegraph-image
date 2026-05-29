import { getFileExtension, CONTENT_TYPE_MAP, extractConfig, CACHE_CONFIG, getContentType } from './_utils.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Check if it's potentially an image file based on extension
  const extension = getFileExtension(pathname);
  if (CONTENT_TYPE_MAP[extension]) {
    const config = extractConfig(env);

    // We only process it if it's an image. Otherwise, fallback to next()
    const requestedUrl = url.origin + pathname;
    const cache = caches.default;

    // ⚡ 核心改动 1：构造一个带有缓存行为的请求对象
    const cacheKey = new Request(requestedUrl, {
      cf: {
        cacheEverything: true,
        cacheTtl: CACHE_CONFIG.IMAGE
      }
    });

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;

    try {
      const result = await config.database.prepare(
        'SELECT fileId FROM media WHERE url = ?'
      ).bind(requestedUrl).first();

      if (!result) {
        return await next(); // Fallback to React static assets instead of immediately failing.
      }

      const fileId = result.fileId;
      let filePath;
      for (let attempts = 0; attempts < 3; attempts++) {
        const getFilePath = await fetch(
          `https://api.telegram.org/bot${config.tgBotToken}/getFile?file_id=${fileId}`
        );
        if (getFilePath.ok) {
          const fileData = await getFilePath.json();
          if (fileData.ok && fileData.result.file_path) {
            filePath = fileData.result.file_path;
            break;
          }
        }
      }
      if (!filePath) {
        const notFoundResponse = new Response('未找到FilePath', { status: 404 });
        await cache.put(cacheKey, notFoundResponse.clone());
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

      // ⚡ 核心改动 2：把缓存时间放大，从 1 天改成 30 天
      const longCacheAge = 2592000;
      headers.set('Cache-Control', `public, max-age=${longCacheAge}, immutable`);
      headers.set('CDN-Cache-Control', `public, max-age=${longCacheAge}`);

      // 允许跨域
      headers.set('Access-Control-Allow-Origin', '*');

      const responseToCache = new Response(response.body, {
        status: response.status,
        headers
      });

      await cache.put(cacheKey, responseToCache.clone());
      return responseToCache;
    } catch (e) {
      console.error("Error serving image:", e);
      return await next();
    }
  }

  // Not an image or no extension match, pass to ASSETS (the React app)
  return next();
}
