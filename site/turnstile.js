/**
 * Late Records — Turnstile Security
 * Handles bot/spam protection on the checkout form.
 *
 * To update Turnstile settings, only edit this file.
 * Do not touch checkout.html for anything Turnstile-related.
 */

const LR_TURNSTILE = (() => {

  const SITE_KEY = '0x4AAAAAACpBT7ijFgQum-H_';
  let widgetId   = null;
  let _resolve   = null;

  function loadScript() {
    return new Promise(resolve => {
      if (typeof turnstile !== 'undefined') { resolve(); return; }
      const s    = document.createElement('script');
      s.src      = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async    = true;
      s.onload   = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function mountWidget() {
    await loadScript();
    const form = document.getElementById('checkoutForm');
    if (!form) return;
    if (document.getElementById('lr-turnstile-widget')) return;

    const div = document.createElement('div');
    div.id    = 'lr-turnstile-widget';
    div.style.display = 'none';
    form.appendChild(div);

    widgetId = turnstile.render(div, {
      sitekey:    SITE_KEY,
      size:       'invisible',
      callback:   token => { if (_resolve) { _resolve(token); _resolve = null; } },
      'error-callback': () => { if (_resolve) { _resolve(''); _resolve = null; } }
    });
  }

  // Returns a promise that resolves to the token
  // Executes the challenge on demand right before submit
  function getToken() {
    return new Promise(resolve => {
      if (typeof turnstile === 'undefined' || widgetId === null) {
        resolve(''); return;
      }
      const existing = turnstile.getResponse(widgetId);
      if (existing) { resolve(existing); return; }
      _resolve = resolve;
      turnstile.execute(widgetId);
    });
  }

  function reset() {
    if (typeof turnstile === 'undefined' || widgetId === null) return;
    turnstile.reset(widgetId);
  }

  async function init() {
    await mountWidget();
  }

  return { init, getToken, reset };

})();

document.addEventListener('DOMContentLoaded', () => LR_TURNSTILE.init());