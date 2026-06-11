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
  { method: 'POST',  path: '/api/cron/bing',          handler: (req, env) => crawlBingWallpapers(env, true) as Promise<Response> },
  { method: 'GET',   path: '/api/tags',               handler: handleTags },
  { method: 'POST',  path: '/api/tags',               handler: handleTags },
  { method: 'DELETE',path: /^\/api\/tags\/\d+$/,      handler: handleTags },
  { method: 'PATCH', path: /^\/api\/tags\/\d+$/,      handler: handleTags }
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    for (const route of routes) {
      if (route.method === method) {
        if (typeof route.path === 'string' && route.path === path) {
          return route.handler(request, env);
        } else if (route.path instanceof RegExp && route.path.test(path)) {
          return route.handler(request, env);
        }
      }
    }

    return handleImage(request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(crawlBingWallpapers(env, false));
  }
};