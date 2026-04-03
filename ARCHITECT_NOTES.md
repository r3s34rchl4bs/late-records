# Late Records — Architect Notes

---

## Standing Rule: Staging Before Main

**All code changes must be verified on staging before merging to main.**

1. Work happens on a feature branch (e.g. `claude/infallible-lichterman`)
2. Push branch → Cloudflare Pages auto-deploys a preview URL (e.g. `claude-infallible-lichterman.late-records.pages.dev`)
3. Test on staging — mobile and desktop
4. Only merge to `main` after visual confirmation

No exceptions, even for small fixes.

---

## Section 0: R2 Media — Operational Reference

### 0.1 How Media Is Served

All album images and audio samples live in the Cloudflare R2 bucket `late-records-media`, served via the custom domain `https://media.late-records.shop`.

| Media type | URL pattern |
|---|---|
| Album cover | `https://media.late-records.shop/images/{album_id}.jpg` |
| Audio sample | `https://media.late-records.shop/audio/{album_id}-{n}.mp3` |

The `album_id` is the slug from Google Sheets (e.g. `self-titled-by-arthur-verocai`). Filename must match exactly — case-sensitive.

### 0.2 Adding a New Album — Full Workflow

**Every new album needs 3 things. Do them in this order:**

1. **Upload image to R2** — open Mac Terminal (any directory):
   ```bash
   wrangler r2 object put late-records-media/images/{album_id}.jpg \
     --file="/Users/a4144/path/to/image.jpg" \
     --content-type="image/jpeg"
   ```

2. **Upload audio sample(s) to R2** — one command per sample file:
   ```bash
   wrangler r2 object put late-records-media/audio/{album_id}-1.mp3 \
     --file="/Users/a4144/path/to/sample.mp3" \
     --content-type="audio/mpeg"
   ```

3. **Update Google Sheets** — add a new row with the `album_id` slug matching the filenames above. Set `status` to `available`.

No git commit or Cloudflare Pages deploy is needed for media uploads — R2 is live immediately.

### 0.3 Image Spec

- Format: JPEG
- Width: 600px (height proportional)
- Quality: 80
- Quick batch resize (Mac Terminal, from the folder containing images):
  ```bash
  mogrify -resize 600x -quality 80 *.jpg
  ```

### 0.4 Diagnosing a Missing or Broken Image

If an album shows a broken image or "Image Pending" placeholder:

1. **Find the album_id** — check the Google Sheets catalog row
2. **Test the URL directly** — paste into browser:
   `https://media.late-records.shop/images/{album_id}.jpg`
   - Returns image → file is there, check the album_id in Sheets matches exactly
   - Returns 404 → file not in R2, upload it (see 0.2)
   - Returns 403 → file may exist but has wrong permissions, re-upload it

3. **Re-upload** from Mac Terminal (any directory):
   ```bash
   wrangler r2 object put late-records-media/images/{album_id}.jpg \
     --file="/Users/a4144/path/to/image.jpg" \
     --content-type="image/jpeg"
   ```

### 0.5 Known Missing Images (as of 2026-04-03)

These three albums are in the catalog but have no matching image in R2.
Upload them using the commands in 0.3 above:

| Artist | album_id | File to upload |
|---|---|---|
| Arthur Verocai | `self-titled-by-arthur-verocai` | `self-titled-by-arthur-verocai.jpg` |
| ANRI | `catseye-by-anri` | `catseye-by-anri.jpg` |
| Abdou El Omari | `nuits-d-ete-avec-abdou-el-omari-by-abdou-el-omari` | `nuits-d-ete-avec-abdou-el-omari-by-abdou-el-omari.jpg` |

---

## Section 1: Security Layer

**Status: COMPLETED**

### 1.1 CORS Lockdown (`worker/index.js`)

The `cors()` helper was previously echoing back any `Origin` header (effectively equivalent to `*`).

**Current allowlist:**
- `https://late-records.shop` — production
- `http://localhost:<any port>` — local dev via `wrangler dev`

All other origins receive `Access-Control-Allow-Origin: https://late-records.shop`, which causes the browser to block the cross-origin response. A `Vary: Origin` header is included so CDN/cache layers do not serve the wrong ACAO header to different origins.

### 1.2 Server-Side Price Validation (`worker/index.js` — `POST /api/order`)

The client submits `{ items: [{ album_id, quantity }], deliveryMethod, total, ... }`.

The worker now **independently recalculates** the order total before forwarding to Apps Script:

1. Fetches the live catalog (already cached at the edge for 2 min).
2. Looks up each `album_id` and reads `price` from the authoritative catalog record.
3. Rejects any item with an unknown `album_id` or a non-integer quantity < 1.
4. Calculates `serverSubtotal = Σ(price × quantity)`.
5. Calculates `serverShipping` from delivery method and total quantity:
   - `pickup` → ₱0
   - `local`  → ₱100
   - `ship`, qty 1–2 → ₱250 / qty 3–5 → ₱350 / qty 6+ → ₱450
