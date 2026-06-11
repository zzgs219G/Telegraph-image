var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker/utils.ts
var CONTENT_TYPE_MAP = {
  "jpg": "image/jpeg",
  "jpeg": "image/jpeg",
  "png": "image/png",
  "gif": "image/gif",
  "webp": "image/webp",
  "bmp": "image/bmp",
  "svg": "image/svg+xml",
  "mp4": "video/mp4",
  "avi": "video/x-msvideo",
  "mov": "video/quicktime",
  "webm": "video/webm"
};
var CACHE_CONFIG = {
  HTML: 3600,
  IMAGE: 86400,
  API: 300
};
function extractConfig(env) {
  return {
    domain: env.DOMAIN,
    database: env.DATABASE,
    username: env.USERNAME,
    password: env.PASSWORD,
    adminPath: env.ADMIN_PATH,
    enableAuth: env.ENABLE_AUTH === "true",
    tgBotToken: env.TG_BOT_TOKEN,
    tgChatId: env.TG_CHAT_ID,
    maxSize: (env.MAX_SIZE_MB ? parseInt(env.MAX_SIZE_MB, 10) : 20) * 1024 * 1024
  };
}
__name(extractConfig, "extractConfig");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}
__name(unauthorizedResponse, "unauthorizedResponse");
function getFileExtension(url) {
  return url.split(".").pop()?.toLowerCase() || "";
}
__name(getFileExtension, "getFileExtension");
function getContentType(extension) {
  return CONTENT_TYPE_MAP[extension] || "application/octet-stream";
}
__name(getContentType, "getContentType");
function authenticate(request, username, password) {
  if (!username || !password) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  try {
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = atob(base64Credentials).split(":");
    return credentials[0] === username && credentials[1] === password;
  } catch {
    return false;
  }
}
__name(authenticate, "authenticate");

// src/worker/handlers/image.ts
async function handleImage(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const extension = getFileExtension(pathname);
  if (CONTENT_TYPE_MAP[extension]) {
    const config = extractConfig(env);
    const cache = caches.default;
    const fullUrl = `https://${config.domain}${pathname}`;
    const cacheKey = new Request(fullUrl, {
      cf: {
        cacheEverything: true,
        cacheTtl: CACHE_CONFIG.IMAGE
      }
    });
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;
    try {
      const result = await config.database.prepare(
        "SELECT fileId FROM media WHERE url = ?"
      ).bind(pathname).first();
      if (!result) {
        return env.ASSETS.fetch(request);
      }
      const fileId = result.fileId;
      let filePath;
      for (let attempts = 0; attempts < 3; attempts++) {
        const getFilePath = await fetch(
          `https://api.telegram.org/bot${config.tgBotToken}/getFile?file_id=${fileId}`
        );
        if (getFilePath.ok) {
          const fileData = await getFilePath.json();
          if (fileData.ok && fileData.result.file_path) {
            filePath = fileData.result.file_path;
            break;
          }
        }
      }
      if (!filePath) {
        const notFoundResponse = new Response("\u672A\u627E\u5230FilePath", { status: 404 });
        await cache.put(cacheKey, notFoundResponse.clone());
        return notFoundResponse;
      }
      const getFileResponse = `https://api.telegram.org/file/bot${config.tgBotToken}/${filePath}`;
      const response = await fetch(getFileResponse);
      if (!response.ok) {
        return new Response("\u83B7\u53D6\u6587\u4EF6\u5185\u5BB9\u5931\u8D25", { status: 500 });
      }
      const contentType = getContentType(extension);
      const headers = new Headers(response.headers);
      headers.set("Content-Type", contentType);
      headers.set("Content-Disposition", "inline");
      const longCacheAge = 2592e3;
      headers.set("Cache-Control", `public, max-age=${longCacheAge}, immutable`);
      headers.set("CDN-Cache-Control", `public, max-age=${longCacheAge}`);
      headers.set("Access-Control-Allow-Origin", "*");
      const responseToCache = new Response(response.body, {
        status: response.status,
        headers
      });
      await cache.put(cacheKey, responseToCache.clone());
      return responseToCache;
    } catch (e) {
      console.error("Error serving image:", e);
      return env.ASSETS.fetch(request);
    }
  }
  return env.ASSETS.fetch(request);
}
__name(handleImage, "handleImage");

