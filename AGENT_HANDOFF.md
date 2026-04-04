# Late Records — Agent Handoff
> **Start here.** Updated: 2026-04-05 (v1.1)

---

## What This Project Is

**Late Records** is a live vinyl e-commerce storefront at `https://late-records.shop`. Real store, real transactions. Hand-coded Vanilla JS SPA + Cloudflare Workers API. No React, no Next.js, no build step. Keep it that way.

---

## Production Status

| Item | Status |
|---|---|
| Site live (SPA v1.1) | ✅ `https://late-records.shop` |
| Worker live | ✅ Auto-deploys via GitHub Actions on push to `worker/**` on `main` |
| R2 catalog cache | ✅ 2-min TTL, cron refresh every 10 min |
| `_redirects` SPA routing | ✅ All paths → `index.html 200` |
| WebP images + JPG fallback | ✅ `_wf()` in `catalog.js` |
| Cart → Checkout dynamic nav | ✅ `updateNav()` in `script.js` |

---

## SPA Architecture

### Single-file shell

`site/index.html` (~2500+ lines) — single HTML file containing all CSS, all view HTML, all JS logic. External JS files ARE loaded:

| File | Role |
|---|---|
| `script.js` | `LR.api`, `LR.cart`, `LR.ui`, `updateNav()`, theme toggle, pinch-zoom lock |
| `catalog.js` | `rowHTML()` catalog row renderer, `_wf()` WebP fallback, `highlight()` |
| `search.js` | `LR_SEARCH` — `buildTable()`, `buildAZNav()`, `renderTable()`, `applyAvailToggle()` |

### Routes

| Route | View |
|---|---|
| `/` | Home: carousel + catalog table + sold log + tag cloud |
| `/album/:id` | Album detail (image, tracklist, audio samples, add to cart) |
| `/cart` | Cart with qty controls |
| `/checkout` | Checkout form (Turnstile-protected) |
| `/success` | Order confirmation + countdown |
| `/genre/:slug` | Genre filter view |

### How routing works

- `navigate(path)` — the SPA's router function, defined in `index.html`
- History API `pushState` for clean URLs
- `popstate` + `pageshow` listeners handle back/forward + iOS bfcache
- `site/_redirects` contains `/*    /index.html    200` so Cloudflare Pages serves the SPA shell for all paths

### Key SPA elements

- **`#app-root`** — div whose `innerHTML` is swapped on every route change
- **`#audio-player`** — persistent audio bar, lives OUTSIDE `#app-root`, never unmounted
- **`LR_PLAYER` singleton** — one `new Audio()` created once. Survives route transitions. Exposes: `init()`, `play()`, `pause()`, `next()`, `prev()`, `playAlbum()`, `setContext()`
- **`updateNav()`** in `script.js` — swaps nav link between "Cart (n)" and "Checkout (n)" based on cart state. Called on: DOMContentLoaded, `lr:cart:updated` event, `pageshow` (bfcache), and at the start of every `navigate()` call

---

## How to Deploy

### Staging (feature branch)

```bash
export PATH="$PATH:/usr/local/bin"
cd /Users/a4144/Documents/late-records
wrangler pages deploy site --project-name=late-records --branch staging --commit-dirty=true
```

Preview URL: `https://staging.late-records.pages.dev`

### Production (main branch)

Push to `main` — GitHub Actions handles Pages deploy automatically.

Worker deploys automatically when `worker/**` changes are pushed to `main`.

### Manual worker deploy (emergency)

```bash
export PATH="$PATH:/usr/local/bin"
cd /Users/a4144/Documents/late-records/worker
wrangler deploy
```

### Syntax-check JS before deploying

```bash
export PATH="$PATH:/usr/local/bin"
cd /Users/a4144/Documents/late-records
awk '/^<script>$/{found=1; next} /^<\/script>$/{found=0} found' site/index.html > /tmp/lr_check.js
node --check /tmp/lr_check.js
```

---

## Hard Constraints

1. **Staging before main** — always test on staging first, never push untested code to main
2. **Never trust client cart total** — Worker recalculates server-side, mismatches → 400
3. **No payment processor** — no Stripe, PayMongo, or any gateway
4. **No secrets in `wrangler.toml`** — use `wrangler secret put`
5. **Never `git push --force` on main`**
6. **No React / no build step** — hard constraint from day one

---

## Pending Work

| Item | Priority | Notes |
|---|---|---|
| Upload audio samples | Medium | `altered-state-by-maldwyn-pope`, `10-by-various-artists`, `phase-iii-by-iao` — add to R2, set `sample_count` in Sheet |
| Revisit Worker catalog TTL | Low | Currently 2 min (changed from 10 min in v1.1 for testing). Decide final value — 2 min is safe but cron runs every 10 min anyway. |
| `sample_count` missing for 3 albums | Low | Once audio is uploaded to R2, fill `sample_count` column in Sheet for those albums |

---

## Key Decisions — Do Not Reopen

| Decision | Why |
|---|---|
| R2 over `caches.default` | Edge cache unreliable, un-invalidatable. R2 ~1–10ms. |
| No table header row | User decision — catalog rows stand alone |
| Cart without album art | Mobile UX — art made rows too tall |
| Global Activity Feed | **Permanently rejected.** Fake social proof, off-brand. |
| Sentry | Parked — not worth setup at current order volume |
| No React / no build step | Hard constraint from day one |
| WebP images (1200×1200, q82) | Best quality/size ratio for free R2 hosting. JPG fallback via `_wf()`. |
| 2-min catalog TTL | Sold-out status updates visible within 2 min of order — important for small inventory store |

---

## Known Bugs — Fixed in v1.1

| Bug | Root Cause | Fix |
|---|---|---|
| Cart 404 intermittent | `script.js` DOMContentLoaded captured old `updateNav` with `.html` routes | Changed `script.js` routes to `/cart` and `/checkout`; added `e.stopPropagation()` on onclick; called `updateNav()` in SPA's DOMContentLoaded and `navigate()` |
| Success page summary/countdown broken | HTML used `metaAddrLabel` but JS referenced `metaAddressLabel` | Replaced all occurrences with `metaAddrLabel` |
| Sold log text overflow | Long text breaking column layout | `min-width: 0; overflow: hidden` on `.sold-log-col` |
