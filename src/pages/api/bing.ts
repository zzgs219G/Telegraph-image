import type { APIRoute } from 'astro';
import { CACHE_CONFIG } from '../../utils/_utils';

export const prerender = false;
export const GET: APIRoute = async () => {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=5');

  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cloned = cachedResponse.clone();
      return new Response(cloned.body, {
        status: cloned.status,
        headers: cloned.headers
      });
    }
  }

  try {
    const res = await fetch(cacheKey);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: '请求 Bing API 失败' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bingData: any = await res.json();
    const images = bingData.images.map((image: any) => ({
      url: `https://cn.bing.com${image.url}`
    }));

    const returnData = {
      status: true,
      message: "操作成功",
      data: images
    };

    const response = new Response(JSON.stringify(returnData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_CONFIG.API}`,
        'CDN-Cache-Control': `public, max-age=${CACHE_CONFIG.API}`
      }
    });

    if (cache) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: '请求 Bing API 失败', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
