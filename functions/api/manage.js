import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  try {
    const totalCountResult = await config.database.prepare('SELECT COUNT(*) as count FROM media').first();
    const totalCount = totalCountResult.count;
    const totalPages = Math.ceil(totalCount / pageSize);

    const mediaDataResult = await config.database.prepare(
      `SELECT url, fileId FROM media ORDER BY url DESC LIMIT ${pageSize} OFFSET ${offset}`
    ).all();

    const mediaData = mediaDataResult.results.map(row => ({ fileId: row.fileId, url: row.url }));

    return jsonResponse({
      data: mediaData,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取媒体数据失败:', error);
    return jsonResponse({ error: '获取媒体数据失败', details: error.message }, 500);
  }
}
