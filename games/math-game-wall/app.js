// 網站外殼：首頁、單元頁、遊戲頁、建立活動、排行榜
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const chunk = (a, n) => { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};
const GRADES = ['七上', '七下', '八上', '八下', '九上', '九下'];
const app = $('#app');

/* ── 題目整理：補足錯誤選項、產生分類資料 ── */
function prepItems(act) {
  const all = act.items.map(i => i.a);
  return act.items.map(it => {
    const w = [...new Set(it.w.filter(x => x && x !== it.a))];
    const pool = shuffle([...new Set(all.filter(x => x !== it.a && !w.includes(x)))]);
    while (w.length < 3 && pool.length) w.push(pool.pop());
    return { q: it.q, a: it.a, w };
  });
}
function groupsOf(act) {
  if (act.groups && Object.keys(act.groups).length >= 2) return { data: act.groups, auto: false };
  const g = { '正確的敘述': [], '錯誤的敘述': [] };
  shuffle(prepItems(act)).slice(0, 10).forEach((it, i) => {
    if (i % 2 === 0 || !it.w.length) g['正確的敘述'].push(`${it.q} → ${it.a}`);
    else g['錯誤的敘述'].push(`${it.q} → ${it.w[0]}`);
  });
  return { data: g, auto: true };
}
const customActs = () => store.get('mw:custom', []);
const saveCustom = list => store.set('mw:custom', list);
const findAct = id => UNITS.find(u => u.id === id) || customActs().find(u => u.id === id);

/* ── 畫面切換 ── */
let view = { name: 'home' };
function go(name, params = {}) {
  stopGame();
  view = { name, ...params };
  Sound.setMode(name === 'play' ? 'game' : 'menu');
  $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name || (name === 'unit' && b.dataset.go === 'home' && !params.custom)));
  ({ home: renderHome, unit: renderUnit, play: renderPlay, create: renderCreate, mine: renderMine })[name]();
  window.scrollTo(0, 0);
}

/* ── 首頁 ── */
function renderHome() {
  const grade = store.get('mw:grade', '七上');
  const totalQ = UNITS.reduce((s, u) => s + u.items.length, 0);
  app.innerHTML = `
  <section class="hero">
    <div class="hero-text">
      <h1>數學遊戲牆</h1>
      <p>國中數學 6 冊、${UNITS.length} 個單元、${totalQ} 道題目。挑一個單元，再選一種遊戲玩法，同一份題目可以換 ${Object.keys(GAMES).length} 種方式練習。</p>
    </div>
    <label class="search"><span>搜尋單元</span><input id="q" type="search" placeholder="例如：畢氏定理、因式分解、機率" autocomplete="off"></label>
  </section>
  <div class="tabs" role="tablist">${GRADES.map(g => `<button role="tab" data-g="${g}" class="${g === grade ? 'on' : ''}">${g}</button>`).join('')}</div>
  <div id="units"></div>
  <section class="strip">
    <h2>${Object.keys(GAMES).length} 種遊戲範本</h2>
    <div class="glyph-row">${Object.entries(GAMES).map(([k, g]) => `<span class="glyph sm" style="--h:${g.hue}" title="${esc(g.name)}">${g.glyph}</span>`).join('')}</div>
  </section>`;
  const draw = () => {
    const kw = $('#q').value.trim();
    const g = store.get('mw:grade', '七上');
    const list = kw ? UNITS.filter(u => (u.title + u.chapter + u.items.map(i => i.q).join('')).includes(kw)) : UNITS.filter(u => u.grade === g);
    const byCh = {};
    list.forEach(u => (byCh[(kw ? u.grade + '・' : '') + u.chapter] ||= []).push(u));
    $('#units').innerHTML = list.length ? Object.entries(byCh).map(([ch, us]) => `
      <section class="chapter"><h2>${esc(ch)}</h2>
        <div class="unit-grid">${us.map(unitCard).join('')}</div></section>`).join('')
      : `<p class="empty">找不到「${esc(kw)}」相關的單元，換個關鍵字試試。</p>`;
    $$('.tabs button').forEach(b => b.classList.toggle('on', !kw && b.dataset.g === g));
  };
  $$('.tabs button').forEach(b => b.onclick = () => { Sound.play('click'); $('#q').value = ''; store.set('mw:grade', b.dataset.g); draw(); });
  $('#q').oninput = draw;
  app.onclick = e => { const c = e.target.closest('[data-unit]'); if (c) { Sound.play('select'); go('unit', { id: c.dataset.unit }); } };
  draw();
}
function unitCard(u) {
  const [num, ...rest] = u.title.split(' ');
  return `<button class="unit-card" data-unit="${u.id}">
    <span class="unit-num">${esc(num)}</span>
    <span class="unit-title">${esc(rest.join(' ') || u.title)}</span>
    <span class="unit-meta">${u.items.length} 題${u.groups ? '・含分類' : ''}</span></button>`;
}

