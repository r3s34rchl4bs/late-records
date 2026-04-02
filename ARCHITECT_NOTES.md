# Late Records — Architect Notes

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
