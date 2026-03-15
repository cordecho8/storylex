// ── HTML BUILDERS ─────────────────────────────────────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildReadHTML(story) {
  return story.split('\n').filter(l=>l.trim()).map(p=>`<p>${p.replace(/\{\{([^|]+)\|([^}]+)\}\}/g,(_,w,m)=>`<span class="vocab-chip" data-w="${esc(w.trim())}" data-m="${esc(m.trim())}"><span class="chip-inner"><span class="meaning">${esc(m.trim())}</span><span class="chip-text">${esc(w.trim())}</span></span></span>`)}</p>`).join('');
}

function buildRecallHTML(story) {
  return story.split('\n').filter(l=>l.trim()).map(p=>`<p>${p.replace(/\{\{([^|]+)\|([^}]+)\}\}/g,(_,w,m)=>`<span class="vocab-blank" data-w="${esc(w.trim())}" data-m="${esc(m.trim())}"><span class="wr">${esc(w.trim())}</span></span>`)}</p>`).join('');
}

// ── VOCAB PARSING ─────────────────────────────────────────────────────────────
function parseVocab(story) {
  const seen=new Set(), list=[];
  const re=/\{\{([^|]+)\|([^}]+)\}\}/g; let m;
  while((m=re.exec(story))!==null){ const w=m[1].trim(); if(!seen.has(w.toLowerCase())){ seen.add(w.toLowerCase()); list.push({word:w,meaning:m[2].trim()}); } }
  return list;
}

function allVocabList() {
  const seen=new Set(), list=[];
  chapters.forEach(ch=>{ parseVocab(ch.story).forEach(v=>{ if(!seen.has(v.word.toLowerCase())){ seen.add(v.word.toLowerCase()); list.push({...v,chId:ch.id,chTitle:ch.title}); } }); });
  return list;
}

function getContext(story, word) {
  const re=new RegExp(`\\{\\{${word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\|[^}]+\\}\\}`,'i');
  const parts=story.split('\n');
  for(const p of parts){ if(re.test(p)){ return p.replace(/\{\{([^|]+)\|([^}]+)\}\}/g,(_,w,m)=>w.trim().toLowerCase()===word.toLowerCase()?'__B__':m.trim()).trim(); } }
  return '';
}

