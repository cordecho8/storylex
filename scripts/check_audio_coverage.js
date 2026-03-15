const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, '../data/chapters.js'), 'utf8');
eval(raw.replace('window.CHAPTERS', 'var CH'));

const allWords = new Set();
CH.forEach(ch => {
  const re = /\{\{([^|]+)\|[^}]+\}\}/g;
  let m;
  while((m=re.exec(ch.story))!==null) allWords.add(m[1].trim().toLowerCase());
});

const audioDir = path.join(__dirname, '../audio');
const audioFiles = new Set(fs.readdirSync(audioDir));

let hasAudio = 0, needsAudio = [];
allWords.forEach(word => {
  const fname = word.replace(/\s+/g,'_').replace(/[^a-z0-9_-]/gi,'') + '.mp3';
  if(audioFiles.has(fname)) {
    hasAudio++;
  } else {
    needsAudio.push(word);
  }
});

console.log(`Total unique words: ${allWords.size}`);
console.log(`Already have audio: ${hasAudio}`);
console.log(`Need audio: ${needsAudio.length}`);
console.log('\nWords needing audio:');
needsAudio.forEach(w => console.log(' ', w));
