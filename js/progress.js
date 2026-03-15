// ── PROGRESS TRACKING ─────────────────────────────────────────────────────────
const PROG_KEY = 'se_progress_v1';
function progLoad() { try { return JSON.parse(localStorage.getItem(PROG_KEY)||'{}'); } catch(e) { return {}; } }
function progSave(d) { try { localStorage.setItem(PROG_KEY, JSON.stringify(d)); } catch(e) {} }
function progGet(chId) {
  const d = progLoad(); return d[chId] || { wordsHeard:[], tabsVisited:[] };
}
function progMarkWord(chId, word) {
  const d = progLoad();
  if(!d[chId]) d[chId] = {wordsHeard:[], tabsVisited:[]};
  if(!d[chId].wordsHeard.includes(word.toLowerCase())) {
    d[chId].wordsHeard.push(word.toLowerCase());
    progSave(d);
    return true;
  }
  return false;
}
function progMarkTab(chId, tab) {
  const d = progLoad();
  if(!d[chId]) d[chId] = {wordsHeard:[], tabsVisited:[]};
  if(!d[chId].tabsVisited.includes(tab)) { d[chId].tabsVisited.push(tab); progSave(d); }
}
function progPct(chId, totalWords) {
  const p = progGet(chId);
  const tabs = (p.tabsVisited||[]).length;
  const words = (p.wordsHeard||[]).length;
  // 60% words heard + 40% tabs visited (read, recall, vocab, practice = 4 tabs)
  const wordScore = totalWords > 0 ? (words/totalWords)*60 : 0;
  const tabScore = (tabs/4)*40;
  return Math.min(100, Math.round(wordScore + tabScore));
}
function isChRead(chId) {
  const d = progLoad();
  return !!(d[chId] && d[chId].read);
}
function markChRead(chId) {
  const d = progLoad();
  if(!d[chId]) d[chId] = { wordsHeard:[], tabsVisited:[] };
  d[chId].read = true;
  // Record today's date for streak tracking
  const today = new Date().toISOString().slice(0,10);
  d[chId].readDate = today;
  // Update streak log
  try {
    const STREAK_KEY = 'se_streak_v1';
    let log = JSON.parse(localStorage.getItem(STREAK_KEY)||'[]');
    if(!log.includes(today)) { log.push(today); localStorage.setItem(STREAK_KEY, JSON.stringify(log)); }
  } catch(e) {}
  progSave(d);
}

function calcStreak() {
  try {
    const STREAK_KEY = 'se_streak_v1';
    const log = JSON.parse(localStorage.getItem(STREAK_KEY)||'[]');
    if(!log.length) return 0;
    const days = log.map(d=>new Date(d).getTime()).sort((a,b)=>b-a);
    const today = new Date(); today.setHours(0,0,0,0);
    let streak = 0, check = today.getTime();
    for(const d of days) {
      const day = new Date(d); day.setHours(0,0,0,0);
      if(day.getTime()===check) { streak++; check -= 86400000; }
      else if(day.getTime() < check) break;
    }
    return streak;
  } catch(e) { return 0; }
}

let progressToastTimer = null;
function showProgressToast(msg) {
  const old = document.querySelector('.progress-toast');
  if(old) old.remove();
  if(progressToastTimer) clearTimeout(progressToastTimer);
  const t = document.createElement('div');
  t.className = 'progress-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  progressToastTimer = setTimeout(()=>{
    t.classList.add('out');
    setTimeout(()=>t.remove(), 200);
  }, 2000);
}
