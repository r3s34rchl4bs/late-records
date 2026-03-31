(function () {
  // ── Styles ────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '.lu-footer {',
    '  padding: 8px 0 38px;',
    '}',
    '.lu-inner {',
    '  max-width: 890px;',
    '  margin: 0 auto;',
    '  padding: 0;',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: flex-start;',
    '  gap: 2px;',
    '}',
    '.lu-relative {',
    '  font-size: 9.5px;',
    '  font-weight: 400;',
    '  letter-spacing: .04em;',
    '  color: rgba(26,26,20,.28);',
    '  line-height: 1.3;',
    '}',
    '.lu-handle {',
    '  font-size: 9px;',
    '  font-weight: 450;',
    '  letter-spacing: .04em;',
    '  color: rgba(26,26,20,.16);',
    '  line-height: 1.3;',
    '}',
    'html.dark .lu-relative { color: rgba(232,232,223,.28); }',
    'html.dark .lu-handle   { color: rgba(232,232,223,.16); }',
    '@media (max-width: 600px) {',
    '  .lu-footer { padding: 8px 0 16px; }',
    '}'
  ].join('');
  document.head.appendChild(style);

  // ── HTML ──────────────────────────────────────────────────
  var footer = document.querySelector('.lr-footer');
  if (!footer) return;

  footer.style.display = 'block';
  footer.innerHTML = [
    '<div class="lu-inner">',
    '  <div class="lu-relative" id="luRelative">Last update —</div>',
    '  <div class="lu-handle" id="luHandle">—</div>',
    '</div>'
  ].join('');

  // ── Logic ─────────────────────────────────────────────────
  var LAST_UPDATED = document.lastModified;
  window.LR_setLastUpdated = function(iso) { if (!iso) return; LAST_UPDATED = iso; render(); };

  function relativeTime(date) {
    var diff = Math.floor((new Date() - date) / 1000);
    if (diff < 120)     return '1 min ago';
    if (diff < 3600)    return Math.floor(diff / 60) + ' mins ago';
    if (diff < 7200)    return '1 hour ago';
    if (diff < 86400)   return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 172800)  return '1 day ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago';
    if (diff < 5184000) return '1 month ago';
    return Math.floor(diff / 2592000) + ' months ago';
  }

  function viewerTZ() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' '); }
    catch (e) { return 'UTC'; }
  }

  function render() {
    var rel = document.getElementById('luRelative');
    var hdl = document.getElementById('luHandle');
    if (hdl) hdl.textContent = 'r3s34rchl4bs · ' + viewerTZ();
    if (!LAST_UPDATED) { if (rel) rel.textContent = 'Last update —'; return; }
    var d = new Date(LAST_UPDATED);
    var day = String(d.getDate()).padStart(2, '0');
    var mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    var yr  = String(d.getFullYear()).slice(-2);
    var hh  = String(d.getHours()).padStart(2, '0');
    var mm  = String(d.getMinutes()).padStart(2, '0');
    if (rel) rel.textContent = 'Last update ' + day + mon + yr + ' ' + hh + ':' + mm;
  }

  render();
  setInterval(render, 60000);
})();