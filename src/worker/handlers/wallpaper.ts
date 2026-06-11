import { extractConfig } from '../utils';
import type { Env } from '../utils';

const WALLPAPER_CACHE_TTL = 86400; // 24小时，壁纸一天才更新一次

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

    // D1 里还没有壁纸时的兜底（首次部署还没抓取过）
    if (result.results.length === 0) {
      return new Response(JSON.stringify({
        status: true,
        message: "操作成功",
        data: [{ url: 'https://cn.bing.com/th?id=OHR.BistiBadlands_ZH-CN8760088514_1920x1080.jpg&rf=LaDigue_1920x1080.jpg' }]
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // 兜底数据不缓存太久，5分钟后重试看D1是否已有数据
          'Cache-Control': 'public, max-age=300',
          'CDN-Cache-Control': 'public, max-age=300'
        }
      });
    }

    const returnData = {
      status: true,
      message: "操作成功",
      data: result.results.map((row: any) => ({ url: `https://${config.domain}${row.url}` }))
    };
    return new Response(JSON.stringify(returnData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // D1有数据时缓存24小时，壁纸一天才更新一次，没必要频繁查询
        'Cache-Control': `public, max-age=${WALLPAPER_CACHE_TTL}`,
        'CDN-Cache-Control': `public, max-age=${WALLPAPER_CACHE_TTL}`
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: '获取壁纸失败', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
