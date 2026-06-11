import { extractConfig, jsonResponse } from '../utils';
import type { Env } from '../utils';

/**
 * 定时任务 / 手动触发抓取必应壁纸功能。
 * 此函数会拉取 Bing 官方接口获取最近 8 天的高清壁纸。
 * 将壁纸下载并转存到 Telegram，同时在 D1 中做好记录绑定。
 *
 * @param env - Cloudflare 环境绑定变量
 * @param manual - 是否为后台用户手动点击触发（手动触发会返回 Response）
 */
export async function crawlBingWallpapers(env: Env, manual: boolean = false): Promise<Response | void> {
  const config = extractConfig(env);

  try {
    const res = await fetch('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8');
    if (!res.ok) throw new Error('Failed to fetch Bing API');

    const bingData = await res.json() as any;
    const images = bingData.images || [];

    let successCount = 0;
    let skippedCount = 0;

    const tagResult = await config.database.prepare('SELECT id FROM tags WHERE name = ?').bind('必应壁纸').first();
    const tagId = tagResult?.id || null;

    for (const image of images) {
      const sourceUrl = `https://cn.bing.com${image.url}`;

      const exists = await config.database.prepare('SELECT 1 FROM media WHERE source_url = ?').bind(sourceUrl).first();
      if (exists) {
        skippedCount++;
        continue;
      }

      const imgRes = await fetch(sourceUrl);
      if (!imgRes.ok) continue;

      const blob = await imgRes.blob();
      const file = new File([blob], `bing_${image.startdate}.jpg`, { type: 'image/jpeg' });

      const uploadFormData = new FormData();
      uploadFormData.append("chat_id", config.tgChatId);
      uploadFormData.append("document", file);

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${config.tgBotToken}/sendDocument`,
        { method: 'POST', body: uploadFormData }
      );

      if (!telegramResponse.ok) continue;

      const responseData = await telegramResponse.json() as any;
      const fileId = responseData.result.document?.file_id;
      if (!fileId) continue;

      const imagePath = `/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;

      await config.database.prepare(
        'INSERT INTO media (url, fileId, tag_id, source_url, filename, size) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(imagePath, fileId, tagId, sourceUrl, file.name, file.size).run();

      successCount++;
    }

    if (manual) {
      return jsonResponse({ success: successCount, skipped: skippedCount, message: '抓取完成' });
    }
  } catch (e: any) {
    console.error('Bing Crawl Error:', e);
    if (manual) {
      return jsonResponse({ error: '抓取失败', details: e.message }, 500);
    }
  }
}
