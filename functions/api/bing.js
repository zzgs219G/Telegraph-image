import { CACHE_CONFIG } from '../_utils.js';

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=5');

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    // Clone it before returning so the cached response can be used again
    const cloned = cachedResponse.clone();
    return new Response(cloned.body, {
      status: cloned.status,
      headers: cloned.headers
    });
  }

  try {
    const res = await fetch(cacheKey);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: '请求 Bing API 失败' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bingData = await res.json();
    const images = bingData.images.map(image => ({
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

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: '请求 Bing API 失败', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
