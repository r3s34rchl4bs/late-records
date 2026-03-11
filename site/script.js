/**
 * Late Records — Shared Script
 * script.js — loaded by every page
 *
 * Exports (globals):
 *   LR.api.catalog()
 *   LR.api.album(id)
 *   LR.api.order(payload)
 *   LR.cart.*
 *   LR.ui.datetime(el)
 *   LR.ui.syncCartBadge()
 */

const LR = (() => {

  // ── Config ───────────────────────────────────────────────────────────────

  const API_BASE = ''; // Empty = same origin (Worker route on /api/*)

  // ── API ──────────────────────────────────────────────────────────────────

  const api = {
    async catalog() {
      const res = await fetch(`${API_BASE}/api/catalog`);
      if (!res.ok) throw new Error('Failed to load catalog');
      return res.json();
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

  // ── Cart ─────────────────────────────────────────────────────────────────

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
      // item: { id, title, artist, price, stock }
      const items = cart.get();
      const existing = items.find(i => i.id === item.id);
      if (existing) {
        if (existing.qty < (item.stock || 1)) existing.qty++;
      } else {
        items.push({ ...item, qty: 1 });
      }
      cart.save(items);
    },

    remove(id) {
      cart.save(cart.get().filter(i => i.id !== id));
    },

    updateQty(id, delta) {
      const items = cart.get();
      const item  = items.find(i => i.id === id);
      if (!item) return;
      item.qty = Math.max(1, Math.min(item.qty + delta, item.stock || 99));
      cart.save(items);
    },

    clear() {
      localStorage.removeItem(CART_KEY);
      cart._emit();
    },

    count() {
      return cart.get().reduce((n, i) => n + i.qty, 0);
    },

    subtotal() {
      return cart.get().reduce((n, i) => n + i.price * i.qty, 0);
    },

    shipping() {
      const qty = cart.count();
      if (qty <= 2) return 250;
      if (qty <= 5) return 350;
      return 450;
    },

    total() {
      return cart.subtotal() + cart.shipping();
    },

    // Dispatch a custom event so any open page can react
    _emit() {
      window.dispatchEvent(new CustomEvent('lr:cart:updated'));
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────

  const ui = {
    // Update a datetime element every second
    datetime(el) {
      if (!el) return;
      const tick = () => {
        const now  = new Date();
        const date = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
        const hh   = String(now.getHours()).padStart(2, '0');
        const mm   = String(now.getMinutes()).padStart(2, '0');
        el.textContent = `${date} — ${hh}:${mm} GMT+8`;
      };
      tick();
      setInterval(tick, 1000);
    },

    // Sync the cart count badge in the header
    syncCartBadge() {
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = cart.count();
      });
    },

    // Format peso
    peso(n) {
      return '₱' + Number(n).toLocaleString('en-PH');
    },

    // Simple modal open/close
    modal(overlayEl, open) {
      if (!overlayEl) return;
      overlayEl.classList.toggle('open', open);
    }
  };

  // Keep badge synced on cart changes
  window.addEventListener('lr:cart:updated', () => ui.syncCartBadge());

  // ── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    ui.syncCartBadge();
    ui.datetime(document.getElementById('datetime'));
    ui.datetime(document.getElementById('datetime-footer'));

    // Global escape key closes any open modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(el => {
          el.classList.remove('open');
        });
      }
    });
  });

  return { api, cart, ui };

})();
