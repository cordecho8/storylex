// ── APP STATE ─────────────────────────────────────────────────────────────────
let chapters=[], activeId=null, activeTab='read', openStoryId=null;
let currentAudio=null, currentPlayingEl=null;
let srsQueue=[], srsIdx=0, srsRevealed=false, srsFilter='all', srsAllMode=false, srsFilterManual=false;
let globalVocabMode=false, gvFilter='all';
let popupWord = null, popupMeaning = null, popupChId = null, popupChTitle = null;

// ── ACCESS GATE ───────────────────────────────────────────────────────────────
// Auth state is stored in localStorage so the user stays logged in
// across sessions unless they manually clear their browser data.
const AUTH_KEY = 'se_auth_v1';

function isAuthed() {
  try { return !!localStorage.getItem(AUTH_KEY); } catch(e) { return false; }
}

function saveAuth(code) {
  try { localStorage.setItem(AUTH_KEY, code); } catch(e) {}
}

function validateCode(input) {
  const clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (typeof VALID_CODES !== 'undefined') && VALID_CODES.includes(clean);
}

function bootGate() {
  const gate = document.getElementById('gate');

  // Already authenticated — hide gate immediately and launch app
  if (isAuthed()) {
    gate.classList.add('hidden');
    return;
  }

  // Show gate, wire up interactions
  const input = document.getElementById('gateInput');
  const btn   = document.getElementById('gateBtn');
  const err   = document.getElementById('gateError');

  // Auto-format: uppercase + strip non-alphanumeric as user types
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    input.setSelectionRange(pos, pos);
    input.classList.remove('error');
    err.textContent = '';
  });

  // Submit on Enter
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptUnlock();
  });

  btn.addEventListener('click', attemptUnlock);

  function attemptUnlock() {
    const code = input.value.trim().toUpperCase();

    if (code.length === 0) {
      showError('Please enter your access code.');
      return;
    }
    if (code.length !== 8) {
      showError('Code must be 8 characters (4 letters + 4 numbers).');
      shakeInput();
      return;
    }
    if (!validateCode(code)) {
      showError('Invalid code. Please check and try again.');
      shakeInput();
      return;
    }

    // Valid — save and launch
    input.classList.add('success');
    err.style.color = '#16a34a';
    err.textContent = 'Code accepted! Loading…';
    btn.disabled = true;

    saveAuth(code);

    setTimeout(() => {
      gate.style.transition = 'opacity 0.4s ease';
      gate.style.opacity = '0';
      setTimeout(() => { gate.classList.add('hidden'); gate.style.opacity = ''; }, 400);
    }, 600);
  }

  function showError(msg) {
    err.style.color = '#ef4444';
    err.textContent = msg;
  }

  function shakeInput() {
    input.classList.remove('error');
    void input.offsetWidth; // force reflow to restart animation
    input.classList.add('error');
  }
}

bootGate();

// ── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  if (window.CHAPTERS) chapters=[...window.CHAPTERS];
  if (chapters.length) openStoryId = chapters[0].story_id || 'story1';
  // Restore font size preference
  const savedSize = parseInt(localStorage.getItem('se_fontsize')||'17');
  document.documentElement.style.setProperty('--story-size', savedSize+'px');
  renderSidebar();
  if (chapters.length) selectChapter(chapters[0].id);
  checkAudio();
  document.getElementById('menuBtn').onclick=toggleSidebar;
  document.getElementById('overlay').onclick=closeSidebar;
  document.getElementById('allSrsBtn').onclick=()=>{ srsAllMode=true; globalVocabMode=false; activeId=null; activeTab='practice'; srsFilter='due'; renderMain(); closeSidebar(); };

  // Wire export/import buttons
  document.getElementById('exportBtn').onclick = exportUserData;
  document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = e => {
    if(e.target.files[0]) importUserData(e.target.files[0]);
  };

  // Global vocab button
  document.getElementById('globalVocabBtn').onclick = () => {
    globalVocabMode = true;
    renderGlobalVocab();
    closeSidebar();
  };
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); }

// ── DARK MODE ─────────────────────────────────────────────────────────────────
const DARK_KEY = 'se_dark_v1';
function initDarkMode() {
  const saved = localStorage.getItem(DARK_KEY);
  if(saved === 'dark') document.documentElement.setAttribute('data-theme','dark');
  else if(saved === 'light') document.documentElement.setAttribute('data-theme','light');
  updateDarkToggle();
}
function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(isDark) {
    document.documentElement.setAttribute('data-theme','light');
    localStorage.setItem(DARK_KEY,'light');
  } else {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem(DARK_KEY,'dark');
  }
  updateDarkToggle();
}
function updateDarkToggle() {
  const btn = document.getElementById('darkToggle');
  if(!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}
document.getElementById('darkToggle').onclick = toggleDark;
initDarkMode();

// ── DATA EXPORT / IMPORT ──────────────────────────────────────────────────────
function exportUserData() {
  const keys = ['se_srs_v2','se_bookmarks_v1','se_progress_v1','se_dark_v1','se_fontsize','se_streak_v1','se_onboarded_v1','se_auth_v1'];
  const data = {};
  keys.forEach(k => {
    const v = localStorage.getItem(k);
    if(v !== null) data[k] = v;
  });
  // Also export any se_scroll_* keys
  for(let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if(k && k.startsWith('se_scroll_')) data[k] = localStorage.getItem(k);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sage-english-backup.json';
  a.click(); URL.revokeObjectURL(url);
}

function importUserData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      Object.entries(data).forEach(([k,v]) => localStorage.setItem(k,v));
      showProgressToast('✓ 数据已恢复，正在重载…');
      setTimeout(() => location.reload(), 1000);
    } catch(err) {
      showProgressToast('导入失败，请检查文件格式');
    }
  };
  reader.readAsText(file);
}

// ── CHIMES ────────────────────────────────────────────────────────────────────
function playChime(freq=660, vol=0.12, type='sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
    setTimeout(() => ctx.close(), 700);
  } catch(e) {}
}
function playSessionCompleteChime() {
  // Three-note ascending chime
  setTimeout(() => playChime(523, 0.1), 0);
  setTimeout(() => playChime(659, 0.1), 160);
  setTimeout(() => playChime(784, 0.14), 320);
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Don't fire when typing in an input
  if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Escape: close sidebar / popups
  if(e.key === 'Escape') {
    closeSidebar(); hideWordPopup(); hideMobileSheet();
    return;
  }

  // SRS keyboard shortcuts (only when on practice tab)
  if(activeTab === 'practice' || srsAllMode) {
    if((e.key === ' ' || e.key === 'Enter') && window._srsRevealFn && !window._srsRevealed) {
      e.preventDefault();
      window._srsRevealFn();
      return;
    }
    if(window._srsGradeFn && window._srsRevealed) {
      if(e.key === '1') { e.preventDefault(); window._srsGradeFn(0, 'card-exit-left', '✗'); return; }
      if(e.key === '2') { e.preventDefault(); window._srsGradeFn(1, 'card-exit-down', '～'); return; }
      if(e.key === '3') { e.preventDefault(); window._srsGradeFn(2, 'card-exit-right', '✓'); return; }
    }
  }
});

// After init, trigger onboarding when first chapter opens
document.addEventListener('click', e => {
  const ch = e.target.closest('.ch-item');
  if(ch) setTimeout(startOnboarding, 700);
}, true);

init();
