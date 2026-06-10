import { extractConfig, CACHE_CONFIG } from '../utils';
import type { Env } from '../utils';

export async function handleWallpaper(_request: Request, env: Env): Promise<Response> {
  const config = extractConfig(env);

  try {
    const query = `
      SELECT url FROM media
      WHERE tag_id = (SELECT id FROM tags WHERE name = '必应壁纸')
      ORDER BY RANDOM()
      LIMIT 5
    `;
    const result = await config.database.prepare(query).all();

    // Default fallback if D1 has no wallpapers yet
    if (result.results.length === 0) {
        return new Response(JSON.stringify({
            status: true,
            message: "操作成功",
            data: [{ url: 'https://cn.bing.com/th?id=OHR.BistiBadlands_ZH-CN8760088514_1920x1080.jpg&rf=LaDigue_1920x1080.jpg' }]
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${CACHE_CONFIG.API}`,
                'CDN-Cache-Control': `public, max-age=${CACHE_CONFIG.API}`
            }
        });
    }

    const returnData = {
      status: true,
      message: "操作成功",
      data: result.results.map((row: any) => ({ url: row.url }))
    };

    return new Response(JSON.stringify(returnData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_CONFIG.API}`,
        'CDN-Cache-Control': `public, max-age=${CACHE_CONFIG.API}`
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: '获取壁纸失败', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
