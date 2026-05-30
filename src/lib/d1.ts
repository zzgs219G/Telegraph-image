import type { D1Database } from '@cloudflare/workers-types';
import type { MediaRecord } from './types';

export async function saveMedia(db: D1Database, url: string, fileId: string): Promise<void> {
  await db.prepare(
    'INSERT INTO media (url, fileId) VALUES (?, ?) ON CONFLICT(url) DO NOTHING'
  ).bind(url, fileId).run();
}

export async function getFileIdByUrl(db: D1Database, url: string): Promise<string | null> {
  const result = await db.prepare(
    'SELECT fileId FROM media WHERE url = ?'
  ).bind(url).first<{ fileId: string }>();

  return result?.fileId || null;
}

export async function deleteMediaByUrls(db: D1Database, urls: string[]): Promise<number> {
  if (urls.length === 0) return 0;

  const placeholders = urls.map(() => '?').join(',');
  const result = await db.prepare(
    `DELETE FROM media WHERE url IN (${placeholders})`
  ).bind(...urls).run();

  return result.meta.changes;
}

export async function listMedia(db: D1Database, page: number, pageSize: number): Promise<{ items: MediaRecord[], total: number }> {
  const offset = (page - 1) * pageSize;

  const totalResult = await db.prepare('SELECT COUNT(*) as count FROM media').first<{ count: number }>();
  const total = totalResult?.count || 0;

  const result = await db.prepare(
    `SELECT url, fileId FROM media ORDER BY url DESC LIMIT ${pageSize} OFFSET ${offset}`
  ).all<MediaRecord>();

  return { items: result.results || [], total };
}
