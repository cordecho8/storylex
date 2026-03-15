const fs = require('fs');
const path = require('path');
const raw = fs.readFileSync(path.join(__dirname, '../data/chapters.js'), 'utf8');

eval(raw.replace('window.CHAPTERS', 'var CH'));

const stories = new Set(CH.map(c=>c.story_id));
console.log('Total stories:', stories.size, [...stories]);
console.log('Total chapters:', CH.length);

stories.forEach(s => {
  const chs = CH.filter(c=>c.story_id===s);
  const sw = new Set();
  chs.forEach(ch => {
    const re = /\{\{([^|]+)\|[^}]+\}\}/g;
    let m;
    while((m=re.exec(ch.story))!==null) sw.add(m[1].trim().toLowerCase());
  });
  const title = chs.find(c=>c.story_title)?.story_title || 'NO TITLE';
  console.log(' ', s, '-', title, '-', chs.length, 'chapters,', sw.size, 'words');
});

// Find any chapter with missing fields
CH.forEach((ch, i) => {
  if(!ch.story_title || !ch.story_id || !ch.id || !ch.title || !ch.story) {
    console.log('Missing field in chapter index', i, ch.id, '- story_title:', ch.story_title, '- story:', ch.story ? 'ok' : 'MISSING');
  }
});

// Check for duplicate IDs
const ids = CH.map(c=>c.id);
const dupes = ids.filter((id,i) => ids.indexOf(id) !== i);
if(dupes.length) console.log('Duplicate IDs:', dupes);
