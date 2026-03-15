// ── SRS ENGINE (SM-2) ─────────────────────────────────────────────────────────
const SRS_KEY = 'se_srs_v2';
function srsLoad() { try { return JSON.parse(localStorage.getItem(SRS_KEY)||'{}'); } catch(e) { return {}; } }
function srsSave(d) { try { localStorage.setItem(SRS_KEY, JSON.stringify(d)); } catch(e) {} }

function srsGrade(word, g) {
  const data = srsLoad();
  let c = data[word] || { interval:1, ease:2.5, due:0, reps:0, introduced:false };
  c.introduced = true;
  if (g === 0) {
    // Again: reset repetitions, reduce ease
    c.interval = 1;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.reps = 0;
  } else if (g === 1) {
    // Hard: small interval increase, ease penalty, reps++ (partial success)
    c.interval = c.reps === 0 ? 1 : Math.max(1, Math.round(c.interval * 1.2));
    c.ease = Math.max(1.3, c.ease - 0.15);
    c.reps++;
  } else {
    // Good: standard SM2 intervals (1, 6, then ease factor)
    if (c.reps === 0) c.interval = 1;
    else if (c.reps === 1) c.interval = 6;
    else c.interval = Math.round(c.interval * c.ease);
    c.ease = Math.min(3.0, c.ease + 0.1);
    c.reps++;
  }
  c.due = Date.now() + c.interval * 86400000;
  data[word] = c;
  srsSave(data);
  return c;
}

function isDue(word) {
  const c = srsLoad()[word];
  if (!c || !c.introduced) return false;
  return c.due <= Date.now();
}

function wordState(word) {
  const c = srsLoad()[word];
  if (!c || !c.introduced) return 'new';
  if (!c.reps) return 'new';
  if (c.due <= Date.now()) return 'due';
  if (c.reps >= 3) return 'known';
  return 'learning';
}

function nextDueLabel(word) {
  const c = srsLoad()[word];
  if (!c || !c.introduced) return '—';
  if (c.due <= Date.now()) return 'Due now';
  const d = Math.round((c.due - Date.now()) / 86400000);
  return d < 1 ? '< 1 day' : `${d} day${d !== 1 ? 's' : ''}`;
}
