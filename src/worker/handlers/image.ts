import { getFileExtension, CONTENT_TYPE_MAP, extractConfig, CACHE_CONFIG, getContentType } from '../utils';
import type { Env } from '../utils';

/**
 * 处理所有静态图片的请求路由。
 * 这是整个应用的核心功能之一：
 * 1. 拦截对图片的请求，检查是否有缓存。
 * 2. 如果无缓存，查询 D1 数据库获取该图片在 Telegram 的 `fileId`。
 * 3. 通过 Telegram API 获取临时下载链接，并将图片抓取下来。
 * 4. 写入 Cloudflare Cache (边缘节点缓存) 返回给用户，极大提升二次访问速度。
 * 5. 如果路径不合法或者不是图片，回退(fallback)给 Vite 构建生成的静态资源。
 */
export async function handleImage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 根据拓展名判断是否是潜在的媒体文件
  const extension = getFileExtension(pathname);
  if (CONTENT_TYPE_MAP[extension]) {
    const config = extractConfig(env);

    // 获取 Cache API 的实例
    const cache = (caches as any).default as Cache;
    const fullUrl = `https://${config.domain}${pathname}`;

    // ⚡ 核心改动 1：构造纯 URL cache key，而 match 时加上 cf 对象
    // ✨ 绿色环保、绝不串线的标准写法
const cacheKey = new Request(fullUrl);
// 直接用纯粹的 cacheKey 去匹配，不要夹带任何 cf 对象的私货
const cachedResponse = await cache.match(cacheKey);

if (cachedResponse) return cachedResponse;


    try {
      // 从 D1 查询图片绑定的 Telegram 文件 ID
      const result = await config.database.prepare(
        'SELECT fileId FROM media WHERE url = ?'
      ).bind(pathname).first();

      if (!result) {
        // 找不到，可能是 React 内部生成的带有文件后缀的资源(如字体)
        return env.ASSETS.fetch(request);
      }

      const fileId = result.fileId;
      let filePath;
      // Telegram GetFile API 有时会请求失败，增加 3 次重试机制提高稳定性
      for (let attempts = 0; attempts < 3; attempts++) {
        const getFilePath = await fetch(
          `https://api.telegram.org/bot${config.tgBotToken}/getFile?file_id=${fileId}`
        );
        if (getFilePath.ok) {
          const fileData = await getFilePath.json() as any;
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
      return env.ASSETS.fetch(request);
    }
  }

  // Not an image or no extension match, pass to ASSETS (the React app)
  return env.ASSETS.fetch(request);
}