6. If `round(serverSubtotal + serverShipping) ≠ round(client total)` → `400 Bad Request`.
7. Passes `serverTotal` (not the client value) forward to Apps Script for logging.

### 1.3 Payload Validation (`worker/index.js` — `POST /api/order`)

Before touching the catalog or Turnstile, the worker now rejects:
- Missing or non-array `items`
- Empty `items` array
- `deliveryMethod` not in `{ 'ship', 'local', 'pickup' }`

Malformed individual items (no `album_id`, non-integer or < 1 `quantity`) are caught in the price-calculation loop.

---

## Section 1b: Quick Wins Audit (2026-04-03)

| Item | Finding | Action |
|---|---|---|
| Lazy loading on album images | ✅ Already present — `catalog.js` `rowHTML()` has `loading="lazy"` on every `<img>`. Both `index.html` and `genre.html` use this single template. No change needed. | — |
| `success.html` localStorage wipe | ✅ Completed this session — all 9 order keys cleared + `LR.cart.clear()` | — |
| `album copy.html` duplicate | ✅ Already absent from both worktree and main repo `site/albums/` | — |
| `robots.txt` | ❌ Was missing — created `site/robots.txt` | Done |
| `sitemap.xml` | ❌ Was missing — created `site/sitemap.xml` | Done |

### robots.txt rules
- `Allow: /` — full crawl permitted by default
- `Disallow` on: `/checkout.html`, `/success.html`, `/hidden-pricer.html`, `/cart.html` — transactional/internal pages with no SEO value
- `Sitemap:` directive points to `https://late-records.shop/sitemap.xml`

### sitemap.xml entries
- `/` — priority 1.0, `changefreq: weekly` (catalog changes with new stock)
- `/genre.html` — priority 0.6, `changefreq: weekly`
- Individual album pages (`/albums/album.html?id=...`) are **not** in the sitemap — they use query params which Google handles inconsistently. When we move to SPA routing (`/album/:id`), add them.

---

## Section 2: Component Registry

Global CSS classes defined in `site/style.css`:

| Class / Token | Value | Notes |
|---|---|---|
| `.header-logo` | width auto, height 37px | Logo across all pages |
| `.fixed-header` | position fixed, top 0, z-index 100 | Sticky site header |
| `.container` | max-width 1100px, padding 80px 24px 60px | Main content wrapper |
| `.btn` | base button style | Used for add-to-cart, etc. |
| `--ink` | `#0d0d0d` (light) / `#f0f0f0` (dark) | Primary text |
| `--ink55` | 55% opacity ink | Secondary / meta text |
| `--ink15` / `--ink30` | 15% / 30% opacity ink | Borders, dividers |
| `--btn-bg` / `--btn-fg` | ink / paper | CTA button fill |
| `--border-mid` | mid-opacity border | Section dividers |

---

## Section 3: SPA Roadmap

### Goal
Replace the 7 separate HTML files with a single `index.html` shell. The `<audio>` player lives **outside** `#app-root` so it persists across route transitions without interruption.

### Shell Structure (target)

```html
<body>
  <header class="fixed-header">…</header>

  <!-- Audio player — persists outside the SPA root -->
  <div id="audio-player">…</div>

  <!-- SPA mount point — router swaps content here -->
  <div id="app-root"></div>

  <footer>…</footer>
</body>
```

### Routes (planned)

| Route | View |
|---|---|
| `/` | Home / catalog grid |
| `/album/:id` | Album detail |
| `/cart` | Cart |
| `/checkout` | Checkout form |
| `/success` | Order confirmation |
| `/genre/:slug` | Genre filter |
| `/search` | Search results |

### Migration Constraint

**Do not touch the 7 existing HTML files** until the Security Layer (Section 1) is deployed and verified in production. The SPA shell will be built as a new `site/app.html` entry point, and the old files will be deleted only after the router covers all routes.

### Audio Player ("Music Never Stops") Requirements

- Player initialises on first user interaction (autoplay policy).
- Playlist drawn from the catalog; shuffled on load.
- Track advances automatically; no hard stop between page transitions.
- Player state (current track, position, play/pause) lives in a module-level singleton — **not** in `localStorage` — so it survives JS re-renders but resets on hard refresh.

---

## Section 4: Cart Persistence & Dynamic Navigation

### 4.1 What Already Exists

`LR.cart` in `site/script.js` already reads and writes to `localStorage` via `cart.get()` and `cart.save()`. The cart survives page refreshes. **Do not rewrite this** — it is working.

### 4.2 What Needs to Be Built — `updateNav()`

A single function added to `script.js` that runs:
- On `DOMContentLoaded` (every page)
- After every `cart.add()`, `cart.remove()`, `cart.updateQty()`, and `cart.clear()` call
- Triggered via the existing `lr:cart:updated` custom event

