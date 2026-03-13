var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var CACHE_TTL = 120;
var CACHE_KEY = "https://late-records-cache/catalog";
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    try {
      if (url.pathname === "/api/catalog") return handleCatalog(request, env, ctx);
      if (url.pathname === "/api/album") return handleAlbum(request, env, ctx);
      if (url.pathname === "/api/order") return handleOrder(request, env);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Internal error" }, 500);
    }
  }
};
async function handleCatalog(request, env, ctx) {
  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) {
    const data2 = await cached.json();
    return json(data2, 200, { "X-Cache": "HIT" });
  }
  const data = await fetchFromSheets(env);
  const cacheRes = new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` }
  });
  ctx.waitUntil(cache.put(CACHE_KEY, cacheRes));
  return json(data, 200, { "X-Cache": "MISS" });
}
__name(handleCatalog, "handleCatalog");
async function handleAlbum(request, env, ctx) {
  const url = new URL(request.url);
  const albumId = url.searchParams.get("id");
  if (!albumId) return json({ error: "Missing id" }, 400);
  const cache = caches.default;
  let catalog;
  const cached = await cache.match(CACHE_KEY);
  if (cached) {
    catalog = await cached.json();
  } else {
    catalog = await fetchFromSheets(env);
    const cacheRes = new Response(JSON.stringify(catalog), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL}` }
    });
    ctx.waitUntil(cache.put(CACHE_KEY, cacheRes));
  }
  const album = catalog.find((a) => a.album_id === albumId);
  if (!album) return json({ error: "Album not found" }, 404);
  return json(album);
}
__name(handleAlbum, "handleAlbum");
async function handleOrder(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const required = ["name", "email", "phone", "address", "items"];
  for (const field of required) {
    if (!body[field]) return json({ error: `Missing required field: ${field}` }, 400);
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: "Order must contain at least one item" }, 400);
  }
  const appsRes = await fetch(env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  const result = await appsRes.json();
  return json({ ok: result.success === true, ...result });
}
__name(handleOrder, "handleOrder");
async function fetchFromSheets(env) {
  const res = await fetch(`${env.APPS_SCRIPT_URL}?action=inventory`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
}
__name(fetchFromSheets, "fetchFromSheets");
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders }
  });
}
__name(json, "json");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
