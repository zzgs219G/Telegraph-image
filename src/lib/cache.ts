export async function cacheMatch(request: any): Promise<Response | undefined> {
  const cache = (caches as any).default;
  return await cache.match(request);
}

export async function cachePut(request: any, response: Response): Promise<void> {
  const cache = (caches as any).default;
  // Clone the response before putting it in the cache
  await cache.put(request, response.clone());
}

export async function cacheDelete(request: any): Promise<boolean> {
  const cache = (caches as any).default;
  return await cache.delete(request);
}

export function createCachedResponse(body: string | ReadableStream, contentType: string, cacheMaxAge: number): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
      'CDN-Cache-Control': `public, max-age=${cacheMaxAge}`
    }
  });
}
