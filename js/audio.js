// ── AUDIO ─────────────────────────────────────────────────────────────────────
function af(w){ return 'audio/'+w.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_-]/gi,'')+ '.mp3'; }

function playWord(word, el) {
  if(currentAudio){ currentAudio.pause(); currentAudio.currentTime=0; }
  if(currentPlayingEl){ currentPlayingEl.classList.remove('playing'); currentPlayingEl=null; }
  const a=new Audio(af(word)); currentAudio=a; currentPlayingEl=el;
  a.onplay=()=>el&&el.classList.add('playing');
  a.onended=()=>{ el&&el.classList.remove('playing'); currentAudio=null; currentPlayingEl=null; };
  a.onerror=()=>{
    el&&el.classList.remove('playing'); currentAudio=null; currentPlayingEl=null;
    if('speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(word); u.lang='en-US'; u.rate=0.9; el&&(u.onstart=()=>el.classList.add('playing')); el&&(u.onend=()=>el.classList.remove('playing')); speechSynthesis.speak(u); }
  };
  a.play().catch(()=>{});
}

// ── STATUS ────────────────────────────────────────────────────────────────────
function checkAudio() {
  const dot=document.getElementById('statusDot'), label=document.getElementById('statusLabel');
  if(!chapters.length){ label.textContent='no chapters'; return; }
  const vocab=parseVocab(chapters[0].story);
  if(!vocab.length) return;
  const a=new Audio(af(vocab[0].word));
  a.oncanplaythrough=()=>{ dot.classList.add('ok'); label.textContent='audio ready'; };
  a.onerror=()=>{ label.textContent='run generate-audio.js'; };
  a.load();
}