/* ── 單元頁：選遊戲 ── */
function gameGrid(active) {
  return `<div class="game-grid">${Object.entries(GAMES).map(([k, g]) => `
    <button class="game-card ${k === active ? 'on' : ''}" data-game="${k}">
      <span class="glyph" style="--h:${g.hue}">${g.glyph}</span>
      <span class="game-name">${esc(g.name)}</span>
      <span class="game-desc">${esc(g.desc)}</span>
      ${g.teacher ? '<span class="tag">課堂帶領</span>' : ''}</button>`).join('')}</div>`;
}
function renderUnit() {
  const act = findAct(view.id);
  if (!act) return go('home');
  const isCustom = act.id.startsWith('c:');
  app.innerHTML = `
  <nav class="crumbs"><button data-back>${isCustom ? '我的活動' : esc(act.grade)}</button><span>›</span>${isCustom ? '' : `<span>${esc(act.chapter)}</span><span>›</span>`}<b>${esc(act.title)}</b></nav>
  <header class="unit-head">
    <h1>${esc(act.title)}</h1>
    <p>${act.items.length} 道題目${act.groups ? '・含分類題組' : ''}。選一種遊戲開始；玩完可以直接切換成別的玩法。</p>
    <div class="row">
      ${isCustom ? '<button class="btn" data-edit>編輯</button><button class="btn" data-share>複製分享碼</button><button class="btn ghost danger" data-del>刪除</button>' : '<button class="btn" data-copy>複製成我的活動</button>'}
    </div>
    <p class="note" id="unit-note" hidden></p>
  </header>
  <h2 class="sec">選擇遊戲</h2>
  ${gameGrid()}
  <details class="items"><summary>查看全部題目（${act.items.length} 題）</summary>
    <ol>${act.items.map(i => `<li><span>${esc(i.q)}</span><b>${esc(i.a)}</b></li>`).join('')}</ol>
    ${act.groups ? `<h3>分類題組</h3><ul class="groups">${Object.entries(act.groups).map(([k, v]) => `<li><b>${esc(k)}</b>：${v.map(esc).join('、')}</li>`).join('')}</ul>` : ''}
  </details>`;
  app.onclick = e => {
    const g = e.target.closest('[data-game]');
    if (g) { Sound.play('select'); return go('play', { id: act.id, game: g.dataset.game }); }
    if (e.target.closest('[data-back]')) { if (!isCustom) store.set('mw:grade', act.grade); return go(isCustom ? 'mine' : 'home'); }
    if (e.target.closest('[data-copy]')) {
      const c = { id: 'c:' + Date.now(), title: act.title + '（我的版本）', items: act.items.map(i => ({ ...i, w: [...i.w] })), groups: act.groups ? JSON.parse(JSON.stringify(act.groups)) : null };
      saveCustom([c, ...customActs()]);
      return go('create', { id: c.id });
    }
    if (e.target.closest('[data-edit]')) return go('create', { id: act.id });
    if (e.target.closest('[data-share]')) return copyText(shareCode(act), $('#unit-note'));
    const del = e.target.closest('[data-del]');
    if (del) {
      if (del.dataset.armed) { saveCustom(customActs().filter(a => a.id !== act.id)); return go('mine'); }
      del.dataset.armed = '1'; del.textContent = '再按一次確認刪除';
    }
  };
}

