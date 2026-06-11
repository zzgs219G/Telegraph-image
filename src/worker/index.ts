import { handleImage } from './handlers/image';
import { handleUpload } from './handlers/upload';
import { handleAdminUpload } from './handlers/adminUpload';
import { handleManage } from './handlers/manage';
import { handleDelete } from './handlers/delete';
import { handleTags } from './handlers/tags';
import { handleBatchTag } from './handlers/media';
import { handleWallpaper } from './handlers/wallpaper';
import { crawlBingWallpapers } from './handlers/cron';
import type { Env } from './utils';

type RouteHandler = (req: Request, env: Env) => Promise<Response>;

interface Route {
  method: string;
  path: string | RegExp;
  handler: RouteHandler;
}

const routes: Route[] = [
  { method: 'POST',  path: '/api/upload',             handler: handleUpload },
  { method: 'POST',  path: '/api/admin/upload',       handler: handleAdminUpload },
  { method: 'GET',   path: '/api/manage',             handler: handleManage },
  { method: 'POST',  path: '/api/delete',             handler: handleDelete },
  { method: 'PATCH', path: '/api/media/batch-tag',    handler: handleBatchTag },
  { method: 'GET',   path: '/api/wallpaper/random',   handler: handleWallpaper },
  { method: 'GET',   path: '/api/bing',               handler: handleWallpaper }, // Alias
  { method: 'POST',  path: '/api/cron/bing',          handler: (_req, env) => crawlBingWallpapers(env, true) as Promise<Response> },
  { method: 'GET',   path: '/api/tags',               handler: handleTags },
  { method: 'POST',  path: '/api/tags',               handler: handleTags },
  { method: 'DELETE',path: /^\/api\/tags\/\d+$/,      handler: handleTags },
  { method: 'PATCH', path: /^\/api\/tags\/\d+$/,      handler: handleTags }
];

/**
 * Cloudflare Worker 入口文件。
 * 这里定义了所有的 API 路由表，负责拦截并分发前端的 HTTP 请求。
 * 如果没有匹配到任何 /api 路由，将统一降级至 `handleImage` 处理静态媒体文件逻辑。
 */
export default {
  // HTTP 请求处理入口
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // 路由分发机制：遍历上方定义的 routes 数组
    for (const route of routes) {
      if (route.method === method) {
        if (typeof route.path === 'string' && route.path === path) {
          return route.handler(request, env);
        } else if (route.path instanceof RegExp && route.path.test(path)) {
          return route.handler(request, env);
        }
      }
    }

    // fallback：兜底由图片处理与 React 静态资源分发器处理
    return handleImage(request, env);
  },

  // 定时任务处理入口（Cron Triggers），由 wrangler.toml 配置触发
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 使用 ctx.waitUntil 保证 Worker 声明周期在爬虫执行完毕后才结束
    ctx.waitUntil(crawlBingWallpapers(env, false));
  }
};