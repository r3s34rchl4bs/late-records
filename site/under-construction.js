(function () {

(function () {

  /* ── Grey wash overlay ── */
  var wash = document.createElement('div');
  wash.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%','height:100%',
    'background:rgba(180,180,174,0)',
    'pointer-events:none',
    'z-index:9998'
  ].join(';');
  document.body.appendChild(wash);

  /* ── Denser dot overlay ── */
  var dots = document.createElement('div');
  dots.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%','height:100%',
    'background-image:radial-gradient(circle,rgba(0,0,0,.06) 0.5px,transparent 0.5px)',
    'background-size:3px 3px',
    'pointer-events:none',
    'z-index:9997'
  ].join(';');
  document.body.appendChild(dots);

  /* ── Checkout notice ── */
  if (window.location.pathname.indexOf('checkout') !== -1) {
    function injectCheckoutNotice() {
      var target = document.querySelector('.container') || document.body;
      var notice = document.createElement('div');
      notice.style.cssText = [
        'font-family:\'Inter\',system-ui,sans-serif',
        'font-size:10px',
        'font-weight:500',
        'letter-spacing:.1em',
        'text-transform:uppercase',
        'color:rgba(26,26,20,.45)',
        'margin-bottom:20px'
      ].join(';');
      notice.textContent = '◈ [PRE-LAUNCH] Checkout enabled for testing — order will not be charged';
      target.insertBefore(notice, target.firstChild);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectCheckoutNotice);
    } else {
      setTimeout(injectCheckoutNotice, 300);
    }
  }

  /* ── Success page notice ── */
  if (window.location.pathname.indexOf('success') !== -1) {
    function injectNotice() {
      var target = document.querySelector('.container') || document.body;
      var notice = document.createElement('div');
      notice.style.cssText = [
        'border:1px solid rgba(26,26,20,.3)',
        'padding:14px 18px',
        'margin-bottom:24px',
        'font-family:\'Inter\',system-ui,sans-serif',
        'background:rgba(26,26,20,.04)'
      ].join(';');
      notice.innerHTML =
        '<div style="font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,26,20,.4);margin-bottom:6px;">Test Build &mdash; Order Status</div>' +
        '<div style="font-size:13px;font-weight:500;color:#1a1a14;margin-bottom:4px;">This order will not be processed</div>' +
        '<div style="font-size:12px;color:rgba(26,26,20,.55);line-height:1.6;">Late Records is currently in preview mode. Your order has been logged but will not be fulfilled. You will be notified when the store officially launches.</div>';
      target.insertBefore(notice, target.firstChild);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectNotice);
    } else {
      setTimeout(injectNotice, 500);
    }
  }

})();

  /* ── Grey wash overlay ── */
  var wash = document.createElement('div');
  wash.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%','height:100%',
    'background:rgba(180,180,174,0)',
    'pointer-events:none',
    'z-index:9998'
  ].join(';');
  document.body.appendChild(wash);

  /* ── Denser dot overlay ── */
  var dots = document.createElement('div');
  dots.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%','height:100%',
    'background-image:radial-gradient(circle,rgba(0,0,0,.06) 0.5px,transparent 0.5px)',
    'background-size:3px 3px',
    'pointer-events:none',
    'z-index:9997'
  ].join(';');
  document.body.appendChild(dots);

  /* ── Checkout notice ── */
  if (window.location.pathname.indexOf('checkout') !== -1) {
    function injectCheckoutNotice() {
      var target = document.querySelector('.container') || document.body;
      var notice = document.createElement('div');
      notice.style.cssText = [
        'font-family:\'Inter\',system-ui,sans-serif',
        'font-size:10px',
        'font-weight:500',
        'letter-spacing:.1em',
        'text-transform:uppercase',
        'color:rgba(26,26,20,.45)',
        'margin-bottom:20px'
      ].join(';');
      notice.textContent = '◈ [PRE-LAUNCH] Checkout enabled for testing — order will not be charged';
      target.insertBefore(notice, target.firstChild);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectCheckoutNotice);
    } else {
      setTimeout(injectCheckoutNotice, 300);
    }
  }

  /* ── Success page notice ── */
  if (window.location.pathname.indexOf('success') !== -1) {
    function injectNotice() {
      var target = document.querySelector('.container') || document.body;
      var notice = document.createElement('div');
      notice.style.cssText = [
        'border:1px solid rgba(26,26,20,.3)',
        'padding:14px 18px',
        'margin-bottom:24px',
        'font-family:\'Inter\',system-ui,sans-serif',
        'background:rgba(26,26,20,.04)'
      ].join(';');
      notice.innerHTML =
        '<div style="font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(26,26,20,.4);margin-bottom:6px;">Test Build &mdash; Order Status</div>' +
        '<div style="font-size:13px;font-weight:500;color:#1a1a14;margin-bottom:4px;">This order will not be processed</div>' +
        '<div style="font-size:12px;color:rgba(26,26,20,.55);line-height:1.6;">Late Records is currently in preview mode. Your order has been logged but will not be fulfilled. You will be notified when the store officially launches.</div>';
      target.insertBefore(notice, target.firstChild);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectNotice);
    } else {
      setTimeout(injectNotice, 500);
    }
  }

  

})();
