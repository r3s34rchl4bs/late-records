/**
 * Late Records — Cloudflare Worker
 * Routes:
 *   GET  /api/catalog        — full inventory (cached 2 min)
 *   GET  /api/album?id=...   — single album
 *   POST /api/order          — place order
 *   GET  /api/suggest?q=...  — smart suggestions (MusicBrainz → Gemini fallback)
 */

const CACHE_TTL = 120; // seconds

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

// ── Turnstile verification ────────────────────────────────
// To update security logic, only edit this function.
async function verifyTurnstile(token, ip, secret) {
  if (!token) return { ok: false, reason: 'empty-token' };
  if (!secret) return { ok: false, reason: 'missing-secret' };
  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const data = await res.json();
    if (data.success === true) return { ok: true };
    return { ok: false, reason: 'siteverify-rejected', codes: data['error-codes'] || [], raw: data };
  } catch (e) {
    console.error('Turnstile fetch error:', e.message);
    return { ok: false, reason: 'fetch-error', message: e.message };
  }
}

// ── Catalog helpers ───────────────────────────────────────
async function fetchCatalog(env) {
  const cache    = caches.default;
  const cacheKey = new Request('https://lr-cache/catalog-v4');
  const cached   = await cache.match(cacheKey);
  if (cached) return cached.json();

  const res  = await fetch(env.APPS_SCRIPT_URL + '?action=catalog');
  const data = await res.json();
  const items = Array.isArray(data) ? data : (data.items || []);

  const r = new Response(JSON.stringify(items), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    },
  });
  await cache.put(cacheKey, r);
  return items;
}

