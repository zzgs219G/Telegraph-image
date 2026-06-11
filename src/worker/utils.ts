export interface Env {
  DATABASE: D1Database;
  ASSETS: Fetcher;
  DOMAIN: string;
  USERNAME?: string;
  PASSWORD?: string;
  ADMIN_PATH?: string;
  ENABLE_AUTH?: string;
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  MAX_SIZE_MB?: string;
}

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
  IMAGE: 2592000,
  API: 300
};

export function extractConfig(env: Env) {
  return {
    domain: env.DOMAIN,
    database: env.DATABASE,
    username: env.USERNAME,
    password: env.PASSWORD,
    adminPath: env.ADMIN_PATH,
    enableAuth: env.ENABLE_AUTH === 'true',
    tgBotToken: env.TG_BOT_TOKEN,
    tgChatId: env.TG_CHAT_ID,
    maxSize: (env.MAX_SIZE_MB ? parseInt(env.MAX_SIZE_MB, 10) : 20) * 1024 * 1024
  };
}

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function getFileExtension(url: string): string {
  return url.split('.').pop()?.toLowerCase() || '';
}

export function getContentType(extension: string): string {
  return CONTENT_TYPE_MAP[extension] || 'application/octet-stream';
}

export function authenticate(request: Request, username?: string, password?: string): boolean {
  if (!username || !password) return false;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials).split(':');
    return credentials[0] === username && credentials[1] === password;
  } catch {
    return false;
  }
}