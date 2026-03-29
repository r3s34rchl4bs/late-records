/**
 * Late Records — Tag Cloud
 * Fetches tags from /api/tags (Gemini) with client-side fallback.
 * Depends on: _escHTML() from index.html inline script.
 */

// ── Extraction (client-side fallback) ─────────────────────
function extractTagsFromCatalog(catalog) {
  var tags = [];
  var seen = new Set();
  function add(text, albumId) {
    var t = text.replace(/[—–]/g, '-').trim();
    var key = t.toLowerCase();
    if (!key || key.length < 8 || seen.has(key)) return;
    if (t.split(/\s+/).length < 2) return;
    if (/\s+(and|or|but|the|a|from|Mr|Mrs|Dr)$/i.test(t)) return;
    if (/["'\u2018\u2019]$/.test(t)) return;
    seen.add(key);
    tags.push({ text: t, albumId: albumId });
  }
  catalog.forEach(function(a) {
    if (!a.description) return;
    var desc = a.description.replace(/[—–]/g, ', ');
    var artist = String(a.artist || '').toLowerCase();
    var title = String(a.title || '').toLowerCase();

    var artistWords = artist.split(/\s+/).filter(function(w) { return w.length > 2; });
    var titleWords = title.split(/\s+/).filter(function(w) { return w.length > 2; });
    function containsArtistOrTitle(s) {
      var low = s.toLowerCase();
      if (low === artist || low === title) return true;
      var matchCount = 0;
      artistWords.forEach(function(w) { if (low.indexOf(w) >= 0) matchCount++; });
      if (artistWords.length > 0 && matchCount >= artistWords.length) return true;
      titleWords.forEach(function(w) { if (low.indexOf(w) >= 0) matchCount++; });
      if (titleWords.length > 0 && matchCount >= titleWords.length + artistWords.length) return true;
      return false;
    }

    // 1) Short complete sentences (2-7 words, naturally ending at period)
    var sentences = desc.split(/\.\s+/).map(function(s) { return s.replace(/\.$/, '').trim(); });
    sentences.forEach(function(s) {
      var wc = s.split(/\s+/).length;
      if (wc >= 2 && wc <= 7 && !containsArtistOrTitle(s)) {
        add(s, a.album_id);
      }
    });

    // 2) "produced by X", "arranged by X" — keep the role context
    var byMatches = desc.match(/(?:produced|engineered|arranged|mixed|recorded|composed)\s+by\s+[A-Z][A-Za-z\s.'-]+/g);
    if (byMatches) byMatches.forEach(function(m) {
      var trimmed = m.split(/\s+/).slice(0, 6).join(' ');
      add(trimmed, a.album_id);
    });

    // 3) Key phrases
    var keyPhrases = desc.match(/originally released in \d{4}|never reissued|only \d+ pressed|first pressing|private press|rare [a-z]+ [a-z]+|recorded (?:at|in) [A-Za-z\s]+/gi);
    if (keyPhrases) keyPhrases.forEach(function(p) {
      var trimmed = p.split(/\s+/).slice(0, 6).join(' ');
      add(trimmed, a.album_id);
    });

    // 4) Cultural context phrases
    var contextPhrases = desc.match(/\d{2}s [A-Za-z\s]+culture|\b(?:golden era|sound system|crate dig[a-z]*|deep cut|analog warmth|cinematic [a-z]+|dancefloor [a-z]+)\b/gi);
    if (contextPhrases) contextPhrases.forEach(function(p) {
      var trimmed = p.split(/\s+/).slice(0, 5).join(' ');
      add(trimmed, a.album_id);
    });
  });
  return tags;
}

// ── Rendering ─────────────────────────────────────────────
var TAG_VISIBLE_COUNT = 30;

function buildTagHTML(tags, limit) {
  var slice = limit ? tags.slice(0, limit) : tags;
  return slice.map(function(tag, i) {
    var url = 'albums/album.html?id=' + encodeURIComponent(tag.albumId);
    return (i > 0 ? '<span class="tag-cloud-sep">&middot;</span>' : '') +
      '<a class="tag-cloud-item" href="' + url + '">' + _escHTML(tag.text) + '</a>';
  }).join('');
}

function renderTagCloud(tags) {
  var list = document.getElementById('tagCloudList');
  if (!list || !tags.length) return;
  var expanded = false;

  function render() {
    var html = buildTagHTML(tags, expanded ? null : TAG_VISIBLE_COUNT);
    if (!expanded && tags.length > TAG_VISIBLE_COUNT) {
      html += '<span class="tag-cloud-sep">&middot;</span><a class="tag-cloud-more" id="tagCloudMore">View more links</a>';
    } else if (expanded && tags.length > TAG_VISIBLE_COUNT) {
      html += '<span class="tag-cloud-sep">&middot;</span><a class="tag-cloud-more" id="tagCloudMore">View less</a>';
    }
    list.innerHTML = html;
    var btn = document.getElementById('tagCloudMore');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        expanded = !expanded;
        render();
        if (!expanded) list.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }
  render();
}

// ── Loading (API → fallback → cache) ─────────────────────
var TAG_CACHE_KEY = 'lr_tag_cloud';
var TAG_CACHE_TTL = 86400000; // 24 hours

async function loadTagCloud(catalog) {
  // check localStorage cache
  try {
    var cached = JSON.parse(localStorage.getItem(TAG_CACHE_KEY));
    if (cached && cached.tags && cached.tags.length && (Date.now() - cached.ts) < TAG_CACHE_TTL) {
      renderTagCloud(cached.tags);
      return;
    }
  } catch (e) {}

  var tags = null;
  try {
    var res = await fetch('https://late-records.shop/api/tags');
    var data = await res.json();
    if (Array.isArray(data) && data.length) {
      tags = data.map(function(t) {
        return { text: t, albumId: catalog[Math.floor(Math.random() * catalog.length)].album_id };
      });
    }
  } catch (e) {}

  if (!tags || !tags.length) {
    tags = extractTagsFromCatalog(catalog);
  }

  if (tags.length) {
    tags = [...tags].sort(function() { return Math.random() - 0.5; });
    try { localStorage.setItem(TAG_CACHE_KEY, JSON.stringify({ tags: tags, ts: Date.now() })); } catch (e) {}
    renderTagCloud(tags);
  } else {
    document.getElementById('tagCloud').style.display = 'none';
  }
}
