/**
 * Late Records — Turnstile Security
 * Only edit this file for anything Turnstile-related.
 */

const LR_TURNSTILE = (() => {

  const SITE_KEY = '0x4AAAAAACpBT7ijFgQum-H_';
  let widgetId   = null;
  let _resolve   = null;
  let _ready     = false;

  function loadScript() {
    return new Promise(resolve => {
      if (typeof turnstile !== 'undefined') { resolve(); return; }
      window.__tsOnLoad = () => resolve();
      const s = document.createElement('script');
      s.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsOnLoad';
      s.async = true;
      document.head.appendChild(s);
    });
  }

  async function mountWidget() {
    await loadScript();
    const form = document.getElementById('checkoutForm');
    if (!form || document.getElementById('lr-ts-widget')) return;
    const div = document.createElement('div');
    div.id    = 'lr-ts-widget';
    div.style.display = 'none';
    form.appendChild(div);
    widgetId = turnstile.render(div, {
      sitekey:            SITE_KEY,
      size:               'invisible',
      callback:           token => {
        _ready = true;
        if (_resolve) { _resolve(token); _resolve = null; }
      },
      'error-callback':   () => {
        _ready = false;
        if (_resolve) { _resolve(''); _resolve = null; }
      },
      'expired-callback': () => { _ready = false; }
    });
  }

  function getToken() {
    return new Promise(resolve => {
      if (typeof turnstile === 'undefined' || widgetId === null) {
        resolve(''); return;
      }
      if (_ready) {
        const t = turnstile.getResponse(widgetId);
        if (t) { resolve(t); return; }
      }
      _resolve = resolve;
      try { turnstile.execute(widgetId); }
      catch(e) { resolve(''); }
    });
  }

  function reset() {
    _ready = false;
    if (typeof turnstile === 'undefined' || widgetId === null) return;
    try { turnstile.reset(widgetId); } catch(e) {}
  }

  return { init: mountWidget, getToken, reset };

})();

document.addEventListener('DOMContentLoaded', () => LR_TURNSTILE.init());