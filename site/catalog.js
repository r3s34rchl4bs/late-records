/* Late Records — Catalog row renderer (scoped) */

// WebP with automatic JPG fallback.
// Usage in onerror: _wf(this, function(el){ /* truly missing handler */ })
function _wf(el, afterFn) {
  if (el.src.indexOf('.webp') !== -1) {
    el.onerror = function() { el.onerror = null; if (afterFn) afterFn(el); };
    el.src = el.src.replace('.webp', '.jpg');
  } else if (afterFn) {
    afterFn(el);
  }
}

function _escHTML(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function highlight(text, query) {
  if (!query) return _escHTML(text);
  const safe = _escHTML(String(text || ''));
  const esc  = _escHTML(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
}

function rowHTML(item, query, isSuggestion, eager) {
  const sold   = item.status !== 'available';
  const genres = LR.ui.splitPipe(item.genre);
  const genre  = isSuggestion && item._matchedGenre
    ? item._matchedGenre
    : (genres[0] || '');
  const format = _escHTML((item.format || 'LP').trim());
  const title  = query ? highlight(item.title, query) : _escHTML(item.title);
  const artist = query ? highlight(item.artist, query) : _escHTML(item.artist);
  return `<tr class="${sold ? 'sold' : ''}${isSuggestion ? ' is-suggestion' : ''}"
    onclick="location.href='albums/album.html?id=${encodeURIComponent(item.album_id)}'">
    <td class="c-art"><div class="rec-art-wrap"><img src="https://media.late-records.shop/images/${encodeURIComponent(item.album_id)}.jpg" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} onerror="this.parentNode.style.opacity='0'"></div></td>
    <td class="c-title"><div class="rec-title">${title}</div><div class="rec-artist">${artist}</div></td>
    <td class="c-genre"><span class="genre-tag"
      onclick="event.stopPropagation();location.href='genre.html?g=${encodeURIComponent(genre.toLowerCase())}'">${_escHTML(genre)}</span></td>
    <td class="c-format"><span class="rec-format">${format}</span></td>
    <td class="c-stock"><div class="rec-stock"><span class="sdot ${sold ? 's' : 'a'}"></span><span>${sold ? 'Sold' : 'Avail'}</span></div></td>
  </tr>`;
}