/* ── 遊戲頁 ── */
let current = null;
function stopGame() {
  if (!current) return;
  current.cleanups.forEach(f => { try { f(); } catch (e) { } });
  current = null;
}
function renderPlay() {
  const act = findAct(view.id), g = GAMES[view.game];
  if (!act || !g) return go('home');
  app.innerHTML = `
  <div class="play">
    <div class="play-bar">
      <button class="btn ghost" data-back>← 回單元</button>
      <div class="play-title"><span class="glyph sm" style="--h:${g.hue}">${g.glyph}</span><div><b>${esc(g.name)}</b><small>${esc(act.title)}</small></div></div>
      <div class="row">
        <button class="btn ghost" data-switch>換遊戲</button>
        <button class="btn ghost" data-restart>重新開始</button>
        <button class="btn ghost" data-full>全螢幕</button>
      </div>
    </div>
    <div class="hud" id="hud"></div>
    <div class="stage-wrap" id="stage-wrap"><div class="stage" id="stage"></div><div class="overlay" id="overlay" hidden></div></div>
  </div>`;
  app.onclick = e => {
    if (e.target.closest('[data-back]')) return go('unit', { id: act.id });
    if (e.target.closest('[data-restart]')) { Sound.play('click'); return startGame(act, view.game); }
    if (e.target.closest('[data-switch]')) { Sound.play('click'); return showSwitcher(act); }
    if (e.target.closest('[data-full]')) {
      const w = $('#stage-wrap');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      else if (w.requestFullscreen) w.requestFullscreen().catch(() => { });
    }
  };
  startGame(act, view.game);
}
function showSwitcher(act) {
  const ov = $('#overlay');
  ov.hidden = false;
  ov.innerHTML = `<div class="panel wide"><div class="panel-head"><h2>換一種遊戲</h2><button class="btn ghost" data-close>關閉</button></div>${gameGrid(view.game)}</div>`;
  ov.onclick = e => {
    const g = e.target.closest('[data-game]');
    if (g) { Sound.play('select'); view.game = g.dataset.game; return renderPlay(); }
    if (e.target.closest('[data-close]') || e.target === ov) { ov.hidden = true; ov.innerHTML = ''; }
  };
}

