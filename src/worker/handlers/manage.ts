import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../utils';
import type { Env } from '../utils';

export async function handleManage(request: Request, env: Env): Promise<Response> {
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const tagIdParam = url.searchParams.get('tag_id');
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  try {
    let countQuery = 'SELECT COUNT(*) as count FROM media';
    let dataQuery = `
      SELECT m.url, m.fileId, m.tag_id, m.filename, m.size, m.created_at, t.name as tag_name, t.color as tag_color
      FROM media m
      LEFT JOIN tags t ON m.tag_id = t.id
    `;
    let countValues: any[] = [];
    let dataValues: any[] = [];

    if (tagIdParam) {
      countQuery += ' WHERE tag_id = ?';
      dataQuery += ' WHERE m.tag_id = ?';
      countValues.push(parseInt(tagIdParam, 10));
      dataValues.push(parseInt(tagIdParam, 10));
    }

    dataQuery += ` ORDER BY m.created_at DESC, m.url DESC LIMIT ${pageSize} OFFSET ${offset}`;

    const totalCountResult = await config.database.prepare(countQuery).bind(...countValues).first();
    const totalCount = totalCountResult?.count as number || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const mediaDataResult = await config.database.prepare(dataQuery).bind(...dataValues).all();

    const mediaData = mediaDataResult.results.map((row: any) => ({
      fileId: row.fileId,
      url: row.url,
      tag_id: row.tag_id,
      filename: row.filename,
      size: row.size,
      created_at: row.created_at,
      tag: row.tag_id ? { id: row.tag_id, name: row.tag_name, color: row.tag_color } : null
    }));

    return jsonResponse({
      data: mediaData,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('获取媒体数据失败:', error);
    return jsonResponse({ error: '获取媒体数据失败', details: error.message }, 500);
  }
}