// src/worker/handlers/upload.ts
async function handleUpload(request, env) {
  const config = extractConfig(env);
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) throw new Error("\u7F3A\u5C11\u6587\u4EF6");
    if (file.size > config.maxSize) {
      return jsonResponse({ error: `\u6587\u4EF6\u5927\u5C0F\u8D85\u8FC7${config.maxSize / (1024 * 1024)}MB\u9650\u5236` }, 413);
    }
    if (config.enableAuth && !authenticate(request, config.username, config.password)) {
      return unauthorizedResponse();
    }
    const uploadFormData = new FormData();
    uploadFormData.append("chat_id", config.tgChatId);
    if (file.type.startsWith("image/gif")) {
      const newFileName = file.name.replace(/\\.gif$/, ".jpeg");
      const newFile = new File([file], newFileName, { type: "image/jpeg" });
      uploadFormData.append("document", newFile);
    } else {
      uploadFormData.append("document", file);
    }
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${config.tgBotToken}/sendDocument`,
      { method: "POST", body: uploadFormData }
    );
    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json();
      throw new Error(errorData.description || "\u4E0A\u4F20\u5230 Telegram \u5931\u8D25");
    }
    const responseData = await telegramResponse.json();
    const fileId = responseData.result.video?.file_id || responseData.result.document?.file_id || responseData.result.sticker?.file_id;
    if (!fileId) throw new Error("\u8FD4\u56DE\u7684\u6570\u636E\u4E2D\u6CA1\u6709\u6587\u4EF6 ID");
    const fileExtension = getFileExtension(file.name);
    const tagResult = await config.database.prepare("SELECT id FROM tags WHERE name = ?").bind("\u524D\u53F0\u4E0A\u4F20").first();
    const tagId = tagResult?.id || null;
    let imagePath = "";
    let inserted = false;
    for (let i = 0; i < 5; i++) {
      const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      imagePath = `/${uniqueId}.${fileExtension}`;
      try {
        const result = await config.database.prepare(
          "INSERT INTO media (url, fileId, tag_id, filename, size) VALUES (?, ?, ?, ?, ?)"
        ).bind(imagePath, fileId, tagId, file.name, file.size).run();
        if (result.meta.changes > 0) {
          inserted = true;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!inserted) throw new Error("\u65E0\u6CD5\u751F\u6210\u552F\u4E00\u8DEF\u5F84\uFF0C\u8BF7\u91CD\u8BD5");
    return jsonResponse({ data: `https://${config.domain}${imagePath}` });
  } catch (error) {
    console.error("\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
__name(handleUpload, "handleUpload");

// src/worker/handlers/adminUpload.ts
async function handleAdminUpload(request, env) {
  const config = extractConfig(env);
  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) throw new Error("\u7F3A\u5C11\u6587\u4EF6");
    if (file.size > config.maxSize) {
      return jsonResponse({ error: `\u6587\u4EF6\u5927\u5C0F\u8D85\u8FC7${config.maxSize / (1024 * 1024)}MB\u9650\u5236` }, 413);
    }
    const uploadFormData = new FormData();
    uploadFormData.append("chat_id", config.tgChatId);
    if (file.type.startsWith("image/gif")) {
      const newFileName = file.name.replace(/\\.gif$/, ".jpeg");
      const newFile = new File([file], newFileName, { type: "image/jpeg" });
      uploadFormData.append("document", newFile);
    } else {
      uploadFormData.append("document", file);
    }
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${config.tgBotToken}/sendDocument`,
      { method: "POST", body: uploadFormData }
    );
    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json();
      throw new Error(errorData.description || "\u4E0A\u4F20\u5230 Telegram \u5931\u8D25");
    }
    const responseData = await telegramResponse.json();
    const fileId = responseData.result.video?.file_id || responseData.result.document?.file_id || responseData.result.sticker?.file_id;
    if (!fileId) throw new Error("\u8FD4\u56DE\u7684\u6570\u636E\u4E2D\u6CA1\u6709\u6587\u4EF6 ID");
    const fileExtension = getFileExtension(file.name);
    const tagResult = await config.database.prepare("SELECT id FROM tags WHERE name = ?").bind("\u540E\u53F0\u4E0A\u4F20").first();
    const tagId = tagResult?.id || null;
    let imagePath = "";
    let inserted = false;
    for (let i = 0; i < 5; i++) {
      const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      imagePath = `/${uniqueId}.${fileExtension}`;
      try {
        const result = await config.database.prepare(
          "INSERT INTO media (url, fileId, tag_id, filename, size) VALUES (?, ?, ?, ?, ?)"
        ).bind(imagePath, fileId, tagId, file.name, file.size).run();
        if (result.meta.changes > 0) {
          inserted = true;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!inserted) throw new Error("\u65E0\u6CD5\u751F\u6210\u552F\u4E00\u8DEF\u5F84\uFF0C\u8BF7\u91CD\u8BD5");
    return jsonResponse({ data: `https://${config.domain}${imagePath}` });
  } catch (error) {
    console.error("\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
__name(handleAdminUpload, "handleAdminUpload");

// src/worker/handlers/manage.ts
async function handleManage(request, env) {
  const config = extractConfig(env);
  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const tagIdParam = url.searchParams.get("tag_id");
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  try {
    let countQuery = "SELECT COUNT(*) as count FROM media";
    let dataQuery = `
      SELECT m.url, m.fileId, m.tag_id, m.filename, m.size, m.created_at, t.name as tag_name, t.color as tag_color
      FROM media m
      LEFT JOIN tags t ON m.tag_id = t.id
    `;
    const countValues = [];
    const dataValues = [];
    if (tagIdParam) {
      countQuery += " WHERE tag_id = ?";
      dataQuery += " WHERE m.tag_id = ?";
      countValues.push(parseInt(tagIdParam, 10));
      dataValues.push(parseInt(tagIdParam, 10));
    }
    dataQuery += ` ORDER BY m.created_at DESC, m.url DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const totalCountResult = await config.database.prepare(countQuery).bind(...countValues).first();
    const totalCount = totalCountResult?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const mediaDataResult = await config.database.prepare(dataQuery).bind(...dataValues).all();
    const mediaData = mediaDataResult.results.map((row) => ({
      fileId: row.fileId,
      url: `https://${config.domain}${row.url}`,
      tag_id: row.tag_id,
      filename: row.filename,
      size: row.size,
      created_at: row.created_at,
      tag: row.tag_id ? { id: row.tag_id, name: row.tag_name, color: row.tag_color } : null
    }));
    return jsonResponse({
      data: mediaData,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u5A92\u4F53\u6570\u636E\u5931\u8D25:", error);
    return jsonResponse({ error: "\u83B7\u53D6\u5A92\u4F53\u6570\u636E\u5931\u8D25", details: error.message }, 500);
  }
}
__name(handleManage, "handleManage");

// src/worker/handlers/delete.ts
async function handleDelete(request, env) {
  const config = extractConfig(env);
  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }
  try {
    const keysToDeleteUrls = await request.json();
    if (!Array.isArray(keysToDeleteUrls) || keysToDeleteUrls.length === 0) {
      return jsonResponse({ message: "\u6CA1\u6709\u8981\u5220\u9664\u7684\u9879" }, 400);
    }
    const keysToDelete = keysToDeleteUrls.map((url) => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    });
    const placeholders = keysToDelete.map(() => "?").join(",");
    const cache = caches.default;
    const [dbResult] = await Promise.all([
      config.database.prepare(
        `DELETE FROM media WHERE url IN (${placeholders})`
      ).bind(...keysToDelete).run(),
      Promise.all(keysToDeleteUrls.map(async (url) => {
        const cacheKey = new Request(url);
        await cache.delete(cacheKey);
      }))
    ]);
    if (dbResult.meta.changes === 0) {
      return jsonResponse({ message: "\u672A\u627E\u5230\u8981\u5220\u9664\u7684\u9879" }, 404);
    }
    return jsonResponse({ message: "\u5220\u9664\u6210\u529F" });
  } catch (error) {
    return jsonResponse({ error: "\u5220\u9664\u5931\u8D25", details: error.message }, 500);
  }
}
__name(handleDelete, "handleDelete");

