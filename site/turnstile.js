/**
 * Late Records — Turnstile Security
 * Handles bot/spam protection on the checkout form.
 * 
 * To update Turnstile settings, only edit this file.
 * Do not touch checkout.html for anything Turnstile-related.
 */

const LR_TURNSTILE = (() => {

  const SITE_KEY = '0x4AAAAAACpBT7ijFgQum-H_';

  // Inject the Cloudflare Turnstile script into the page
  function loadScript() {
    if (document.querySelector('script[src*="turnstile"]')) return;
    const s = document.createElement('script');
    s.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // Inject the invisible Turnstile widget into the checkout form
  function mountWidget() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;
    if (document.getElementById('lr-turnstile-widget')) return;
    const div = document.createElement('div');
    div.id                       = 'lr-turnstile-widget';
    div.className                = 'cf-turnstile';
    div.dataset.sitekey          = SITE_KEY;
    div.dataset.theme            = 'light';
    div.dataset.size             = 'invisible';
    div.style.display            = 'none';
    form.appendChild(div);
  }

  // Get the Turnstile token to send with the order
  function getToken() {
    if (typeof turnstile === 'undefined') return '';
    return turnstile.getResponse() || '';
  }

  // Reset the widget after a failed order attempt (so they can try again)
  function reset() {
    if (typeof turnstile === 'undefined') return;
    turnstile.reset();
  }

  // Init — call this once on DOMContentLoaded
  function init() {
    loadScript();
    // Wait briefly for the form to exist before mounting
    const ready = () => {
      if (document.getElementById('checkoutForm')) {
        mountWidget();
      } else {
        setTimeout(ready, 100);
      }
    };
    ready();
  }

  return { init, getToken, reset };

})();

// Auto-init when the page loads
document.addEventListener('DOMContentLoaded', () => LR_TURNSTILE.init());