// ── MusicBrainz suggestion ────────────────────────────────
async function musicBrainzSuggest(query, catalog) {
  const mbUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&limit=5&fmt=json`;
  const mbRes = await fetch(mbUrl, {
    headers: { 'User-Agent': 'LateRecords/1.0 (info.late.records@gmail.com)' }
  });
  if (!mbRes.ok) return [];

  const mbData  = await mbRes.json();
  const artists = mbData.artists || [];
  if (!artists.length) return [];

  const tagWords           = new Set();
  const relatedArtistNames = new Set();

  for (const artist of artists.slice(0, 3)) {
    (artist.tags || []).forEach(t => {
      t.name.toLowerCase().split(/[\s,/-]+/).forEach(w => tagWords.add(w));
    });
    artist.name.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length > 2) relatedArtistNames.add(w);
    });
  }

  const scored = catalog.map(item => {
    let score = 0;
    const itemGenres = String(item.genre  || '').toLowerCase();
    const itemArtist = String(item.artist || '').toLowerCase();
    const itemTitle  = String(item.title  || '').toLowerCase();

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
    .map(({ item }) => {
      const genres       = item.genre.split('||').map(g => g.trim());
      const matchedGenre = genres.find(g =>
        g.toLowerCase().split(/[\s\/\-]+/).some(gw =>
          [...tagWords].some(tw => tw.length > 2 && (gw.includes(tw) || tw.includes(gw)))
        )
      ) || genres[0];
      return { ...item, _matchedGenre: matchedGenre };
    });
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
      .slice(0, 6)
      .map(item => {
        const genres = item.genre.split('||').map(g => g.trim());
        return { ...item, _matchedGenre: genres[0] };
      });
  } catch {
    return [];
  }
}

// ── Tag cloud generation (Gemini) ────────────────────────
async function generateTags(catalog, geminiKey) {
  const summaries = catalog.map(a =>
    [
      `"${a.title}" by ${a.artist}`,
      a.genre  ? `Genre: ${a.genre}`       : '',
      a.description ? `Desc: ${a.description}` : '',
      a.context ? `Context: ${a.context}`   : '',
    ].filter(Boolean).join(' | ')
  ).join('\n');

  const prompt = `You are a music expert curating a vinyl record shop called Late Records.

From the album descriptions below, create short, culturally meaningful link tags for the shop homepage. Each tag should read naturally as a standalone phrase someone might click on.

Categories to extract from (vary across all of them — do not over-represent any single category):
- Credits: "produced by Mad Professor", "arranged by David Axelrod", "Tony Allen on drums"
- Labels: "Blue Note classic", "Ariwa vaults", "Stones Throw release"
- Release history: "originally released in 1972", "never reissued", "first pressing"
- Studios / locations: "recorded at Compass Point", "pressed at RTI"
- Pressing / format: "180g virgin vinyl", "half-speed mastered", "gatefold sleeve"
- Scene / movement: "80s UK sound system culture", "Ethiopian golden era", "1970s Lagos"
- Sampling legacy: "sampled by J Dilla", "sampled on Endtroducing"
- Rarity / collector signals: "only 500 pressed", "private press", "test pressing"
- Cultural impact: "defined the Philly sound", "a cornerstone of UK bass"

Diversity rules:
- Maximum 3 tags per category — spread evenly across categories
- Each album should contribute at most 1-2 tags to the total pool
- Do not repeat the same phrasing pattern (e.g. avoid multiple "originally released in..." tags)

Tag rules:
- Each tag must be a complete, grammatically correct phrase (no cut-off sentences)
- 3 to 6 words per tag (never longer)
- Do NOT include bare artist names or album titles
- Do NOT include genre names on their own
- Do NOT start tags with "Featuring" or "The album"
- Every tag should make sense if read in isolation
- Return 60-80 tags total, mixed across categories
- Respond with ONLY a JSON array of strings, no explanation, no markdown

Catalog:
${summaries}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    }
  );

  if (!res.ok) {
    console.error('Gemini HTTP error:', res.status, res.statusText);
    return [];
  }

  const data = await res.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Gemini raw response length:', raw.length, 'first 200:', raw.substring(0, 200));

  if (!raw) {
    console.error('Gemini returned empty text. Full response:', JSON.stringify(data).substring(0, 500));
    return [];
  }

  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const tags = JSON.parse(cleaned);
    if (!Array.isArray(tags)) { console.error('Gemini result not array'); return []; }
    console.log('Gemini tags count:', tags.length);
    return tags.filter(t => typeof t === 'string' && t.length > 0).slice(0, 80);
  } catch (e) {
    console.error('Gemini JSON parse error:', e.message, 'raw:', raw.substring(0, 300));
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin');
    const path   = url.pathname;

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
        const body  = await request.json();
        const ip    = request.headers.get('CF-Connecting-IP') || '';
        const check = await verifyTurnstile(body.turnstileToken, ip, env.TURNSTILE_SECRET);
        if (!check.ok) return json({ error: 'Security check failed. Please refresh and try again.', debug: check.reason, codes: check.codes || [], raw: check.raw || null }, 403, origin);
        const res  = await fetch(env.APPS_SCRIPT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'order', ...body }),
        });
        const data = await res.json();
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: 'Order failed' }, 500, origin);
      }
    }

    // GET /api/tags
    if (path === '/api/tags' && request.method === 'GET') {
      try {
        const cache    = caches.default;
        const cacheKey = new Request('https://lr-cache/tags-v4');
        const cached   = await cache.match(cacheKey);
        if (cached) return new Response(cached.body, {
          headers: { 'Content-Type': 'application/json', ...cors(origin) },
        });

        const catalog = await fetchCatalog(env);
        if (!env.GEMINI_API_KEY) return json([], 200, origin);

        const tags = await generateTags(catalog, env.GEMINI_API_KEY);

        // only cache non-empty results
        if (tags.length > 0) {
          const body = JSON.stringify(tags);
          const r = new Response(body, {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=86400',
            },
          });
          await cache.put(cacheKey, r);
          return new Response(body, {
            headers: { 'Content-Type': 'application/json', ...cors(origin) },
          });
        }

        return json([], 200, origin);
      } catch (e) {
        console.error('Tags error:', e.message);
        return json([], 200, origin);
      }
    }

    // GET /api/suggest?q=...
    if (path === '/api/suggest' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return json([], 200, origin);

      try {
        const catalog = await fetchCatalog(env);
        let results   = await musicBrainzSuggest(q, catalog);
        if (results.length < 4 && env.GEMINI_API_KEY) {
          results = await geminiSuggest(q, catalog, env.GEMINI_API_KEY);
        }
        return json(results, 200, origin);
      } catch (e) {
        console.error('Suggest error:', e.message);
        return json([], 200, origin);
      }
    }

    return json({ error: 'Not found' }, 404, origin);
  }
};