import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../src/lib/types';
import { authenticate, unauthorizedResponse } from '../src/lib/auth';
import { deleteMediaByUrls } from '../src/lib/d1';
import { cacheDelete } from '../src/lib/cache';

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  if (env.ENABLE_AUTH === 'true' && !authenticate(request, env.USERNAME, env.PASSWORD)) {
    return unauthorizedResponse();
  }

  try {
    const keysToDelete: string[] = await request.json();
    if (!Array.isArray(keysToDelete) || keysToDelete.length === 0) {
      return new Response(JSON.stringify({ message: '没有要删除的项' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    const [deletedCount] = await Promise.all([
      deleteMediaByUrls(env.DB, keysToDelete),
      Promise.all(keysToDelete.map(url => cacheDelete(url)))
    ]);

    if (deletedCount === 0) {
      return new Response(JSON.stringify({ message: '未找到要删除的项' }), { status: 404, headers: { 'Content-Type': 'application/json' }});
    }

    return new Response(JSON.stringify({ message: '删除成功' }), { status: 200, headers: { 'Content-Type': 'application/json' }});
  } catch (error: any) {
    return new Response(JSON.stringify({ error: '删除失败', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
};
