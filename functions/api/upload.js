import { extractConfig, authenticate, unauthorizedResponse, jsonResponse, CONTENT_TYPE_MAP, getFileExtension } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const config = extractConfig(env);

  try {
    const formData = await request.formData();
    const file = formData.get('file');

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
      const errorData = await telegramResponse.json();
      throw new Error(errorData.description || '上传到 Telegram 失败');
    }

    const responseData = await telegramResponse.json();
    const fileId = responseData.result.video?.file_id
      || responseData.result.document?.file_id
      || responseData.result.sticker?.file_id;

    if (!fileId) throw new Error('返回的数据中没有文件 ID');

    const fileExtension = getFileExtension(file.name);
    const timestamp = Date.now();
    const isImage = CONTENT_TYPE_MAP[fileExtension]?.startsWith('image/');
    const imageURL = `https://${config.domain}/${timestamp}.${fileExtension}`;

    await config.database.prepare(
      'INSERT INTO media (url, fileId) VALUES (?, ?) ON CONFLICT(url) DO NOTHING'
    ).bind(imageURL, fileId).run();

    return jsonResponse({ data: imageURL });
  } catch (error) {
    console.error('内部服务器错误:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}
