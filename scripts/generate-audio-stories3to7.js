#!/usr/bin/env node
// scripts/generate-audio-stories3to7.js
//
// USAGE:
//   node scripts/generate-audio-stories3to7.js
//
// REQUIREMENTS:
//   - Kokoro running via Docker:
//       docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.1
//   - Node.js 18+
//   - chapters.js (stories 3–7) present at data/chapters.js
//
// This script:
//   1. Reads all chapters from data/chapters.js (stories 3–7)
//   2. Extracts every unique vocab word from {{word|meaning}} markers
//   3. Calls your local Kokoro Docker API to generate MP3s
//   4. Saves them to audio/[word].mp3
//   5. Skips words that already have audio files
//
// After running, commit the audio/ folder to git — Netlify serves them statically.

const fs   = require("fs");
const path = require("path");
const http = require("http");

// ── Config ──────────────────────────────────────────────────────────────────
const KOKORO_URL = "http://localhost:8880";   // Change port if needed
const VOICE      = "af_heart";               // Kokoro voice (af_heart = clear American English)
const SPEED      = 0.85;                     // Slightly slower for vocab clarity
const OUTPUT_DIR = path.join(__dirname, "../audio");
const CHAPTERS_PATH = path.join(__dirname, "../data/chapters.js");
// ────────────────────────────────────────────────────────────────────────────

/** Load chapters.js by executing it in a sandbox */
function loadChapters() {
  const raw = fs.readFileSync(CHAPTERS_PATH, "utf8");
  const sandbox = { window: {} };
  new Function("window", raw)(sandbox.window);
  const chapters = sandbox.window.CHAPTERS;
  if (!chapters || !Array.isArray(chapters)) {
    throw new Error(
      "Could not parse chapters.js — make sure window.CHAPTERS is set at the bottom of the file"
    );
  }
  return chapters;
}

/** Extract all {{word|meaning}} vocab words from a story string */
function extractVocab(story) {
  const regex = /\{\{([^|]+)\|([^}]+)\}\}/g;
  const words = [];
  let m;
  while ((m = regex.exec(story)) !== null) {
    words.push(m[1].trim());
  }
  return words;
}

/** Convert a vocab word to a safe MP3 filename (matches the app's audioFilename() logic) */
function wordToFilename(word) {
  return word.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/gi, "") + ".mp3";
}

/** Call the Kokoro Docker TTS API and write the result to outputPath */
function generateAudio(word, outputPath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      input: word,
      voice: VOICE,
      speed: SPEED,
      response_format: "mp3"
    });

    const url = new URL(`${KOKORO_URL}/v1/audio/speech`);
    const options = {
      hostname: url.hostname,
      port:     Number(url.port) || 8880,
      path:     url.pathname,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let err = "";
        res.on("data", d  => (err += d));
        res.on("end",  () => reject(new Error(`Kokoro ${res.statusCode}: ${err.slice(0, 200)}`)));
        return;
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end",  ()    => {
        fs.writeFileSync(outputPath, Buffer.concat(chunks));
        resolve();
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** Ping Kokoro to confirm it's up before starting */
function checkKokoro() {
  return new Promise((resolve, reject) => {
    http.get(`${KOKORO_URL}/`, resolve).on("error", reject);
  });
}

async function main() {
  // Ensure audio output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("📖 Loading chapters...");
  const chapters = loadChapters();

  // Summarise stories found
  const stories = {};
  for (const ch of chapters) {
    const sid = ch.story_id || "unknown";
    if (!stories[sid]) stories[sid] = { title: ch.story_title || sid, count: 0 };
    stories[sid].count++;
  }

  console.log(`\n📚 Found ${chapters.length} chapters across ${Object.keys(stories).length} stories:`);
  for (const [sid, s] of Object.entries(stories)) {
    console.log(`   • [${sid}] ${s.title} (${s.count} chapters)`);
  }

  // Collect all unique vocab words
  const allWords = new Set();
  for (const ch of chapters) {
    for (const w of extractVocab(ch.story)) {
      allWords.add(w.toLowerCase());
    }
  }

  const words = [...allWords].sort();
  console.log(`\n🔤 Found ${words.length} unique vocab words\n`);

  // Check Kokoro is reachable
  console.log(`🐳 Checking Kokoro at ${KOKORO_URL}...`);
  try {
    await checkKokoro();
    console.log("✅ Kokoro is running!\n");
  } catch {
    console.error(`❌ Cannot reach Kokoro at ${KOKORO_URL}`);
    console.error("   Start it with:");
    console.error("   docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.1\n");
    process.exit(1);
  }

  // Generate audio
  let generated = 0, skipped = 0, failed = 0;

  for (const word of words) {
    const filename   = wordToFilename(word);
    const outputPath = path.join(OUTPUT_DIR, filename);

    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭  Skipping  "${word}" (already exists)`);
      skipped++;
      continue;
    }

    process.stdout.write(`  🔊 Generating "${word}"...`);
    try {
      await generateAudio(word, outputPath);
      console.log(` ✓  ${filename}`);
      generated++;
    } catch (err) {
      console.log(` ✗  FAILED: ${err.message}`);
      failed++;
    }

    // Small delay to be polite to the local API
    await new Promise(r => setTimeout(r, 100));
  }

  // Summary
  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Generated : ${generated}`);
  console.log(`⏭  Skipped   : ${skipped}  (already existed)`);
  if (failed > 0) console.log(`❌ Failed    : ${failed}`);
  console.log("─────────────────────────────────────────");
  console.log("\n🚀 Commit the audio/ folder and push:");
  console.log("   git add audio/ data/chapters.js && git commit -m 'Add stories 3-7 + audio' && git push");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
