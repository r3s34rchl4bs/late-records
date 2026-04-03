# Late Records — Agent Handoff (Entry Point)

> **Start here.** This is the first file any AI agent should read. It contains the current state of production, what has been built, what is pending, and every constraint that must be respected.
>
> Last updated: 2026-04-03

---

## What This Project Is

**Late Records** is a live e-commerce storefront at `https://late-records.shop` selling curated vinyl records — primarily Japanese city pop, AOR, and rare pressings. It is a real, revenue-generating site.

It is a hand-coded static site + Cloudflare Worker API. No React, no Next.js, no build step on the frontend. Keep it that way unless explicitly instructed otherwise.

---

## Production Status

| Item | Status |
|---|---|
| Site live | ✅ `https://late-records.shop` |
| Worker live | ✅ Auto-deploys via GitHub Actions on push to `worker/**` |
| R2 catalog cache | ✅ 10-min TTL, cron refresh `*/10 * * * *` |
| R2 tags cache | ✅ 24-hr TTL, stale served on Gemini failure |
| Cloudflare Observability | ✅ `head_sampling_rate = 1` in `wrangler.toml` |
| PageSpeed (desktop) | ✅ 100 Performance / 93 Accessibility / 100 Best Practices |
| PageSpeed (mobile) | ✅ 95 Performance / 93 Accessibility / 100 Best Practices |

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Static files in `site/` |
| API layer | Cloudflare Worker | `worker/index.js` |
| Media storage | Cloudflare R2 | Bucket: `late-records-media`, served at `media.late-records.shop` |
| Catalog data | Google Sheets + Apps Script | Single source of truth |
| Catalog cache | R2 `data/catalog.json` | 10-min TTL + cron warm |
| Tags cache | R2 `data/tags.json` | 24-hr TTL |
| Tag generation | Google Gemini API | Called from Worker |
| Payments | Manual (GCash/BPI bank transfer) | No payment processor |
| CI/CD | GitHub Actions | `.github/workflows/deploy-worker.yml` |
| Analytics | Cloudflare Web Analytics | Beacon in all HTML files |
| Error visibility | Cloudflare Observability | `head_sampling_rate = 1` |

---

## Repository Structure

```
late-records/
├── site/                        # Static frontend (Cloudflare Pages)
│   ├── index.html               # Main catalog page
│   ├── genre.html               # Genre filter view
│   ├── albums/
│   │   └── album.html           # Album detail (?id= query param)
│   ├── cart.html
│   ├── checkout.html
│   ├── success.html
│   ├── script.js                # Shared: LR.cart, LR.api, LR.ui
│   ├── catalog.js               # rowHTML() — catalog row renderer
│   ├── search.js                # buildTable(), renderTable(), AZ nav
│   ├── style.css
│   └── fonts/
│       ├── inter.css            # @font-face with font-display: swap
│       ├── inter-latin.woff2
│       └── inter-latin-ext.woff2
├── worker/
│   ├── index.js                 # Worker API + cron handler
│   ├── wrangler.toml            # Config, R2 bindings, cron, observability
│   └── package.json
├── .github/workflows/
│   └── deploy-worker.yml        # Auto-deploy on push to worker/**
├── AGENT_HANDOFF.md             # ← You are here. Entry point for all AI sessions.
├── ARCHITECTURE.md              # High-level system overview
└── ARCHITECT_NOTES.md          # Decisions, constraints, backlog, rejected ideas
```

---

## Worker API — Active Rules

All routes at `late-records.shop/api/*`.

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/api/catalog` | R2 → 10-min TTL. Falls back to Apps Script on miss. |
| `GET` | `/api/album?id=` | Single album lookup. |
| `GET` | `/api/tags?id=` | R2 cached 24 hr. Stale served on Gemini 429. |
| `GET` | `/api/suggest?q=` | Search suggestions. |
| `POST` | `/api/order` | **Server-side price recalculation. Client total is never trusted.** |
| cron | `*/10 * * * *` | Proactively refreshes R2 catalog cache. |

**Order validation rules (never bypass):**
- `album_id` must exist in live catalog
- `quantity` must be integer ≥ 1
- `deliveryMethod` must be `ship`, `local`, or `pickup`
- Server recalculates subtotal + shipping independently
- Mismatch between client and server total → `400 Bad Request`
- CORS locked to `https://late-records.shop` and `http://localhost:<any>`

