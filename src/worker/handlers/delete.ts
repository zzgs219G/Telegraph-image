import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../utils';
import type { Env } from '../utils';

export async function handleDelete(request: Request, env: Env): Promise<Response> {
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  try {
    const keysToDeleteUrls = await request.json() as string[];
    if (!Array.isArray(keysToDeleteUrls) || keysToDeleteUrls.length === 0) {
      return jsonResponse({ message: '没有要删除的项' }, 400);
    }

    const keysToDelete = keysToDeleteUrls.map(url => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    });

    const placeholders = keysToDelete.map(() => '?').join(',');
    const cache = (caches as any).default as Cache;

    const [dbResult] = await Promise.all([
      config.database.prepare(
        `DELETE FROM media WHERE url IN (${placeholders})`
      ).bind(...keysToDelete).run(),
      Promise.all(keysToDeleteUrls.map(async (url) => {
        const cacheKey = new Request(url);
        await cache.delete(cacheKey);
      }))
    ]);

    if (dbResult.meta.changes === 0) {
      return jsonResponse({ message: '未找到要删除的项' }, 404);
    }

    return jsonResponse({ message: '删除成功' });
  } catch (error: any) {
    return jsonResponse({ error: '删除失败', details: error.message }, 500);
  }
}