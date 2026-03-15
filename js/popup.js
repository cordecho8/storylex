// ── WORD POPUP ────────────────────────────────────────────────────────────────
const wordPopup = document.getElementById('wordPopup');

function isMobileDevice() { return window.innerWidth <= 700; }

// ── SYLLABIFICATION + IPA via Free Dictionary API ────────────────────────────
// Uses https://api.dictionaryapi.dev — free, no key required
// Results cached in memory (per session) to avoid repeat fetches

const ipaCache = {};

// Fallback syllabifier for when API is unavailable
function syllabify(word) {
  const w = word.toLowerCase();
  const vowels = 'aeiouy';
  const result = [];
  let syllable = '';
  let prevVowel = false;
  for(let i = 0; i < w.length; i++) {
    const ch = w[i];
    const isVowel = vowels.includes(ch);
    syllable += ch;
    if(isVowel && !prevVowel && syllable.length > 1 && i < w.length - 2) {
      const next = w[i+1];
      const afterNext = w[i+2];
      if(next && !vowels.includes(next) && afterNext && vowels.includes(afterNext)) {
        result.push(syllable); syllable = '';
      }
    }
    prevVowel = isVowel;
  }
  if(syllable) result.push(syllable);
  return result.length > 1 ? result.join('·') : word;
}

// Fetch from preloaded cache first, then live API, then fallback syllabifier
async function fetchWordData(word) {
  const key = word.toLowerCase();
  // 1. In-memory session cache (already fetched this session)
  if(ipaCache[key]) return ipaCache[key];
  // 2. Preloaded cache from data/ipa-cache.json (built by preload-ipa.js)
  if(window.IPA_CACHE && window.IPA_CACHE[key]) {
    ipaCache[key] = window.IPA_CACHE[key];
    return ipaCache[key];
  }
  // 3. Live API fetch (fallback for words not in preloaded cache)
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if(!res.ok) throw new Error('not found');
    const data = await res.json();
    const entry = data[0];
    let ipa = '';
    if(entry.phonetics && entry.phonetics.length) {
      const withText = entry.phonetics.filter(p => p.text);
      if(withText.length) ipa = withText[0].text;
    }
    if(!ipa && entry.phonetic) ipa = entry.phonetic;
    if(ipa && !ipa.startsWith('[') && !ipa.startsWith('/')) ipa = '/' + ipa + '/';
    const result = { syllables: syllabify(word), ipa };
    ipaCache[key] = result;
    return result;
  } catch(e) {
    const result = { syllables: syllabify(word), ipa: '' };
    ipaCache[key] = result;
    return result;
  }
}

function showWordPopup(word, meaning, chId, chTitle, targetEl) {
  popupWord = word; popupMeaning = meaning; popupChId = chId; popupChTitle = chTitle;

  // Show popup immediately with syllables + meaning as placeholder
  const syllables = syllabify(word);
  if(isMobileDevice()) {
    _openMobileSheet(word, meaning, chId, chTitle, targetEl, syllables, meaning);
  } else {
    document.getElementById('wpWord').textContent = syllables;
    document.getElementById('wpMeaning').textContent = meaning;
    updatePopupBookmarkState();
    wordPopup.classList.add('show');
    positionPopup(targetEl);
  }

  // Fetch real IPA and update in place
  fetchWordData(word).then(({ syllables: syl, ipa }) => {
    if(popupWord !== word) return; // user moved on
    const ipaText = ipa || meaning;
    if(isMobileDevice()) {
      const msWord = document.getElementById('msWord');
      const msMeaning = document.getElementById('msMeaning');
      if(msWord) msWord.textContent = syl;
      if(msMeaning) msMeaning.textContent = ipaText;
    } else {
      const wpWord = document.getElementById('wpWord');
      const wpMeaning = document.getElementById('wpMeaning');
      if(wpWord) wpWord.textContent = syl;
      if(wpMeaning) wpMeaning.textContent = ipaText;
    }
  });
}


