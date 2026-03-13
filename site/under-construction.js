(function () {

  /* ── Status bar ── */
  var bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed',
    'top:0','left:0','width:100%',
    'background:#1a1a14',
    'color:#e2e2e2',
    'font-family:\'Inter\',system-ui,sans-serif',
    'font-weight:500',
    'letter-spacing:.13em',
    'text-transform:uppercase',
    'padding:7px 0',
    'display:flex',
    'align-items:center',
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

  /* ── Feedback widget ── */
  var widgetBtn = document.createElement('div');
  widgetBtn.style.cssText = [
    'position:fixed','bottom:24px','right:24px',
    'background:#1a1a14','color:#e2e2e2',
    'font-family:\'Inter\',system-ui,sans-serif',
    'font-size:9px','font-weight:500','letter-spacing:.12em',
    'text-transform:uppercase','padding:8px 12px',
    'border:1px solid rgba(226,226,226,.2)',
    'cursor:pointer','z-index:9999',
    'user-select:none'
  ].join(';');
  widgetBtn.textContent = '[ REPORT ISSUE ]';
  document.body.appendChild(widgetBtn);

  var widgetBox = document.createElement('div');
  widgetBox.style.cssText = [
    'position:fixed','bottom:64px','right:24px',
    'width:260px','background:#e2e2e2',
    'border:1px solid #1a1a14',
    'font-family:\'Inter\',system-ui,sans-serif',
    'z-index:9999','display:none',
    'box-sizing:border-box'
  ].join(';');
  widgetBox.innerHTML =
    '<div style="background:#1a1a14;color:#e2e2e2;font-size:9px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">' +
    '<span>&#9672; Report Issue</span>' +
    '<span id="lr-widget-close" style="cursor:pointer;opacity:.6;font-size:12px;">&#x2715;</span>' +
    '</div>' +
    '<div style="padding:12px;">' +
    '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(26,26,20,.45);margin-bottom:4px;">Message</div>' +
    '<textarea id="lr-feedback-msg" style="width:100%;height:80px;resize:none;border:1px solid rgba(26,26,20,.3);background:#e2e2e2;font-family:\'Inter\',system-ui,sans-serif;font-size:11px;padding:8px;box-sizing:border-box;color:#1a1a14;outline:none;" placeholder="Tell us what you found..."></textarea>' +
    '<button id="lr-feedback-send" style="margin-top:8px;width:100%;background:#1a1a14;color:#e2e2e2;border:none;font-family:\'Inter\',system-ui,sans-serif;font-size:9px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:8px;cursor:pointer;">SEND &#8594;</button>' +
    '</div>';
  document.body.appendChild(widgetBox);

  widgetBtn.addEventListener('click', function() {
    widgetBox.style.display = widgetBox.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('lr-widget-close').addEventListener('click', function() {
    widgetBox.style.display = 'none';
  });
  document.getElementById('lr-feedback-send').addEventListener('click', function() {
    var msg = document.getElementById('lr-feedback-msg').value.trim();
    if (!msg) return;
    var subject = encodeURIComponent('[Late Records Feedback] ' + window.location.pathname);
    var body = encodeURIComponent(msg);
    window.location.href = 'mailto:info.late.records@gmail.com?subject=' + subject + '&body=' + body;
    widgetBox.style.display = 'none';
  });

})();
