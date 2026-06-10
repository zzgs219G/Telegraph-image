import { handleImage } from './handlers/image';
import { handleUpload } from './handlers/upload';
import { handleAdminUpload } from './handlers/adminUpload';
import { handleManage } from './handlers/manage';
import { handleDelete } from './handlers/delete';
import { handleTags } from './handlers/tags';
import { handleWallpaper } from './handlers/wallpaper';
import { crawlBingWallpapers } from './handlers/cron';
import type { Env } from './utils';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path === '/api/upload' && method === 'POST') return handleUpload(request, env);
    if (path === '/api/admin/upload' && method === 'POST') return handleAdminUpload(request, env);
    if (path === '/api/manage' && method === 'GET') return handleManage(request, env);
    if (path === '/api/delete' && method === 'POST') return handleDelete(request, env);
    if (path.startsWith('/api/tags') || path === '/api/media/batch-tag') return handleTags(request, env);
    if (path === '/api/wallpaper/random' && method === 'GET') return handleWallpaper(request, env);
    if (path === '/api/cron/bing' && method === 'POST') return crawlBingWallpapers(env, true) as Promise<Response>;
    // Keep /api/bing working as /api/wallpaper/random
    if (path === '/api/bing' && method === 'GET') return handleWallpaper(request, env);

    return handleImage(request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(crawlBingWallpapers(env, false));
  }
};