// ── BACKGROUND PRELOAD ────────────────────────────────────────────────────────
function preloadChapterAssets(ch) {
  const vocab = parseVocab(ch.story);
  // Preload IPA data for all words in background
  vocab.forEach(v => fetchWordData(v.word));
  // Preload first 15 audio files
  vocab.slice(0, 15).forEach(v => {
    const a = new Audio(af(v.word));
    a.preload = 'auto';
    a.load();
  });
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list=document.getElementById('chapterList'); list.innerHTML='';

  // Group chapters by story
  const storyMap = new Map();
  chapters.forEach((ch, i) => {
    const sid = ch.story_id || 'story1';
    if (!storyMap.has(sid)) storyMap.set(sid, { title: ch.story_title || sid, chapters: [] });
    storyMap.get(sid).chapters.push({ ch, globalIdx: i });
  });

  storyMap.forEach((story, sid) => {
    const isOpen = openStoryId === sid;
    const totalWords = story.chapters.reduce((n, {ch}) => n + parseVocab(ch.story).length, 0);
    const dueWords = story.chapters.reduce((n, {ch}) => {
      return n + parseVocab(ch.story).filter(v => isDue(v.word.toLowerCase())).length;
    }, 0);

    const group = document.createElement('div');
    group.className = 'story-group' + (isOpen ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'story-header';
    header.innerHTML = `
      <div class="story-header-left">
        <div class="story-name">${esc(story.title)}</div>
        <div class="story-meta">${story.chapters.length} 章 · ${totalWords} 词${dueWords > 0 ? ` · <span style="color:var(--orange)">${dueWords} 待复习</span>` : ''}</div>
      </div>
      <span class="story-chevron">▼</span>`;
    header.onclick = () => {
      openStoryId = isOpen ? null : sid;
      globalVocabMode = false;
      renderSidebar();
    };

    const chList = document.createElement('div');
    chList.className = 'story-chapters';

    story.chapters.forEach(({ ch, globalIdx }) => {
      const vocab = parseVocab(ch.story);
      const due = vocab.filter(v => isDue(v.word.toLowerCase())).length;
      const chNumInStory = story.chapters.findIndex(x => x.ch.id === ch.id) + 1;
      const isRead = isChRead(ch.id);
      const el = document.createElement('div');
      el.className = 'ch-item' + (ch.id === activeId ? ' active' : '') + (isRead ? ' read' : '');
      el.innerHTML = `<div class="ch-num">${String(chNumInStory).padStart(2,'0')}</div><div class="ch-info"><div class="ch-name">${esc(ch.title)}</div><div class="ch-meta"><span class="ch-badge">${vocab.length} 词</span>${due > 0 ? `<span class="ch-due">${due} 待</span>` : ''}</div></div>`;
      el.onclick = () => { selectChapter(ch.id); closeSidebar(); };
      chList.appendChild(el);
    });

    group.appendChild(header);
    group.appendChild(chList);
    list.appendChild(group);
  });
}

function selectChapter(id) {
  // Save scroll position of current chapter before switching
  const mainEl = document.getElementById('main');
  if(activeId && mainEl) {
    try { localStorage.setItem('se_scroll_'+activeId, mainEl.scrollTop); } catch(e) {}
  }
  activeId=id; activeTab='read'; srsAllMode=false; globalVocabMode=false; srsFilterManual=false;
  const ch = chapters.find(c=>c.id===id);
  if (ch) openStoryId = ch.story_id || 'story1';
  renderSidebar(); renderMain();
  // Restore scroll position for this chapter
  if(mainEl) {
    const saved = localStorage.getItem('se_scroll_'+id);
    mainEl.scrollTop = saved ? parseInt(saved) : 0;
  }
  // Preload assets for this chapter in background
  if(ch) setTimeout(() => preloadChapterAssets(ch), 500);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
function renderMain() {
  const main=document.getElementById('main');

  // Global vocab view
  if(globalVocabMode) { renderGlobalVocab(); return; }

  // All-chapters SRS
  if(srsAllMode || (!activeId && activeTab==='practice')) {
    main.innerHTML='<div class="srs-wrap" id="srsWrap"></div>';
    buildSrsSession(allVocabList(), document.getElementById('srsWrap'));
    return;
  }

  const ch=chapters.find(c=>c.id===activeId);
  if(!ch) return;
  const vocab=parseVocab(ch.story);
  const chIdx=chapters.indexOf(ch);

  const prevCh = chIdx > 0 ? chapters[chIdx-1] : null;
  const nextCh = chIdx < chapters.length-1 ? chapters[chIdx+1] : null;

  // Streak calculation
  const streak = calcStreak();
  const srsData = srsLoad();
  const introduced = vocab.filter(v=>{ const c=srsData[v.word.toLowerCase()]; return c&&c.introduced; });

  main.innerHTML=`
    <div class="chapter-view">
      <div class="chapter-header">
        <div class="ch-eyebrow">${esc(ch.story_title||'Chapter')}</div>
        <div class="ch-title">${esc(ch.title)}</div>
        <div class="ch-meta-row">
          <span class="ch-meta-pill">${vocab.length} 个词汇</span>
          ${introduced.length>0 ? `<span class="ch-meta-pill" style="color:var(--accent);border-color:var(--accent-light);background:var(--accent-light)">${introduced.length} 已加入复习</span>` : ''}
          ${isChRead(ch.id) ? `<span class="ch-meta-pill" style="color:var(--accent)">✓ 已读</span>` : ''}
          ${streak>0 ? `<span class="streak-badge"><span class="streak-flame">🔥</span><span class="streak-days">${streak} 天</span></span>` : ''}
        </div>
      </div>
      <div class="tabs" id="tabBar">
        <button class="tab${activeTab==='read'?' active':''}" data-t="read">阅读</button>
        <button class="tab${activeTab==='recall'?' active':''}" data-t="recall">回想</button>
        <button class="tab${activeTab==='vocab'?' active':''}" data-t="vocab">词汇</button>
        <button class="tab${activeTab==='practice'?' active':''}" data-t="practice">练习</button>
        <button class="tab${activeTab==='bookmarks'?' active':''}" data-t="bookmarks">🔖</button>
      </div>
      <div class="font-controls" id="fontControls" style="display:${activeTab==='read'?'flex':'none'}">
        <span style="font-size:11px;color:var(--muted);font-weight:500;margin-right:4px">字号</span>
        <button class="font-btn sz-sm" id="fontDn" title="Smaller">A−</button>
        <button class="font-btn sz-lg" id="fontUp" title="Larger">A+</button>
      </div>
      <div id="tabBody"></div>
    </div>`;

  // Font size controls
  const FONT_KEY = 'se_fontsize';
  let storySize = parseInt(localStorage.getItem(FONT_KEY)||'17');
  function applyFontSize(sz) {
    storySize = Math.min(22, Math.max(13, sz));
    localStorage.setItem(FONT_KEY, storySize);
    document.documentElement.style.setProperty('--story-size', storySize+'px');
  }
  applyFontSize(storySize);

  function updateFontControlsVisibility() {
    const fc = document.getElementById('fontControls');
    if(fc) fc.style.display = activeTab==='read' ? 'flex' : 'none';
  }
  // Already set correctly in HTML via template literal, but call to sync after tab switches

  main.querySelectorAll('.tab').forEach(t=>{
    t.onclick=()=>{
      activeTab=t.dataset.t;
      globalVocabMode=false;
      main.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.t===activeTab));
      updateFontControlsVisibility();
      // Re-animate tabBody on switch
      const tb = document.getElementById('tabBody');
      if(tb) { tb.style.animation='none'; void tb.offsetWidth; tb.style.animation=''; }
      renderTab(ch,vocab);
    };
  });

  const fontDn = document.getElementById('fontDn');
  const fontUp = document.getElementById('fontUp');
  if(fontDn) fontDn.onclick = () => applyFontSize(storySize - 1);
  if(fontUp) fontUp.onclick = () => applyFontSize(storySize + 1);
  updateFontControlsVisibility();

  renderTab(ch,vocab);
}