let hudState = {};
function renderHud(o) {
  Object.assign(hudState, o);
  const h = hudState, parts = [];
  if (h.progress != null) parts.push(`<span class="pill"><small>題數</small>${esc(h.progress)}</span>`);
  if (h.score != null) parts.push(`<span class="pill score"><small>得分</small>${h.score}</span>`);
  if (h.lives != null) parts.push(`<span class="pill lives"><small>生命</small>${'<i></i>'.repeat(Math.max(0, h.lives))}${'<i class="off"></i>'.repeat(Math.max(0, (h.maxLives || 3) - h.lives))}</span>`);
  if (h.countdown != null) parts.push(`<span class="pill ${h.countdown <= 10 ? 'warn' : ''}"><small>剩餘</small>${h.countdown} 秒</span>`);
  if (h.time != null) parts.push(`<span class="pill"><small>用時</small>${fmtTime(h.time)}</span>`);
  if (h.note) parts.push(`<span class="pill note">${esc(h.note)}</span>`);
  const el = $('#hud'); if (el) el.innerHTML = parts.join('');
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function startGame(act, key) {
  stopGame();
  const g = GAMES[key];
  const stage = $('#stage'), ov = $('#overlay');
  ov.hidden = true; ov.innerHTML = '';
  stage.innerHTML = ''; stage.className = 'stage g-' + key;
  hudState = {};
  const ctx = { cleanups: [], t0: performance.now() };
  current = ctx;
  const alive = () => current === ctx;
  const api = {
    act, items: shuffle(prepItems(act)), groups: groupsOf(act),
    hud: renderHud, sfx: Sound.play, alive,
    later(fn, ms) { const id = setTimeout(() => alive() && fn(), ms); ctx.cleanups.push(() => clearTimeout(id)); return id; },
    every(fn, ms) { const id = setInterval(() => alive() && fn(), ms); ctx.cleanups.push(() => clearInterval(id)); return id; },
    frame(fn) { let id, last = performance.now(); const loop = t => { if (!alive()) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; if (fn(dt) !== false) id = requestAnimationFrame(loop); }; id = requestAnimationFrame(loop); ctx.cleanups.push(() => cancelAnimationFrame(id)); },
    on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); ctx.cleanups.push(() => t.removeEventListener(ev, fn, opt)); },
    elapsed: () => Math.round((performance.now() - ctx.t0) / 1000),
    finish(score, total, extra = {}) { if (!alive()) return; const time = api.elapsed(); stopGame(); showResult(act, key, { score, total, time, ...extra }); },
  };
  if (!g.teacher && !g.countdown) { renderHud({ time: 0 }); api.every(() => renderHud({ time: api.elapsed() }), 1000); }
  if (g.teacher) renderHud({ note: '課堂帶領模式：不計分，適合投影給全班一起玩' });
  g.run(stage, api);
}

