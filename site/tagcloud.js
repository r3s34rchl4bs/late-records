/**
 * Late Records — Tag Cloud
 * Fetches tags from /api/tags (Gemini) with client-side fallback.
 * Depends on: _escHTML() from index.html inline script.
 */

// ── Category detection & caps ────────────────────────────
var TAG_CATEGORY_CAP = 3;

function classifyTag(text) {
  var t = text.toLowerCase();
  if (/(?:produced|engineered|arranged|mixed|composed)\s+by/.test(t)) return 'credits';
  if (/\bon\s+(?:keys|drums|bass|guitar|piano|sax|trumpet|vocals|percussion|flute|organ|synth)\b/.test(t)) return 'session';
  if (/(?:originally\s+released|first\s+pressing|reissue|private\s+press|never\s+reissued|limited\s+press|early\s+pressing)/.test(t)) return 'history';
  if (/(?:recorded\s+(?:at|in)|pressed\s+at)/.test(t)) return 'studio';
  if (/(?:180g|half-speed|gatefold|remastered\s+from)/.test(t)) return 'format';
  if (/(?:sampled\s+by)/.test(t)) return 'sampling';
  if (/(?:only\s+\d+\s+pressed|test\s+pressing|promo\s+copy|limited\s+run)/.test(t)) return 'rarity';
  if (/(?:dancefloor|analog\s+warmth|cinematic|golden\s+era|sound\s+system|crate\s+dig)/.test(t)) return 'vibes';
  return 'other';
}

function capByCategory(tags) {
  var counts = {};
  return tags.filter(function(tag) {
    var cat = classifyTag(tag.text);
    if (cat === 'other') return true;
    counts[cat] = (counts[cat] || 0) + 1;
    return counts[cat] <= TAG_CATEGORY_CAP;
  });
}

// ── Phrase-prefix dedup (no two tags start the same way) ─
function dedupeByPhrasePrefix(tags) {
  var seenPrefixes = new Set();
  return tags.filter(function(tag) {
    var words = tag.text.toLowerCase().split(/\s+/);
    // Check first 2 words as prefix (e.g. "originally released", "produced by", "recorded at")
    var prefix = words.slice(0, 2).join(' ');
    // Skip generic prefixes that are fine to repeat
    if (/^(a |the |one |deep |rare )/.test(prefix)) return true;
    if (seenPrefixes.has(prefix)) return false;
    seenPrefixes.add(prefix);
    return true;
  });
}

// ── One-per-album dedup ──────────────────────────────────
function dedupeByAlbum(tags) {
  var seen = new Set();
  return tags.filter(function(tag) {
    if (seen.has(tag.albumId)) return false;
    seen.add(tag.albumId);
    return true;
  });
}

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

    // 1) Short complete sentences (2-7 words)
    var sentences = desc.split(/\.\s+/).map(function(s) { return s.replace(/\.$/, '').trim(); });
    sentences.forEach(function(s) {
      var wc = s.split(/\s+/).length;
      if (wc >= 2 && wc <= 7 && !containsArtistOrTitle(s)) add(s, a.album_id);
    });

    // 2) "produced by X", "arranged by X", "[Name] on [instrument]"
    var byMatches = desc.match(/(?:produced|engineered|arranged|mixed|recorded|composed)\s+by\s+[A-Z][A-Za-z\s.'-]+/g);
    if (byMatches) byMatches.forEach(function(m) { add(m.split(/\s+/).slice(0, 6).join(' '), a.album_id); });
    var onMatches = desc.match(/[A-Z][A-Za-z.'-]+\s+(?:[A-Z][A-Za-z.'-]+\s+)?on\s+(?:keys|drums|bass|guitar|piano|sax|trumpet|vocals|percussion|flute|organ|synth)/g);
    if (onMatches) onMatches.forEach(function(m) { add(m.split(/\s+/).slice(0, 5).join(' '), a.album_id); });

    // 3) Key phrases — release history, studio, location
    var keyPhrases = desc.match(/originally released in \d{4}|never reissued|only \d+ pressed|first pressing|early pressing|private press|limited press|rare [a-z]+ [a-z]+|recorded (?:at|in) [A-Za-z\s]+|pressed at [A-Za-z\s]+/gi);
    if (keyPhrases) keyPhrases.forEach(function(p) { add(p.split(/\s+/).slice(0, 6).join(' '), a.album_id); });

    // 4) Pressing / format
    var formatPhrases = desc.match(/180g vinyl|half-speed mastered|gatefold sleeve|remastered from original tapes/gi);
    if (formatPhrases) formatPhrases.forEach(function(p) { add(p, a.album_id); });

    // 5) Sampling legacy
    var sampledBy = desc.match(/sampled by [A-Z][A-Za-z\s.'-]+/g);
    if (sampledBy) sampledBy.forEach(function(m) { add(m.split(/\s+/).slice(0, 5).join(' '), a.album_id); });

    // 6) Rarity / collector signals
    var rarityPhrases = desc.match(/test pressing|promo copy|limited run/gi);
    if (rarityPhrases) rarityPhrases.forEach(function(p) { add(p, a.album_id); });

    // 7) Cultural context phrases
    var contextPhrases = desc.match(/\d{2}s [A-Za-z\s]+culture|\d{4}s [A-Z][A-Za-z]+|\b(?:golden era|sound system|crate dig[a-z]*|deep cut|analog warmth|cinematic [a-z]+|dancefloor [a-z]+)\b/gi);
    if (contextPhrases) contextPhrases.forEach(function(p) { add(p.split(/\s+/).slice(0, 5).join(' '), a.album_id); });
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
      html += '<span class="tag-cloud-sep">&middot;</span><a class="tag-cloud-more" id="tagCloudMore">VIEW MORE LINKS</a>';
    } else if (expanded && tags.length > TAG_VISIBLE_COUNT) {
      html += '<span class="tag-cloud-sep">&middot;</span><a class="tag-cloud-more" id="tagCloudMore">VIEW LESS</a>';
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
var TAG_CACHE_KEY = 'lr_tag_cloud_v3';
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
    // Pipeline: cap categories → shuffle → no repeated phrasing → one-per-album
    tags = capByCategory(tags);
    tags = [...tags].sort(function() { return Math.random() - 0.5; });
    tags = dedupeByPhrasePrefix(tags);
    tags = dedupeByAlbum(tags);
    try { localStorage.setItem(TAG_CACHE_KEY, JSON.stringify({ tags: tags, ts: Date.now() })); } catch (e) {}
    renderTagCloud(tags);
  } else {
    document.getElementById('tagCloud').style.display = 'none';
  }
}