function renderChNav(body, ch, vocab) {
  const chIdx = chapters.indexOf(ch);
  const prevCh = chIdx > 0 ? chapters[chIdx-1] : null;
  const nextCh = chIdx < chapters.length-1 ? chapters[chIdx+1] : null;
  if(!prevCh && !nextCh) return;
  const nav = document.createElement('div');
  nav.className = 'ch-nav';
  nav.innerHTML = `
    ${prevCh ? `<button class="ch-nav-btn prev" id="prevChBtn"><span class="nav-arrow">←</span><div class="nav-info"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;font-weight:600;margin-bottom:2px;color:var(--muted)">上一章</div><div class="ch-nav-title">${esc(prevCh.title)}</div></div></button>` : '<span></span>'}
    ${nextCh ? `<button class="ch-nav-btn next" id="nextChBtn"><div class="nav-info"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;font-weight:600;margin-bottom:2px;color:var(--muted)">下一章</div><div class="ch-nav-title">${esc(nextCh.title)}</div></div><span class="nav-arrow">→</span></button>` : '<span></span>'}`;
  body.appendChild(nav);
  if(prevCh) document.getElementById('prevChBtn').onclick=()=>selectChapter(prevCh.id);
  if(nextCh) document.getElementById('nextChBtn').onclick=()=>{
    markChRead(ch.id);
    // Clear saved scroll for next chapter so it starts at top
    try { localStorage.removeItem('se_scroll_'+nextCh.id); } catch(e) {}
    selectChapter(nextCh.id);
  };
}

function renderTab(ch,vocab) {
  const body=document.getElementById('tabBody');
  progMarkTab(ch.id, activeTab);

  if(activeTab==='read') {
    body.innerHTML=`<div class="story-box"><div class="story-text">${buildReadHTML(ch.story)}</div></div>`;
    body.querySelectorAll('.vocab-chip').forEach(c=>{
      // SRS state dot
      const state = wordState(c.dataset.w.toLowerCase());
      if(state==='learning') c.classList.add('srs-learning');
      if(state==='known') c.classList.add('srs-known');
      // Bookmark state
      if(bkIsBookmarked(c.dataset.w)) c.classList.add('bookmarked');

      // Any click/tap → straight to popup
      c.onclick=e=>{
        e.stopPropagation();
        progMarkWord(ch.id, c.dataset.w);
        showWordPopup(c.dataset.w, c.dataset.m, ch.id, ch.title, c);
      };
    });
    // Mark chapter as read when user scrolls to bottom of story
    const storyBox = body.querySelector('.story-box');
    const mainEl = document.getElementById('main');
    if(storyBox && mainEl && !isChRead(ch.id)) {
      const onScroll = () => {
        const scrollBottom = mainEl.scrollTop + mainEl.clientHeight;
        const storyBottom = storyBox.offsetTop + storyBox.offsetHeight;
        if(scrollBottom >= storyBottom - 40) {
          markChRead(ch.id);
          renderSidebar();
          mainEl.removeEventListener('scroll', onScroll);
        }
      };
      mainEl.addEventListener('scroll', onScroll);
    }
    renderChNav(body, ch, vocab);
  } else if(activeTab==='recall') {
    const vocabList = parseVocab(ch.story);
    const total = vocabList.length;
    let revealedCount = 0;

    function buildRecallView() {
      body.innerHTML = `
        <div class="recall-wrap">
          <div class="recall-hint-bar">点击每张卡片，尝试回想英文单词，然后揭示答案。</div>
          <div class="recall-progress">
            <span id="recallCount">0 / ${total} 已揭示</span>
            <div class="recall-progress-bar"><div class="recall-progress-fill" id="recallFill" style="width:0%"></div></div>
          </div>
          <div class="recall-grid" id="recallGrid"></div>
        </div>`;

      const grid = document.getElementById('recallGrid');
      const revealed = new Set();

      vocabList.forEach((v, i) => {
        const card = document.createElement('div');
        card.className = 'recall-card';
        card.innerHTML = `
          <div class="recall-card-meaning">${esc(v.meaning)}</div>
          <div class="recall-card-english hidden-word" id="rcw${i}">${esc(v.word)}</div>
          <div class="recall-card-tap" id="rct${i}">点击揭示</div>`;

        card.onclick = () => {
          if(revealed.has(i)) return;
          revealed.add(i);
          const wordEl = document.getElementById('rcw'+i);
          const tapEl = document.getElementById('rct'+i);
          wordEl.classList.remove('hidden-word');
          tapEl.style.display = 'none';
          card.classList.add('revealed');
          playWord(v.word, card);
          progMarkWord(ch.id, v.word);
          // update progress bar
          const pct = Math.round((revealed.size / total) * 100);
          const fill = document.getElementById('recallFill');
          const countEl = document.getElementById('recallCount');
          if(fill) fill.style.width = pct + '%';
          if(countEl) countEl.textContent = revealed.size + ' / ' + total + ' 已揭示';
        };
        grid.appendChild(card);
      });
      renderChNav(body, ch, vocab);
    }

    buildRecallView();
  } else if(activeTab==='vocab') {
    body.innerHTML=`<div class="vtitle">${vocab.length} 词 · 点击行播放</div>
    <table class="vtable"><thead><tr><th>单词</th><th>释义</th><th>待复习时间</th><th style="text-align:center">收藏 / ☆复习</th></tr></thead><tbody>${vocab.map(v=>{
      const isBk = bkIsBookmarked(v.word);
      const inSrs = srsLoad()[v.word.toLowerCase()]?.introduced;
      return `<tr class="vocab-row" data-w="${esc(v.word)}" data-m="${esc(v.meaning)}">
        <td><div class="td-word"><button class="play-btn" data-w="${esc(v.word)}">▶</button>${esc(v.word)}</div></td>
        <td>${esc(v.meaning)}</td>
        <td style="font-size:11px;color:var(--muted)">${nextDueLabel(v.word.toLowerCase())}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:flex-end">
            <button class="bk-star${isBk?' active':''}" data-w="${esc(v.word)}" data-m="${esc(v.meaning)}" title="收藏">${isBk?'🔖':'☆'}</button>
            <button class="vocab-srs-btn${inSrs?' srs-in':''}" data-w="${esc(v.word)}" data-m="${esc(v.meaning)}" title="加入复习">☆复习</button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;
    body.querySelectorAll('.play-btn').forEach(b=>{ b.onclick=e=>{e.stopPropagation();playWord(b.dataset.w,b.closest('tr'));}; });
    body.querySelectorAll('.vocab-row').forEach(r=>{
      r.onclick=e=>{
        // Don't play if a button inside the row was clicked
        if(e.target.closest('button')) return;
        playWord(r.dataset.w,r);
      };
    });
    body.querySelectorAll('.bk-star').forEach(btn=>{
      btn.onclick=e=>{
        e.stopPropagation();
        const word = btn.dataset.w, meaning = btn.dataset.m;
        const added = bkToggle(word, meaning, ch.id, ch.title);
        btn.classList.toggle('active', added);
        btn.textContent = added ? '🔖' : '☆';
        showProgressToast(added ? '🔖 已收藏' : '已取消收藏');
      };
    });
    body.querySelectorAll('.vocab-srs-btn').forEach(btn=>{
      btn.onclick=e=>{
        e.stopPropagation();
        const word = btn.dataset.w;
        const d = srsLoad();
        if(!d[word.toLowerCase()] || !d[word.toLowerCase()].introduced) {
          srsGrade(word.toLowerCase(), 0);
        }
        btn.classList.add('srs-in');
        btn.textContent = '✓ 复习';
        showProgressToast('☆ 已加入复习');
        renderSidebar();
      };
    });
    renderChNav(body, ch, vocab);
  } else if(activeTab==='bookmarks') {
    renderBookmarksTab(body);
  } else {
    const chVocab=vocab.map(v=>({...v,chId:ch.id,chTitle:ch.title}));
    if(!srsFilterManual) {
      const hasIntroduced = chVocab.some(v=>{ const c=srsLoad()[v.word.toLowerCase()]; return c&&c.introduced; });
      srsFilter = hasIntroduced ? 'due' : 'all';
    }
    body.innerHTML='<div class="srs-wrap" id="srsWrap"></div>';
    buildSrsSession(chVocab, document.getElementById('srsWrap'));
  }
}

function renderBookmarksTab(body) {
  const bks = bkLoad();
  if(!bks.length) {
    body.innerHTML=`<div class="bookmarks-wrap"><div class="bookmarks-empty"><div class="be-icon">🔖</div><p>暂无收藏。<br>阅读时点击高亮词汇，<br>点击<strong>收藏</strong>即可保存。</p></div></div>`;
    return;
  }
  body.innerHTML=`<div class="bookmarks-wrap">
    <div class="bookmarks-header">
      <div class="bookmarks-title">收藏夹 · <span style="color:var(--muted);font-size:14px;font-family:'Inter',sans-serif;font-weight:400">${bks.length} 个词</span></div>
      <button class="bookmarks-clear" id="bkClearAll">清除全部</button>
    </div>
    <div class="bookmark-list">${bks.map(b=>`
      <div class="bookmark-card" data-w="${esc(b.word)}">
        <div style="flex:1;min-width:0">
          <div class="bk-word">${esc(b.word)}</div>
          <div class="bk-meaning">${esc(b.meaning)}</div>
          ${b.chTitle?`<div class="bk-chapter">${esc(b.chTitle)}</div>`:''}
        </div>
        <div class="bk-actions">
          <button class="bk-play" data-w="${esc(b.word)}" title="播放">🔊</button>
          <button class="bk-srs" data-w="${esc(b.word)}" data-m="${esc(b.meaning)}" data-ch="${esc(b.chId||'')}" data-cht="${esc(b.chTitle||'')}">☆ 加入复习</button>
          <button class="bk-remove" data-w="${esc(b.word)}" title="移除">×</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
  document.getElementById('bkClearAll').onclick=()=>{
    bkSave([]);
    renderTab(chapters.find(c=>c.id===activeId), parseVocab(chapters.find(c=>c.id===activeId).story));
  };
  body.querySelectorAll('.bk-play').forEach(b=>{ b.onclick=e=>{e.stopPropagation();playWord(b.dataset.w,b);}; });
  body.querySelectorAll('.bk-remove').forEach(b=>{ b.onclick=e=>{
    e.stopPropagation(); bkRemove(b.dataset.w);
    const ch=chapters.find(c=>c.id===activeId);
    renderTab(ch, parseVocab(ch.story));
  }; });
  body.querySelectorAll('.bk-srs').forEach(b=>{ b.onclick=e=>{
    e.stopPropagation();
    const d = srsLoad();
    if(!d[b.dataset.w.toLowerCase()] || !d[b.dataset.w.toLowerCase()].introduced) {
      srsGrade(b.dataset.w.toLowerCase(), 0);
    }
    showProgressToast('☆ 已加入复习');
    renderSidebar();
  }; });
}

// ── SRS SESSION ───────────────────────────────────────────────────────────────
// Session grade tracking
let sessionGrades = { good: 0, hard: 0, again: 0 };

function buildSrsSession(vocabList, wrap) {
  const introduced=vocabList.filter(v=>{ const c=srsLoad()[v.word.toLowerCase()]; return c&&c.introduced; });
  // "due" filter = all words added to review (introduced); "all" = every word in chapter
  const queue=srsFilter==='due'?introduced:vocabList;

  wrap.innerHTML=`
    <div class="srs-filter">
      <span class="srs-fl">显示:</span>
      <button class="srs-fb${srsFilter==='due'?' active':''}" id="fbDue">☆ 复习中</button>
      <button class="srs-fb${srsFilter==='all'?' active':''}" id="fbAll">全部词汇</button>
    </div>
    <div id="cardArea"></div>`;

  document.getElementById('fbDue').onclick=()=>{ srsFilter='due'; srsFilterManual=true; renderMain(); };
  document.getElementById('fbAll').onclick=()=>{ srsFilter='all'; srsFilterManual=true; renderMain(); };

  if(queue.length===0) {
    document.getElementById('cardArea').innerHTML=`<div class="srs-done"><div class="di">🎉</div><h3>今日已完成</h3><p>暂无待复习卡片。点击下方学习新词汇。</p><button class="btn btn-primary" onclick="srsFilter='all';renderMain()">学习全部 ${vocabList.length} 个词</button></div>`;
    return;
  }

  srsQueue=[...queue].sort(()=>Math.random()-0.5);
  srsIdx=0; srsRevealed=false; sessionGrades={good:0,hard:0,again:0};
  renderCard(vocabList);
}

function renderCard(vocabList) {
  const area=document.getElementById('cardArea');
  if(!area) return;
  if(srsIdx>=srsQueue.length) {
    // Session summary
    const total = srsQueue.length;
    const isPerfect = sessionGrades.again===0;
    area.innerHTML=`
      <div class="srs-summary">
        <span class="sum-icon">${isPerfect ? '🏆' : sessionGrades.good > sessionGrades.again ? '🌟' : '💪'}</span>
        <h3>本轮完成</h3>
        <div class="sum-sub">复习了 <strong>${total}</strong> 个词${total>0?' · 继续保持！':''}</div>
        <div class="sum-stats">
          <div class="sum-stat s-good"><div class="sv">${sessionGrades.good}</div><div class="sl">掌握</div></div>
          <div class="sum-stat s-hard"><div class="sv">${sessionGrades.hard}</div><div class="sl">有难度</div></div>
          <div class="sum-stat s-again"><div class="sv">${sessionGrades.again}</div><div class="sl">再试</div></div>
        </div>
        <button class="btn btn-ghost" onclick="sessionGrades={good:0,hard:0,again:0};renderMain()">再来一轮</button>
      </div>`;
    renderSidebar();
    // Play completion chime
    setTimeout(playSessionCompleteChime, 150);
    return;
  }

  const v=srsQueue[srsIdx];
  const prog=`${srsIdx+1} / ${srsQueue.length}`;
  const ch=chapters.find(c=>c.id===v.chId);
  const ctx=ch?getContext(ch.story,v.word):'';

  if(!srsRevealed) {
    // Show flip-scene with only front face visible
    area.innerHTML=`
      <div class="flip-scene" id="flipScene">
        <div class="flip-card" id="flipCard">
          <div class="flip-front">
            <div class="srs-ch">${esc(v.chTitle||'')}</div>
            <div class="srs-meaning">${esc(v.meaning)}</div>
            <div class="srs-prog">${prog}</div>
          </div>
          <div class="flip-back">
            <div class="srs-ch">${esc(v.chTitle||'')}</div>
            <div style="display:flex;align-items:center;gap:12px">
              <div class="srs-word">${esc(v.word)}</div>
              <button class="srs-play" id="srsPlayBtnB">🔊</button>
            </div>
            <div class="srs-meaning">${esc(v.meaning)}</div>
            ${ctx?`<div class="srs-ctx">${ctx.replace('__B__',`<span class="bw">${esc(v.word)}</span>`)}</div>`:''}
            <div class="srs-prog">${prog}</div>
          </div>
        </div>
      </div>
      <button class="srs-reveal" id="revBtn" style="opacity:1">揭示英文单词 →</button>
      <div class="srs-grades" id="gradeArea" style="opacity:0;pointer-events:none;transition:opacity 0.2s">
        <button class="srs-g again" id="gAgain">再试<span class="gl">没想起来</span></button>
        <button class="srs-g hard"  id="gHard">有点难<span class="gl">想了一会儿</span></button>
        <button class="srs-g good"  id="gGood">掌握了！<span class="gl">一下就想起</span></button>
      </div>`;

    // Add keyboard hint (not revealed state)
    const hint = document.createElement('div');
    hint.className = 'srs-kbd-hint';
    hint.innerHTML = '<kbd>Space</kbd> 揭示';
    area.appendChild(hint);

    const revBtn = document.getElementById('revBtn');

    // Register reveal function for keyboard shortcut
    window._srsRevealFn = () => revBtn.click();
    window._srsRevealed = false;

    revBtn.onclick=()=>{
      // Flip the card
      document.getElementById('flipCard').classList.add('flipped');
      revBtn.style.opacity='0'; revBtn.style.pointerEvents='none';
      playWord(v.word, null);
      // After flip completes, show grade buttons
      setTimeout(()=>{
        revBtn.style.display='none';
        const ga=document.getElementById('gradeArea');
        if(ga){ ga.style.opacity='1'; ga.style.pointerEvents='auto'; }
        srsRevealed=true;
        window._srsRevealed = true;
        // Update keyboard hint
        const hintEl = area.querySelector('.srs-kbd-hint');
        if(hintEl) hintEl.innerHTML = '<kbd>1</kbd> 再试 &nbsp; <kbd>2</kbd> 有点难 &nbsp; <kbd>3</kbd> 掌握了';
        wireGradeButtons(vocabList, v);
      }, 420);
    };
    // Pre-wire play button on back face (may already be rendered)
    setTimeout(()=>{
      const pb=document.getElementById('srsPlayBtnB');
      if(pb) pb.onclick=()=>playWord(v.word,pb);
    }, 50);

  } else {
    // Already revealed — just show back + grade buttons (e.g. after re-render)
    const ctxHtml=ctx?ctx.replace('__B__',`<span class="bw">${esc(v.word)}</span>`):'';
    area.innerHTML=`
      <div class="srs-card" id="activeCard">
        <div class="srs-ch">${esc(v.chTitle||'')}</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="srs-word">${esc(v.word)}</div>
          <button class="srs-play" id="srsPlayBtn">🔊</button>
        </div>
        <div class="srs-meaning">${esc(v.meaning)}</div>
        ${ctxHtml?`<div class="srs-ctx">${ctxHtml}</div>`:''}
        <div class="srs-prog">${prog}</div>
      </div>
      <div class="srs-grades">
        <button class="srs-g again" id="gAgain">再试<span class="gl">没想起来</span></button>
        <button class="srs-g hard"  id="gHard">有点难<span class="gl">想了一会儿</span></button>
        <button class="srs-g good"  id="gGood">掌握了！<span class="gl">一下就想起</span></button>
      </div>`;

    // Add keyboard hint (revealed state)
    const hint = document.createElement('div');
    hint.className = 'srs-kbd-hint';
    hint.innerHTML = '<kbd>1</kbd> 再试 &nbsp; <kbd>2</kbd> 有点难 &nbsp; <kbd>3</kbd> 掌握了';
    area.appendChild(hint);

    document.getElementById('srsPlayBtn').onclick=()=>playWord(v.word,document.getElementById('srsPlayBtn'));
    wireGradeButtons(vocabList, v);
  }
}

function wireGradeButtons(vocabList, v) {
  function grade(g, exitClass, tick) {
    // Track session
    if(g===2) sessionGrades.good++;
    else if(g===1) sessionGrades.hard++;
    else sessionGrades.again++;

    // Animate card exit
    const card = document.getElementById('activeCard') || document.getElementById('flipCard');
    if(card) {
      card.classList.add(exitClass);
      // Flash tick
      const el=document.createElement('div');
      el.className='grade-tick'; el.textContent=tick;
      document.body.appendChild(el);
      setTimeout(()=>el.remove(), 550);
      setTimeout(()=>{ srsGrade(v.word.toLowerCase(),g); srsIdx++; srsRevealed=false; window._srsRevealed=false; window._srsGradeFn=null; renderCard(vocabList); renderSidebar(); }, 200);
    } else {
      srsGrade(v.word.toLowerCase(),g); srsIdx++; srsRevealed=false; window._srsRevealed=false; window._srsGradeFn=null; renderCard(vocabList); renderSidebar();
    }
  }
  // Register grade function for keyboard shortcuts
  window._srsGradeFn = grade;
  window._srsRevealed = true;

  const gA=document.getElementById('gAgain'), gH=document.getElementById('gHard'), gG=document.getElementById('gGood');
  if(gA) gA.onclick=()=>grade(0,'card-exit-left','✗');
  if(gH) gH.onclick=()=>grade(1,'card-exit-down','～');
  if(gG) gG.onclick=()=>grade(2,'card-exit-right','✓');
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
const ONBOARD_KEY = 'se_onboarded_v1';
const ONBOARD_STEPS = [
  {
    target: '.story-box',
    title: '阅读真实故事',
    body: '高亮词汇可点击查看释义，轻触 🔊 播放发音。',
    arrow: 'arrow-top', offsetX: 20, offsetY: 12
  },
  {
    target: '[data-t="practice"]',
    title: '练习记忆',
    body: '看到中文释义，回想英文单词。加入复习队列后每天自动安排。',
    arrow: 'arrow-top', offsetX: 0, offsetY: 8
  },
  {
    target: '[data-t="recall"]',
    title: '回想练习',
    body: '看到中文释义，尝试回想英文单词，点击卡片揭示答案。',
    arrow: 'arrow-top', offsetX: 0, offsetY: 8
  }
];

function startOnboarding() {
  if(localStorage.getItem(ONBOARD_KEY)) return;
  // Only start after a chapter is open
  if(!activeId) return;
  let step = 0;
  showOnboardStep(step);

  function showOnboardStep(i) {
    removeOnboard();
    if(i >= ONBOARD_STEPS.length) { localStorage.setItem(ONBOARD_KEY,'1'); return; }
    const s = ONBOARD_STEPS[i];
    const targetEl = document.querySelector(s.target);
    if(!targetEl) { showOnboardStep(i+1); return; }
    const rect = targetEl.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.className = 'onboard-overlay';
    const backdrop = document.createElement('div');
    backdrop.className = 'onboard-backdrop';

    const tip = document.createElement('div');
    tip.className = `onboard-tip ${s.arrow}`;
    tip.innerHTML = `
      <div class="onboard-step">步骤 ${i+1} / ${ONBOARD_STEPS.length}</div>
      <div class="onboard-title">${s.title}</div>
      <div class="onboard-body">${s.body}</div>
      <div class="onboard-actions">
        <button class="onboard-next" id="onboardNext">${i < ONBOARD_STEPS.length-1 ? '下一步 →' : '开始学习 ✓'}</button>
        <button class="onboard-skip" id="onboardSkip">跳过</button>
        <div class="onboard-dots">${ONBOARD_STEPS.map((_,j)=>`<div class="onboard-dot${j===i?' active':''}"></div>`).join('')}</div>
      </div>`;

    // Position tip near target
    const tipLeft = Math.min(rect.left + s.offsetX, window.innerWidth - 300);
    const tipTop = s.arrow === 'arrow-top' ? rect.bottom + s.offsetY : rect.top - 160;
    tip.style.left = Math.max(12, tipLeft) + 'px';
    tip.style.top = Math.max(12, tipTop) + 'px';

    overlay.appendChild(backdrop);
    overlay.appendChild(tip);
    document.body.appendChild(overlay);

    document.getElementById('onboardNext').onclick = () => showOnboardStep(i+1);
    document.getElementById('onboardSkip').onclick = () => { localStorage.setItem(ONBOARD_KEY,'1'); removeOnboard(); };
    backdrop.onclick = () => { localStorage.setItem(ONBOARD_KEY,'1'); removeOnboard(); };
  }

  function removeOnboard() {
    document.querySelectorAll('.onboard-overlay').forEach(el => el.remove());
  }
}

// ── GLOBAL VOCAB VIEW ─────────────────────────────────────────────────────────
function renderGlobalVocab() {
  const main = document.getElementById('main');
  const allVocab = allVocabList();
  const srsData = srsLoad();
  let sortCol = 'word', sortDir = 'asc';

  function filtered() {
    return allVocab.filter(v => {
      const state = wordState(v.word.toLowerCase());
      if(gvFilter === 'due') return srsData[v.word.toLowerCase()]?.introduced;
      if(gvFilter === 'known') return state === 'known';
      if(gvFilter === 'new') return state === 'new';
      return true;
    });
  }

  const stateOrder = { 'known': 0, 'learning': 1, 'due': 2, 'new': 3 };

  function sorted(items) {
    return [...items].sort((a, b) => {
      let va, vb;
      if(sortCol === 'word') { va = a.word.toLowerCase(); vb = b.word.toLowerCase(); }
      else if(sortCol === 'meaning') { va = a.meaning.toLowerCase(); vb = b.meaning.toLowerCase(); }
      else if(sortCol === 'state') {
        va = stateOrder[wordState(a.word.toLowerCase())] ?? 9;
        vb = stateOrder[wordState(b.word.toLowerCase())] ?? 9;
      }
      if(va < vb) return sortDir === 'asc' ? -1 : 1;
      if(va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function updateSortHeaders() {
    ['word','meaning','state'].forEach(col => {
      const th = document.getElementById('gvth-'+col);
      if(!th) return;
      th.className = 'sortable' + (sortCol===col ? ' sort-'+sortDir : '');
      const icon = th.querySelector('.sort-icon');
      if(icon) icon.textContent = sortCol===col ? (sortDir==='asc'?'↑':'↓') : '↕';
    });
  }

  function render(search = '') {
    const items = sorted(filtered().filter(v =>
      !search || v.word.toLowerCase().includes(search.toLowerCase()) || v.meaning.toLowerCase().includes(search.toLowerCase())
    ));
    const tbody = document.getElementById('gvtbody');
    if(!tbody) return;
    if(!items.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="gvocab-empty">没有词汇</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(v => {
      const state = wordState(v.word.toLowerCase());
      const stateColor = state==='known'?'var(--green)':state==='learning'?'#3b82f6':'var(--muted)';
      const stateLabel = state==='known'?'已掌握':state==='learning'?'学习中':'未学';
      const inSrs = srsData[v.word.toLowerCase()]?.introduced;
      return `<tr class="vocab-row" data-w="${esc(v.word)}" data-m="${esc(v.meaning)}">
        <td><div class="td-word"><button class="play-btn" data-w="${esc(v.word)}">▶</button>${esc(v.word)}</div></td>
        <td>${esc(v.meaning)}</td>
        <td style="font-size:11px;color:${stateColor};font-weight:500">${stateLabel}</td>
        <td><button class="vocab-srs-btn${inSrs?' srs-in':''}" data-w="${esc(v.word)}" data-m="${esc(v.meaning)}">${inSrs?'✓ 复习':'☆ 复习'}</button></td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('.play-btn').forEach(b => { b.onclick=e=>{e.stopPropagation();playWord(b.dataset.w,b.closest('tr'));}; });
    tbody.querySelectorAll('.vocab-srs-btn').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        srsGrade(btn.dataset.w.toLowerCase(), 0);
        btn.classList.add('srs-in'); btn.textContent='✓ 复习';
        showProgressToast('☆ 已加入复习');
      };
    });
    tbody.querySelectorAll('.vocab-row').forEach(r => { r.onclick=e=>{ if(e.target.closest('button')) return; playWord(r.dataset.w,r); }; });
  }

  const totalDue = allVocab.filter(v=>srsData[v.word.toLowerCase()]?.introduced).length;
  const totalKnown = allVocab.filter(v=>wordState(v.word.toLowerCase())==='known').length;

  main.innerHTML = `
    <div class="gvocab-wrap">
      <div class="gvocab-header">
        <div>
          <div class="gvocab-title">全部词汇库</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${allVocab.length} 个词 · ${totalKnown} 已掌握 · ${totalDue} 在复习中</div>
        </div>
        <button class="btn btn-ghost" id="gvBack" style="font-size:12px">← 返回</button>
      </div>
      <div class="gvocab-filters" style="margin-bottom:14px">
        <button class="gvf${gvFilter==='all'?' active':''}" data-f="all">全部 (${allVocab.length})</button>
        <button class="gvf${gvFilter==='due'?' active':''}" data-f="due">复习中 (${totalDue})</button>
        <button class="gvf${gvFilter==='known'?' active':''}" data-f="known">已掌握 (${totalKnown})</button>
        <button class="gvf${gvFilter==='new'?' active':''}" data-f="new">未学 (${allVocab.length-totalKnown-allVocab.filter(v=>wordState(v.word.toLowerCase())==='learning').length})</button>
      </div>
      <input class="gvocab-search" id="gvSearch" placeholder="搜索词汇或释义…" type="text" autocomplete="off"/>
      <table class="vtable">
        <thead><tr>
          <th class="sortable" id="gvth-word">单词<span class="sort-icon">↑</span></th>
          <th class="sortable" id="gvth-meaning">释义<span class="sort-icon">↕</span></th>
          <th class="sortable" id="gvth-state">状态<span class="sort-icon">↕</span></th>
          <th>复习</th>
        </tr></thead>
        <tbody id="gvtbody"></tbody>
      </table>
    </div>`;

  render();
  updateSortHeaders();

  document.getElementById('gvBack').onclick = () => { globalVocabMode=false; renderMain(); };
  document.getElementById('gvSearch').addEventListener('input', e => render(e.target.value));
  document.querySelectorAll('.gvf').forEach(btn => {
    btn.onclick = () => { gvFilter = btn.dataset.f; renderGlobalVocab(); };
  });
  ['word','meaning','state'].forEach(col => {
    const th = document.getElementById('gvth-'+col);
    if(th) th.addEventListener('click', () => {
      if(sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = col; sortDir = 'asc'; }
      updateSortHeaders();
      render(document.getElementById('gvSearch')?.value || '');
    });
  });
}