function _openMobileSheet(word, meaning, chId, chTitle, targetEl, syllables, ipaOrMeaning) {
  const sheet = document.getElementById('mobileSheet');
  const panel = document.getElementById('mobileSheetPanel');
  document.getElementById('msWord').textContent = syllables || word;
  document.getElementById('msMeaning').textContent = ipaOrMeaning || meaning;
  updateMobileSheetState();
  sheet.classList.add('show');
  // Position near the tapped word, just like desktop popup
  requestAnimationFrame(() => {
    const pw = 220;
    const ph = panel.offsetHeight || 130;
    let left, top, arrowDir;
    if(targetEl) {
      const r = targetEl.getBoundingClientRect();
      left = r.left + r.width / 2 - pw / 2;
      top = r.bottom + 10;
      arrowDir = 'down';
      if(top + ph > window.innerHeight - 16) {
        top = r.top - ph - 10;
        arrowDir = 'up';
      }
    } else {
      left = window.innerWidth / 2 - pw / 2;
      top = window.innerHeight / 2 - ph / 2;
      arrowDir = null;
    }
    if(left < 10) left = 10;
    if(left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.width = pw + 'px';
    panel.style.transformOrigin = arrowDir === 'up' ? 'bottom center' : 'top center';
    if(targetEl && arrowDir) {
      const r = targetEl.getBoundingClientRect();
      const arrowLeft = Math.max(12, Math.min(pw - 20, r.left + r.width / 2 - left - 5));
      panel.style.setProperty('--ms-arrow-left', arrowLeft + 'px');
      if(arrowDir === 'up') {
        panel.style.setProperty('--ms-arrow-top', 'auto');
        panel.style.setProperty('--ms-arrow-bottom', '-5px');
      } else {
        panel.style.setProperty('--ms-arrow-top', '-5px');
        panel.style.setProperty('--ms-arrow-bottom', 'auto');
      }
    } else {
      panel.style.setProperty('--ms-arrow-top', '-100px'); // hide arrow
    }
  });
}

function hideMobileSheet() {
  const sheet = document.getElementById('mobileSheet');
  sheet.classList.remove('show');
}

function updateMobileSheetState() {
  if(!popupWord) return;
  const isBk = bkIsBookmarked(popupWord);
  const label = document.getElementById('msBkLabel');
  const icon = document.getElementById('msBkIcon');
  const btn = document.getElementById('msBookmark');
  if(label) label.textContent = isBk ? '已收藏' : '收藏';
  if(icon) {
    const svg = icon.querySelector('svg');
    if(svg) svg.style.fill = isBk ? 'var(--accent)' : 'none';
    if(svg) svg.style.stroke = isBk ? 'var(--accent)' : 'currentColor';
  }
  if(btn) btn.classList.toggle('active', isBk);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const overlay = document.getElementById('mobileSheetOverlay');
  if(overlay) overlay.onclick = hideMobileSheet;

  // Close mobile popup when tapping outside
  document.getElementById('mobileSheet').addEventListener('click', (e) => {
    if(e.target === document.getElementById('mobileSheet') || e.target === overlay) {
      hideMobileSheet();
    }
  });

  const msPlayBtn = document.getElementById('msPlayBtn');
  if(msPlayBtn) msPlayBtn.onclick = (e) => {
    e.stopPropagation();
    if(popupWord) playWord(popupWord, msPlayBtn);
  };

  const msBookmark = document.getElementById('msBookmark');
  if(msBookmark) msBookmark.onclick = (e) => {
    e.stopPropagation();
    if(!popupWord) return;
    const added = bkToggle(popupWord, popupMeaning, popupChId, popupChTitle);
    updateMobileSheetState();
    document.querySelectorAll(`.vocab-chip[data-w="${CSS.escape(popupWord)}"]`).forEach(c=>{
      c.classList.toggle('bookmarked', bkIsBookmarked(popupWord));
    });
    showProgressToast(added ? '🔖 已收藏' : '已取消收藏');
  };

  const msSrs = document.getElementById('msSrs');
  if(msSrs) msSrs.onclick = (e) => {
    e.stopPropagation();
    if(!popupWord) return;
    const d = srsLoad();
    if(!d[popupWord.toLowerCase()] || !d[popupWord.toLowerCase()].introduced) {
      srsGrade(popupWord.toLowerCase(), 0);
    }
    showProgressToast('☆ 已加入复习');
    hideMobileSheet();
    renderSidebar();
  };
});


