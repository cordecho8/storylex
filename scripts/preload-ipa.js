#!/usr/bin/env node
/**
 * preload-ipa.js  —  Sage English / StoryLex
 *
 * Fetches IPA for every vocab word in data/chapters.js and saves
 * a preloaded cache to data/ipa-cache.json.
 *
 * Usage (from project root):
 *   node scripts/preload-ipa.js
 *   node scripts/preload-ipa.js --refresh   ← re-fetch everything
 *
 * Requires Node 18+ (built-in fetch + ESM).
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHAPTERS_FILE = path.join(__dirname, '../data/chapters.js');
const CACHE_FILE    = path.join(__dirname, '../data/ipa-cache.json');
const API_BASE      = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const DELAY_MS      = 130;
const MAX_RETRIES   = 3;
const SAVE_EVERY    = 25;
const FORCE_REFRESH = process.argv.includes('--refresh');

// ── helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function syllabify(word) {
  const w = word.toLowerCase(), V = 'aeiouy';
  let out = '', syl = '', pv = false;
  for (let i = 0; i < w.length; i++) {
    const c = w[i], iv = V.includes(c);
    syl += c;
    if (iv && !pv && syl.length > 1 && i < w.length - 2) {
      const n = w[i+1], nn = w[i+2];
      if (n && !V.includes(n) && nn && V.includes(nn)) { out += syl + '·'; syl = ''; }
    }
    pv = iv;
  }
  out += syl;
  return out.includes('·') ? out : word;
}

async function apiFetch(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'SageEnglish/1.0' },
        signal: AbortSignal.timeout(9000),
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        const wait = 2000 * (attempt + 1);
        process.stdout.write(` [rate-limited, waiting ${wait/1000}s...]`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries) return null;
      await sleep(600 * (attempt + 1));
    }
  }
  return null;
}

function extractIPA(entry) {
  if (!entry) return '';
  const phonetics = (entry.phonetics || []).filter(p => p.text?.trim());
  if (!phonetics.length) return entry.phonetic || '';
  // Prefer UK pronunciation where available
  const uk = phonetics.find(p => (p.audio || '').includes('-uk'));
  const chosen = uk || phonetics[0];
  let t = chosen.text.trim();
  if (!t.startsWith('/') && !t.startsWith('[')) t = '/' + t + '/';
  return t;
}

// ── load chapters ─────────────────────────────────────────────────────────────

console.log('\n📖  Loading chapters.js…');
if (!fs.existsSync(CHAPTERS_FILE)) {
  console.error('❌  File not found:', CHAPTERS_FILE);
  process.exit(1);
}

const raw = fs.readFileSync(CHAPTERS_FILE, 'utf8');
const win = {};
try {
  new Function('window', raw)(win);
} catch (e) {
  console.error('❌  Failed to parse chapters.js:', e.message);
  process.exit(1);
}
const chapters = win.CHAPTERS;
if (!chapters?.length) {
  console.error('❌  No CHAPTERS found in chapters.js');
  process.exit(1);
}
console.log(`✅  ${chapters.length} chapters loaded`);

// ── extract unique vocab ───────────────────────────────────────────────────────

const seen = new Set(), words = [];
for (const ch of chapters) {
  for (const m of ch.story.matchAll(/\{\{([^|]+)\|[^}]+\}\}/g)) {
    const w = m[1].trim();
    if (!seen.has(w.toLowerCase())) { seen.add(w.toLowerCase()); words.push(w); }
  }
}
console.log(`📚  ${words.length} unique vocab words found`);

// ── load existing cache ────────────────────────────────────────────────────────

let cache = {};
if (fs.existsSync(CACHE_FILE) && !FORCE_REFRESH) {
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (_) {}
  const n = Object.keys(cache).length;
  if (n) console.log(`💾  Existing cache: ${n} words  (pass --refresh to re-fetch all)`);
}

// ── fetch loop ─────────────────────────────────────────────────────────────────

const todo = words.filter(w => !cache[w.toLowerCase()]);
if (todo.length === 0) {
  console.log('\n✅  All words already cached — nothing to fetch.\n');
  process.exit(0);
}
console.log(`\n🌐  Fetching ${todo.length} word${todo.length !== 1 ? 's' : ''} from dictionaryapi.dev…\n`);

let found = 0, missing = 0;

for (let i = 0; i < todo.length; i++) {
  const word = todo[i];
  const key  = word.toLowerCase();
  const pad  = String(i + 1).padStart(String(todo.length).length);
  process.stdout.write(`  [${pad}/${todo.length}]  ${word.padEnd(24)} `);

  const data = await apiFetch(API_BASE + encodeURIComponent(key));

  if (!data || !Array.isArray(data) || !data[0]) {
    cache[key] = { syllables: syllabify(word), ipa: '' };
    process.stdout.write('— not in dictionary\n');
    missing++;
  } else {
    const ipa = extractIPA(data[0]);
    cache[key] = { syllables: syllabify(word), ipa };
    process.stdout.write(`${ipa || '(no IPA text)'}\n`);
    found++;
  }

  // Save incrementally so a crash doesn't lose progress
  if ((i + 1) % SAVE_EVERY === 0) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    process.stdout.write(`\n  💾  Progress saved (${i + 1}/${todo.length})\n\n`);
  }

  if (i < todo.length - 1) await sleep(DELAY_MS);
}

// ── final save ────────────────────────────────────────────────────────────────

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Done
   Words fetched     : ${todo.length}
   IPA found         : ${found}
   Not in dictionary : ${missing}
   Total in cache    : ${Object.keys(cache).length}
   Output            : data/ipa-cache.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit and deploy:
  git add data/ipa-cache.json
  git commit -m "Add preloaded IPA cache"
  git push
`);