// src/worker/handlers/tags.ts
async function handleTags(request, env) {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname;
  const config = extractConfig(env);
  if (method === "GET" && path === "/api/tags") {
    try {
      const result = await config.database.prepare(`
        SELECT t.id, t.name, t.color, t.created_at, COUNT(m.id) as count
        FROM tags t
        LEFT JOIN media m ON t.id = m.tag_id
        GROUP BY t.id
        ORDER BY t.id ASC
      `).all();
      return jsonResponse({ data: result.results });
    } catch (e) {
      return jsonResponse({ error: "\u83B7\u53D6\u6807\u7B7E\u5931\u8D25", details: e.message }, 500);
    }
  }
  if (!authenticate(request, config.username, config.password)) {
    return unauthorizedResponse();
  }
  if (method === "POST" && path === "/api/tags") {
    try {
      const { name, color } = await request.json();
      if (!name || !color) return jsonResponse({ error: "name and color are required" }, 400);
      const result = await config.database.prepare(
        "INSERT INTO tags (name, color) VALUES (?, ?) RETURNING *"
      ).bind(name, color).first();
      return jsonResponse({ data: result });
    } catch (e) {
      return jsonResponse({ error: "\u521B\u5EFA\u6807\u7B7E\u5931\u8D25", details: e.message }, 500);
    }
  }
  const match = path.match(/^\/api\/tags\/(\d+)$/);
  if (match) {
    const id = parseInt(match[1], 10);
    if (method === "DELETE") {
      try {
        await config.database.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
        return jsonResponse({ message: "\u5220\u9664\u6210\u529F" });
      } catch (e) {
        return jsonResponse({ error: "\u5220\u9664\u6807\u7B7E\u5931\u8D25", details: e.message }, 500);
      }
    }
    if (method === "PATCH") {
      try {
        const { name, color } = await request.json();
        if (!name && !color) return jsonResponse({ error: "name or color required" }, 400);
        const updates = [];
        const values = [];
        if (name) {
          updates.push("name = ?");
          values.push(name);
        }
        if (color) {
          updates.push("color = ?");
          values.push(color);
        }
        values.push(id);
        const query = `UPDATE tags SET ${updates.join(", ")} WHERE id = ?`;
        await config.database.prepare(query).bind(...values).run();
        return jsonResponse({ message: "\u66F4\u65B0\u6210\u529F" });
      } catch (e) {
        return jsonResponse({ error: "\u66F4\u65B0\u6807\u7B7E\u5931\u8D25", details: e.message }, 500);
      }
    }
  }
  if (method === "PATCH" && path === "/api/media/batch-tag") {
    try {
      const { urls, tag_id } = await request.json();
      if (!Array.isArray(urls) || urls.length === 0) return jsonResponse({ error: "urls array required" }, 400);
      const paths = urls.map((url2) => {
        try {
          return new URL(url2).pathname;
        } catch {
          return url2;
        }
      });
      const placeholders = paths.map(() => "?").join(",");
      const bindValues = [tag_id === null ? null : tag_id, ...paths];
      const query = `UPDATE media SET tag_id = ? WHERE url IN (${placeholders})`;
      const result = await config.database.prepare(query).bind(...bindValues).run();
      return jsonResponse({ message: "\u6279\u91CF\u6253\u6807\u7B7E\u6210\u529F", count: result.meta.changes });
    } catch (e) {
      return jsonResponse({ error: "\u6279\u91CF\u6253\u6807\u7B7E\u5931\u8D25", details: e.message }, 500);
    }
  }
  return new Response("Not found", { status: 404 });
}
__name(handleTags, "handleTags");

