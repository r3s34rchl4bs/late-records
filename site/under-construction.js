(function () {

  /* ── Status bar ── */
  var bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%',
    'background:#1a1a14',
    'color:#e2e2e2',
    'font-family:\'Inter\',system-ui,sans-serif',
    'font-size:10px',
    'font-weight:500',
    'letter-spacing:.13em',
    'text-transform:uppercase',
    'padding:7px 20px',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'z-index:9999',
    'box-sizing:border-box'
  ].join(';');
  bar.innerHTML =
   '<div style="max-width:1200px;margin:0 auto;padding:0 clamp(20px,2.5vw,30px);display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;">' +
    '<span style="font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">&#9672; PUBLIC TEST BUILD &mdash; SITE UNDER CONSTRUCTION</span>' +
    '<span style="font-size:9px;opacity:.45;letter-spacing:.08em;margin-left:12px;flex-shrink:0;">PRE-LAUNCH</span>' +
    '</div>';

  document.body.insertBefore(bar, document.body.firstChild);

  /* ── Push all content down by bar height ── */
  var BAR_H = 34;
  var header = document.querySelector('.fixed-header');
  if (header) {
    header.style.top = BAR_H + 'px';
  }
  var container = document.querySelector('.container');
  if (container) {
    var current = parseInt(window.getComputedStyle(container).paddingTop) || 0;
    container.style.paddingTop = (current + BAR_H) + 'px';
  }

  /* ── Grey wash overlay ── */
  var wash = document.createElement('div');
  wash.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%','height:100%',
    'background:rgba(180,180,174,.13)',
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

  /* ── Success page test mode notice ── */
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
      notice.textContent = '◈ [PRE-LAUNCH] Checkout enabled for testing purposes';
      target.insertBefore(notice, target.firstChild);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectCheckoutNotice);
    } else {
      setTimeout(injectCheckoutNotice, 300);
    }
  }

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
