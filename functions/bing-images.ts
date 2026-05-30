import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../src/lib/types';
import { cacheMatch, cachePut, createCachedResponse } from '../src/lib/cache';
import { CACHE_CONFIG } from '../src/lib/constants';

export const onRequestGet: any = async (context: any) => {
  const { request } = context;
  const bingUrl = 'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=5';

  const cachedResponse = await cacheMatch(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const res = await fetch(bingUrl);
  if (!res.ok) {
    return new Response('请求 Bing API 失败', { status: res.status });
  }

  const bingData = await res.json() as any;
  const images = bingData.images.map((image: any) => ({
    url: `https://cn.bing.com${image.url}`
  }));

  const returnData = {
    status: true,
    message: "操作成功",
    data: images
  };

  const response = createCachedResponse(
    JSON.stringify(returnData),
    'application/json',
    CACHE_CONFIG.API
  );

  context.waitUntil(cachePut(request, response.clone()));
  return response;
};
