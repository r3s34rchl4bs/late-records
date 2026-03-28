/* Late Records — Search + Suggestions (scoped) */

const LR_SEARCH = (() => {

  let _catalog = [];
  let _suggestTimer = null;
  let _currentSuggestions = [];
  let _isSuggestionMode = false;
  let _activeAZLetter = null;

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

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

    _isSuggestionMode = false;
    _currentSuggestions = [];

    if (_suggestTimer) {
      clearTimeout(_suggestTimer);
      _suggestTimer = null;
    }

    if (!q) {
      let base = _catalog;
      if (_activeAZLetter) {
        base = base.filter(a =>
          String(a.artist || '').trim()[0]?.toUpperCase() === _activeAZLetter
        );
      }
      if (window.availFilterActive) {
        base = base.filter(a => String(a.status).toLowerCase() === 'available');
      }
      tbody.innerHTML = base.map(item => rowHTML(item, '', false)).join('');
      count.textContent = '';
      return;
    }

    const src = window.availFilterActive
      ? _catalog.filter(a => String(a.status).toLowerCase() === 'available')
      : _catalog;

    const matches = src
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
    hdr.innerHTML = `No results for <span>"${_esc(rawQuery.trim())}"</span> — looking for suggestions`;
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
      const res = await fetch(`${location.origin}/api/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      clearTimeout(timeout);
      const suggestions = await res.json();

      if (!suggestions.length) {
        tbl.style.display = 'none';
        hdr.style.display = 'none';
        empty.style.display = 'block';
        return;
      }

      _isSuggestionMode = true;
      _currentSuggestions = suggestions;

      applySuggestionsWithToggle(query);

    } catch {
      tbl.style.display = 'none';
      hdr.style.display = 'none';
      empty.style.display = 'block';
    }
  }

  function applySuggestionsWithToggle(query) {
    const hdr   = document.getElementById('suggestionsHeader');
    const empty = document.getElementById('noResultsEmpty');
    const tbody = document.getElementById('catalogList');
    const tbl   = document.getElementById('catalogTable');

    tbl.style.display = '';
    empty.style.display = 'none';

    const toShow = window.availFilterActive
      ? _currentSuggestions.filter(a => String(a.status).toLowerCase() === 'available')
      : _currentSuggestions;

    if (!toShow.length) {
      hdr.className = 'suggestions-header';
      hdr.style.display = 'block';
      hdr.innerHTML = `No available results for <span>"${_esc(query || '')}"</span> — turn off the filter to see sold items`;
      tbody.innerHTML = '';
      return;
    }

    hdr.className = 'suggestions-header';
    hdr.style.display = 'block';
    hdr.innerHTML = window.availFilterActive
      ? `No results for <span>"${_esc(query || '')}"</span> — showing available suggestions only`
      : `No results for <span>"${_esc(query || '')}"</span> — you might like:`;

    tbody.innerHTML = toShow.map(item => rowHTML(item, '', true)).join('');
  }

  function initSearch() {
    const input = document.getElementById('searchInput');
    const clear = document.getElementById('searchClear');
    let _debounce = null;

    input.addEventListener('input', () => {
      const v = input.value;
      clear.style.display = v ? 'block' : 'none';
      if (v && _activeAZLetter) {
        _activeAZLetter = null;
        document.querySelectorAll('.az-letter').forEach(b => b.classList.remove('active'));
      }
      clearTimeout(_debounce);
      _debounce = setTimeout(() => renderTable(v), 150);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(_debounce);
        renderTable(input.value);
      }
    });

    clear.addEventListener('click', () => {
      input.value = '';
      clear.style.display = 'none';
      _isSuggestionMode = false;
      _currentSuggestions = [];
      renderTable('');
      input.focus();
    });

    document.addEventListener('click', e => {
      if (
        !e.target.closest('#searchBar') &&
        !e.target.closest('#searchBtn') &&
        !e.target.closest('#catalogTable') &&
        !e.target.closest('#suggestionsHeader') &&
        !e.target.closest('.no-results-empty') &&
        !e.target.closest('.az-nav')
      ) {
        input.value = '';
        clear.style.display = 'none';
        _isSuggestionMode = false;
        _currentSuggestions = [];
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

  function buildAZNav(albums) {
    const nav = document.getElementById('azNav');
    if (!nav) return;

    const firstLetters = new Set();
    albums.forEach(a => {
      const first = String(a.artist || '').trim()[0]?.toUpperCase();
      if (first && /[A-Z]/.test(first)) firstLetters.add(first);
    });

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    nav.innerHTML = alphabet.map(l => {
      const has = firstLetters.has(l);
      return `<button class="az-letter${has ? '' : ' empty'}" data-letter="${l}"${has ? '' : ' disabled'}>${l}</button>`;
    }).join('');

    nav.addEventListener('click', e => {
      const btn = e.target.closest('.az-letter');
      if (!btn || btn.disabled) return;
      const letter = btn.dataset.letter;

      if (_activeAZLetter === letter) {
        _activeAZLetter = null;
        btn.classList.remove('active');
      } else {
        _activeAZLetter = letter;
        nav.querySelectorAll('.az-letter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }

      const input   = document.getElementById('searchInput');
      const clearBtn = document.getElementById('searchClear');
      if (input)    input.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      _isSuggestionMode = false;
      _currentSuggestions = [];

      renderTable('');
    });
  }

  function applyAvailToggle() {
    if (_isSuggestionMode) {
      const query = document.getElementById('searchInput').value.trim();
      applySuggestionsWithToggle(query);
    } else {
      renderTable(document.getElementById('searchInput').value);
    }
  }

  return { initSearch, buildTable, buildAZNav, applyAvailToggle };

})();

/* Expose for inline scripts in HTML pages */
function initSearch()       { LR_SEARCH.initSearch(); }
function buildTable(a)      { LR_SEARCH.buildTable(a); }
function buildAZNav(a)      { LR_SEARCH.buildAZNav(a); }
function applyAvailToggle() { LR_SEARCH.applyAvailToggle(); }
