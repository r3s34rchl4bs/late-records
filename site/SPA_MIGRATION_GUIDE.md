# Late Records — SPA Migration Guide

> **Handoff document for the implementation agent.**
> Written by: `claude/upbeat-burnell` (audit + planning phase)
> Implemented by: `claude/distracted-nash` (implementation phase)
> Last updated: 2026-04-04

---

## 1. Goal

Replace the 7 separate HTML files with a single `site/app.html` shell.

The `<audio>` player lives **outside** `#app-root` so it persists across route transitions without interruption ("Music Never Stops").

Old files are **not deleted** until `app.html` covers every route and is visually confirmed on staging.

---

## 2. Files to Create

| File | Purpose |
|---|---|
| `site/app.html` | SPA shell + router + all view renderers + persistent audio player |
| `site/_redirects` | Cloudflare Pages SPA fallback |

**Files NOT modified:** all 7 existing HTML files, `script.js`, `catalog.js`, `search.js`, `tagcloud.js`, `turnstile.js`, `last-updated.js`, `style.css`.

---

## 3. Shell Structure (`app.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <!-- Inline dark-mode script (before body to prevent flash) -->
  <script>document.documentElement.classList.toggle('dark', localStorage.getItem('lr_theme') === 'dark')</script>
  <link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/inter-latin.woff2">
  <link rel="stylesheet" href="fonts/inter.css">
  <link rel="stylesheet" href="style.css">
  <!-- All page-specific CSS consolidated here in one <style> block -->
</head>
<body>

  <!-- Fixed header — identical across all views -->
  <header class="fixed-header">…</header>

  <!-- Search bar — shown only on catalog/genre/search views -->
  <div class="search-bar" id="searchBar">…</div>

  <!-- Persistent audio player — OUTSIDE #app-root, survives all route transitions -->
  <div id="audio-player" style="display:none;">…</div>

  <!-- SPA mount point — router swaps content here only -->
  <div id="app-root"></div>

  <!-- Shared scripts (load once, not per-route) -->
  <script src="last-updated.js"></script>
  <script src="script.js"></script>
  <script src="catalog.js"></script>   <!-- rowHTML() overridden below -->
  <script src="search.js"></script>
  <script src="tagcloud.js"></script>  <!-- buildTagHTML() overridden below -->
  <script src="turnstile.js"></script> <!-- init() called by renderCheckout(), not DOMContentLoaded -->

  <!-- SPA router + view renderers + audio player (all inline) -->
  <script>…</script>
</body>
</html>
```

---

## 4. Router

```js
// ── Routes ────────────────────────────────────────────────
const ROUTES = [
  { re: /^\/$/, fn: () => renderCatalog() },
  { re: /^\/album\/(.+)$/, fn: (m) => renderAlbum(decodeURIComponent(m[1])) },
  { re: /^\/cart$/, fn: () => renderCart() },
  { re: /^\/checkout$/, fn: () => renderCheckout() },
  { re: /^\/success$/, fn: () => renderSuccess() },
  { re: /^\/genre\/(.+)$/, fn: (m) => renderGenre(decodeURIComponent(m[1])) },
  { re: /^\/search$/, fn: () => renderSearch() },
];

// ── Navigate ──────────────────────────────────────────────
function navigate(path, pushState = true) {
  if (pushState) history.pushState(null, '', path);
  for (const route of ROUTES) {
    const m = path.match(route.re);
    if (m) { route.fn(m); return; }
  }
  render404();
}

// ── Popstate (back/forward) ───────────────────────────────
window.addEventListener('popstate', () => navigate(location.pathname, false));

// ── bfcache (iOS Safari back/forward) ────────────────────
window.addEventListener('pageshow', (e) => {
  if (e.persisted) navigate(location.pathname, false);
});

// ── Link interception ────────────────────────────────────
// Catches <a href="/..."> clicks — prevents full page reload.
// Does NOT intercept external links, mailto:, or # anchors.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
  e.preventDefault();
  navigate(href);
});

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  navigate(location.pathname, false);
});
```

---

## 5. URL Mapping (Old → New)

| Old URL | New SPA Route |
|---|---|
| `/` → `index.html` | `/` |
| `/albums/album.html?id=X` | `/album/X` |
| `/genre.html?g=X` | `/genre/X` |
| `/cart.html` | `/cart` |
| `/checkout.html` | `/checkout` |
| `/success.html` | `/success` |
| Search (inline in catalog) | `/search` (opens catalog with search active) |

### Why `location.href` clicks still work

`catalog.js rowHTML()` uses `onclick="location.href='albums/album.html?id=X'"`. That triggers a full navigation. Cloudflare Pages `_redirects` serves `app.html` (200) for any path without a matching static file. Since `/albums/album.html` IS a static file during the transition period, this path goes to the old file — which is fine. Links generated by the SPA itself use clean URLs.

**SPA-generated links override `catalog.js`:** After `<script src="catalog.js">`, immediately redefine `rowHTML` globally to emit `/album/X` hrefs. Same for `buildTagHTML` in `tagcloud.js`.

```js
// Override catalog.js rowHTML to use SPA routes
function rowHTML(item, query, isSuggestion, eager) {
  // ...identical logic but:
  //   onclick="navigate('/album/${encodeURIComponent(item.album_id)}')"
  //   genre tag: onclick="navigate('/genre/${encodeURIComponent(genre.toLowerCase())}')"
}

