const fs = require('fs');
const path = require('path');
let raw = fs.readFileSync(path.join(__dirname, '../data/chapters.js'), 'utf8');

// Parse and fix unescaped double-quotes inside story string values
let result = '';
let i = 0;

while (i < raw.length) {
  // Look for "story": " pattern (10 chars)
  if (raw.slice(i, i + 10) === '"story": "') {
    result += '"story": "';
    i += 10;

    // Now we're inside the story string - collect until unescaped closing quote
    while (i < raw.length) {
      if (raw[i] === '\\') {
        // Escaped char - copy both
        result += raw[i] + (raw[i+1] || '');
        i += 2;
      } else if (raw[i] === '"') {
        // Could be closing quote or embedded quote
        const next = raw[i+1];
        if (next === '\n' || next === '\r' || next === ',' || next === '}') {
          // Closing quote
          result += '"';
          i++;
          break;
        } else {
          // Embedded unescaped quote - escape it
          result += '\\"';
          i++;
        }
      } else {
        result += raw[i];
        i++;
      }
    }
  } else {
    result += raw[i];
    i++;
  }
}

fs.writeFileSync(path.join(__dirname, '../data/chapters.js'), result);
console.log('Done. Fixed file written.');

// Verify
try {
  eval(result.replace('window.CHAPTERS', 'var CH'));
  const words = new Set();
  CH.forEach(ch => {
    const re = /\{\{([^|]+)\|[^}]+\}\}/g;
    let m;
    while((m=re.exec(ch.story))!==null) words.add(m[1].trim().toLowerCase());
  });
  console.log('Unique vocab words:', words.size);
  console.log('Total chapters:', CH.length);
  const stories = new Set(CH.map(c=>c.story_id));
  console.log('Total stories:', stories.size);
  stories.forEach(s => {
    const chs = CH.filter(c=>c.story_id===s);
    const sw = new Set();
    chs.forEach(ch => {
      const re = /\{\{([^|]+)\|[^}]+\}\}/g;
      let m;
      while((m=re.exec(ch.story))!==null) sw.add(m[1].trim().toLowerCase());
    });
    console.log(' ', s, '-', chs[0].story_title, '-', chs.length, 'chapters,', sw.size, 'words');
  });
} catch(e) {
  console.error('Still has errors:', e.message.slice(0, 200));
}
