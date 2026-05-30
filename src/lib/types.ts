export interface Env {
  DB: D1Database;
  DOMAIN: string;
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  ADMIN_PATH?: string;
  ENABLE_AUTH?: string;
  USERNAME?: string;
  PASSWORD?: string;
  MAX_SIZE_MB?: string;
}

export interface MediaRecord {
  url: string;
  fileId: string;
}
