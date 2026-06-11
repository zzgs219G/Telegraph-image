import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../utils';
import type { Env } from '../utils';

export async function handleBatchTag(request: Request, env: Env): Promise<Response> {
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  try {
    const { urls, tag_id } = await request.json() as any;
    if (!Array.isArray(urls) || urls.length === 0) return jsonResponse({ error: 'urls array required' }, 400);

    const pathsToUpdate = urls.map((url: string) => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    });

    const placeholders = pathsToUpdate.map(() => '?').join(',');
    const bindValues = [tag_id === null ? null : tag_id, ...pathsToUpdate];
    const query = `UPDATE media SET tag_id = ? WHERE url IN (${placeholders})`;

    const result = await config.database.prepare(query).bind(...bindValues).run();
    return jsonResponse({ message: '批量打标签成功', count: result.meta.changes });
  } catch (e: any) {
    return jsonResponse({ error: '批量打标签失败', details: e.message }, 500);
  }
}
