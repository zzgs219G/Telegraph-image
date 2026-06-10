import { extractConfig, authenticate, unauthorizedResponse, jsonResponse, getFileExtension } from '../utils';
import type { Env } from '../utils';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  const config = extractConfig(env);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) throw new Error('缺少文件');

    if (file.size > config.maxSize) {
      return jsonResponse({ error: `文件大小超过${config.maxSize / (1024 * 1024)}MB限制` }, 413);
    }

    if (config.enableAuth && !authenticate(request, config.username, config.password)) {
      return unauthorizedResponse();
    }

    const uploadFormData = new FormData();
    uploadFormData.append("chat_id", config.tgChatId);

    if (file.type.startsWith('image/gif')) {
      const newFileName = file.name.replace(/\\.gif$/, '.jpeg');
      const newFile = new File([file], newFileName, { type: 'image/jpeg' });
      uploadFormData.append("document", newFile);
    } else {
      uploadFormData.append("document", file);
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${config.tgBotToken}/sendDocument`,
      { method: 'POST', body: uploadFormData }
    );

    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json() as any;
      throw new Error(errorData.description || '上传到 Telegram 失败');
    }

    const responseData = await telegramResponse.json() as any;
    const fileId = responseData.result.video?.file_id
      || responseData.result.document?.file_id
      || responseData.result.sticker?.file_id;

    if (!fileId) throw new Error('返回的数据中没有文件 ID');

    const fileExtension = getFileExtension(file.name);

    const tagResult = await config.database.prepare('SELECT id FROM tags WHERE name = ?').bind('前台上传').first();
    const tagId = tagResult?.id || null;

    let imagePath: string = '';
    let inserted = false;
    for (let i = 0; i < 5; i++) {
      const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      imagePath = `/${uniqueId}.${fileExtension}`;
      try {
        const result = await config.database.prepare(
          'INSERT INTO media (url, fileId, tag_id, filename, size) VALUES (?, ?, ?, ?, ?)'
        ).bind(imagePath, fileId, tagId, file.name, file.size).run();
        if (result.meta.changes > 0) { inserted = true; break; }
      } catch {
        // UNIQUE constraint，继续重试
        continue;
      }
    }
    if (!inserted) throw new Error('无法生成唯一路径，请重试');

    return jsonResponse({ data: `https://${config.domain}${imagePath}` });
  } catch (error: any) {
    console.error('内部服务器错误:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}