/**
 * Late Records — Cloudflare Worker
 * Routes: /api/catalog  /api/album  /api/order
 *
 * Env vars (set via wrangler secret put):
 *   APPS_SCRIPT_URL   — full Apps Script exec URL
 *   TURNSTILE_SECRET  — Cloudflare Turnstile secret key
 */

const CACHE_TTL  = 120;           // 2 minutes
const CACHE_KEY  = 'https://late-records-cache/catalog';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Entry point ────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === '/api/catalog') return handleCatalog(request, env, ctx);
      if (url.pathname === '/api/album')   return handleAlbum(request, env, ctx);
      if (url.pathname === '/api/order')   return handleOrder(request, env);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal error' }, 500);
    }
  }
};

// ── GET /api/catalog ───────────────────────────────────────────────────────────

async function handleCatalog(request, env, ctx) {
  const cache = caches.default;

  // Cache hit
  const cached = await cache.match(CACHE_KEY);
  if (cached) {
    const data = await cached.json();
    return json(data, 200, { 'X-Cache': 'HIT' });
  }

  // Cache miss — fetch from Apps Script
  const data = await fetchFromSheets(env);

  // Store in edge cache
  const cacheRes = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL}` }
  });
  ctx.waitUntil(cache.put(CACHE_KEY, cacheRes));

  return json(data, 200, { 'X-Cache': 'MISS' });
}

// ── GET /api/album?id= ─────────────────────────────────────────────────────────

async function handleAlbum(request, env, ctx) {
  const url    = new URL(request.url);
  const albumId = url.searchParams.get('id');

  if (!albumId) return json({ error: 'Missing id' }, 400);

  // Reuse cached catalog data — no extra Sheets call if catalog is warm
  const cache  = caches.default;
  let catalog;

  const cached = await cache.match(CACHE_KEY);
  if (cached) {
    catalog = await cached.json();
  } else {
    catalog = await fetchFromSheets(env);
    const cacheRes = new Response(JSON.stringify(catalog), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL}` }
    });
    ctx.waitUntil(cache.put(CACHE_KEY, cacheRes));
  }

  const album = catalog.find(a => a.album_id === albumId);
  if (!album) return json({ error: 'Album not found' }, 404);

  return json(album);
}

// ── POST /api/order ────────────────────────────────────────────────────────────

async function handleOrder(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // ── Forward to Apps Script ────────────────────────────────────────────────
  const appsRes = await fetch(env.APPS_SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify(body)
  });

  const result = await appsRes.json();
  // Normalize: Apps Script returns {success:true}, we expose {ok:true}
  return json({ ok: result.success === true, ...result });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchFromSheets(env) {
  const res  = await fetch(`${env.APPS_SCRIPT_URL}?action=inventory`);
  const data = await res.json();
  // Normalise — Apps Script should return an array
  return Array.isArray(data) ? data : (data.items || []);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders }
  });
}
