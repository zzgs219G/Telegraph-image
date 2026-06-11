import { getFileExtension } from '../utils';

/**
 * 核心逻辑：将文件上传到 Telegram，并将元数据插入 Cloudflare D1 数据库。
 *
 * @param file - 用户上传的文件对象（File）
 * @param config - 环境变量配置（包含 Tg 凭证与数据库实例）
 * @param tagName - 文件的标签归属（如"前台上传" 或 "后台上传"）
 * @returns 包含生成的相对路径（imagePath）的对象
 */
export async function uploadToTelegram(
  file: File,
  config: {
    tgBotToken: string;
    tgChatId: string;
    database: D1Database;
  },
  tagName: string
): Promise<{ imagePath: string }> {
  const uploadFormData = new FormData();
  uploadFormData.append("chat_id", config.tgChatId);

  // Telegram 针对 GIF 格式使用 document 形式发送时有可能无法获得正常的预览
  // 这里在图床场景下直接转为 JPEG 后缀上传作为折中处理方案
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

  const tagResult = await config.database.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();
  const tagId = tagResult?.id || null;

  // 将记录写入 D1 数据库
  // 由于 url 列设置了 UNIQUE 约束，这里带有冲突重试机制（最多 5 次）
  let imagePath: string = '';
  let inserted = false;
  for (let i = 0; i < 5; i++) {
    const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    // 这里故意只存相对路径，防止绑定域名变更时图片地址失效
    imagePath = `/${uniqueId}.${fileExtension}`;
    try {
      const result = await config.database.prepare(
        'INSERT INTO media (url, fileId, tag_id, filename, size) VALUES (?, ?, ?, ?, ?)'
      ).bind(imagePath, fileId, tagId, file.name, file.size).run();
      if (result.meta.changes > 0) { inserted = true; break; }
    } catch {
      // 若抛出 UNIQUE constraint 冲突，则继续下一次循环重试
      continue;
    }
  }
  if (!inserted) throw new Error('无法生成唯一路径，请重试');

  return { imagePath };
}
