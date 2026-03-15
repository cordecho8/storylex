// ── BOOKMARK ENGINE ───────────────────────────────────────────────────────────
const BK_KEY = 'se_bookmarks_v1';
function bkLoad() { try { return JSON.parse(localStorage.getItem(BK_KEY)||'[]'); } catch(e) { return []; } }
function bkSave(d) { try { localStorage.setItem(BK_KEY, JSON.stringify(d)); } catch(e) {} }
function bkIsBookmarked(word) { return bkLoad().some(b=>b.word.toLowerCase()===word.toLowerCase()); }
function bkAdd(word, meaning, chId, chTitle) {
  const d = bkLoad().filter(b=>b.word.toLowerCase()!==word.toLowerCase());
  d.unshift({word,meaning,chId,chTitle,addedAt:Date.now()});
  bkSave(d);
}
function bkRemove(word) {
  bkSave(bkLoad().filter(b=>b.word.toLowerCase()!==word.toLowerCase()));
}
function bkToggle(word, meaning, chId, chTitle) {
  if(bkIsBookmarked(word)) { bkRemove(word); return false; }
  else { bkAdd(word,meaning,chId,chTitle); return true; }
}
