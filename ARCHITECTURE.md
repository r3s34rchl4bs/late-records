# Late Records — Architecture & Implementation Notes

## Stack

| Layer | Tool |
|---|---|
| Hosting | Cloudflare Pages |
| API / Cache | Cloudflare Worker |
| Data source | Google Sheets via Apps Script |
| Spam protection | Cloudflare Turnstile |
| DNS / Domain | Namecheap → Cloudflare nameservers |

---

## File Structure

```
late-records/
├── site/                        ← deployed to Cloudflare Pages
│   ├── index.html
│   ├── cart.html
│   ├── checkout.html
│   ├── success.html
│   ├── style.css                ← single shared stylesheet
│   ├── script.js                ← shared cart + API + utils
│   ├── images/                  ← optimised album covers (.jpg, max 600px wide)
│   └── albums/
│       └── album.html
│
└── worker/                      ← deployed to Cloudflare Workers
    ├── index.js                 ← API handler
    └── wrangler.toml            ← Worker config
```

---

## API Endpoints (Worker)

| Method | Endpoint | Cache | Description |
|---|---|---|---|
| GET | /api/catalog | 5 min edge cache | Full inventory from Sheets |
| GET | /api/album?id= | 5 min edge cache | Single album (filtered from catalog) |
| POST | /api/order | Never | Submit order → Apps Script |

---

## Caching Strategy

- **Catalog + Album reads**: Cached at the Cloudflare edge via Cache API for 5 minutes.  
  On a cache hit the Apps Script is not called at all — the Worker returns instantly.  
  On a cache miss the Worker fetches from Apps Script, stores the response, and returns it.

- **Order submissions**: Always fresh — no cache, direct pass-through to Apps Script after Turnstile verification.

- **Frontend**: `style.css` and `script.js` are served by Pages with long-lived cache headers (`Cache-Control: public, max-age=31536000, immutable`). Add a query string version bump (e.g. `?v=2`) when deploying changes.

---

## Worker Deployment

1. Install Wrangler: `npm install -g wrangler`
2. Login: `wrangler login`
3. Set secrets:
   ```
   wrangler secret put TURNSTILE_SECRET
   wrangler secret put APPS_SCRIPT_URL
   ```
4. Deploy: `wrangler deploy` from the `worker/` directory
5. In Cloudflare Dashboard → Workers → Routes, add:
   `late-records.shop/api/*` → your Worker

---

## Turnstile Setup

1. Go to Cloudflare Dashboard → Turnstile → Add Site
2. Domain: `late-records.shop`
3. Widget type: **Managed** (invisible, auto-solves for real users)
4. Copy the **Site Key** → paste into `checkout.html` where noted
5. Copy the **Secret Key** → `wrangler secret put TURNSTILE_SECRET`

---

## Google Sheets Column Order

`album_id | title | artist | price | stock | status | description | tracklist | genre | context`

- `tracklist`: values separated by `||`
- `genre`: values separated by `||`
- `context`: values separated by `||`
- `status`: `available` or `sold_out`

---

## Image Optimisation

Target: **600px wide, JPEG, quality 80**.  
Filename must match `album_id` exactly, e.g. `self-titled-by-guilherme-coutinho-e-o-grupo-stalo.jpg`.

Quick batch resize with ImageMagick:
```bash
mogrify -resize 600x -quality 80 images/*.jpg
```

---

## Shipping Rates (hardcoded in checkout.html and worker)

| Qty | Rate |
|---|---|
| 1–2 records | ₱250 |
| 3–5 records | ₱350 |
| 6+ records | ₱450 |

---

## Local Development

Open `site/` files directly in a browser. API calls will fail locally (no Worker).  
For local API testing, use `wrangler dev` in the `worker/` directory.

Set a local override in `script.js` during dev:
```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : '';
```
