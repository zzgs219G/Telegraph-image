import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  try {
    const keysToDelete = await request.json();
    if (!Array.isArray(keysToDelete) || keysToDelete.length === 0) {
      return jsonResponse({ message: '没有要删除的项' }, 400);
    }

    const placeholders = keysToDelete.map(() => '?').join(',');
    const cache = caches.default;

    const [dbResult] = await Promise.all([
      config.database.prepare(
        `DELETE FROM media WHERE url IN (${placeholders})`
      ).bind(...keysToDelete).run(),
      Promise.all(keysToDelete.map(async (url) => {
        const cacheKey = new Request(url);
        await cache.delete(cacheKey);
      }))
    ]);

    if (dbResult.changes === 0) {
      return jsonResponse({ message: '未找到要删除的项' }, 404);
    }

    return jsonResponse({ message: '删除成功' });
  } catch (error) {
    return jsonResponse({ error: '删除失败', details: error.message }, 500);
  }
}
