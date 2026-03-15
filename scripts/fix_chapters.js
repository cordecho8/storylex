const fs = require('fs');
const path = require('path');
let raw = fs.readFileSync(path.join(__dirname, '../data/chapters.js'), 'utf8');

eval(raw.replace('window.CHAPTERS', 'var CH'));

// Find null/undefined elements
CH.forEach((ch, i) => {
  if (!ch || typeof ch !== 'object') {
    console.log('Null/undefined at index', i);
  }
});

// Filter out null/undefined chapters
const clean = CH.filter(c => c && typeof c === 'object' && c.story_id && c.id && c.story);

console.log('Original:', CH.length, 'chapters');
console.log('After cleanup:', clean.length, 'chapters');

// Calculate total unique words
const allWords = new Set();
clean.forEach(ch => {
  const re = /\{\{([^|]+)\|[^}]+\}\}/g;
  let m;
  while((m=re.exec(ch.story))!==null) allWords.add(m[1].trim().toLowerCase());
});
console.log('Total unique vocab words:', allWords.size);

// Write fixed file
const newContent = `// chapters.js — StoryLex chapter data
// Vocab format: {{english_word|中文释义}}

window.CHAPTERS = ${JSON.stringify(clean, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '../data/chapters.js'), newContent);
console.log('Written fixed chapters.js');

// Final per-story summary
const stories = [...new Set(clean.map(c=>c.story_id))];
stories.forEach(s => {
  const chs = clean.filter(c=>c.story_id===s);
  const sw = new Set();
  chs.forEach(ch => {
    const re = /\{\{([^|]+)\|[^}]+\}\}/g;
    let m;
    while((m=re.exec(ch.story))!==null) sw.add(m[1].trim().toLowerCase());
  });
  console.log(' ', s, chs[0].story_title, '-', chs.length, 'ch,', sw.size, 'unique words');
});