// Override tagcloud.js buildTagHTML to use SPA routes
function buildTagHTML(tags, limit) {
  // ...identical logic but url = '/album/' + encodeURIComponent(tag.albumId)
}
```

---

## 6. Cloudflare Pages `_redirects`

File: `site/_redirects`

```
/*    /app.html    200
```

**How it works on Cloudflare Pages:**
- Static files take priority over `_redirects` rules.
- Any path with no matching static file (e.g. `/cart`, `/album/X`, `/genre/jazz`) gets served `app.html` with HTTP 200.
- The SPA's router then reads `location.pathname` and renders the correct view.
- The old `.html` files remain accessible at their old paths during the transition.

**Phase 2 additions (after old files deleted):**

```
/index.html           /           302
/cart.html            /cart        302
/checkout.html        /checkout    302
/success.html         /success     302
/genre.html           /genre/      302
/*                    /index.html  200
```

---

## 7. "Music Never Stops" — Persistent Audio Player

### Singleton design

```js
const LR_PLAYER = (() => {
  const audio = new Audio();
  let playlist = [];   // [{ albumId, title, artist, src }]
  let idx = 0;
  let initialized = false;

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function init(catalog) {
    if (initialized) return;
    initialized = true;
    playlist = catalog
      .filter(a => Number(a.sample_count) > 0)
      .map(a => ({
        albumId: a.album_id,
        title:   a.title,
        artist:  a.artist,
        src:     `https://media.late-records.shop/audio/${a.album_id}/sample1.mp3`,
      }));
    _shuffle(playlist);
    audio.addEventListener('ended', next);
    _render();
  }

  function _render() {
    // Update #audio-player UI with current track info
    // Show/hide player based on playlist length
  }

  function _loadTrack(i) {
    const track = playlist[i];
    if (!track) return;
    idx = i;
    audio.src = track.src;
    _render();
  }

  function play() {
    if (!playlist.length) return;
    if (!audio.src) _loadTrack(0);
    audio.play();
    document.getElementById('audio-player').style.display = '';
  }

  function pause() { audio.pause(); }
  function next()  { _loadTrack((idx + 1) % playlist.length); audio.play(); }
  function prev()  { _loadTrack((idx - 1 + playlist.length) % playlist.length); }

  // State lives in module variables — NOT localStorage
  // Survives JS re-renders, resets on hard refresh (by design)
  return { init, play, pause, next, prev, get track() { return playlist[idx]; } };
})();
```

### Player UI (in shell, outside `#app-root`)

```html
<div id="audio-player" style="display:none;">
  <div id="player-inner">
    <button id="player-prev">‹</button>
    <button id="player-play">▶</button>
    <button id="player-next">›</button>
    <div id="player-info">
      <span id="player-title"></span>
      <span id="player-artist"></span>
    </div>
    <div id="player-progress-wrap">
      <div id="player-progress-bar"></div>
    </div>
    <span id="player-time"></span>
  </div>
</div>
```

### Autoplay policy

Audio cannot start until a user gesture. `LR_PLAYER.init(catalog)` is called once catalog loads (sets up playlist). `LR_PLAYER.play()` is only called in response to a user click on the player's play button. The player stays hidden until the user first clicks play.

---

## 8. CSS Strategy

All page-specific CSS is consolidated into a single `<style>` block in `app.html`. Nothing is added to `style.css` (shared base styles only). Page-specific styles are scoped by adding a class to `#app-root` or by nesting selectors under a view-specific wrapper class.

**View wrapper classes** (added/removed on `#app-root` on each route change):
- `.view-catalog`
- `.view-album`
- `.view-cart`
- `.view-checkout`
- `.view-success`
- `.view-genre`

This avoids style bleed between views while keeping everything in one file.

---

## 9. Turnstile on Checkout

`turnstile.js` auto-calls `LR_TURNSTILE.init()` on `DOMContentLoaded`. At that point, `#checkoutForm` does not exist in the shell, so `mountWidget()` is a no-op (it checks for `#checkoutForm`).

When `renderCheckout()` runs:
1. Injects checkout form HTML into `#app-root`
2. Calls `LR_TURNSTILE.init()` explicitly (mounts Turnstile widget onto the form)
3. Sets up form submit handler (identical logic to `checkout.html`)

On route change away from checkout: the widget is destroyed with the DOM. Next visit to `/checkout` re-calls `LR_TURNSTILE.init()`. The `document.getElementById('lr-ts-widget')` guard in `mountWidget()` prevents double-mounting.

---

## 10. View Inventory

| Route | Ported from | Key logic |
|---|---|---|
| `/` | `index.html` | Carousel, A-Z nav, catalog table, sold log, tag cloud, search bar |
| `/album/:id` | `albums/album.html` | Fetch album by id, render details, audio player (per-album sample), add-to-cart, related albums, OG/JSON-LD meta |
| `/cart` | `cart.html` | Render cart items, qty controls, remove, subtotal |
| `/checkout` | `checkout.html` | Form, delivery method, order summary, Turnstile, POST /api/order |
| `/success` | `success.html` | Read from localStorage, render order summary, countdown timer, localStorage wipe |
| `/genre/:slug` | `genre.html` | Genre pill nav, filtered catalog table, guide modal |
| `/search` | inline in `index.html` | Navigate to `/` and programmatically open the search bar |

---

## 11. SEO — Post-Migration Updates

After Phase 2 (old files deleted, `app.html` renamed to `index.html`):

1. **`site/sitemap.xml`** — add individual album URLs using clean `/album/:id` format
2. **`site/robots.txt`** — update `Disallow` paths from `.html` form to clean routes
3. **`AGENT_HANDOFF.md` / `ARCHITECT_NOTES.md`** — Atomic Release Sync on merge to `main`

---

## 12. Hard Constraints (never break)

1. No React, no build step — vanilla JS only
2. Never trust client cart total — server recalculates on every order
3. Staging before main — test at `https://<branch>.late-records.pages.dev/app.html`
4. Atomic Release Sync on merge to main (update all `.md` files in same commit)
5. Never `git push --force` on `main`
6. Delete old HTML files only after every route is confirmed working on staging
