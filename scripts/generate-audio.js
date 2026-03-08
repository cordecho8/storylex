#!/usr/bin/env node
// scripts/generate-audio.js
//
// USAGE:
//   node scripts/generate-audio.js
//
// REQUIREMENTS:
//   - Kokoro running via Docker: docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.1
//   - Node.js 18+
//
// This script:
//   1. Reads all chapters from data/chapters.js
//   2. Extracts every unique vocab word (from {{word|meaning}} markers)
//   3. Calls your local Kokoro API to generate MP3s
//   4. Saves them to audio/[word].mp3
//
// After running, commit the audio/ folder to git — Netlify serves them statically.

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── Config ──────────────────────────────────────────────────────────────────
const KOKORO_URL = "http://localhost:8880"; // Change port if needed
const VOICE = "af_heart";                  // Kokoro voice — see their docs for options
const SPEED = 1.0;
const OUTPUT_DIR = path.join(__dirname, "../audio");
// ────────────────────────────────────────────────────────────────────────────

// Load chapters data by executing the JS file in a sandbox
function loadChapters() {
  const raw = fs.readFileSync(path.join(__dirname, "../data/chapters.js"), "utf8");
  const sandbox = { window: {} };
  const fn = new Function("window", raw);
  fn(sandbox.window);
  const chapters = sandbox.window.CHAPTERS;
  if (!chapters || !Array.isArray(chapters)) {
    throw new Error("Could not parse chapters.js — make sure window.CHAPTERS is set at the bottom of the file");
  }
  return chapters;
}

// Extract all {{word|meaning}} pairs from story text
function extractVocab(story) {
  const regex = /\{\{([^|]+)\|([^}]+)\}\}/g;
  const vocab = [];
  let m;
  while ((m = regex.exec(story)) !== null) {
    vocab.push(m[1].trim());
  }
  return vocab;
}

// Call Kokoro TTS API
async function generateAudio(word, outputPath) {
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
      port: url.port || 8880,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let err = "";
        res.on("data", d => err += d);
        res.on("end", () => reject(new Error(`Kokoro returned ${res.statusCode}: ${err}`)));
        return;
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(outputPath, buf);
        resolve();
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("📖 Loading chapters...");
  const chapters = loadChapters();

  // Collect all unique vocab words across all chapters
  const allWords = new Set();
  for (const ch of chapters) {
    const words = extractVocab(ch.story);
    words.forEach(w => allWords.add(w.toLowerCase()));
  }

  const words = [...allWords];
  console.log(`🔤 Found ${words.length} unique vocab words across ${chapters.length} chapters\n`);

  // Check Kokoro is running
  console.log(`🐳 Checking Kokoro at ${KOKORO_URL}...`);
  try {
    await new Promise((resolve, reject) => {
      http.get(`${KOKORO_URL}/`, (res) => resolve(res)).on("error", reject);
    });
    console.log("✅ Kokoro is running!\n");
  } catch (e) {
    console.error(`❌ Cannot reach Kokoro at ${KOKORO_URL}`);
    console.error("   Make sure Docker is running:");
    console.error("   docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.1\n");
    process.exit(1);
  }

  // Generate audio for each word
  let generated = 0, skipped = 0, failed = 0;

  for (const word of words) {
    // Sanitize filename: lowercase, replace spaces with underscores
    const filename = word.replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/gi, "") + ".mp3";
    const outputPath = path.join(OUTPUT_DIR, filename);

    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭  Skipping "${word}" (already exists)`);
      skipped++;
      continue;
    }

    process.stdout.write(`  🔊 Generating "${word}"...`);
    try {
      await generateAudio(word, outputPath);
      console.log(` ✓ saved as ${filename}`);
      generated++;
    } catch (err) {
      console.log(` ✗ FAILED: ${err.message}`);
      failed++;
    }

    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n─────────────────────────────────");
  console.log(`✅ Generated: ${generated}`);
  console.log(`⏭  Skipped:   ${skipped} (already existed)`);
  if (failed > 0) console.log(`❌ Failed:    ${failed}`);
  console.log("─────────────────────────────────");
  console.log("\n🚀 Now commit the audio/ folder and push to Git!");
  console.log("   git add audio/ && git commit -m 'Add vocab audio' && git push");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
