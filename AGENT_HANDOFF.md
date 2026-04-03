# Late Records — Agent Handoff Brief

> This document gives a complete picture of the project state, stack, decisions made, and remaining work. Read this before touching any code.

---

## 1. What This Project Is

**Late Records** is a small e-commerce storefront selling curated vinyl records — primarily Japanese city pop, AOR, and rare pressings. It is a real production site at `https://late-records.shop`.

It is not a framework app. It is a hand-coded static site + a Cloudflare Worker API. No React, no Next.js, no build step on the frontend.

---

## 2. Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Static files in `site/` |
| API layer | Cloudflare Worker | `worker/index.js` — deployed via Wrangler |
| Media storage | Cloudflare R2 | Bucket: `late-records-media`, domain: `media.late-records.shop` |
| Catalog data | Google Sheets + Apps Script | Single source of truth for album records |
| Catalog cache | Cloudflare R2 (`data/catalog.json`) | 10-min TTL; cron refresh every `*/10 * * * *` |
| Tags cache | Cloudflare R2 (`data/tags.json`) | 24-hr TTL; stale served on Gemini failure |
| Tag generation | Google Gemini API | Genre/mood tags per album — called from Worker |
| Payments | Manual bank transfer (GCash/BPI) | No payment processor. Orders are logged via Apps Script. |
| CI/CD | GitHub Actions | `.github/workflows/deploy-worker.yml` — auto-deploys Worker on push to `worker/**` on `main` |
| Analytics | Cloudflare Web Analytics | Beacon in all HTML files |
| Error visibility | Cloudflare Observability | `head_sampling_rate = 1` in `wrangler.toml` |

---

## 3. Repository Structure

```
late-records/
├── site/                        # Static frontend (deployed to Cloudflare Pages)
│   ├── index.html               # Catalog grid (main page)
│   ├── genre.html               # Genre filter view
│   ├── albums/
│   │   └── album.html           # Album detail page (uses ?id= query param)
│   ├── cart.html
│   ├── checkout.html
│   ├── success.html
│   ├── script.js                # Shared JS: LR.cart, LR.api, catalog rendering
│   ├── style.css
│   ├── robots.txt
│   └── sitemap.xml
├── worker/
│   ├── index.js                 # Cloudflare Worker (API + cron handler)
│   ├── wrangler.toml            # Worker config, routes, R2 bindings, cron
│   └── package.json
├── .github/
│   └── workflows/
│       └── deploy-worker.yml    # Auto-deploy Worker to Cloudflare on push
├── ARCHITECT_NOTES.md           # Full architecture decisions, backlog, constraints
└── AGENT_HANDOFF.md             # This file
```

---

## 4. Worker API Endpoints

All routes live under `late-records.shop/api/*`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/catalog` | Returns full album catalog. Reads `data/catalog.json` from R2 (10-min TTL), falls back to Apps Script. |
| `GET` | `/api/album?id=<album_id>` | Returns single album record. |
| `GET` | `/api/tags?id=<album_id>` | Returns Gemini-generated tags. Cached in R2 (`data/tags.json`) for 24 hrs. |
| `GET` | `/api/suggest?q=<query>` | Search suggestions. |
| `POST` | `/api/order` | Validates and forwards order to Apps Script. Server-side price recalculation — client total is verified, not trusted. |
| `scheduled` | cron `*/10 * * * *` | Proactively refreshes `data/catalog.json` in R2. |

**Security in `/api/order`:**
- Items validated: `album_id` must exist in catalog, `quantity` must be integer ≥ 1
- `deliveryMethod` must be `ship`, `local`, or `pickup`
- Server independently recalculates subtotal + shipping from catalog prices
- Any mismatch between client total and server total → `400 Bad Request`
- CORS locked to `https://late-records.shop` and `http://localhost:<any port>`

---

## 5. What Has Been Built (Completed Work)

- **CORS lockdown** — allowlist replaces wildcard echo
- **Server-side price validation** — cannot be bypassed via client localStorage editing
- **Canonical `<link>` tags** — on all album pages (dynamic via JS in `renderAlbum()`)
- **Open Graph + Twitter Card meta tags** — index.html, genre.html, album.html (dynamic injection)
- **JSON-LD Product schema** — album pages, injected dynamically in `renderAlbum()`
- **R2 catalog cache** — replaced unreliable Cloudflare edge cache; 10-min TTL with async write-back
- **R2 tags cache** — 24-hr TTL; serves stale on Gemini 429 failure (fixed retry loop)
- **Cron refresh** — `*/10 * * * *` cron keeps R2 catalog warm proactively
- **Cart redesign** — utilitarian single-row layout (no album art); title+artist left, price+qty+× right
- **success.html localStorage wipe** — all 9 order keys cleared + `LR.cart.clear()` on confirmation
- **robots.txt + sitemap.xml** — transactional pages excluded from crawl
- **GitHub Actions auto-deploy** — Worker deploys on every push to `worker/**` on `main`
- **Cloudflare Observability** — `head_sampling_rate = 1` enabled in `wrangler.toml`
- **2-min localStorage catalog cache** — in `LR.api.catalog()` in `script.js`
- **`sample_count` support** — `setupAudio(albumId, sampleCount)` skips probe requests if count is known

