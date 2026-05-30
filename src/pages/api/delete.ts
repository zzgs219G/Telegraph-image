import type { APIRoute } from 'astro';
import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../../utils/_utils';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime.env;
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  try {
    const keysToDelete: string[] = await request.json();
    if (!Array.isArray(keysToDelete) || keysToDelete.length === 0) {
      return jsonResponse({ message: '没有要删除的项' }, 400);
    }

    const placeholders = keysToDelete.map(() => '?').join(',');
    const cache = (caches as any).default;

    const [dbResult] = await Promise.all([
      config.database.prepare(
        `DELETE FROM media WHERE url IN (${placeholders})`
      ).bind(...keysToDelete).run(),
      Promise.all(keysToDelete.map(async (url) => {
        const cacheKey = new Request(url);
        if (cache) await cache.delete(cacheKey);
      }))
    ]);

    if (dbResult.changes === 0) {
      return jsonResponse({ message: '未找到要删除的项' }, 404);
    }

    return jsonResponse({ message: '删除成功' });
  } catch (error: any) {
    return jsonResponse({ error: '删除失败', details: error.message }, 500);
  }
};
