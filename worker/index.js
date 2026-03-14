/**
 * Late Records — Cloudflare Worker
 * Routes:
 *   GET  /api/catalog        — full inventory (cached 2 min)
 *   GET  /api/album?id=...   — single album
 *   POST /api/order          — place order
 *   GET  /api/suggest?q=...  — smart suggestions (MusicBrainz → Gemini fallback)
 */

const APPS_SCRIPT_URL = typeof APPS_SCRIPT_URL !== 'undefined' ? APPS_SCRIPT_URL : '';
const CACHE_TTL = 120; // seconds
const PAYMENT_MODE = 'paymongo'; // 'manual' | 'paymongo'


// ── CORS headers ──────────────────────────────────────────
function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

// ── Catalog helpers ───────────────────────────────────────
async function fetchCatalog(env) {
  const cache = caches.default;
  const cacheKey = new Request('https://lr-cache/catalog-v3');
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const res  = await fetch(env.APPS_SCRIPT_URL + '?action=catalog');
  const data = await res.json();

  const r = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    },
  });
  await cache.put(cacheKey, r);
  return data;
}

// ── MusicBrainz suggestion ────────────────────────────────
async function musicBrainzSuggest(query, catalog) {
  // 1. Search for the artist on MusicBrainz
  const mbUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&limit=5&fmt=json`;
  const mbRes = await fetch(mbUrl, {
    headers: { 'User-Agent': 'LateRecords/1.0 (info.late.records@gmail.com)' }
  });
  if (!mbRes.ok) return [];

  const mbData = await mbRes.json();
  const artists = mbData.artists || [];
  if (!artists.length) return [];

  // 2. Collect genre/tag words from top MusicBrainz results
  const tagWords = new Set();
  const relatedArtistNames = new Set();

  for (const artist of artists.slice(0, 3)) {
    // Collect tags
    (artist.tags || []).forEach(t => {
      t.name.toLowerCase().split(/[\s,/-]+/).forEach(w => tagWords.add(w));
    });
    // Collect artist name words for fuzzy matching
    artist.name.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length > 2) relatedArtistNames.add(w);
    });
  }

  // 3. Score catalog against collected tags + artist name words
  const scored = catalog.map(item => {
    let score = 0;
    const itemGenres = item.genre.toLowerCase();
    const itemArtist = item.artist.toLowerCase();
    const itemTitle  = item.title.toLowerCase();

    tagWords.forEach(tag => {
      if (tag.length < 3) return;
      if (itemGenres.includes(tag)) score += 3;
      if (itemArtist.includes(tag)) score += 2;
      if (itemTitle.includes(tag))  score += 1;
    });
    relatedArtistNames.forEach(name => {
      if (itemArtist.includes(name)) score += 4;
    });

    return { item, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ item }) => item);
}

// ── Gemini suggestion (fallback) ──────────────────────────
async function geminiSuggest(query, catalog, geminiKey) {
  const catalogSummary = catalog.map(a =>
    `ID:${a.album_id} | "${a.title}" by ${a.artist} | Genre: ${a.genre}`
  ).join('\n');

  const prompt = `You are a music expert helping customers of a vinyl record shop called Late Records.

A customer searched for: "${query}"

This is our current inventory:
${catalogSummary}

Based on the customer's search, pick up to 6 records from the inventory above that are most musically related or similar in style, genre, or era. Only pick records that are in the list above — do not invent new ones.

Respond with ONLY a JSON array of album_id strings, like: ["id1","id2","id3"]
No explanation, no markdown, just the raw JSON array.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 }
      })
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const ids = JSON.parse(raw.trim());
    if (!Array.isArray(ids)) return [];
    return ids
      .map(id => catalog.find(a => a.album_id === id))
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function createPayMongoSession(payload, secret) {
  const { name, email, phone, items, shipping } = payload;
  const lineItems = items.map(i => ({
    currency: 'PHP',
    amount: Math.round(i.price * 100),
    name: i.title,
    quantity: i.quantity
  }));
  lineItems.push({ currency: 'PHP', amount: Math.round(shipping * 100), name: 'Shipping', quantity: 1 });
  const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(secret + ':')}`
    },
    body: JSON.stringify({ data: { attributes: {
      billing: { name, email, phone },
      line_items: lineItems,
      payment_method_types: ['gcash', 'maya', 'card', 'grab_pay'],
      success_url: 'https://late-records.shop/success.html',
      cancel_url: 'https://late-records.shop/checkout.html',
      metadata: { ...payload }
    }}})
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err?.errors?.[0]?.detail || 'PayMongo error'); }
  return res.json();
}

// ── Main handler ──────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin');
    const path   = url.pathname;

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // GET /api/catalog
    if (path === '/api/catalog' && request.method === 'GET') {
      try {
        const data = await fetchCatalog(env);
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: 'Failed to load catalog' }, 500, origin);
      }
    }

    // GET /api/album?id=...
    if (path === '/api/album' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'Missing id' }, 400, origin);
      try {
        const catalog = await fetchCatalog(env);
        const album   = catalog.find(a => a.album_id === id);
        if (!album) return json({ error: 'Not found' }, 404, origin);
        return json(album, 200, origin);
      } catch (e) {
        return json({ error: 'Failed to load album' }, 500, origin);
      }
    }

    // POST /api/order
    if (path === '/api/order' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (PAYMENT_MODE === 'paymongo') {
          const session = await createPayMongoSession(body, env.PAYMONGO_SECRET);
          return json({ ok: true, checkout_url: session.data.attributes.checkout_url }, 200, origin);
        }
        const res = await fetch(env.APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'order', ...body })
        });
        const data = await res.json();
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: 'Order failed' }, 500, origin);
      }
    }

    // POST /api/paymongo-webhook
    if (path === '/api/paymongo-webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (body?.data?.attributes?.type === 'checkout_session.payment.paid') {
          const meta = body.data.attributes.data.attributes.metadata;
          await fetch(env.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'order', ...meta })
          });
        }
        return new Response('ok', { status: 200 });
      } catch (e) {
        return new Response('error', { status: 500 });
      }
    }

    // GET /api/suggest?q=...
    if (path === '/api/suggest' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return json([], 200, origin);

      try {
        const catalog = await fetchCatalog(env);

        // Try MusicBrainz first
        let results = await musicBrainzSuggest(q, catalog);

        // Fallback to Gemini if MusicBrainz returned nothing useful
        if (!results.length && env.GEMINI_API_KEY) {
          results = await geminiSuggest(q, catalog, env.GEMINI_API_KEY);
        }

        return json(results, 200, origin);
      } catch (e) {
        return json([], 200, origin); // fail silently — frontend handles empty
      }
    }

    return json({ error: 'Not found' }, 404, origin);
  }
};
