# D1 Database Migration Guide

## Task 2: Refactor Database Storage Format

The application code has been updated to store only the `pathname` of the image in the `media.url` column instead of the full URL including the domain name.

Before or immediately after deploying the code changes, **you must execute the following SQL** in your Cloudflare D1 console to migrate the existing data.

### Migration SQL:

```sql
-- Optional but recommended: Create a backup of the current media table
CREATE TABLE media_backup AS SELECT * FROM media;

-- Migrate existing data: Remove the 'https://yourdomain.com' prefix, keeping only '/timestamp.ext'
UPDATE media
SET url = '/' || SUBSTR(url, INSTR(url, '/', 9) + 1)
WHERE url LIKE 'http%';

-- Verify the results
SELECT url FROM media LIMIT 5;
-- Expected output: /1781117167589.jpg (and similar paths)
```

## Task 3: Add `source_url` Column to `media`

The background sync task relies on the `source_url` column which was missing from the initial schema. You must apply this migration to avoid SQL errors during wallpaper syncs.

### Migration SQL:

```sql
ALTER TABLE media ADD COLUMN source_url TEXT;
CREATE INDEX IF NOT EXISTS idx_media_source_url ON media(source_url);
```