---

## 6. What Still Needs to Be Done

### Approved — implement next (in this order)

1. **`fetchpriority="high"` on first 2 catalog images**
   - File: `site/script.js` → `rowHTML()` function
   - The first 2 images rendered in the catalog grid are almost always above the fold
   - Add `fetchpriority="high"` attribute to those two `<img>` tags only
   - All others keep `loading="lazy"` as-is

2. **`font-display: swap` + `<link rel="preload">` on Inter font**
   - File: `site/style.css` (add `font-display: swap` to `@font-face` or `@import`)
   - Files: `site/index.html`, `site/genre.html`, `site/albums/album.html`, `site/cart.html`, `site/checkout.html`, `site/success.html`
   - Add `<link rel="preload" as="font" crossorigin href="...inter...woff2">` to `<head>` of each HTML file
   - Eliminates invisible-text flash during initial load (FCP/LCP improvement)

3. **`defer` on inline scripts in `cart.html`, `success.html`, `album.html`**
   - Inline `<script>` blocks cannot use `defer` — wrap their contents in `DOMContentLoaded` listeners first
   - Then add `defer` to any external `<script src="...">` tags on those pages
   - `index.html` and others already handled

### User action needed (no code required)

- **Add `sample_count` column to Google Sheet** — integer column, number of audio samples per album. Worker code already reads it via `sample_count` field. Without it, `setupAudio()` falls back to sequential HEAD-request probing (5 requests per album page load).

### Backlog (low priority, no deadline)

- Name magic numbers as constants in `worker/index.js` (shipping tier amounts, commission %)

### Parked (do not implement now)

- **Sentry error monitoring** — `@sentry/cloudflare`, `withSentry` wrapper, DSN via `wrangler secret put SENTRY_DSN`. Revisit when order volume grows and line-by-line crash reports are worth the setup. GitHub Actions auto-deploy is a prerequisite (source maps upload automatically) — that's done now, so Sentry can be added any time it becomes worthwhile.

---

## 7. Hard Constraints

- **Staging before main** — all changes go to a feature branch first. Cloudflare Pages auto-deploys a preview URL (`claude-<branch-name>.late-records.pages.dev`). Only merge to `main` after visual confirmation on staging. No exceptions.
- **No SPA work yet** — Section 3 of ARCHITECT_NOTES has the full SPA plan. Do not start it until the current site is stable and all Section 5 tasks are complete.
- **Do not touch the 7 existing HTML files for routing** — the SPA shell will be `site/app.html`. Old files deleted only after all routes are covered.
- **No payment processor** — orders are logged manually. Do not add Stripe, PayMongo, or any payment processor without explicit instruction.
- **No secrets in `wrangler.toml`** — `APPS_SCRIPT_URL`, `TURNSTILE_SECRET`, and any future secrets go in `wrangler secret put`.

---

## 8. Key Decisions Made (Do Not Revisit Without Good Reason)

| Decision | Rationale |
|---|---|
| R2 for catalog cache instead of `caches.default` | Edge cache was unreliable and couldn't be invalidated predictably. R2 reads are ~1–10ms, survive Worker restarts, and can be written from cron. |
| Cart with no album art | Mobile UX. Art made the cart feel cluttered and the rows too tall on small screens. |
| CORS allowlist (not wildcard) | Security. Prevents third-party pages from calling the order API on behalf of users. |
| Global Activity Feed — **permanently rejected** | Fake social proof is off-brand for a curated shop. Durable Objects complexity not justified. Evaluated and rejected twice. |
| No Sentry yet | GitHub Actions wasn't set up when Sentry was first discussed — source maps wouldn't upload. Now that Actions works, Sentry is viable but still not urgent at current volume. |
| `sample_count` in Sheets | Eliminates 5 sequential HEAD requests per album page load. Code already supports it — user just needs to fill the column. |

---

## 9. Deployment

**Frontend (site/):**
- Push to `main` → Cloudflare Pages auto-deploys to `https://late-records.shop`
- Push to any branch → preview at `https://<branch-slug>.late-records.pages.dev`

**Worker (worker/):**
- Push to `main` with changes in `worker/**` → GitHub Actions runs `wrangler deploy` automatically
- Manual deploy: `cd worker && wrangler deploy`
- Secrets: `wrangler secret put <KEY>` (interactive — enter value at prompt, not on command line)

**Media (R2):**
- Upload via Wrangler: `wrangler r2 object put late-records-media/images/<album_id>.jpg --file=... --content-type=image/jpeg`
- No git commit needed — R2 is live immediately

---

## 10. Environment

- Node 20 (for Wrangler)
- Wrangler 4.x (`wrangler@latest`)
- Cloudflare account: late-records.shop zone
- GitHub repo: contains `CF_API_TOKEN` and `CF_ACCOUNT_ID` as Actions secrets
