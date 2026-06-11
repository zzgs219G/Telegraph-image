import { extractConfig, jsonResponse, authenticate, unauthorizedResponse } from '../utils';
import type { Env } from '../utils';
import { uploadToTelegram } from '../utils/telegram';

/**
 * 后台上传媒体接口处理逻辑。
 * 要求管理员鉴权，统一将其打上"后台上传"的标签。
 */
export async function handleAdminUpload(request: Request, env: Env): Promise<Response> {
  const config = extractConfig(env);

  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) throw new Error('缺少文件');

    if (file.size > config.maxSize) {
      return jsonResponse({ error: `文件大小超过${config.maxSize / (1024 * 1024)}MB限制` }, 413);
    }

    const { imagePath } = await uploadToTelegram(file, config, '后台上传');

    return jsonResponse({ data: `https://${config.domain}${imagePath}` });
  } catch (error: any) {
    console.error('内部服务器错误:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}
