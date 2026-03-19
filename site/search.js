let _catalog = [];
let _suggestTimer = null;

function renderTable(rawQuery) {
  const q      = rawQuery.trim().toLowerCase();
  const tbody  = document.getElementById('catalogList');
  const hdr    = document.getElementById('suggestionsHeader');
  const empty  = document.getElementById('noResultsEmpty');
  const count  = document.getElementById('searchCount');
  const tbl    = document.getElementById('catalogTable');

  hdr.style.display = 'none';
  hdr.className = 'suggestions-header';
  empty.style.display = 'none';
  tbl.style.display = '';

  if (_suggestTimer) {
    clearTimeout(_suggestTimer);
    _suggestTimer = null;
  }

  if (!q) {
    tbody.innerHTML = _catalog.map(item => rowHTML(item, '', false)).join('');
    count.textContent = '';
    return;
  }

  const matches = _catalog
    .map(item => {
      const artist = String(item.artist || '').toLowerCase();
      const title  = String(item.title  || '').toLowerCase();
      const genre  = String(item.genre  || '').toLowerCase();
      const format = String(item.format || '').toLowerCase();

      let score = 0;

      if (artist === q) score += 100;
      else if (artist.startsWith(q)) score += 80;
      else if (artist.includes(q)) score += 60;

      if (title === q) score += 50;
      else if (title.startsWith(q)) score += 35;
      else if (title.includes(q)) score += 25;

      if (genre.includes(q)) score += 15;
      if (format.includes(q)) score += 5;

      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.item.artist || '').localeCompare(String(b.item.artist || ''));
    })
    .map(x => x.item);

  if (matches.length) {
    tbody.innerHTML = matches.map(item => rowHTML(item, rawQuery.trim(), false)).join('');
    count.textContent = `${matches.length} result${matches.length !== 1 ? 's' : ''}`;
    return;
  }

  count.textContent = '';
  hdr.style.display = 'block';
  hdr.className = 'suggestions-header is-loading';
  hdr.innerHTML = `No results for <span>"${rawQuery.trim()}"</span> — looking for suggestions`;
  tbody.innerHTML = '';
  _suggestTimer = setTimeout(() => fetchSuggestions(rawQuery.trim()), 500);
}

async function fetchSuggestions(query) {
  const hdr   = document.getElementById('suggestionsHeader');
  const empty = document.getElementById('noResultsEmpty');
  const tbody = document.getElementById('catalogList');
  const tbl   = document.getElementById('catalogTable');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://late-records.shop/api/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal });
    clearTimeout(timeout);
    const suggestions = await res.json();
    if (!suggestions.length) {
      tbl.style.display = 'none';
      hdr.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    hdr.className = 'suggestions-header';
    hdr.innerHTML = `No results for <span>"${query}"</span> — you might like:`;
    tbody.innerHTML = suggestions.map(item => rowHTML(item, '', true)).join('');
  } catch {
    tbl.style.display = 'none';
    hdr.style.display = 'none';
    empty.style.display = 'block';
  }
}

function initSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('searchClear');

  input.addEventListener('input', () => {
    const v = input.value;
    clear.style.display = v ? 'block' : 'none';
    renderTable(v);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      renderTable(input.value);
    }
  });

  clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    renderTable('');
    input.focus();
  });

  document.addEventListener('click', e => {
    if (
      !e.target.closest('.search-row') &&
      !e.target.closest('#catalogTable') &&
      !e.target.closest('#suggestionsHeader') &&
      !e.target.closest('.no-results-empty')
    ) {
      input.value = '';
      clear.style.display = 'none';
      renderTable('');
    }
  });
}

function buildTable(albums) {
  _catalog = [...albums].sort((a, b) =>
    String(a.artist || '').localeCompare(String(b.artist || ''))
  );
  renderTable('');
}