/* ── 結果與排行榜 ── */
function showResult(act, key, r) {
  const g = GAMES[key], ov = $('#overlay');
  const pct = r.total ? r.score / r.total : Math.min(1, r.score / 10);
  Sound.play(pct >= 0.6 ? 'win' : 'lose');
  const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : pct > 0 ? 1 : 0;
  const lbKey = `mw:lb:${act.id}:${key}`;
  const lb = store.get(lbKey, []);
  const msg = pct >= 0.9 ? '太厲害了！' : pct >= 0.6 ? '表現不錯！' : pct > 0 ? '再練一次會更好' : '別灰心，再挑戰一次';
  ov.hidden = false;
  ov.innerHTML = `<div class="panel result">
    <div class="stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}"></i>`).join('')}</div>
    <h2>${msg}</h2>
    <div class="big-score">${r.score}${r.total ? `<small> / ${r.total}</small>` : `<small> ${r.unit || '分'}</small>`}</div>
    <p class="muted">用時 ${fmtTime(r.time)}${r.detail ? '・' + esc(r.detail) : ''}</p>
    <form class="lb-form" id="lb-form"><label for="lb-name">寫上名字登上排行榜</label><div class="row"><input id="lb-name" maxlength="12" placeholder="你的名字或座號" value="${esc(store.get('mw:name', ''))}"><button class="btn primary">儲存成績</button></div></form>
    <div id="lb">${lbTable(lb)}</div>
    <div class="row center">
      <button class="btn primary" data-again>再玩一次</button>
      <button class="btn" data-switch>換一種遊戲</button>
      <button class="btn ghost" data-back>回單元</button>
    </div></div>`;
  $('#lb-form').onsubmit = e => {
    e.preventDefault();
    const name = $('#lb-name').value.trim() || '無名英雄';
    store.set('mw:name', name);
    const list = [...store.get(lbKey, []), { name, score: r.score, time: r.time, d: Date.now() }]
      .sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 10);
    store.set(lbKey, list);
    $('#lb').innerHTML = lbTable(list, name, r);
    $('#lb-form').hidden = true;
    Sound.play('correct');
  };
  ov.onclick = e => {
    if (e.target.closest('[data-again]')) return startGame(act, key);
    if (e.target.closest('[data-switch]')) return showSwitcher(act);
    if (e.target.closest('[data-back]')) return go('unit', { id: act.id });
  };
}
function lbTable(list, me, r) {
  if (!list.length) return '<p class="muted small">這台裝置還沒有人登上這個遊戲的排行榜。</p>';
  return `<ol class="lb">${list.map((x, i) => `<li class="${me && x.name === me && r && x.score === r.score && x.time === r.time ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(x.name)}</span><span class="sc">${x.score}</span><span class="tm">${fmtTime(x.time)}</span></li>`).join('')}</ol>`;
}

/* ── 建立／編輯活動 ── */
const SAMPLE = `3 + 4 × 2 = ？|11|14|10|9
(−2)³ = ？|−8|8|−6|6
√81 = ？|9|±9|81|3
直角三角形兩股 6、8，斜邊是？|10|14|12|48`;
function parseItems(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const p = l.split(l.includes('\t') ? '\t' : '|').map(s => s.trim());
    return { q: p[0], a: p[1], w: p.slice(2).filter(Boolean) };
  }).filter(i => i.q && i.a);
}
function parseGroups(text) {
  const g = {};
  text.split('\n').forEach(l => {
    const m = l.match(/^\s*([^：:]+)[：:](.+)$/);
    if (m) { const items = m[2].split(/[、,，;；]/).map(s => s.trim()).filter(Boolean); if (items.length) g[m[1].trim()] = items; }
  });
  return Object.keys(g).length >= 2 ? g : null;
}
function renderCreate() {
  const editing = view.id ? customActs().find(a => a.id === view.id) : null;
  const itemsText = editing ? editing.items.map(i => [i.q, i.a, ...i.w].join('|')).join('\n') : SAMPLE;
  const groupsText = editing && editing.groups ? Object.entries(editing.groups).map(([k, v]) => `${k}：${v.join('、')}`).join('\n') : '';
  app.innerHTML = `
  <header class="unit-head"><h1>${editing ? '編輯活動' : '建立活動'}</h1>
    <p>輸入一次題目，就能用全部 ${Object.keys(GAMES).length} 種遊戲來玩。活動存在這台裝置的瀏覽器裡，可用「分享碼」傳給其他老師或學生。</p></header>
  <form class="editor" id="editor">
    <label for="ed-title">活動名稱</label>
    <input id="ed-title" required maxlength="40" value="${esc(editing ? editing.title : '')}" placeholder="例如：七年級 第二次段考複習">
    <label for="ed-items">題目（每行一題）</label>
    <p class="hint">格式：<code>題目|正確答案|錯誤答案1|錯誤答案2|錯誤答案3</code>。錯誤答案可以省略，系統會從其他題目的答案自動補上。也可以直接從 Excel 複製多欄貼上。</p>
    <textarea id="ed-items" rows="10" spellcheck="false">${esc(itemsText)}</textarea>
    <p class="hint" id="ed-count"></p>
    <label for="ed-groups">分類題組（選填，給「分類」遊戲用）</label>
    <p class="hint">每行一個類別：<code>質數：2、3、5、7</code>，至少兩行。沒填的話，分類遊戲會改成「正確／錯誤敘述」分類。</p>
    <textarea id="ed-groups" rows="4" spellcheck="false" placeholder="質數：2、3、5、7&#10;合數：4、6、8、9">${esc(groupsText)}</textarea>
    <div class="row"><button class="btn primary">儲存並選遊戲</button><button type="button" class="btn ghost" data-cancel>取消</button></div>
    <p class="note" id="ed-err" hidden></p>
  </form>`;
  const count = () => { const n = parseItems($('#ed-items').value).length; $('#ed-count').textContent = `目前解析出 ${n} 題${n < 4 ? '（建議至少 4 題，配對類遊戲才好玩）' : ''}`; };
  $('#ed-items').oninput = count; count();
  $('#editor').onsubmit = e => {
    e.preventDefault();
    const items = parseItems($('#ed-items').value);
    if (items.length < 2) { const n = $('#ed-err'); n.hidden = false; n.textContent = '至少要有 2 題。請確認每行都有「題目|答案」。'; return; }
    const act = { id: editing ? editing.id : 'c:' + Date.now(), title: $('#ed-title').value.trim() || '未命名活動', items, groups: parseGroups($('#ed-groups').value) };
    const list = customActs().filter(a => a.id !== act.id);
    saveCustom([act, ...list]);
    Sound.play('correct');
    go('unit', { id: act.id, custom: true });
  };
  app.onclick = e => { if (e.target.closest('[data-cancel]')) go(editing ? 'unit' : 'mine', { id: editing?.id, custom: true }); };
}

/* ── 我的活動 ── */
function shareCode(act) {
  const json = JSON.stringify({ t: act.title, i: act.items.map(i => [i.q, i.a, ...i.w]), g: act.groups });
  return 'MW1:' + btoa(unescape(encodeURIComponent(json)));
}
function readShare(code) {
  const raw = code.trim().replace(/^MW1:/, '');
  const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
  return { id: 'c:' + Date.now(), title: o.t, items: o.i.map(([q, a, ...w]) => ({ q, a, w })), groups: o.g || null };
}
function copyText(text, note) {
  const done = ok => { note.hidden = false; note.innerHTML = ok ? '已複製分享碼，貼給別人後在「我的活動 → 匯入」貼上即可。' : `無法自動複製，請手動選取：<textarea readonly rows="3">${esc(text)}</textarea>`; if (!ok) note.querySelector('textarea').select(); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
}
function renderMine() {
  const list = customActs();
  app.innerHTML = `
  <header class="unit-head"><h1>我的活動</h1><p>你自己建立或從單元複製修改的活動。</p>
    <div class="row"><button class="btn primary" data-new>建立新活動</button></div></header>
  ${list.length ? `<div class="unit-grid">${list.map(a => `<button class="unit-card" data-unit="${a.id}"><span class="unit-num">自訂</span><span class="unit-title">${esc(a.title)}</span><span class="unit-meta">${a.items.length} 題${a.groups ? '・含分類' : ''}</span></button>`).join('')}</div>`
      : `<div class="empty-box"><p>還沒有自訂活動。按「建立新活動」輸入題目，或到任一單元按「複製成我的活動」來修改現成題目。</p></div>`}
  <section class="import"><h2 class="sec">匯入分享碼</h2>
    <form id="imp" class="row"><input id="imp-code" placeholder="貼上 MW1: 開頭的分享碼"><button class="btn">匯入</button></form>
    <p class="note" id="imp-note" hidden></p></section>`;
  app.onclick = e => {
    const c = e.target.closest('[data-unit]');
    if (c) return go('unit', { id: c.dataset.unit, custom: true });
    if (e.target.closest('[data-new]')) go('create');
  };
  $('#imp').onsubmit = e => {
    e.preventDefault();
    const n = $('#imp-note'); n.hidden = false;
    try { const a = readShare($('#imp-code').value); saveCustom([a, ...customActs()]); Sound.play('correct'); go('unit', { id: a.id, custom: true }); }
    catch (err) { n.textContent = '分享碼格式不正確，請確認有完整複製（以 MW1: 開頭）。'; Sound.play('wrong'); }
  };
}

/* ── 頂端列 ── */
$$('.nav button').forEach(b => b.onclick = () => { Sound.play('click'); go(b.dataset.go); });
$('#brand').onclick = () => go('home');
function syncSoundBtns() {
  $('#btn-sfx').classList.toggle('off', !Sound.state.sfx);
  $('#btn-music').classList.toggle('off', !Sound.state.music);
  $('#btn-sfx').setAttribute('aria-pressed', Sound.state.sfx);
  $('#btn-music').setAttribute('aria-pressed', Sound.state.music);
}
$('#btn-sfx').onclick = () => { Sound.toggle('sfx'); syncSoundBtns(); };
$('#btn-music').onclick = () => { Sound.unlock(); Sound.toggle('music'); syncSoundBtns(); };
syncSoundBtns();
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
document.addEventListener('keydown', () => Sound.unlock(), { once: true });
go('home');
