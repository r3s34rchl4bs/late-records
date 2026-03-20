function rowHTML(item, query, isSuggestion) {
  const sold   = item.status !== 'available';
  const genres = LR.ui.splitPipe(item.genre);
  const genre  = isSuggestion && item._matchedGenre
    ? item._matchedGenre
    : (genres[0] || '');
  const format = (item.format || 'LP').trim();
  const title  = query ? highlight(item.title, query) : item.title;
  const artist = query ? highlight(item.artist, query) : item.artist;
  return `<tr class="${sold ? 'sold' : ''}${isSuggestion ? ' is-suggestion' : ''}"
    onclick="location.href='albums/album.html?id=${item.album_id}'">
    <td class="c-thumb">
      <img src="images/${item.album_id}.jpg" class="rec-thumb" alt=""
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
      <div class="rec-thumb-placeholder" style="display:none;">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(26,26,20,.2)" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
    </td>
    <td class="c-title"><div class="rec-title">${title}</div><div class="rec-artist">${artist}</div></td>
    <td class="c-genre"><span class="genre-tag"
      onclick="event.stopPropagation();location.href='genre.html?g=${encodeURIComponent(genre.toLowerCase())}'">${genre}</span></td>
    <td class="c-format"><span class="rec-format">${format}</span></td>
    <td class="c-stock"><div class="rec-stock"><span class="sdot ${sold ? 's' : 'a'}"></span><span>${sold ? 'Sold' : 'Avail'}</span></div></td>
  </tr>`;
}

function highlight(text, query) {
  if (!query) return text;
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text || '').replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
}