**Logic:**
```js
function updateNav() {
  const hasItems = LR.cart.count() > 0;
  document.querySelectorAll('.cart-link').forEach(el => {
    el.textContent = hasItems ? 'Checkout' : 'Cart';
    // preserve cart count badge if present
  });
}
window.addEventListener('lr:cart:updated', updateNav);
document.addEventListener('DOMContentLoaded', updateNav);
```

The `.cart-link` class is already on every header nav anchor — no HTML changes required across the 7 pages.

### 4.3 Success Page — Full localStorage Wipe

On `success.html`, after rendering the confirmation, clear ALL order-related keys:

```js
const ORDER_KEYS = [
  'lr_buyer', 'lr_order_total', 'lr_order_created_at',
  'lr_address', 'lr_order_items', 'lr_order_subtotal',
  'lr_order_shipping', 'lr_delivery_method'
];
ORDER_KEYS.forEach(k => localStorage.removeItem(k));
LR.cart.clear(); // also wipes lr_cart
```

This ensures the next visit starts with an empty cart and "Cart" label — not "Checkout" for an already-completed order.

### 4.4 Security Note — localStorage Price Tampering

A user could manually edit `localStorage` to change a record's price before checkout (e.g., set a ₱1,200 record to ₱1).

**This is already blocked.** The Worker's `POST /api/order` handler (Section 1.2) independently re-fetches prices from the catalog and recalculates the total server-side. The client-sent total is compared against the server total — any mismatch returns `400`. The client price in localStorage is irrelevant to what gets charged.

---

## Section 5: Master Task Backlog (Priority Order)

Last updated: 2026-04-03

### 🔴 Do immediately (high impact, low effort)

| Task | Why | Effort |
|---|---|---|
| Add Cloudflare Analytics token to all 6 HTML files | Every day without it is lost traffic data. Zero code — just paste the token. | 5 min |
| Add `sample_count` column to Google Sheet | Eliminates 5 audio metadata requests per album page load. Code is already done — user just needs to fill the column. | 10 min (user fills sheet) |

### 🟠 Next sprint (high impact, medium effort)

| Task | Why | Effort |
|---|---|---|
| Canonical `<link>` tags on album pages | Album pages use `?id=` query params. Without canonical tags Google may treat them as duplicate or low-value URLs. | 30 min |
| catalog.json snapshot on R2 (replaces live Sheets fetch in Worker) | Worker currently hits Google Sheets on every `/api/catalog` call. R2 JSON would be faster, more reliable, and survives Sheets downtime. Needs a sync script (Apps Script or scheduled Worker). | 2–3 hrs |
| Error monitoring for Worker exceptions | Currently flying blind on backend errors. Add Cloudflare Logpush or a simple error counter. | 1 hr |

### 🟡 Polish (medium impact, low–medium effort)

| Task | Why | Effort |
|---|---|---|
| `defer` on `cart.html`, `success.html`, `album.html` | Requires wrapping inline scripts in `DOMContentLoaded` first. Minor parse performance gain. | 1 hr |
| GitHub Actions: auto-deploy Worker on push to main | Currently Worker must be deployed manually via `wrangler publish`. | 1 hr |
| Name magic numbers as constants (shipping tiers, commission %) | Code quality / maintainability only. No user-facing impact. | 30 min |

### 🔵 SPA Phase (future — do not start until current site is stable)

Full plan in Section 3. Key constraint: audio player must live outside `#app-root`.

| Task | Notes |
|---|---|
| SPA shell (`app.html` + router) | New entry point. Old HTML files deleted after all routes covered. |
| History API routing | `pushState` for clean URLs (`/album/:id`, `/cart`, etc.) |
| Persistent audio player | Initialized once, survives all route transitions |
| catalog.json as SPA data source | R2 snapshot replaces live Worker fetch entirely on the client |
| Lazy-render album images | Only render images in viewport — already have `loading="lazy"`, may want IntersectionObserver for more control |

### ⏸ Parked — revisit when site grows

| Idea | When to revisit | Notes |
|---|---|---|
| Sentry error monitoring (`@sentry/cloudflare`) | When order volume grows and line-by-line crash reports are needed | Set up GitHub Actions auto-deploy first — source maps upload automatically on each deploy, making Sentry much more useful. DSN goes in `wrangler secret put SENTRY_DSN`. Use `withSentry` wrapper on the fetch handler. |

### ❌ Rejected / Deferred

| Idea | Reason |
|---|---|
| Global Activity Feed (Durable Objects + WebSockets) | Over-engineered for current scale. Ghost logs are fake social proof — off-brand for a curated shop. Revisit if/when there's real concurrent traffic to broadcast. |
| Flash invert on header actions | Gimmick. Clashes with current clean aesthetic. |
| Roboto Mono / terminal design split | Not the current brand direction. Revisit only if a deliberate brutalist pivot is decided. |
| USR_[ID] session broadcasting | Requires privacy disclosure / consent. Not worth complexity at this stage. |
| Disable all animations | Current animations are subtle and intentional. Removing them hurts UX with no meaningful gain. |
