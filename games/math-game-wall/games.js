// 17 種遊戲範本。每個遊戲的 run(stage, api) 會拿到同一份題目，用不同玩法呈現。
const opts4 = it => shuffle([it.a, ...it.w.slice(0, 3)]);
const uniqByAnswer = items => { const seen = new Set(); return items.filter(i => !seen.has(i.a) && seen.add(i.a)); };
const KEYS = 'ABCD';
function optButtons(os) {
  return `<div class="optgrid">${os.map((o, k) => `<button class="opt" data-k="${k}"><b>${KEYS[k]}</b><span>${esc(o)}</span></button>`).join('')}</div>`;
}
function keyPick(api, st) {
  api.on(document, 'keydown', e => {
    let k = '1234'.indexOf(e.key); if (k < 0) k = 'abcd'.indexOf(e.key.toLowerCase());
    if (k < 0 || e.target.tagName === 'INPUT') return;
    const b = $$('.opt', st)[k]; if (b && !b.disabled) b.click();
  });
}
function setupCanvas(cv, w, h) {
  const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return g;
}
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function fitText(g, text, maxW, size, font) {
  let s = size; g.font = `600 ${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 10) { s--; g.font = `600 ${s}px ${font}`; }
}
const FONT = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';

const GAMES = {

  /* 1. 測驗問答 */
  quiz: {
    name: '測驗問答', glyph: '問', hue: 8, desc: '一題一題作答，四選一。',
    run(st, api) {
      const items = api.items; let i = 0, score = 0;
      const show = () => {
        if (i >= items.length) return api.finish(score, items.length);
        const it = items[i], os = opts4(it);
        api.hud({ progress: `${i + 1} / ${items.length}`, score });
        st.innerHTML = `<div class="qwrap"><div class="qtext">${esc(it.q)}</div>${optButtons(os)}</div>`;
        $$('.opt', st).forEach(b => b.onclick = () => {
          const ok = os[b.dataset.k] === it.a;
          $$('.opt', st).forEach(x => { x.disabled = true; if (os[x.dataset.k] === it.a) x.classList.add('ok'); });
          if (!ok) b.classList.add('bad');
          api.sfx(ok ? 'correct' : 'wrong'); if (ok) score++;
          api.hud({ score });
          api.later(() => { i++; show(); }, ok ? 700 : 1500);
        });
      };
      keyPick(api, st); show();
    },
  },

  /* 2. 益智節目 */
  gameshow: {
    name: '益智節目', glyph: '秀', hue: 280, desc: '限時搶答，越快分數越高，還有三張救援卡。', countdown: true,
    run(st, api) {
      const items = api.items.slice(0, 15); let i = 0, pts = 0, correct = 0, tmr = null;
      const life = { half: true, time: true, dbl: true };
      const show = () => {
        if (i >= items.length) return api.finish(pts, null, { unit: '分', detail: `答對 ${correct} / ${items.length} 題` });
        const it = items[i], os = opts4(it); let left = 20, max = 20, locked = false, dbl = false, lastSec = 20;
        api.hud({ progress: `${i + 1} / ${items.length}`, score: pts });
        st.innerHTML = `<div class="show">
          <div class="show-top"><span class="show-no">第 ${i + 1} 題</span><div class="show-timer"><i id="gs-bar"></i><span id="gs-sec">20</span></div></div>
          <div class="qtext">${esc(it.q)}</div>${optButtons(os)}
          <div class="lifelines">
            <button data-l="half" ${life.half ? '' : 'disabled'}>刪去兩個選項</button>
            <button data-l="time" ${life.time ? '' : 'disabled'}>多 10 秒</button>
            <button data-l="dbl" ${life.dbl ? '' : 'disabled'}>本題分數加倍</button></div></div>`;
        const answer = b => {
          if (locked) return; locked = true; clearInterval(tmr);
          const ok = b && os[b.dataset.k] === it.a;
          $$('.opt', st).forEach(x => { x.disabled = true; if (os[x.dataset.k] === it.a) x.classList.add('ok'); });
          $$('.lifelines button', st).forEach(x => x.disabled = true);
          if (b && !ok) b.classList.add('bad');
          if (ok) { const gain = Math.round((100 + left * 10) * (dbl ? 2 : 1)); pts += gain; correct++; st.querySelector('.show-top').insertAdjacentHTML('beforeend', `<span class="gain">+${gain}</span>`); }
          api.sfx(ok ? 'correct' : 'wrong'); api.hud({ score: pts });
          api.later(() => { i++; show(); }, ok ? 1100 : 1700);
        };
        $$('.opt', st).forEach(b => b.onclick = () => answer(b));
        $$('.lifelines button', st).forEach(b => b.onclick = () => {
          const l = b.dataset.l; if (!life[l]) return; life[l] = false; b.disabled = true; api.sfx('select');
          if (l === 'half') shuffle($$('.opt', st).filter(x => os[x.dataset.k] !== it.a)).slice(0, 2).forEach(x => { x.disabled = true; x.classList.add('gone'); });
          if (l === 'time') { left += 10; max = Math.max(max, left); }
          if (l === 'dbl') { dbl = true; b.classList.add('active'); }
        });
        tmr = api.every(() => {
          if (locked) return;
          left = Math.max(0, left - 0.1);
          $('#gs-bar').style.width = (left / max * 100) + '%';
          const sec = Math.ceil(left); $('#gs-sec').textContent = sec;
          if (sec !== lastSec) { lastSec = sec; if (sec <= 5) api.sfx('tick'); }
          if (left <= 0) answer(null);
        }, 100);
      };
      keyPick(api, st); show();
    },
  },

  /* 3. 配對連連看 */
  matchup: {
    name: '配對連連看', glyph: '配', hue: 200, desc: '把答案卡放到對應的題目旁，再按檢查。',
    run(st, api) {
      const pages = chunk(api.items, 5); let p = 0, score = 0;
      const show = () => {
        if (p >= pages.length) return api.finish(score, api.items.length);
        const page = pages[p], chips = shuffle(page.map(it => it.a)).map((text, id) => ({ id, text }));
        const slots = new Array(page.length).fill(null); let sel = null, checked = false;
        api.hud({ progress: `第 ${p + 1} / ${pages.length} 組`, score });
        const draw = () => {
          const used = new Set(slots.filter(s => s != null));
          st.innerHTML = `<div class="match">
            <p class="hint-line">先點一張答案卡，再點題目右邊的空格。</p>
            <div class="match-rows">${page.map((it, k) => `<div class="mrow"><div class="mq">${esc(it.q)}</div>
              <button class="slot ${slots[k] != null ? 'filled' : ''} ${checked ? (chips[slots[k]]?.text === it.a ? 'ok' : 'bad') : ''}" data-s="${k}">${slots[k] != null ? esc(chips[slots[k]].text) : '放這裡'}</button></div>`).join('')}</div>
            <div class="pool">${chips.filter(c => !used.has(c.id)).map(c => `<button class="chip ${sel === c.id ? 'sel' : ''}" data-c="${c.id}">${esc(c.text)}</button>`).join('')}</div>
            <div class="row center">${checked ? `<button class="btn primary" data-next>${p + 1 < pages.length ? '下一組' : '看結果'}</button>` : `<button class="btn primary" data-check ${used.size < page.length ? 'disabled' : ''}>檢查答案</button>`}</div></div>`;
        };
        st.onclick = e => {
          const c = e.target.closest('[data-c]'), s = e.target.closest('[data-s]');
          if (checked) { if (e.target.closest('[data-next]')) { p++; st.onclick = null; show(); } return; }
          if (c) { sel = sel === +c.dataset.c ? null : +c.dataset.c; api.sfx('select'); draw(); }
          else if (s) {
            const k = +s.dataset.s;
            if (sel != null) { slots[k] = sel; sel = null; api.sfx('click'); }
            else if (slots[k] != null) { slots[k] = null; api.sfx('click'); }
            draw();
          } else if (e.target.closest('[data-check]')) {
            checked = true;
            const got = page.filter((it, k) => chips[slots[k]].text === it.a).length;
            score += got; api.hud({ score }); api.sfx(got === page.length ? 'win' : got ? 'correct' : 'wrong'); draw();
          }
        };
        draw();
      };
      show();
    },
  },

  /* 4. 翻牌記憶 */
  pairs: {
    name: '翻牌記憶', glyph: '翻', hue: 150, desc: '翻開兩張牌，找出題目和答案配成一對。',
    run(st, api) {
      const set = uniqByAnswer(api.items).slice(0, 6);
      const cards = shuffle(set.flatMap((it, k) => [{ k, side: 'q', text: it.q, a: it.a }, { k, side: 'a', text: it.a, a: it.a }]));
      let open = [], found = 0, moves = 0, lock = false;
      api.hud({ progress: `0 / ${set.length} 對` });
      st.innerHTML = `<div class="memory cols-${cards.length > 8 ? 4 : 3}">${cards.map((c, i) => `<button class="mcard ${c.side}" data-i="${i}"><span class="back">?</span><span class="face">${esc(c.text)}</span></button>`).join('')}</div>`;
      st.onclick = e => {
        const b = e.target.closest('.mcard'); if (!b || lock || b.classList.contains('open')) return;
        b.classList.add('open'); api.sfx('flip'); open.push(b);
        if (open.length < 2) return;
        moves++; const [x, y] = open.map(o => cards[o.dataset.i]);
        if (x.side !== y.side && x.a === y.a) {
          open.forEach(o => o.classList.add('done')); open = []; found++; api.sfx('correct');
          api.hud({ progress: `${found} / ${set.length} 對` });
          if (found === set.length) api.later(() => api.finish(found, set.length, { detail: `共翻 ${moves} 次` }), 600);
        } else {
          lock = true; api.later(() => { api.sfx('wrong'); open.forEach(o => o.classList.remove('open')); open = []; lock = false; }, 950);
        }
      };
    },
  },

  /* 5. 尋找配對 */
  findmatch: {
    name: '尋找配對', glyph: '找', hue: 45, desc: '看題目，從整片答案中點出正確的那一個。',
    run(st, api) {
      const set = uniqByAnswer(api.items).slice(0, 8), queue = shuffle(set);
      let score = 0, miss = false, n = 0;
      st.innerHTML = `<div class="find"><div class="qtext" id="fq"></div><div class="tiles">${shuffle(set).map(it => `<button class="tile" data-a="${esc(it.a)}">${esc(it.a)}</button>`).join('')}</div></div>`;
      const next = () => {
        if (!queue.length) return api.finish(score, set.length);
        n++; miss = false; $('#fq').textContent = queue[0].q; api.hud({ progress: `${n} / ${set.length}`, score });
      };
      st.onclick = e => {
        const t = e.target.closest('.tile'); if (!t || t.classList.contains('gone')) return;
        if (t.dataset.a === queue[0].a) {
          t.classList.add('gone'); api.sfx('correct'); if (!miss) score++; queue.shift(); next();
        } else { miss = true; api.sfx('wrong'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); }
      };
      next();
    },
  },

  /* 6. 打地鼠 */
  whack: {
    name: '打地鼠', glyph: '鼠', hue: 25, desc: '地鼠舉著答案冒出來，只打正確的那隻！60 秒計時。', countdown: true,
    run(st, api) {
      const items = api.items; let qi = 0, score = 0, left = 60, sinceRight = 0;
      st.innerHTML = `<div class="whack"><div class="qtext" id="wq"></div><div class="holes">${Array.from({ length: 9 }, (_, i) => `<div class="hole"><button class="mole" data-h="${i}"><span class="sign"></span><span class="body"></span></button></div>`).join('')}</div></div>`;
      const moles = $$('.mole', st), cur = () => items[qi % items.length];
      const setQ = () => { $('#wq').textContent = cur().q; moles.forEach(m => m.classList.remove('up', 'hit', 'miss')); };
      api.hud({ countdown: left, score });
      const spawn = () => {
        const free = moles.filter(m => !m.classList.contains('up')); if (!free.length) return;
        const m = free[Math.random() * free.length | 0], it = cur();
        const right = sinceRight >= 2 || Math.random() < 0.38;
        sinceRight = right ? 0 : sinceRight + 1;
        m.dataset.v = right ? it.a : it.w[Math.random() * it.w.length | 0];
        m.querySelector('.sign').textContent = m.dataset.v;
        m.classList.remove('hit', 'miss'); m.classList.add('up');
        const token = Math.random(); m.dataset.t = token;
        api.later(() => { if (m.dataset.t == token) m.classList.remove('up'); }, 1700 - Math.min(600, qi * 40));
      };
      st.onclick = e => {
        const m = e.target.closest('.mole'); if (!m || !m.classList.contains('up')) return;
        m.dataset.t = ''; api.sfx('whack');
        if (m.dataset.v === cur().a) {
          score++; m.classList.add('hit'); api.sfx('correct'); qi++; api.later(setQ, 350);
        } else { score = Math.max(0, score - 1); m.classList.add('miss'); api.sfx('wrong'); api.later(() => m.classList.remove('up'), 300); }
        api.hud({ score });
      };
      setQ(); api.every(spawn, 750);
      api.every(() => { left--; api.hud({ countdown: left }); if (left <= 0) api.finish(score, null, { unit: '分', detail: `共打中 ${qi} 隻正確地鼠` }); }, 1000);
    },
  },

  /* 7. 氣球爆破 */
  balloon: {
    name: '氣球爆破', glyph: '球', hue: 330, desc: '戳破寫著正確答案的氣球，戳錯會少一條命。',
    run(st, api) {
      const items = api.items; let qi = 0, score = 0, lives = 3, balloons = [], spawnT = 0, sinceRight = 0;
      st.innerHTML = `<div class="balloons"><div class="qtext" id="bq"></div><div class="sky" id="sky"></div></div>`;
      const sky = $('#sky');
      const setQ = () => {
        if (qi >= items.length) return api.finish(score, items.length);
        $('#bq').textContent = items[qi].q; api.hud({ progress: `${qi + 1} / ${items.length}`, score, lives, maxLives: 3 });
      };
      const pop = (b, cls) => { b.el.classList.add('popped'); if (cls) b.el.classList.add(cls); b.dead = true; setTimeout(() => b.el.remove(), 400); };
      sky.onclick = e => {
        const el = e.target.closest('.balloon'); const b = balloons.find(x => x.el === el); if (!b || b.dead) return;
        api.sfx('pop');
        if (b.text === items[qi].a) {
          pop(b, 'ok'); score++; api.sfx('correct'); qi++;
          balloons.filter(x => !x.dead).forEach(x => pop(x)); balloons = []; setQ();
        } else {
          pop(b, 'bad'); lives--; api.sfx('wrong'); api.hud({ lives });
          if (lives <= 0) api.later(() => api.finish(score, items.length), 500);
        }
      };
      api.frame(dt => {
        if (qi >= items.length || lives <= 0) return false;
        spawnT -= dt;
        const H = sky.clientHeight, W = sky.clientWidth;
        if (spawnT <= 0) {
          spawnT = 1.15; const it = items[qi];
          const right = sinceRight >= 2 || Math.random() < 0.35; sinceRight = right ? 0 : sinceRight + 1;
          const text = right ? it.a : it.w[Math.random() * it.w.length | 0];
          const el = document.createElement('button'); el.className = 'balloon';
          el.style.setProperty('--h', [8, 45, 150, 200, 280, 330][Math.random() * 6 | 0]);
          el.innerHTML = `<span>${esc(text)}</span>`;
          const x = 8 + Math.random() * Math.max(10, W - 140);
          el.style.left = x + 'px'; sky.appendChild(el);
          balloons.push({ el, text, y: H + 10, v: 55 + Math.random() * 30 + qi * 3, sway: Math.random() * 6 });
        }
        balloons.forEach(b => {
          if (b.dead) return; b.y -= b.v * dt; b.sway += dt * 2;
          b.el.style.transform = `translate(${Math.sin(b.sway) * 8}px, ${b.y}px)`;
          if (b.y < -150) { b.dead = true; b.el.remove(); }
        });
        balloons = balloons.filter(b => !b.dead || b.el.isConnected);
      });
      setQ();
    },
  },

  /* 8. 是非判斷 */
  truefalse: {
    name: '是非判斷', glyph: '是', hue: 120, desc: '題目配上一個答案，判斷對還是錯，越來越快！',
    run(st, api) {
      const list = api.items.map(it => { const t = Math.random() < 0.5 || !it.w.length; return { q: it.q, show: t ? it.a : it.w[0], truth: t, a: it.a }; });
      let i = 0, score = 0, tmr = null;
      const show = () => {
        if (i >= list.length) return api.finish(score, list.length);
        const s = list[i], limit = Math.max(3, 7 - i * 0.3); let left = limit, done = false;
        api.hud({ progress: `${i + 1} / ${list.length}`, score });
        st.innerHTML = `<div class="tf"><div class="tf-bar"><i id="tf-bar"></i></div>
          <div class="qtext">${esc(s.q)}</div><div class="tf-ans">答案：<b>${esc(s.show)}</b></div>
          <div class="tf-btns"><button class="tf-yes" data-v="1">對 <small>←</small></button><button class="tf-no" data-v="0">錯 <small>→</small></button></div>
          <p class="tf-msg" id="tf-msg"></p></div>`;
        const answer = v => {
          if (done) return; done = true; clearInterval(tmr);
          const ok = v === s.truth;
          if (ok) score++;
          api.sfx(ok ? 'correct' : 'wrong'); api.hud({ score });
          $('#tf-msg').innerHTML = v == null ? `時間到！正確答案是 <b>${esc(s.a)}</b>` : ok ? '答對了！' : `答錯了，正確答案是 <b>${esc(s.a)}</b>`;
          $('#tf-msg').className = 'tf-msg ' + (ok ? 'ok' : 'bad');
          api.later(() => { i++; show(); }, ok ? 650 : 1600);
        };
        $$('.tf-btns button', st).forEach(b => b.onclick = () => answer(b.dataset.v === '1'));
        tmr = api.every(() => { if (done) return; left -= 0.05; $('#tf-bar').style.width = Math.max(0, left / limit * 100) + '%'; if (left <= 0) answer(null); }, 50);
        st.answer = answer;
      };
      api.on(document, 'keydown', e => {
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'o') st.answer?.(true);
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'x') st.answer?.(false);
      });
      show();
    },
  },

  /* 9. 隨機轉盤 */
  wheel: {
    name: '隨機轉盤', glyph: '轉', hue: 260, desc: '轉動轉盤隨機抽題，全班一起回答。', teacher: true,
    run(st, api) {
      let pool = api.items.slice(0, 20), rot = 0, spinning = false, removeDrawn = true, lastIdx = -1;
      st.innerHTML = `<div class="wheel"><div class="wheel-box"><canvas id="wc"></canvas><div class="pointer"></div>
          <button class="btn primary spin" id="spin">轉！</button></div>
        <div class="wheel-side"><div class="wcard" id="wcard"><p class="muted">按「轉！」抽一題。</p></div>
          <label class="check"><input type="checkbox" id="wrm" checked> 抽過的題目從轉盤移除</label>
          <button class="btn ghost" id="wrefill">把題目全部放回</button></div></div>`;
      const cv = $('#wc'), size = Math.min(440, st.clientWidth - 32);
      const g = setupCanvas(cv, size, size), R = size / 2;
      const draw = () => {
        g.clearRect(0, 0, size, size);
        if (!pool.length) { g.fillStyle = css('--line'); g.beginPath(); g.arc(R, R, R - 4, 0, 7); g.fill(); g.fillStyle = css('--ink'); g.font = `600 18px ${FONT}`; g.textAlign = 'center'; g.fillText('題目抽完了', R, R); return; }
        const seg = Math.PI * 2 / pool.length;
        pool.forEach((it, i) => {
          g.beginPath(); g.moveTo(R, R); g.arc(R, R, R - 4, rot + i * seg, rot + (i + 1) * seg); g.closePath();
          g.fillStyle = `hsl(${(i * 47) % 360} 70% ${i % 2 ? 60 : 52}%)`; g.fill();
          g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
          g.save(); g.translate(R, R); g.rotate(rot + (i + 0.5) * seg); g.textAlign = 'right'; g.fillStyle = '#fff';
          const label = `${api.items.indexOf(it) + 1}. ${it.q.length > 9 ? it.q.slice(0, 9) + '…' : it.q}`;
          fitText(g, label, R - 50, pool.length > 12 ? 12 : 15, FONT); g.fillText(label, R - 16, 5); g.restore();
        });
        g.beginPath(); g.arc(R, R, 34, 0, 7); g.fillStyle = css('--card'); g.fill();
      };
      const idxAt = () => { const seg = Math.PI * 2 / pool.length; let a = (-Math.PI / 2 - rot) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return Math.floor(a / seg); };
      $('#spin').onclick = () => {
        if (spinning || !pool.length) return; spinning = true; api.sfx('whoosh');
        const start = rot, total = Math.PI * 2 * (4 + Math.random() * 2) + Math.random() * Math.PI * 2, dur = 3800, t0 = performance.now();
        api.frame(() => {
          const t = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - t, 3);
          rot = start + total * e; draw();
          const k = idxAt(); if (k !== lastIdx) { lastIdx = k; api.sfx('tick'); }
          if (t >= 1) { spinning = false; reveal(k); return false; }
        });
      };
      const reveal = k => {
        const it = pool[k]; api.sfx('select');
        $('#wcard').innerHTML = `<div class="wnum">第 ${api.items.indexOf(it) + 1} 題</div><div class="qtext">${esc(it.q)}</div>
          <button class="btn" id="wshow">顯示答案</button><div class="wans" id="wans" hidden>${esc(it.a)}</div>`;
        $('#wshow').onclick = () => { $('#wans').hidden = false; $('#wshow').hidden = true; api.sfx('correct'); };
        if ($('#wrm').checked) { pool.splice(k, 1); draw(); }
      };
      $('#wrefill').onclick = () => { pool = api.items.slice(0, 20); draw(); api.sfx('click'); };
      draw();
    },
  },

  /* 10. 開箱子 */
  openbox: {
    name: '開箱子', glyph: '箱', hue: 35, desc: '選一個箱子打開，裡面藏著一道題目。',
    run(st, api) {
      const items = api.items.slice(0, 16); let opened = 0, score = 0;
      st.innerHTML = `<div class="boxes">${items.map((_, i) => `<button class="box" data-i="${i}"><span class="lid"></span><span class="n">${i + 1}</span></button>`).join('')}</div><div class="box-modal" id="bm" hidden></div>`;
      api.hud({ progress: `0 / ${items.length}`, score });
      st.onclick = e => {
        const b = e.target.closest('.box'); if (!b || b.classList.contains('done')) return;
        const it = items[b.dataset.i], os = opts4(it), m = $('#bm');
        api.sfx('flip'); b.classList.add('opening');
        m.hidden = false;
        m.innerHTML = `<div class="panel"><div class="wnum">箱子 ${+b.dataset.i + 1}</div><div class="qtext">${esc(it.q)}</div>${optButtons(os)}</div>`;
        $$('.opt', m).forEach(o => o.onclick = () => {
          const ok = os[o.dataset.k] === it.a;
          $$('.opt', m).forEach(x => { x.disabled = true; if (os[x.dataset.k] === it.a) x.classList.add('ok'); });
          if (!ok) o.classList.add('bad');
          api.sfx(ok ? 'correct' : 'wrong'); if (ok) score++; opened++;
          b.classList.remove('opening'); b.classList.add('done', ok ? 'ok' : 'bad');
          b.innerHTML = `<span class="n">${ok ? '○' : '×'}</span><small>${esc(it.a)}</small>`;
          api.hud({ progress: `${opened} / ${items.length}`, score });
          api.later(() => { m.hidden = true; if (opened === items.length) api.finish(score, items.length); }, ok ? 800 : 1500);
        });
      };
    },
  },

  /* 11. 閃卡 */
  flashcards: {
    name: '閃卡', glyph: '卡', hue: 190, desc: '看題目先想答案，翻面對照，再標記會不會。',
    run(st, api) {
      const queue = [...api.items], total = queue.length, seen = new Set(); let known = 0, flipped = false;
      const show = () => {
        if (!queue.length) return api.finish(known, total, { detail: '第一次就會的題數' });
        const it = queue[0]; flipped = false;
        api.hud({ progress: `剩 ${queue.length} 張`, score: known });
        st.innerHTML = `<div class="flash"><button class="fcard" id="fc"><span class="ff">${esc(it.q)}<small>點一下翻面（空白鍵）</small></span><span class="fb">${esc(it.a)}</span></button>
          <div class="row center"><button class="btn" data-r="again">還不熟 <small>←</small></button><button class="btn primary" data-r="ok">我會了 <small>→</small></button></div></div>`;
        $('#fc').onclick = flip;
        $$('[data-r]', st).forEach(b => b.onclick = () => rate(b.dataset.r === 'ok'));
      };
      const flip = () => { flipped = !flipped; $('#fc').classList.toggle('flipped', flipped); api.sfx('flip'); };
      const rate = ok => {
        const it = queue.shift();
        if (ok) { if (!seen.has(it)) known++; api.sfx('correct'); }
        else { seen.add(it); queue.splice(Math.min(queue.length, 3), 0, it); api.sfx('click'); }
        show();
      };
      api.on(document, 'keydown', e => {
        if (e.code === 'Space') { e.preventDefault(); flip(); }
        if (e.key === 'ArrowRight') rate(true);
        if (e.key === 'ArrowLeft') rate(false);
      });
      show();
    },
  },

  /* 12. 翻轉方塊 */
  fliptiles: {
    name: '翻轉方塊', glyph: '磚', hue: 170, desc: '一整面方塊，點一下翻出答案，適合上課複習。', teacher: true,
    run(st, api) {
      st.innerHTML = `<div class="row center"><button class="btn ghost" id="ft-reset">全部翻回</button><button class="btn ghost" id="ft-mix">重新洗牌</button></div>
        <div class="ftiles" id="ft"></div>`;
      const draw = () => { $('#ft').innerHTML = shuffle(api.items).map(it => `<button class="ftile"><span class="ff">${esc(it.q)}</span><span class="fb">${esc(it.a)}</span></button>`).join(''); };
      $('#ft').onclick = e => { const t = e.target.closest('.ftile'); if (t) { t.classList.toggle('flipped'); api.sfx('flip'); } };
      $('#ft-reset').onclick = () => { $$('.ftile', st).forEach(t => t.classList.remove('flipped')); api.sfx('click'); };
      $('#ft-mix').onclick = () => { draw(); api.sfx('spin'); };
      draw();
    },
  },

  /* 13. 分類 */
  groupsort: {
    name: '分類', glyph: '類', hue: 95, desc: '把每張卡片放進正確的類別。',
    run(st, api) {
      const { data, auto } = api.groups, names = Object.keys(data);
      const cards = shuffle(names.flatMap(n => data[n].map(t => ({ t, n }))));
      const placed = Object.fromEntries(names.map(n => [n, []]));
      let i = 0, score = 0, miss = false;
      const draw = () => {
        if (i >= cards.length) return api.finish(score, cards.length);
        api.hud({ progress: `${i + 1} / ${cards.length}`, score });
        st.innerHTML = `<div class="sort">${auto ? '<p class="hint-line">這個單元沒有分類題組，改為判斷敘述正確或錯誤。</p>' : ''}
          <div class="sort-card" id="sc">${esc(cards[i].t)}</div>
          <div class="bins cols-${Math.min(names.length, 4)}">${names.map(n => `<button class="bin" data-n="${esc(n)}"><b>${esc(n)}</b><span class="bin-items">${placed[n].map(t => `<i>${esc(t)}</i>`).join('')}</span></button>`).join('')}</div></div>`;
      };
      st.onclick = e => {
        const b = e.target.closest('.bin'); if (!b) return;
        const c = cards[i];
        if (b.dataset.n === c.n) {
          if (!miss) score++; miss = false; placed[c.n].push(c.t); i++; api.sfx('correct'); draw();
        } else {
          miss = true; api.sfx('wrong'); const sc = $('#sc'); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
        }
      };
      draw();
    },
  },

  /* 14. 迷宮追逐 */
  maze: {
    name: '迷宮追逐', glyph: '迷', hue: 220, desc: '躲開怪物，跑進正確答案的房間。方向鍵或螢幕按鈕移動。',
    run(st, api) {
      const MAP = [
        '###############',
        '#A....#.#....B#',
        '#.###.#.#.###.#',
        '#.............#',
        '#.##.#####.##.#',
        '#....#...#....#',
        '#.##.##.##.##.#',
        '#.............#',
        '#.###.#.#.###.#',
        '#C....#.#....D#',
        '###############'];
      const W = MAP[0].length, H = MAP.length, items = api.items;
      let qi = 0, score = 0, lives = 3, os = [], player, ghosts, dir = null, want = null, pause = 0, tick = 0, msg = '';
      st.innerHTML = `<div class="maze"><div class="maze-q"><div class="qtext" id="mq"></div><div class="maze-opts" id="mo"></div></div>
        <div class="maze-board"><canvas id="mc"></canvas><div class="maze-msg" id="mm" hidden></div></div>
        <div class="dpad"><button data-d="u" aria-label="上">▲</button><button data-d="l" aria-label="左">◀</button><button data-d="d" aria-label="下">▼</button><button data-d="r" aria-label="右">▶</button></div></div>`;
      const cell = Math.floor(Math.min(560, st.clientWidth - 8) / W);
      const g = setupCanvas($('#mc'), cell * W, cell * H);
      const D = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
      const wall = (x, y) => MAP[y]?.[x] === '#' || MAP[y]?.[x] == null;
      const reset = () => { player = { x: 7, y: 5 }; ghosts = [{ x: 1, y: 5, d: 'u' }, { x: 13, y: 5, d: 'd' }]; dir = want = null; };
      const say = (t, ms = 1100) => { const m = $('#mm'); m.hidden = false; m.innerHTML = t; pause = ms; };
      const newQ = () => {
        if (qi >= items.length || lives <= 0) return api.finish(score, items.length);
        const it = items[qi]; os = opts4(it);
        $('#mq').textContent = it.q;
        $('#mo').innerHTML = os.map((o, k) => `<span><b>${KEYS[k]}</b>${esc(o)}</span>`).join('');
        api.hud({ progress: `${qi + 1} / ${items.length}`, score, lives, maxLives: 3 });
        reset(); say('準備…', 800);
      };
      const hurt = (text, skip = true) => { lives--; api.sfx('wrong'); api.hud({ lives }); if (skip) qi++; say(text, 1500); api.later(newQ, 1500); pause = 99999; };
      const step = () => {
        if (pause > 0) { pause -= 120; if (pause <= 0) $('#mm').hidden = true; return; }
        tick++;
        if (want) { const [dx, dy] = D[want]; if (!wall(player.x + dx, player.y + dy)) dir = want; }
        if (dir) { const [dx, dy] = D[dir]; if (!wall(player.x + dx, player.y + dy)) { player.x += dx; player.y += dy; } }
        const z = MAP[player.y][player.x];
        if ('ABCD'.includes(z)) {
          const k = 'ABCD'.indexOf(z), it = items[qi];
          if (os[k] === it.a) { score++; api.sfx('correct'); api.hud({ score }); qi++; say('答對了！', 900); api.later(newQ, 900); pause = 99999; }
          else hurt(`答錯了！正確答案是 <b>${esc(it.a)}</b>`);
          return;
        }
        if (tick % 2 === 0 || qi > 5) ghosts.forEach(gh => {
          const back = { u: 'd', d: 'u', l: 'r', r: 'l' }[gh.d];
          let opts = Object.keys(D).filter(k => { const [dx, dy] = D[k]; const c = MAP[gh.y + dy]?.[gh.x + dx]; return c === '.'; });
          if (opts.length > 1) opts = opts.filter(k => k !== back);
          const chase = Math.random() < 0.6;
          gh.d = chase ? opts.sort((a, b) => dist(gh, a) - dist(gh, b))[0] : opts[Math.random() * opts.length | 0];
          if (gh.d) { gh.x += D[gh.d][0]; gh.y += D[gh.d][1]; }
        });
        if (ghosts.some(gh => gh.x === player.x && gh.y === player.y)) hurt('被怪物抓到了！', false);
      };
      const dist = (gh, k) => Math.abs(gh.x + D[k][0] - player.x) + Math.abs(gh.y + D[k][1] - player.y);
      const draw = () => {
        const ink = css('--ink'), card = css('--card'), wallC = css('--blue');
        g.fillStyle = card; g.fillRect(0, 0, cell * W, cell * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const c = MAP[y][x];
          if (c === '#') { g.fillStyle = wallC; g.globalAlpha = 0.85; g.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2); g.globalAlpha = 1; }
          if ('ABCD'.includes(c)) {
            g.fillStyle = `hsl(${[8, 45, 150, 280]['ABCD'.indexOf(c)]} 75% 55%)`; g.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
            g.fillStyle = '#fff'; g.font = `700 ${cell * 0.6}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c, x * cell + cell / 2, y * cell + cell / 2 + 1);
          }
        }
        ghosts?.forEach((gh, i) => {
          const cx = gh.x * cell + cell / 2, cy = gh.y * cell + cell / 2, r = cell * 0.38;
          g.fillStyle = i ? '#8b5cf6' : '#ef4444';
          g.beginPath(); g.arc(cx, cy - r * 0.2, r, Math.PI, 0); g.lineTo(cx + r, cy + r * 0.8); g.lineTo(cx - r, cy + r * 0.8); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.25, r * 0.22, 0, 7); g.arc(cx + r * 0.35, cy - r * 0.25, r * 0.22, 0, 7); g.fill();
        });
        if (player) {
          const cx = player.x * cell + cell / 2, cy = player.y * cell + cell / 2, mouth = 0.25 + Math.abs(Math.sin(performance.now() / 120)) * 0.35;
          const ang = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }[dir || 'r'];
          g.fillStyle = '#facc15'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, cell * 0.4, ang + mouth, ang + Math.PI * 2 - mouth); g.closePath(); g.fill();
          g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
        }
      };
      const keymap = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' };
      api.on(document, 'keydown', e => { const k = keymap[e.key] || keymap[e.key.toLowerCase?.()]; if (k) { e.preventDefault(); want = k; } });
      $$('.dpad button', st).forEach(b => b.onpointerdown = e => { e.preventDefault(); want = b.dataset.d; api.sfx('tick'); });
      api.every(step, 120); api.frame(() => draw());
      newQ();
    },
  },

  /* 15. 飛機 */
  airplane: {
    name: '飛機', glyph: '飛', hue: 205, desc: '駕駛飛機撞向正確答案的雲，避開錯的。↑↓ 或點畫面上下移動。',
    run(st, api) {
      const items = api.items; let qi = 0, score = 0, lives = 3, lane = 1.5, target = 1, wave = null, stars = [];
      st.innerHTML = `<div class="air"><div class="qtext" id="aq"></div><div class="air-board" id="ab"><canvas id="ac"></canvas></div>
        <div class="row center"><button class="btn" data-m="-1">▲ 往上</button><button class="btn" data-m="1">▼ 往下</button></div></div>`;
      const Wd = Math.min(760, st.clientWidth - 8), Hd = Math.round(Math.min(380, Wd * 0.6));
      const g = setupCanvas($('#ac'), Wd, Hd), laneY = l => Hd * (l + 0.5) / 4;
      for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * Wd, y: Math.random() * Hd, s: 0.3 + Math.random() });
      const newWave = () => {
        if (qi >= items.length || lives <= 0) return api.finish(score, items.length);
        const it = items[qi], os = opts4(it);
        $('#aq').textContent = it.q;
        api.hud({ progress: `${qi + 1} / ${items.length}`, score, lives, maxLives: 3 });
        wave = { x: Wd + 80, v: Math.min(170, 70 + qi * 6), os, a: it.a, hit: null };
      };
      const move = d => { target = Math.max(0, Math.min(3, target + d)); api.sfx('tick'); };
      api.on(document, 'keydown', e => { if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); move(-1); } if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); move(1); } });
      $$('[data-m]', st).forEach(b => b.onclick = () => move(+b.dataset.m));
      $('#ac').onpointerdown = e => { const r = e.target.getBoundingClientRect(); target = Math.max(0, Math.min(3, Math.floor((e.clientY - r.top) / (r.height / 4)))); api.sfx('tick'); };
      const PX = 70;
      api.frame(dt => {
        lane += (target - lane) * Math.min(1, dt * 10);
        g.fillStyle = css('--sky'); g.fillRect(0, 0, Wd, Hd);
        g.fillStyle = css('--sky-dot');
        stars.forEach(s => { s.x -= s.s * 60 * dt; if (s.x < 0) s.x = Wd; g.fillRect(s.x, s.y, 2 * s.s, 2 * s.s); });
        if (wave) {
          wave.x -= wave.v * dt;
          wave.os.forEach((o, k) => {
            if (wave.hit && wave.hit.k === k) return;
            const y = laneY(k), w = Math.min(190, Wd * 0.3), h = Hd / 4 - 14;
            g.fillStyle = css('--cloud'); g.beginPath(); g.roundRect(wave.x - w / 2, y - h / 2, w, h, h / 2); g.fill();
            g.fillStyle = css('--ink'); g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, o, w - 20, 18, FONT); g.fillText(o, wave.x, y + 1);
          });
          if (!wave.hit && wave.x - Math.min(95, Wd * 0.15) < PX + 30) {
            const k = Math.round(lane), ok = wave.os[k] === wave.a; wave.hit = { k, ok };
            if (ok) { score++; api.sfx('correct'); } else { lives--; api.sfx('wrong'); $('#aq').innerHTML = `${esc(items[qi].q)}<small class="bad-text">正確答案：${esc(wave.a)}</small>`; }
            api.hud({ score, lives });
          }
          if (wave.x < -120) { qi++; wave = null; newWave(); }
        }
        const y = laneY(lane);
        g.save(); g.translate(PX, y);
        g.fillStyle = css('--red'); g.beginPath(); g.moveTo(34, 0); g.lineTo(-22, -12); g.lineTo(-28, 0); g.lineTo(-22, 12); g.closePath(); g.fill();
        g.fillStyle = css('--blue'); g.beginPath(); g.moveTo(4, 0); g.lineTo(-12, -26); g.lineTo(-20, -26); g.lineTo(-12, 0); g.lineTo(-20, 26); g.lineTo(-12, 26); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(16, -2, 5, 0, 7); g.fill();
        g.restore();
        if (wave?.hit) { g.fillStyle = wave.hit.ok ? css('--green') : css('--red'); g.font = `700 22px ${FONT}`; g.textAlign = 'left'; g.fillText(wave.hit.ok ? '答對！' : '撞錯了！', PX + 40, y - 24); }
      });
      newWave();
    },
  },

  /* 16. 重組答案 */
  anagram: {
    name: '重組答案', glyph: '組', hue: 300, desc: '答案被打散了，依序點選把它拼回來。',
    run(st, api) {
      const tokens = s => Array.from(s.replace(/\s+/g, ''));
      let list = api.items.filter(it => { const n = tokens(it.a).length; return n >= 2 && n <= 12; });
      if (list.length < 3) list = api.items.slice(0, 10);
      let i = 0, score = 0;
      const show = () => {
        if (i >= list.length) return api.finish(score, list.length);
        const it = list[i], ans = tokens(it.a); let pool = shuffle(ans.map((c, k) => ({ c, k }))), tries = 0;
        while (pool.map(p => p.c).join('') === ans.join('') && ans.length > 1 && tries++ < 10) pool = shuffle(pool);
        const slots = []; let hinted = false, locked = false;
        api.hud({ progress: `${i + 1} / ${list.length}`, score });
        const draw = () => {
          const used = new Set(slots.map(s => s.k));
          st.innerHTML = `<div class="ana"><div class="qtext">${esc(it.q)}</div>
            <div class="ana-slots" id="as">${ans.map((_, k) => `<button class="aslot ${slots[k] ? 'filled' : ''}" data-s="${k}">${slots[k] ? esc(slots[k].c) : ''}</button>`).join('')}</div>
            <div class="ana-pool">${pool.map(p => `<button class="atile" data-k="${p.k}" ${used.has(p.k) ? 'disabled' : ''}>${esc(p.c)}</button>`).join('')}</div>
            <div class="row center"><button class="btn ghost" data-hint>提示一個字</button><button class="btn ghost" data-skip>跳過</button></div></div>`;
        };
        const check = () => {
          if (slots.length < ans.length) return;
          locked = true;
          const ok = slots.map(s => s.c).join('') === ans.join('');
          $('#as').classList.add(ok ? 'ok' : 'shake');
          api.sfx(ok ? 'correct' : 'wrong');
          if (ok) { if (!hinted) score++; api.later(() => { i++; show(); }, 900); }
          else api.later(() => { slots.length = 0; locked = false; draw(); }, 700);
        };
        st.onclick = e => {
          if (locked) return;
          const t = e.target.closest('.atile'), s = e.target.closest('.aslot');
          if (t && !t.disabled) { const p = pool.find(x => x.k == t.dataset.k); slots.push(p); api.sfx('click'); draw(); check(); }
          else if (s && slots[s.dataset.s]) { slots.splice(+s.dataset.s); api.sfx('click'); draw(); }
          else if (e.target.closest('[data-hint]')) {
            hinted = true;
            let n = 0; while (n < slots.length && slots[n].c === ans[n]) n++;
            slots.length = n;
            const used = new Set(slots.map(x => x.k));
            const p = pool.find(x => x.c === ans[n] && !used.has(x.k)); if (p) slots.push(p);
            api.sfx('select'); draw(); check();
          } else if (e.target.closest('[data-skip]')) { api.sfx('whoosh'); i++; show(); }
        };
        draw();
      };
      show();
    },
  },

  /* 17. 輸入答案 */
  typeanswer: {
    name: '輸入答案', glyph: '寫', hue: 0, desc: '自己打出答案，最能檢驗是否真的會。',
    run(st, api) {
      const items = api.items; let i = 0, score = 0;
      const norm = s => {
        let t = String(s).normalize('NFKC').replace(/\s+/g, '').replace(/[−–—]/g, '-').replace(/\*/g, '×').replace(/\^/g, '').replace(/[，、]/g, ',').replace(/°/g, '').replace(/^[a-z]=/, '').toLowerCase();
        if (/\d/.test(t)) t = t.replace(/[一-鿿（）]/g, '');
        return t;
      };
      const SYM = ['−', '×', '÷', '/', '√', '²', '³', 'π', '±', '°', '(', ')', ':', '<', '>', '≤', '≥', 'x', 'y'];
      const show = () => {
        if (i >= items.length) return api.finish(score, items.length);
        const it = items[i];
        api.hud({ progress: `${i + 1} / ${items.length}`, score });
        st.innerHTML = `<div class="type"><div class="qtext">${esc(it.q)}</div>
          <form id="tf" class="type-form"><input id="ta" autocomplete="off" placeholder="在這裡輸入答案" aria-label="答案"><button class="btn primary">送出</button></form>
          <div class="sym">${SYM.map(s => `<button type="button" data-y="${esc(s)}">${esc(s)}</button>`).join('')}</div>
          <p class="type-msg" id="tm">提示：答案有 ${Array.from(it.a.replace(/\s/g, '')).length} 個字元</p></div>`;
        const inp = $('#ta'); inp.focus();
        $$('.sym button', st).forEach(b => b.onclick = () => {
          const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.y + inp.value.slice(inp.selectionEnd ?? s);
          inp.focus(); inp.setSelectionRange(s + b.dataset.y.length, s + b.dataset.y.length); api.sfx('click');
        });
        let done = false;
        $('#tf').onsubmit = e => {
          e.preventDefault(); if (done || !inp.value.trim()) return; done = true;
          const ok = norm(inp.value) === norm(it.a);
          if (ok) score++;
          api.sfx(ok ? 'correct' : 'wrong'); api.hud({ score });
          inp.classList.add(ok ? 'ok' : 'bad'); inp.readOnly = true;
          $('#tm').innerHTML = ok ? '答對了！' : `正確答案是 <b>${esc(it.a)}</b>`;
          $('#tm').className = 'type-msg ' + (ok ? 'ok' : 'bad');
          api.later(() => { i++; show(); }, ok ? 800 : 2000);
        };
      };
      show();
    },
  },
};
