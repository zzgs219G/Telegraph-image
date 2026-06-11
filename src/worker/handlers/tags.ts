import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../utils';
import type { Env } from '../utils';

/**
 * 标签管理系统路由处理程序（多合一处理）。
 * 包含了标签的 GET/POST/PATCH/DELETE API 逻辑。
 * 删除标签时，媒体表 `media` 对应数据会被 `ON DELETE SET NULL` 自动清除其 tag_id，而不是级联删除。
 */
export async function handleTags(request: Request, env: Env): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname;
  const config = extractConfig(env);

  // GET /api/tags - No auth required
  if (method === 'GET' && path === '/api/tags') {
    try {
      const result = await config.database.prepare(`
        SELECT t.id, t.name, t.color, t.created_at, COUNT(m.url) as count
        FROM tags t
        LEFT JOIN media m ON t.id = m.tag_id
        GROUP BY t.id
        ORDER BY t.id ASC
      `).all();
      return jsonResponse({ data: result.results });
    } catch (e: any) {
      return jsonResponse({ error: '获取标签失败', details: e.message }, 500);
    }
  }

  // Auth required for mutating tags
  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  // POST /api/tags - Create tag
  if (method === 'POST' && path === '/api/tags') {
    try {
      const { name, color } = await request.json() as any;
      if (!name || !color) return jsonResponse({ error: 'name and color are required' }, 400);
      const result = await config.database.prepare(
        'INSERT INTO tags (name, color) VALUES (?, ?) RETURNING *'
      ).bind(name, color).first();
      return jsonResponse({ data: result });
    } catch (e: any) {
      return jsonResponse({ error: '创建标签失败', details: e.message }, 500);
    }
  }

  // Match /api/tags/:id
  const match = path.match(/^\/api\/tags\/(\d+)$/);
  if (match) {
    const id = parseInt(match[1], 10);

    // DELETE /api/tags/:id
    if (method === 'DELETE') {
      try {
        await config.database.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
        // tag_id on media is set to NULL automatically via ON DELETE SET NULL
        return jsonResponse({ message: '删除成功' });
      } catch (e: any) {
        return jsonResponse({ error: '删除标签失败', details: e.message }, 500);
      }
    }

    // PATCH /api/tags/:id
    if (method === 'PATCH') {
      try {
        const { name, color } = await request.json() as any;
        if (!name && !color) return jsonResponse({ error: 'name or color required' }, 400);
        const updates: string[] = [];
        const values: any[] = [];
        if (name) { updates.push('name = ?'); values.push(name); }
        if (color) { updates.push('color = ?'); values.push(color); }
        values.push(id);
        const query = `UPDATE tags SET ${updates.join(', ')} WHERE id = ?`;
        await config.database.prepare(query).bind(...values).run();
        return jsonResponse({ message: '更新成功' });
      } catch (e: any) {
        return jsonResponse({ error: '更新标签失败', details: e.message }, 500);
      }
    }
  }

  return new Response('Not found', { status: 404 });
}
