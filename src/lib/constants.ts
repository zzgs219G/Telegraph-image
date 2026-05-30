export const CONTENT_TYPE_MAP: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'webm': 'video/webm'
};

export const CACHE_CONFIG = {
  HTML: 3600,
  IMAGE: 86400,
  API: 300
};

export function getFileExtension(url: string): string {
  const parts = url.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getContentType(extension: string): string {
  return CONTENT_TYPE_MAP[extension] || 'application/octet-stream';
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
