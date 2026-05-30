import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../src/lib/types';
import { authenticate, unauthorizedResponse } from '../src/lib/auth';
import { uploadToTelegram } from '../src/lib/telegram';
import { saveMedia } from '../src/lib/d1';
import { getFileExtension, CONTENT_TYPE_MAP } from '../src/lib/constants';

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) throw new Error('缺少文件');

    const maxSize = (env.MAX_SIZE_MB ? parseInt(env.MAX_SIZE_MB, 10) : 20) * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: `文件大小超过${maxSize / (1024 * 1024)}MB限制` }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    if (env.ENABLE_AUTH === 'true' && !authenticate(request, env.USERNAME, env.PASSWORD)) {
      return unauthorizedResponse();
    }

    const fileId = await uploadToTelegram(file, env.TG_BOT_TOKEN, env.TG_CHAT_ID);

    const fileExtension = getFileExtension(file.name) || 'bin';
    const timestamp = Date.now();
    // Assuming DOMAIN is configured. If not, fallback to host
    const domain = env.DOMAIN || new URL(request.url).host;
    const imageURL = `https://${domain}/${timestamp}.${fileExtension}`;

    await saveMedia(env.DB, imageURL, fileId);

    return new Response(JSON.stringify({ data: imageURL }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('内部服务器错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