---

## What Has Been Completed

- CORS locked to allowlist (no wildcard)
- Server-side price validation on `/api/order`
- R2 catalog cache (10-min TTL, cron refresh, async write-back)
- R2 tags cache (24-hr TTL, stale-on-failure for Gemini 429)
- Canonical `<link>` tags on album pages (dynamic via `renderAlbum()`)
- Open Graph + Twitter Card meta tags (all pages; dynamic on album pages)
- JSON-LD Product schema (album pages, injected in `renderAlbum()`)
- Cart redesign — utilitarian single-row layout, no album art
- `success.html` wipes all 9 order localStorage keys + `LR.cart.clear()`
- `robots.txt` + `sitemap.xml` (transactional pages excluded from crawl)
- GitHub Actions auto-deploy for Worker
- Cloudflare Observability (`head_sampling_rate = 1`)
- 2-min localStorage catalog cache in `LR.api.catalog()`
- `sample_count` support in `setupAudio()` — skips HEAD probes when known
- **`fetchpriority="high"` on first 2 catalog images** (LCP improvement)
- **`font-display: swap` already set; `<link rel="preload">` for `inter-latin.woff2` on all 6 pages** (FCP/CLS improvement)
- **`defer` + `DOMContentLoaded` wrapper on `cart.html`, `success.html`, `album.html`**

---

## What Is Still Pending

### User action needed (no code)
- **Add `sample_count` column to Google Sheet** — integer, number of audio samples per album. Code already supports it via `item.sample_count`. Without it, `setupAudio()` falls back to 5 sequential HEAD requests per album page load.

### Approved for next session
- **Name magic numbers as constants** in `worker/index.js` (shipping tier amounts, commission %)

### Parked — do not implement yet
- **Sentry** (`@sentry/cloudflare`, `withSentry` wrapper, `SENTRY_DSN` via `wrangler secret put`). GitHub Actions is now set up (source maps auto-upload). Revisit when order volume makes crash reports worth the setup.

### Future — do not start until site is stable
- **SPA migration** — full plan in ARCHITECT_NOTES.md Section 3. Entry point: `site/app.html`. Persistent audio player survives route changes. Do not start this.

---

## Hard Constraints — Never Break These

1. **Staging before main** — every change goes to a feature branch first. Cloudflare Pages auto-deploys a preview. Merge to `main` only after visual confirmation on staging. No exceptions.
2. **No SPA work yet** — do not touch routing or create `app.html`.
3. **No payment processor** — do not add Stripe, PayMongo, or any gateway.
4. **No secrets in `wrangler.toml`** — use `wrangler secret put`.
5. **Never trust client cart total** — always recalculate server-side in the Worker.
6. **Never use `git push --force` on main**.

---

## Key Decisions — Do Not Reopen

| Decision | Why |
|---|---|
| R2 over `caches.default` for catalog | Edge cache was unreliable and un-invalidatable. R2 is ~1–10ms, survives Worker restarts. |
| Cart with no album art | Mobile UX — art made rows too tall on small screens. |
| CORS allowlist | Prevents third-party pages from calling `/api/order` on behalf of users. |
| Global Activity Feed — **permanently rejected** | Fake social proof, off-brand. Durable Objects complexity not justified. Evaluated twice. Do not reopen. |
| Sentry parked | Not yet worth the setup at current order volume. |

---

## Deployment Reference

**Frontend:**
- Push to any branch → preview at `https://<branch-slug>.late-records.pages.dev`
- Push to `main` → live at `https://late-records.shop`

**Worker:**
- Push to `main` with changes in `worker/**` → GitHub Actions runs `wrangler deploy` automatically
- Manual: `cd worker && wrangler deploy`
- Add secrets: `wrangler secret put <KEY>` (type value at prompt — never on command line)

**R2 media:**
- `wrangler r2 object put late-records-media/images/<album_id>.jpg --file=... --content-type=image/jpeg`

---

## How to Use This File

**Starting a new session with any AI agent:**
1. Copy the contents of this file
2. Paste it at the start of your prompt as context
3. Then describe what you want to do

The agent will have full context on the stack, what's done, what's pending, and every constraint — without needing to read the whole codebase first.
