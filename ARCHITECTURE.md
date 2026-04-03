# Late Records — Architecture

> This file describes the live production system. It is updated only when a release changes infrastructure — new/removed endpoints, cache strategy, R2 bindings, Worker triggers, or Sheets schema. Not updated for frontend-only releases.
>
> Last updated: 2026-04-03

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Static files in `site/` |
| API layer | Cloudflare Worker | `worker/index.js` — routes all `/api/*` |
| Media storage | Cloudflare R2 | Bucket: `late-records-media` → `media.late-records.shop` |
| Catalog + tags cache | Cloudflare R2 | `data/catalog.json` (10-min TTL), `data/tags.json` (24-hr TTL) |
| Catalog data source | Google Sheets + Apps Script | Single source of truth for all album records |
| Tag generation | Google Gemini API | Called from Worker; result cached in R2 |
| Spam protection | Cloudflare Turnstile | Invisible widget on checkout |
| DNS / Domain | Namecheap → Cloudflare nameservers | |
| CI/CD | GitHub Actions | Auto-deploys Worker on push to `worker/**` on `main` |
| Analytics | Cloudflare Web Analytics | Beacon in all HTML files |
| Error visibility | Cloudflare Observability | `head_sampling_rate = 1` in `wrangler.toml` |

---

## Repository Structure

```
late-records/
├── site/                          ← deployed to Cloudflare Pages
│   ├── index.html                 ← main catalog page
│   ├── genre.html                 ← genre filter view
│   ├── cart.html
│   ├── checkout.html
│   ├── success.html
│   ├── hidden-pricer.html
│   ├── style.css                  ← single shared stylesheet
│   ├── script.js                  ← shared: LR.api, LR.cart, LR.ui
│   ├── catalog.js                 ← rowHTML() catalog row renderer
│   ├── search.js                  ← buildTable(), renderTable(), AZ nav
│   ├── tagcloud.js                ← tag cloud component
│   ├── last-updated.js            ← footer timestamp
│   ├── robots.txt                 ← transactional pages excluded
│   ├── sitemap.xml
│   ├── fonts/
│   │   ├── inter.css              ← @font-face, font-display: swap
│   │   ├── inter-latin.woff2
│   │   └── inter-latin-ext.woff2
│   ├── images/                    ← logo, static assets
│   └── albums/
│       └── album.html             ← album detail (?id= query param)
│
└── worker/
    ├── index.js                   ← Worker API + cron handler
    ├── wrangler.toml              ← config, R2 bindings, cron, observability
    └── package.json
```

---

## API Endpoints

| Method | Path | Cache | Description |
|---|---|---|---|
| `GET` | `/api/catalog` | R2 `data/catalog.json`, 10-min TTL | Full catalog. Falls back to Apps Script on R2 miss. Async write-back to R2. |
| `GET` | `/api/album?id=` | None | Single album lookup from catalog. |
| `GET` | `/api/tags?id=` | R2 `data/tags.json`, 24-hr TTL | Gemini-generated genre/mood tags. Stale served on Gemini failure. |
| `GET` | `/api/suggest?q=` | None | Search suggestions. |
| `POST` | `/api/order` | Never | Validates order, recalculates price server-side, submits to Apps Script. |
| cron | `*/10 * * * *` | — | Proactively refreshes `data/catalog.json` in R2. |

---

## Caching Strategy

### R2 Catalog Cache (`data/catalog.json`)
- TTL: 10 minutes
- On request: Worker reads R2 first. If fresh → return immediately (~1–10ms). If stale/missing → fetch Apps Script, write back to R2 asynchronously, return result.
- Cron (`*/10 * * * *`): proactively refreshes before TTL expires, keeping R2 warm even with no traffic.
- Replaced the old `caches.default` edge cache, which was unreliable and couldn't be invalidated.

### R2 Tags Cache (`data/tags.json`)
- TTL: 24 hours
- On Gemini 429 or failure: stale data served rather than retrying (prevents infinite retry loops).

### Client-side Catalog Cache
- `localStorage` key `lr_catalog_cache`, TTL 2 minutes.
- Checked before every `/api/catalog` call in `LR.api.catalog()`.

### Static Assets
- Cloudflare Pages serves `style.css`, `script.js`, and font files with long-lived cache headers.
- When deploying changes to these files, Cloudflare Pages handles cache busting automatically via content hashing.

---

## Order Validation Rules

Server-side in `worker/index.js` — client values are never trusted:

1. `album_id` must exist in live catalog
2. `quantity` must be integer ≥ 1
3. `deliveryMethod` must be `ship`, `local`, or `pickup`
4. Server independently recalculates subtotal + shipping from catalog prices
5. Mismatch between client total and server total → `400 Bad Request`
6. CORS locked to `https://late-records.shop` and `http://localhost:<any>`

### Shipping Rates (hardcoded in Worker)

| Qty | Rate |
|---|---|
| 1–2 records | ₱250 |
| 3–5 records | ₱350 |
| 6+ records | ₱450 |

---

## Google Sheets Schema

Column order matters — Apps Script reads by position.

```
album_id | title | artist | price | stock | status | format | condition |
description | tracklist | genre | context | featured | sample_count
```

| Column | Notes |
|---|---|
| `album_id` | URL-safe slug, e.g. `self-titled-by-arthur-verocai`. Must match R2 filenames exactly. |
| `status` | `available` or `sold_out` |
| `format` | `LP`, `7"`, `12"`, etc. |
| `tracklist` | Values separated by `\|\|` |
| `genre` | Values separated by `\|\|` |
| `context` | Values separated by `\|\|` |
| `featured` | `yes` to appear in homepage carousel |
| `sample_count` | Integer. Number of audio samples in R2. If set, skips HEAD-request probing in `setupAudio()`. **User must fill this column.** |

---

## R2 Media Storage

Bucket: `late-records-media` → served at `https://media.late-records.shop`

| Type | Path pattern |
|---|---|
| Album cover | `images/{album_id}.jpg` |
| Audio sample | `audio/{album_id}/sample{n}.mp3` |
| Catalog cache | `data/catalog.json` |
| Tags cache | `data/tags.json` |

Filenames are case-sensitive and must match `album_id` exactly.

**Upload commands:**
```bash
# Image
wrangler r2 object put late-records-media/images/{album_id}.jpg \
  --file="/path/to/image.jpg" --content-type="image/jpeg"

# Audio sample
wrangler r2 object put late-records-media/audio/{album_id}/sample1.mp3 \
  --file="/path/to/sample.mp3" --content-type="audio/mpeg"
```

**Image spec:** 600px wide, JPEG, quality 80.
```bash
mogrify -resize 600x -quality 80 *.jpg
```

---

## Worker Deployment

**Automatic (normal workflow):**
Push changes in `worker/**` to `main` → GitHub Actions runs `wrangler deploy`.

**Manual:**
```bash
cd worker
wrangler deploy
```

**Secrets (set once, never in `wrangler.toml`):**
```bash
wrangler secret put APPS_SCRIPT_URL
wrangler secret put TURNSTILE_SECRET
wrangler secret put GEMINI_API_KEY
```

---

## Turnstile Setup

1. Cloudflare Dashboard → Turnstile → Add Site
2. Domain: `late-records.shop`, Widget type: **Managed** (invisible)
3. Site Key → paste into `checkout.html`
4. Secret Key → `wrangler secret put TURNSTILE_SECRET`

---

## Local Development

```bash
# Frontend: open site/ files directly in browser
# API calls will fail — Worker not running locally

# Worker only:
cd worker
wrangler dev
```

Set a local API override in `script.js` during dev:
```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : 'https://late-records.shop';
```
