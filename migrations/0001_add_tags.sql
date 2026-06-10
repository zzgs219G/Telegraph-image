-- 新增标签表
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  color      TEXT    NOT NULL DEFAULT '#6366f1',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 预置系统标签
INSERT OR IGNORE INTO tags (name, color) VALUES
  ('前台上传', '#6366f1'),
  ('后台上传', '#f59e0b'),
  ('必应壁纸', '#10b981');

-- media 表扩展字段
ALTER TABLE media ADD COLUMN tag_id     INTEGER REFERENCES tags(id) ON DELETE SET NULL;
ALTER TABLE media ADD COLUMN filename   TEXT;
ALTER TABLE media ADD COLUMN size       INTEGER;
ALTER TABLE media ADD COLUMN source_url TEXT UNIQUE;  -- 必应去重用
ALTER TABLE media ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch());

-- 索引
CREATE INDEX IF NOT EXISTS idx_media_tag     ON media(tag_id);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_source ON media(source_url);
