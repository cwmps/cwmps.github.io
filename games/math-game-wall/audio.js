// 音效與背景音樂：全部用 Web Audio 即時合成，不需要外部音檔
const Sound = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const state = {
    sfx: store('mw:sfx') !== '0',
    music: store('mw:music') !== '0',
  };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    return true;
  }

  // 一個音符：type 波形、f 頻率、t 開始時間、d 長度、v 音量、bus 輸出
  function tone(f, t, d, { type = 'square', v = 0.3, bus = sfxBus, slide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(t, d, v = 0.2, hp = 1000) {
    const len = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
  }

  const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI 音高轉頻率

  const effects = {
    click: t => tone(880, t, 0.05, { type: 'triangle', v: 0.25 }),
    select: t => tone(660, t, 0.07, { type: 'triangle', v: 0.25, slide: 1.3 }),
    correct: t => { tone(N(76), t, 0.1, { v: 0.22 }); tone(N(83), t + 0.09, 0.18, { v: 0.22 }); },
    wrong: t => { tone(180, t, 0.22, { type: 'sawtooth', v: 0.2, slide: 0.6 }); tone(120, t + 0.12, 0.25, { type: 'square', v: 0.12 }); },
    flip: t => { noise(t, 0.08, 0.12, 2500); tone(500, t, 0.08, { type: 'sine', v: 0.15, slide: 1.8 }); },
    pop: t => { noise(t, 0.12, 0.3, 800); tone(1200, t, 0.08, { type: 'sine', v: 0.2, slide: 0.4 }); },
    whack: t => { noise(t, 0.06, 0.35, 300); tone(220, t, 0.12, { type: 'square', v: 0.2, slide: 0.5 }); },
    tick: t => tone(1500, t, 0.03, { type: 'square', v: 0.08 }),
    spin: t => { for (let i = 0; i < 6; i++) tone(700 + i * 60, t + i * 0.05, 0.04, { type: 'triangle', v: 0.12 }); },
    whoosh: t => noise(t, 0.3, 0.15, 400),
    lose: t => [67, 63, 60].forEach((n, i) => tone(N(n), t + i * 0.16, 0.2, { type: 'triangle', v: 0.25 })),
    win: t => [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.1, i === 5 ? 0.45 : 0.12, { v: 0.2 })),
  };

  function play(name) {
    if (!state.sfx || !ensure() || !effects[name]) return;
    effects[name](ctx.currentTime + 0.005);
  }

  /* ── 背景音樂：小型編曲器，兩種曲風（選單／遊戲）循環播放 ── */
  const TRACKS = {
    menu: {
      bpm: 96,
      chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], // C Am F G
      lead: [0, 2, 1, 2, 0, 2, 1, -1],
      leadType: 'triangle',
    },
    game: {
      bpm: 132,
      chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], // Am F C G
      lead: [0, 1, 2, 1, 2, 3, 2, 1],
      leadType: 'square',
    },
  };
  let mode = 'menu', timer = null, step = 0, nextTime = 0;

  function schedule() {
    const tr = TRACKS[mode], eighth = 60 / tr.bpm / 2;
    while (nextTime < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 8) % tr.chords.length, beat = step % 8, ch = tr.chords[bar];
      if (beat % 4 === 0) tone(N(ch[0] - 24), nextTime, eighth * 3.5, { type: 'triangle', v: 0.5, bus: musicBus });
      if (beat % 2 === 1) tone(N(ch[0] - 12), nextTime, eighth * 0.8, { type: 'triangle', v: 0.25, bus: musicBus });
      const li = tr.lead[beat];
      if (li >= 0) {
        const note = li < 3 ? ch[li] + 12 : ch[0] + 24;
        tone(N(note), nextTime, eighth * 0.9, { type: tr.leadType, v: mode === 'game' ? 0.14 : 0.2, bus: musicBus });
      }
      if (mode === 'game' && beat % 2 === 0) {
        const s = nextTime, len = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = 0.25;
        src.buffer = b; src.connect(f); f.connect(g); g.connect(musicBus); src.start(s);
      }
      nextTime += eighth; step++;
    }
  }
  function startMusic() {
    if (!state.music || !ensure() || timer) return;
    nextTime = ctx.currentTime + 0.05; step = 0;
    timer = setInterval(schedule, 50);
  }
  function stopMusic() { clearInterval(timer); timer = null; }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    if (timer) { stopMusic(); startMusic(); }
  }

  function toggle(kind) {
    state[kind] = !state[kind];
    store('mw:' + kind, state[kind] ? '1' : '0');
    if (kind === 'music') state.music ? startMusic() : stopMusic();
    if (kind === 'sfx' && state.sfx) play('select');
    return state[kind];
  }

  // 瀏覽器規定要使用者先互動才能出聲，所以第一次點擊時才啟動音樂
  function unlock() {
    if (!ensure()) return;
    if (state.music) startMusic();
  }

  return { play, toggle, setMode, unlock, state };
})();
