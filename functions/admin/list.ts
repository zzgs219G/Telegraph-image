import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../../src/lib/types';
import { authenticate, unauthorizedResponse } from '../../src/lib/auth';
import { listMedia } from '../../src/lib/d1';

export const onRequestGet: any = async (context: any) => {
  const { request, env } = context;

  if (env.ENABLE_AUTH === 'true' && !authenticate(request, env.USERNAME, env.PASSWORD)) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = 50;

  try {
    const data = await listMedia(env.DB, page, pageSize);
    return new Response(JSON.stringify({
      items: data.items,
      total: data.total,
      page,
      pageSize
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
};