// src/worker/handlers/wallpaper.ts
async function handleWallpaper(_request, env) {
  const config = extractConfig(env);
  try {
    const query = `
      SELECT url FROM media
      WHERE tag_id = (SELECT id FROM tags WHERE name = '\u5FC5\u5E94\u58C1\u7EB8')
      ORDER BY RANDOM()
      LIMIT 5
    `;
    const result = await config.database.prepare(query).all();
    if (result.results.length === 0) {
      return new Response(JSON.stringify({
        status: true,
        message: "\u64CD\u4F5C\u6210\u529F",
        data: [{ url: "https://cn.bing.com/th?id=OHR.BistiBadlands_ZH-CN8760088514_1920x1080.jpg&rf=LaDigue_1920x1080.jpg" }]
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_CONFIG.API}`,
          "CDN-Cache-Control": `public, max-age=${CACHE_CONFIG.API}`
        }
      });
    }
    const returnData = {
      status: true,
      message: "\u64CD\u4F5C\u6210\u529F",
      data: result.results.map((row) => ({ url: `https://${config.domain}${row.url}` }))
    };
    return new Response(JSON.stringify(returnData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_CONFIG.API}`,
        "CDN-Cache-Control": `public, max-age=${CACHE_CONFIG.API}`
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "\u83B7\u53D6\u58C1\u7EB8\u5931\u8D25", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleWallpaper, "handleWallpaper");

// src/worker/handlers/cron.ts
async function crawlBingWallpapers(env, manual = false) {
  const config = extractConfig(env);
  try {
    const res = await fetch("https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8");
    if (!res.ok) throw new Error("Failed to fetch Bing API");
    const bingData = await res.json();
    const images = bingData.images || [];
    let successCount = 0;
    let skippedCount = 0;
    const tagResult = await config.database.prepare("SELECT id FROM tags WHERE name = ?").bind("\u5FC5\u5E94\u58C1\u7EB8").first();
    const tagId = tagResult?.id || null;
    for (const image of images) {
      const sourceUrl = `https://cn.bing.com${image.url}`;
      const exists = await config.database.prepare("SELECT 1 FROM media WHERE source_url = ?").bind(sourceUrl).first();
      if (exists) {
        skippedCount++;
        continue;
      }
      const imgRes = await fetch(sourceUrl);
      if (!imgRes.ok) continue;
      const blob = await imgRes.blob();
      const file = new File([blob], `bing_${image.startdate}.jpg`, { type: "image/jpeg" });
      const uploadFormData = new FormData();
      uploadFormData.append("chat_id", config.tgChatId);
      uploadFormData.append("document", file);
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${config.tgBotToken}/sendDocument`,
        { method: "POST", body: uploadFormData }
      );
      if (!telegramResponse.ok) continue;
      const responseData = await telegramResponse.json();
      const fileId = responseData.result.document?.file_id;
      if (!fileId) continue;
      const imagePath = `/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
      await config.database.prepare(
        "INSERT INTO media (url, fileId, tag_id, source_url, filename, size) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(imagePath, fileId, tagId, sourceUrl, file.name, file.size).run();
      successCount++;
    }
    if (manual) {
      return jsonResponse({ success: successCount, skipped: skippedCount, message: "\u6293\u53D6\u5B8C\u6210" });
    }
  } catch (e) {
    console.error("Bing Crawl Error:", e);
    if (manual) {
      return jsonResponse({ error: "\u6293\u53D6\u5931\u8D25", details: e.message }, 500);
    }
  }
}
__name(crawlBingWallpapers, "crawlBingWallpapers");

// src/worker/index.ts
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    if (path === "/api/upload" && method === "POST") return handleUpload(request, env);
    if (path === "/api/admin/upload" && method === "POST") return handleAdminUpload(request, env);
    if (path === "/api/manage" && method === "GET") return handleManage(request, env);
    if (path === "/api/delete" && method === "POST") return handleDelete(request, env);
    if (path.startsWith("/api/tags") || path === "/api/media/batch-tag") return handleTags(request, env);
    if (path === "/api/wallpaper/random" && method === "GET") return handleWallpaper(request, env);
    if (path === "/api/cron/bing" && method === "POST") return crawlBingWallpapers(env, true);
    if (path === "/api/bing" && method === "GET") return handleWallpaper(request, env);
    return handleImage(request, env);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(crawlBingWallpapers(env, false));
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0aAEYf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0aAEYf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