function positionPopup(el) {
  const r = el.getBoundingClientRect();
  const pw = 240, ph = 120;
  // Center popup over the word
  let left = r.left + r.width / 2 - pw / 2;
  let top = r.bottom + 12;
  let arrowDir = 'down'; // arrow points up (popup is below word)
  // Flip upward if too close to bottom
  if (top + ph > window.innerHeight - 16) {
    top = r.top - ph - 12;
    arrowDir = 'up';
  }
  if (left < 12) left = 12;
  if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
  wordPopup.style.left = left + 'px';
  wordPopup.style.top = top + 'px';
  wordPopup.style.width = pw + 'px';
  // Position the CSS arrow to point at the word
  const arrowLeft = Math.max(16, Math.min(pw - 24, r.left + r.width / 2 - left - 5));
  wordPopup.style.setProperty('--arrow-left', arrowLeft + 'px');
  if (arrowDir === 'up') {
    wordPopup.style.setProperty('--arrow-top', 'auto');
    wordPopup.style.setProperty('--arrow-bottom', '-5px');
    wordPopup.style.transformOrigin = 'bottom center';
  } else {
    wordPopup.style.setProperty('--arrow-top', '-5px');
    wordPopup.style.setProperty('--arrow-bottom', 'auto');
    wordPopup.style.transformOrigin = 'top center';
  }
}

function hideWordPopup() { wordPopup.classList.remove('show'); }

function updatePopupBookmarkState() {
  if(!popupWord) return;
  const isBk = bkIsBookmarked(popupWord);
  const label = document.getElementById('wpBkLabel');
  const icon = document.getElementById('wpBkIcon');
  const btn = document.getElementById('wpBookmark');
  if(label) label.textContent = isBk ? '已收藏' : '收藏';
  if(icon) {
    const svg = icon.querySelector('svg');
    if(svg) svg.style.fill = isBk ? 'var(--accent)' : 'none';
    if(svg) svg.style.stroke = isBk ? 'var(--accent)' : 'currentColor';
  }
  if(btn) btn.classList.toggle('active', isBk);
}

document.getElementById('wpPlayBtn').onclick = (e) => {
  e.stopPropagation();
  if(popupWord) playWord(popupWord, document.getElementById('wpPlayBtn'));
};

document.getElementById('wpBookmark').onclick = (e) => {
  e.stopPropagation();
  if(!popupWord) return;
  const added = bkToggle(popupWord, popupMeaning, popupChId, popupChTitle);
  updatePopupBookmarkState();
  // Update chip appearance
  document.querySelectorAll(`.vocab-chip[data-w="${CSS.escape(popupWord)}"]`).forEach(c=>{
    c.classList.toggle('bookmarked', bkIsBookmarked(popupWord));
  });
  showProgressToast(added ? '🔖 已收藏' : '已取消收藏');
};

document.getElementById('wpSrs').onclick = (e) => {
  e.stopPropagation();
  if(!popupWord) return;
  // Introduce word to SRS immediately
  const d = srsLoad();
  if(!d[popupWord.toLowerCase()] || !d[popupWord.toLowerCase()].introduced) {
    srsGrade(popupWord.toLowerCase(), 0);
  }
  showProgressToast('☆ 已加入复习');
  hideWordPopup();
  renderSidebar();
};

document.addEventListener('click', (e) => {
  if(!wordPopup.contains(e.target) && !e.target.classList.contains('vocab-chip') && !e.target.closest('.vocab-chip')) {
    hideWordPopup();
  }
  const panel = document.getElementById('mobileSheetPanel');
  if(panel && !panel.contains(e.target) && !e.target.closest('.vocab-chip')) {
    hideMobileSheet();
  }
});
