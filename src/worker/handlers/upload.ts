import { extractConfig, authenticate, unauthorizedResponse, jsonResponse } from '../utils';
import type { Env } from '../utils';
import { uploadToTelegram } from '../utils/telegram';

/**
 * 前台游客或鉴权上传接口处理逻辑。
 * 根据环境变量决定是否需要认证，上传后打上"前台上传"标签。
 */
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

    const { imagePath } = await uploadToTelegram(file, config, '前台上传');

    return jsonResponse({ data: `https://${config.domain}${imagePath}` });
  } catch (error: any) {
    console.error('内部服务器错误:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}