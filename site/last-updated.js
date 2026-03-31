(function () {
  // ── Styles ────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '.lu-footer { padding: 8px 0 60px; }',
    '.lu-inner { max-width: 890px; margin: 0 auto; padding: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }',
    '.lu-handle { font-size: 9px; font-weight: 450; letter-spacing: .04em; color: rgba(26,26,20,.16); line-height: 1.3; }',
    'html.dark .lu-handle { color: rgba(232,232,223,.16); }',
    '@media (max-width: 600px) { .lu-footer { padding: 8px 0 16px; } }'
  ].join('');
  document.head.appendChild(style);

  // ── HTML ──────────────────────────────────────────────────
  var footer = document.querySelector('.lr-footer');
  if (!footer) return;

  footer.style.display = 'block';
  footer.innerHTML = [
    '<div class="lu-inner">',
    '  <div class="lu-handle" id="luHandle">r3s34rchl4bs · Asia/Manila</div>',
    '</div>'
  ].join('');
})();