import { getFileExtension, CONTENT_TYPE_MAP, extractConfig, getContentType } from '../utils';
import type { Env } from '../utils';


/**
 * 处理所有静态图片的请求路由。
 * 这是整个应用的核心流量枢纽与高并发防线：
 * * 1. 缓存拦截：高效检索 Cloudflare Cache (边缘节点缓存)，实现微秒级二次访问响应。
 * 2. 身份寻址：若缓存未命中，解析 pathname 并检索 D1 数据库，获取对应的 Telegram `fileId`。
 * 3. 跨域路由：调用 Telegram Bot API 动态换取临时文件路径，并内置 3 次容错重试机制。
 * 4. 强效缓存：重构并注入精准的 Content-Type 与 30天强缓存响应头，安全克隆流并持久化至边缘缓存。
 * 5. 安全回退 (Fallback)：若路径不合法、D1 未命中或执行异常，降级回退给静态资产宿主 (env.ASSETS)。
 * ⚠️ 【架构避坑提示】：在单页应用 (SPA) 部署环境下，不存在的图片路径回退给 ASSETS 时，
 * Cloudflare Pages 会默认判定为前端路由，从而返回 index.html。这会导致图片直链在失效时
 * 在浏览器端直接渲染出带有全局背景壁纸轮播的空白前端页面。
 */


export async function handleImage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const extension = getFileExtension(pathname);

  if (CONTENT_TYPE_MAP[extension]) {
    const config = extractConfig(env);
    const cache = (caches as any).default as Cache;
    const fullUrl = `https://${config.domain}${pathname}`;
    
    // 1. 从缓存中匹配
    const cacheKey = new Request(fullUrl);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;

    try {
      // 从 D1 查询图片绑定的 Telegram 文件 ID
      const result = await config.database.prepare(
        'SELECT fileId FROM media WHERE url = ?'
      ).bind(pathname).first();
      
      if (!result) {
        return env.ASSETS.fetch(request);
      }

      const fileId = result.fileId;
      let filePath;
      
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
      
      // 发起请求获取 TG 原生响应
      const response = await fetch(getFileResponse);
      if (!response.ok) {
        return new Response('获取文件内容失败', { status: 500 });
      }

      // 2. 构造干净的响应头
      const contentType = getContentType(extension);
      const headers = new Headers(response.headers);
      headers.set('Content-Type', contentType);
      headers.set('Content-Disposition', 'inline');
      
      const longCacheAge = 2592000; // 30天
      headers.set('Cache-Control', `public, max-age=${longCacheAge}, immutable`);
      headers.set('CDN-Cache-Control', `public, max-age=${longCacheAge}`);
      headers.set('Access-Control-Allow-Origin', '*');

      // ✨【核心修正】：在这里直接克隆 Telegram 官方的原生 Response 对象
      // Cloudflare 对原生 Response 的克隆有底层底层的 V8 级优化，绝不会发生流死锁
      const responseClone = response.clone();
      
      // 一个装填进缓存键
      const responseToCache = new Response(responseClone.body, {
        status: response.status,
        headers
      });
      
      // 一个直接递交给客户端浏览器
      const responseToClient = new Response(response.body, {
        status: response.status,
        headers
      });

      // 3. 写入缓存并安全返回
      await cache.put(cacheKey, responseToCache);
      return responseToClient;

    } catch (e) {
      console.error("Error serving image:", e);
      return env.ASSETS.fetch(request);
    }
  }
  
  return env.ASSETS.fetch(request);
}
