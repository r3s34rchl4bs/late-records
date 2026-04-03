/**
 * Late Records — Shared Script
 * API layer: /api/catalog  /api/album  /api/order
 * Cart, UI helpers, datetime
 */

const LR = (() => {

  // ── Config ────────────────────────────────────────────────
  const API_BASE = 'https://late-records.shop';

  // ── API ───────────────────────────────────────────────────
  const CATALOG_CACHE_KEY = 'lr_catalog_cache';
  const CATALOG_TTL_MS    = 2 * 60 * 1000; // 2 minutes

  const api = {
    async catalog() {
      try {
        const raw = localStorage.getItem(CATALOG_CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CATALOG_TTL_MS) return data;
        }
      } catch {}
      const res = await fetch(`${API_BASE}/api/catalog`);
      if (!res.ok) throw new Error('Failed to load catalog');
      const data = await res.json();
      try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
      return data;
    },

    async album(id) {
      const res = await fetch(`${API_BASE}/api/album?id=${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load album');
      return res.json();
    },

    async order(payload) {
      const res = await fetch(`${API_BASE}/api/order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      return res.json();
    }
  };

  // ── Cart ──────────────────────────────────────────────────
  const CART_KEY = 'lr_cart';

  const cart = {
    get() {
      try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
      catch { return []; }
    },

    save(items) {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      cart._emit();
    },

    add(item) {
      const items = cart.get();
      if (items.find(i => i.id === item.id)) return 'exists';
      items.push({ ...item, qty: 1 });
      cart.save(items);
      return 'added';
    },

    remove(id) {
      cart.save(cart.get().filter(i => i.id !== id));
    },

    updateQty(id, delta) {
      const items = cart.get();
      const item  = items.find(i => i.id === id);
      if (!item) return;
      item.qty = Math.max(1, Math.min(item.qty + delta, item.stock || 10));
      cart.save(items);
    },

    clear() {
      localStorage.removeItem(CART_KEY);
      cart._emit();
    },

    count()    { return cart.get().reduce((n, i) => n + i.qty, 0); },
    subtotal() { return cart.get().reduce((n, i) => n + i.price * i.qty, 0); },

    shipping() {
      const qty = cart.count();
      if (qty <= 2) return 250;
      if (qty <= 5) return 350;
      return 450;
    },

    total() { return cart.subtotal() + cart.shipping(); },

    _emit() {
      window.dispatchEvent(new CustomEvent('lr:cart:updated'));
    }
  };

  // ── UI helpers ────────────────────────────────────────────
  const ui = {
    peso(n) {
      return '₱' + Number(n).toLocaleString('en-PH');
    },

    datetime(el) {
      if (!el) return;
      const tick = () => {
        const now  = new Date();
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const hh   = String(now.getHours()).padStart(2, '0');
        const mm   = String(now.getMinutes()).padStart(2, '0');
        el.textContent = `${date} — ${hh}:${mm} GMT+8`;
      };
      tick();
      setInterval(tick, 1000);
    },

    syncCartBadge() {
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = cart.count();
      });
    },

    splitPipe(val) {
      return String(val || '').split('||').map(s => s.trim()).filter(Boolean);
    }
  };

  window.addEventListener('lr:cart:updated', () => ui.syncCartBadge());

  document.addEventListener('DOMContentLoaded', () => {
    ui.syncCartBadge();
    ui.datetime(document.getElementById('datetime'));
    ui.datetime(document.getElementById('datetime-footer'));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.is-open').forEach(el => el.classList.remove('is-open'));
      }
    });
  });

  return { api, cart, ui };

})();

// ── Theme ──────────────────────────────────────────────────

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('lr_theme', dark ? 'dark' : 'light');
}

document.addEventListener('DOMContentLoaded', function() {
  var saved = localStorage.getItem('lr_theme');
  applyTheme(saved === 'dark');
  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      applyTheme(!document.documentElement.classList.contains('dark'));
    });
  }
});

// ── Nav: Cart ↔ Checkout label ────────────────────────────
// Runs on every page. Swaps the header nav link label between
// "Cart" and "Checkout" based on whether items exist in the cart.
// Uses root-relative hrefs (/cart.html, /checkout.html) so the link
// works correctly from any page depth (e.g. /albums/album.html).
// Fires on:
//   - DOMContentLoaded      (normal page load)
//   - lr:cart:updated        (after any cart add/remove/clear)
//   - pageshow + persisted   (iOS Safari back/forward from bfcache)
function updateNav() {
  var count    = LR.cart.count();
  var hasItems = count > 0;
  var label    = hasItems ? 'Checkout' : 'Cart';
  var href     = hasItems ? '/checkout.html' : '/cart.html';
  document.querySelectorAll('.cart-link').forEach(function(el) {
    el.href = href; // root-relative — safe from any directory depth
    var badge = el.querySelector('.cart-count');
    if (badge) {
      // innerHTML only replaces children — el.href set above is preserved
      el.innerHTML = label + ' (<span class="cart-count">' + count + '</span>)';
    } else {
      el.textContent = label;
    }
  });
}

window.addEventListener('lr:cart:updated', updateNav);
document.addEventListener('DOMContentLoaded', updateNav);

// iOS Safari restores pages from bfcache on back/forward navigation.
// DOMContentLoaded does NOT re-fire in this case — only pageshow does.
window.addEventListener('pageshow', function(e) {
  if (e.persisted) updateNav();
});
