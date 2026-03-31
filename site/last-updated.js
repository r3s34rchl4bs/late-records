(function () {
  // ── Styles ────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '.lu-footer {',
    '  padding: 40px 0 32px;',
    '}',
    '.lu-inner {',
    '  max-width: 890px;',
    '  margin: 0 auto;',
    '  padding: 0 30px;',
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
    '  .lu-inner { padding: 0 20px; }',
    '  .lu-footer { padding: 32px 0 28px; }',
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
  var LAST_UPDATED = null;

  window.LR_setLastUpdated = function(isoString) {
    if (!isoString) return;
    LAST_UPDATED = isoString;
    render();
  };

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
    if (!LAST_UPDATED) {
      if (rel) rel.textContent = 'Last update —';
      return;
    }
    var date = new Date(LAST_UPDATED);
    if (isNaN(date.getTime())) {
      if (rel) rel.textContent = 'Last update —';
      return;
    }
    if (rel) rel.textContent = 'Last update ' + relativeTime(date);
  }

  render();
  setInterval(render, 60000);
})();
