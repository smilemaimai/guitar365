/* Guitar 365 — 木吉他 365 天課程產生器
 * 每一課：{ day, stage, title, goal, tips[], notes[], bpm, bpb, key, flat, ring, chords[] }
 * notes 事件：
 *   單音 { m, d, s, f }   m = MIDI 音高、d = 拍數、s = 弦 (0=第 6 弦 E … 5=第 1 弦 e)、f = 格數
 *   刷弦 { c, d, u }      c = 和弦物件、u = true 為上刷
 *   休止 { r, d }
 */
(function () {
  const OPEN = [40, 45, 50, 55, 59, 64];
  const SN = ['E', 'A', 'D', 'G', 'B', 'e'];
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const NPC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const FLATKEY = /^(F|Bb|Eb|Ab|Db|Dm|Gm|Cm|Fm)$/;
  const SC = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], minPent: [0, 3, 5, 7, 10], majPent: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10], harmMinor: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10],
  };

  // ---------- 和弦 ----------
  const OPENCH = {
    Em: [0, 2, 2, 0, 0, 0], E: [0, 2, 2, 1, 0, 0], Am: [-1, 0, 2, 2, 1, 0], A: [-1, 0, 2, 2, 2, 0],
    Dm: [-1, -1, 0, 2, 3, 1], D: [-1, -1, 0, 2, 3, 2], C: [-1, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3],
    E7: [0, 2, 0, 1, 0, 0], A7: [-1, 0, 2, 0, 2, 0], D7: [-1, -1, 0, 2, 1, 2], G7: [3, 2, 0, 0, 0, 1],
    C7: [-1, 3, 2, 3, 1, 0], B7: [-1, 2, 1, 2, 0, 2],
    Em7: [0, 2, 2, 0, 3, 0], Am7: [-1, 0, 2, 0, 1, 0], Dm7: [-1, -1, 0, 2, 1, 1],
    Cmaj7: [-1, 3, 2, 0, 0, 0], Fmaj7: [-1, -1, 3, 2, 1, 0], Gmaj7: [3, 2, 0, 0, 0, 2], Dmaj7: [-1, -1, 0, 2, 2, 2], Amaj7: [-1, 0, 2, 1, 2, 0],
    Asus4: [-1, 0, 2, 2, 3, 0], Asus2: [-1, 0, 2, 2, 0, 0], Dsus4: [-1, -1, 0, 2, 3, 3], Dsus2: [-1, -1, 0, 2, 3, 0], Esus4: [0, 2, 2, 2, 0, 0],
    Cadd9: [-1, 3, 2, 0, 3, 3], 'D/F#': [2, 0, 0, 2, 3, 2], 'G/B': [-1, 2, 0, 0, 0, 3], 'Am/G': [3, 0, 2, 2, 1, 0],
    E5: [0, 2, 2, -1, -1, -1], A5: [-1, 0, 2, 2, -1, -1], D5: [-1, -1, 0, 2, 3, -1],
  };
  const SMALL_F = [-1, -1, 3, 2, 1, 1];
  const BIG_G = [3, 2, 0, 0, 3, 3];
  const ESH = { '': n => [n, n + 2, n + 2, n + 1, n, n], m: n => [n, n + 2, n + 2, n, n, n], '7': n => [n, n + 2, n, n + 1, n, n], m7: n => [n, n + 2, n, n, n, n], sus4: n => [n, n + 2, n + 2, n + 2, n, n], '5': n => [n, n + 2, n + 2, -1, -1, -1] };
  const ASH = { '': n => [-1, n, n + 2, n + 2, n + 2, n], m: n => [-1, n, n + 2, n + 2, n + 1, n], '7': n => [-1, n, n + 2, n, n + 2, n], m7: n => [-1, n, n + 2, n, n + 1, n], maj7: n => [-1, n, n + 2, n + 1, n + 2, n], sus4: n => [-1, n, n + 2, n + 2, n + 3, n], sus2: n => [-1, n, n + 2, n + 2, n, n], '5': n => [-1, n, n + 2, n + 2, -1, -1] };
  function barre(pc, q) {
    const e = (((pc - 4) % 12) + 12) % 12 || 12, a = (((pc - 9) % 12) + 12) % 12 || 12;
    if (ESH[q] && (!ASH[q] || e <= a)) return ESH[q](e);
    return ASH[q](a);
  }
  const chords = {};
  function chord(name, shape) {
    const key = name + (shape ? '|' + shape.join(',') : '');
    if (chords[key]) return chords[key];
    const m = /^([A-G])([#b]?)([^/]*)/.exec(name);
    const rootPc = (NPC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
    shape = shape || OPENCH[name] || barre(rootPc, m[3]);
    const pcs = [...new Set(shape.map((f, s) => f < 0 ? -1 : (OPEN[s] + f) % 12).filter(x => x >= 0))];
    const bass = shape.findIndex(f => f >= 0);
    return (chords[key] = { name, shape, pcs, bass, alt: Math.max(2, bass + 1), rootPc });
  }
  const C = (...names) => names.map(x => Array.isArray(x) ? chord(x[0], x[1]) : chord(x));
  function describe(ch) {
    const num = s => `第 ${6 - s} 弦`;
    const fr = ch.shape.map((f, s) => f > 0 ? `${num(s)}第 ${f} 格` : null).filter(Boolean);
    const mute = ch.shape.map((f, s) => f < 0 ? num(s) : null).filter(Boolean);
    return `按法：${fr.join('、') || '全部空弦'}${mute.length ? `；${mute.join('、')}不彈` : '；六條弦全部刷'}。`;
  }
  const FT = {
    Em: '中指按第 5 弦、無名指按第 4 弦，都在第 2 格。這是最好按的和弦之一',
    Am: '食指第 2 弦第 1 格、中指第 4 弦第 2 格、無名指第 3 弦第 2 格',
    E: '就是 Am 的指型整個往粗弦移一條弦',
    A: '食指、中指、無名指擠在第 2 格（第 4、3、2 弦），也可以用一根食指橫按',
    D: '食指第 3 弦第 2 格、中指第 1 弦第 2 格、無名指第 2 弦第 3 格，像一個小三角形',
    C: '無名指第 5 弦第 3 格、中指第 4 弦第 2 格、食指第 2 弦第 1 格，手指要立起來才不會碰到空弦',
    G: '中指第 6 弦第 3 格、食指第 5 弦第 2 格、無名指（或小指）第 1 弦第 3 格',
    Dm: '食指第 1 弦第 1 格、中指第 3 弦第 2 格、無名指第 2 弦第 3 格',
    E7: '按好 E 和弦後把無名指放開，第 4 弦變成空弦',
    A7: '按好 A 和弦後把中間那根手指放開，第 3 弦變成空弦',
    D7: '像把 D 和弦的三角形上下翻過來：食指第 2 弦第 1 格、中指第 3 弦第 2 格、無名指第 1 弦第 2 格',
    B7: '中指第 5 弦第 2 格、食指第 4 弦第 1 格、無名指第 3 弦第 2 格、小指第 1 弦第 2 格，第 2 弦空弦',
    G7: '按好 G 的低音兩指，第 1 弦改用食指按第 1 格',
    C7: '按好 C 和弦，小指加按第 3 弦第 3 格',
    Fmaj7: '像 C 和弦往細弦移一條：無名指第 4 弦第 3 格、中指第 3 弦第 2 格、食指第 2 弦第 1 格，第 1 弦空弦',
    F: '食指從第 1 格橫按（封閉），其他三指按出 E 和弦的形狀',
    Bm: '食指在第 2 格橫按第 5～1 弦，其他三指按出 Am 的形狀',
    'F#m': '食指在第 2 格橫按六條弦，無名指、小指按第 5、4 弦第 4 格',
    Cadd9: '從 G（第 2、1 弦都按第 3 格）把食指、中指各往細弦移一條弦',
    Cmaj7: '按好 C 和弦後把食指放開',
    Am7: '按好 Am 和弦後把無名指放開',
    Dm7: '食指橫按第 1、2 弦第 1 格，中指第 3 弦第 2 格',
    Em7: 'Em 加上小指（或無名指）按第 2 弦第 3 格',
    Dsus4: 'D 和弦加上小指按第 1 弦第 3 格',
    Dsus2: 'D 和弦把中指放開，第 1 弦變空弦',
    Asus4: 'A 和弦加上小指按第 2 弦第 3 格', Asus2: 'A 和弦把第 2 弦的手指放開',
    Esus4: 'E 和弦加上小指按第 3 弦第 2 格',
    Gmaj7: 'G 和弦的第 1 弦改按第 2 格', Dmaj7: '食指橫按第 3、2、1 弦第 2 格', Amaj7: 'A 和弦的第 3 弦改按第 1 格',
    'D/F#': 'D 和弦加上拇指（或食指）按第 6 弦第 2 格當低音', 'G/B': '只彈 G 和弦的第 5 弦以上，低音是第 5 弦第 2 格的 B',
  };

  // ---------- helpers ----------
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const N = (m, d) => ({ m, d });
  const R = (d) => ({ r: true, d });
  const P = (s, f, d) => ({ m: OPEN[s] + f, d, s, f });
  const S = (c, d, u) => ({ c, d, u: !!u });
  const seq = (ms, d) => ms.map(m => N(m, d));
  const scaleOf = (root, ints, oct = 1) => { const a = []; for (let o = 0; o < oct; o++) ints.forEach(i => a.push(root + 12 * o + i)); a.push(root + 12 * oct); return a; };
  const upDown = (a) => a.concat(a.slice(0, -1).reverse());
  const rep = (arr, n) => { let o = []; for (let i = 0; i < n; i++) o = o.concat(arr.map(x => ({ ...x }))); return o; };
  const names = (chs) => chs.map(x => x.name).join(' → ');

  // 旋律記譜："G3 A3:.5 r:2 |"（音名＋八度，冒號後為拍數，預設 1 拍；E4 = 第 1 弦空弦）
  function mel(str) {
    return str.split(/\s+/).filter(t => t && t !== '|').map(t => {
      const [p, d] = t.split(':'); const dur = d ? +d : 1;
      if (p === 'r') return R(dur);
      const m = /^([A-G])([#b]?)(\d)$/.exec(p);
      return N(12 * (+m[3] + 1) + NPC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), dur);
    });
  }

  // 刷法：D 下刷、U 上刷、B 根音、A 交替低音、- 延長、. 休止（每個字元一格）
  function strum(chs, pat, step) {
    const out = [];
    for (const ch of chs) for (const x of pat) {
      const l = out[out.length - 1];
      if (x === 'D' || x === 'U') out.push(S(ch, step, x === 'U'));
      else if (x === 'B' || x === 'A') { const s = x === 'B' ? ch.bass : ch.alt; out.push(P(s, Math.max(0, ch.shape[s]), step)); }
      else if (x === '-') { if (l) l.d += step; else out.push(R(step)); }
      else if (l && l.r) l.d += step; else out.push(R(step));
    }
    return out;
  }
  // 16 分 / 8 分遮罩：x 的位置依「偶數下、奇數上」自動決定方向
  const mask = (m) => [...m].map((x, i) => x === 'x' ? (i % 2 ? 'U' : 'D') : x === '_' ? '.' : '-').join('');
  // 指彈：p 根音弦、q 交替低音弦、1–6 弦號、- 延長、. 休止
  function arp(chs, pat, step) {
    const out = [];
    for (const ch of chs) for (const x of pat) {
      const l = out[out.length - 1];
      if (x === '-') { if (l) l.d += step; else out.push(R(step)); continue; }
      if (x === '.') { if (l && l.r) l.d += step; else out.push(R(step)); continue; }
      let s = x === 'p' ? ch.bass : x === 'q' ? ch.alt : 6 - (+x);
      if (ch.shape[s] < 0) s = ch.bass;
      out.push(P(s, ch.shape[s], step));
    }
    return out;
  }

  function fill(notes, bpb = 4) {
    const tot = notes.reduce((a, n) => a + n.d, 0);
    const rem = Math.ceil(tot / bpb - 1e-6) * bpb - tot;
    if (rem > 1e-6) notes[notes.length - 1].d += rem;
    return notes;
  }

  // 自動把單音放到 TAB 上（動態規劃，讓左手移動最少）
  function assignTab(notes, opt = {}) {
    const maxF = opt.maxFret ?? 12, minF = opt.minFret ?? 0;
    const idx = [];
    notes.forEach((n, i) => {
      if (n.r || n.c) return;
      while (n.m < 40 + minF) n.m += 12;
      while (n.m > 64 + maxF) n.m -= 12;
      idx.push(i);
    });
    if (!idx.length) return notes;
    const cands = idx.map(i => {
      const n = notes[i];
      if (n.s !== undefined) return [{ s: n.s, f: n.f }];
      const a = [];
      for (let s = 0; s < 6; s++) {
        if (opt.string !== undefined && s !== opt.string) continue;
        const f = n.m - OPEN[s];
        if (f >= minF && f <= maxF) a.push({ s, f });
      }
      if (!a.length) for (let s = 5; s >= 0; s--) { const f = n.m - OPEN[s]; if (f >= 0 && f <= 19) { a.push({ s, f }); break; } }
      return a;
    });
    const base = (p) => (p.f > 12 ? (p.f - 12) * 0.6 : 0) + p.f * 0.03;
    const trans = (a, b) => {
      if (a.f === 0 || b.f === 0) return 0.1 + Math.abs(a.s - b.s) * 0.1;
      const fd = Math.abs(a.f - b.f);
      return (fd > 3 ? fd * 1.0 + 2 : fd * 0.3) + Math.abs(a.s - b.s) * 0.15;
    };
    let cost = cands[0].map(base); const back = [];
    for (let k = 1; k < cands.length; k++) {
      const nc = [], bk = [];
      cands[k].forEach(p => {
        let best = Infinity, bi = 0;
        cands[k - 1].forEach((q, j) => { const v = cost[j] + trans(q, p); if (v < best) { best = v; bi = j; } });
        nc.push(best + base(p)); bk.push(bi);
      });
      cost = nc; back.push(bk);
    }
    let j = cost.indexOf(Math.min(...cost));
    for (let k = cands.length - 1; k >= 0; k--) {
      const p = cands[k][j]; notes[idx[k]].s = p.s; notes[idx[k]].f = p.f;
      if (k > 0) j = back[k - 1][j];
    }
    return notes;
  }

  // ---------- 旋律庫（皆為傳統民謠或公有領域的古典曲） ----------
  const MEL = {
    twinkle: { t: '小星星', k: 'G', s: 'G3 G3 D4 D4 E4 E4 D4:2 | C4 C4 B3 B3 A3 A3 G3:2 | D4 D4 C4 C4 B3 B3 A3:2 | D4 D4 C4 C4 B3 B3 A3:2 | G3 G3 D4 D4 E4 E4 D4:2 | C4 C4 B3 B3 A3 A3 G3:2', g: '第一首曲子！只用到第 3、2、1 弦上剛學過的音。' },
    mary: { t: '瑪莉有隻小綿羊', k: 'G', s: 'B3 A3 G3 A3 | B3 B3 B3:2 | A3 A3 A3:2 | B3 D4 D4:2 | B3 A3 G3 A3 | B3 B3 B3 B3 | A3 A3 B3 A3 | G3:4', g: '只有四個音（G、A、B、D），注意二分音符要撐滿兩拍。' },
    ode: { t: '歡樂頌', k: 'G', s: 'B3 B3 C4 D4 | D4 C4 B3 A3 | G3 G3 A3 B3 | B3:1.5 A3:.5 A3:2 | B3 B3 C4 D4 | D4 C4 B3 A3 | G3 G3 A3 B3 | A3:1.5 G3:.5 G3:2', g: '貝多芬第九號交響曲的主題。注意第 4、8 小節的附點節奏（一拍半＋半拍）。' },
    jacques: { t: '兩隻老虎', k: 'G', s: 'G3 A3 B3 G3 | G3 A3 B3 G3 | B3 C4 D4:2 | B3 C4 D4:2 | D4:.5 E4:.5 D4:.5 C4:.5 B3 G3 | D4:.5 E4:.5 D4:.5 C4:.5 B3 G3 | G3 D3 G3:2 | G3 D3 G3:2', g: '第 5、6 小節出現八分音符，最後兩小節會用到第 4 弦空弦的低音 D。' },
    saints: { t: '聖者進行曲', k: 'G', s: 'r G3 B3 C4 | D4:4 | r G3 B3 C4 | D4:4 | r G3 B3 C4 | D4:2 B3:2 | G3:2 B3:2 | A3:4', g: '每句都從第 2 拍開始（第 1 拍休息），練習「等一拍再進來」。' },
    jingle: { t: 'Jingle Bells', k: 'G', s: 'B3 B3 B3:2 | B3 B3 B3:2 | B3 D4 G3:1.5 A3:.5 | B3:4 | C4 C4 C4:1.5 C4:.5 | C4 B3 B3 B3:.5 B3:.5 | B3 A3 A3 B3 | A3:2 D4:2', g: '副歌的旋律，同音反覆很多，是練右手穩定度的好曲子。' },
    aura: { t: 'Aura Lee', k: 'G', s: 'D3 G3 F#3 G3 | A3 E3 A3:2 | G3 F#3 E3 F#3 | G3:4 | D3 G3 F#3 G3 | A3 E3 A3:2 | G3 F#3 E3 F#3 | G3:4', g: '十九世紀的美國民謠，旋律落在第 4、3 弦，會用到第 4 弦第 4 格的 F#。' },
    susanna: { t: '噢！蘇珊娜', k: 'G', s: 'r:3 G3:.5 A3:.5 | B3 D4 D4:1.5 E4:.5 | D4 B3 G3:1.5 A3:.5 | B3 B3 A3 G3 | A3:3 G3:.5 A3:.5 | B3 D4 D4:1.5 E4:.5 | D4 B3 G3:1.5 A3:.5 | B3 B3 A3 A3 | G3:4', g: '以兩個八分音符的弱起拍開始，全曲是 G 大調五聲音階。' },
    auld: { t: '驪歌（Auld Lang Syne）', k: 'G', s: 'r:3 D3 | G3:1.5 G3:.5 G3 B3 | A3:1.5 G3:.5 A3 B3 | G3:1.5 G3:.5 B3 D4 | E4:3 E4 | D4:1.5 B3:.5 B3 G3 | A3:1.5 G3:.5 A3 B3 | G3:1.5 E3:.5 E3 D3 | G3:4', g: '蘇格蘭民謠。幾乎每小節都有附點節奏，先用嘴巴唱熟再彈。' },
    grace: { t: '奇異恩典', k: 'G', bpb: 3, s: 'r:2 D3 | G3:2 B3:.5 G3:.5 | B3:2 A3 | G3:2 E3 | D3:2 D3 | G3:2 B3:.5 G3:.5 | B3:2 A3 | D4:3 | D4:3', g: '第一首三拍子（3/4）的曲子，數「1 2 3、1 2 3」，重音在每小節第 1 拍。' },
    green: { t: '綠袖子', k: 'Am', bpb: 3, s: 'r:2 A3 | C4:2 D4 | E4:1.5 F4:.5 E4 | D4:2 B3 | G3:1.5 A3:.5 B3 | C4:2 A3 | A3:1.5 G#3:.5 A3 | B3:2 G#3 | E3:2 A3 | C4:2 D4 | E4:1.5 F4:.5 E4 | D4:2 B3 | G3:1.5 A3:.5 B3 | C4:1.5 B3:.5 A3 | G#3:1.5 F#3:.5 G#3 | A3:3', g: '英國古老民謠，小調的三拍子旋律。右手試著用食指、中指交替撥弦。' },
    scar: { t: '史卡博羅市集', k: 'Am', bpb: 3, s: 'A3:2 A3 | E4:2 E4 | B3:1.5 C4:.5 B3 | A3:3 | r E4 G4 | A4:2 G4 | E4 F#4 D4 | E4:3', g: '英國民謠，帶有多利安調式的特殊色彩（F# 那個音）。會用到第 1 弦第 5 格的 A。' },
    jasmine: { t: '茉莉花', k: 'G', s: 'B3 B3:.5 D4:.5 E4:.5 G4:.5 G4:.5 E4:.5 | D4 D4:.5 E4:.5 D4:2 | B3 B3:.5 D4:.5 E4:.5 G4:.5 G4:.5 E4:.5 | D4 D4:.5 E4:.5 D4:2 | D4 D4 D4 B3:.5 D4:.5 | E4 E4 D4:2 | B3 A3:.5 B3:.5 D4 B3:.5 A3:.5 | G3 G3:.5 A3:.5 G3:2', g: '中國民謠，全曲只用五聲音階（G A B D E）。八分音符很多，注意換弦。' },
    minuet: { t: 'G 大調小步舞曲', k: 'G', bpb: 3, s: 'D4 G3:.5 A3:.5 B3:.5 C4:.5 | D4 G3 G3 | E4 C4:.5 D4:.5 E4:.5 F#4:.5 | G4 G3 G3 | C4 D4:.5 C4:.5 B3:.5 A3:.5 | B3 C4:.5 B3:.5 A3:.5 G3:.5 | F#3 G3:.5 A3:.5 B3:.5 G3:.5 | A3:3', g: '巴洛克時期的名曲（Petzold 作，收錄於巴哈的《安娜・瑪德蓮娜筆記本》）。音階式的八分音符跑動。' },
    birthday: { t: '生日快樂歌', k: 'G', bpb: 3, s: 'r:2 D3:.5 D3:.5 | E3 D3 G3 | F#3:2 D3:.5 D3:.5 | E3 D3 A3 | G3:2 D3:.5 D3:.5 | D4 B3 G3 | F#3 E3 C4:.5 C4:.5 | B3 G3 A3 | G3:3', g: '三拍子，弱起拍。學會這首，朋友生日就能派上用場。' },
    elise: { t: '給愛麗絲（主題）', k: 'Am', bpb: 3, s: 'r:2 E4:.5 D#4:.5 | E4:.5 D#4:.5 E4:.5 B3:.5 D4:.5 C4:.5 | A3 r:.5 C3:.5 E3:.5 A3:.5 | B3 r:.5 E3:.5 G#3:.5 B3:.5 | C4 r:.5 E3:.5 E4:.5 D#4:.5 | E4:.5 D#4:.5 E4:.5 B3:.5 D4:.5 C4:.5 | A3 r:.5 C3:.5 E3:.5 A3:.5 | B3 r:.5 E3:.5 C4:.5 B3:.5 | A3:3', g: '貝多芬的名曲。開頭 E–D# 的半音來回（第 1 弦空弦與第 2 弦第 4 格）要彈得平均。' },
  };
  const melody = (id) => () => {
    const M = MEL[id];
    return { title: `旋律：〈${M.t}〉`, goal: M.g, tips: ['先放慢，嘴巴跟著哼旋律', '左手指尖按在琴衍（金屬條）的後方，聲音才乾淨', '彈完一句再看下一句，不要一個音一個音盯著看'], notes: mel(M.s), key: M.k, bpb: M.bpb, tab: { maxFret: 5 } };
  };

  // ---------- 課程模板工廠 ----------
  const know = (name, shape, label) => (c) => {
    const ch = chord(name, shape), shown = label || name;
    const one = fill(ch.shape.map((f, s) => f >= 0 ? P(s, f, 1) : null).filter(Boolean));
    const strums = [S(ch, 4), S(ch, 2), S(ch, 2), S(ch, 1), S(ch, 1), S(ch, 1), S(ch, 1)];
    const tips = [FT[name] || '照著和弦圖把手指放好，指尖立起來', '逐弦撥的時候如果有悶掉的音，檢查是不是指腹碰到了隔壁弦', '按弦的位置靠近琴衍後方，不需要太用力'];
    if (c.pass === 0) return { title: `認識和弦：${shown}`, goal: `${describe(ch)}先一條弦一條弦撥，確認每個音都清楚，再整個刷下去。`, tips, notes: one.concat(strums, [S(ch, 4)]), key: name.replace(/\/.*/, ''), ring: true };
    const eight = strum([ch, ch], 'DUDUDUDU', 0.5);
    return { title: `和弦複習：${shown}`, goal: `再次確認 ${shown} 的按法，這次加上八分音符的下上刷。${describe(ch)}`, tips, notes: strums.concat(eight, [S(ch, 4)]), key: name.replace(/\/.*/, ''), ring: true };
  };
  const change = (a, b, hint) => (c) => {
    const [A, B] = C(a, b);
    const slow = [S(A, 4), S(B, 4), S(A, 4), S(B, 4), S(A, 2), S(A, 2), S(B, 2), S(B, 2), S(A, 2), S(A, 2), S(B, 2), S(B, 2), S(A, 4)];
    const fast = rep(strum([A, B], 'DDDD', 1), 3).concat(strum([A, B, A, B], 'DD', 1), [S(A, 4)]);
    return { title: `換和弦：${A.name} ↔ ${B.name}`, goal: c.pass === 0 ? `在 ${A.name} 和 ${B.name} 之間切換。先每個和弦刷一下、撐 4 拍，再變成每 2 拍刷一下。` : `${A.name} ↔ ${B.name} 加快版：每拍刷一下，最後兩小節每 2 拍就換一次和弦。`, tips: [hint || '找出兩個和弦之間「不用動」或「可以順著滑過去」的手指', '右手不要停下來等左手——寧可左手晚一點到，節奏不能斷', '換之前眼睛先看好下一個和弦要按的位置'], notes: c.pass === 0 ? slow : fast, key: A.name, ring: true };
  };
  const pickProg = (progs, c, off = 0) => { const p = progs[(c.pass + c.si + off) % progs.length]; return { k: p.k, chs: C(...p.ch) }; };
  // 刷法課：progs 輪流使用，pat 為一個和弦的刷法
  const strumL = (title, goal, progs, pat, step, tips, o = {}) => (c) => {
    const { k, chs } = pickProg(progs, c, o.off);
    const body = rep(strum(chs, pat, step), o.rep || 2);
    const tail = o.noEnd ? [] : [S(chs[o.endOn ?? 0], o.bpb || 4)];
    return { title: `${title}（${k}）`, goal: `${goal}和弦進行：${names(chs)}。`, tips, notes: body.concat(tail), key: k, bpb: o.bpb, bpmMul: o.mul, ring: true };
  };
  const arpL = (title, goal, progs, pat, step, tips, o = {}) => (c) => {
    const { k, chs } = pickProg(progs, c, o.off);
    const body = rep(arp(chs, pat, step), o.rep || 2);
    const e = chs[o.endOn ?? 0];
    return { title: `${title}（${k}）`, goal: `${goal}和弦：${names(chs)}。`, tips, notes: body.concat([P(e.bass, e.shape[e.bass], o.bpb || 4)]), key: k, bpb: o.bpb, bpmMul: o.mul, ring: true };
  };
  const scaleL = (label, rootName, root, ints, oct, tab, desc, tips) => (c) => {
    const d = c.pass === 0 ? 1 : 0.5;
    const s = seq(upDown(scaleOf(root, ints, oct)), d);
    return { title: `${rootName} ${label}${c.pass ? '：八分音符' : ''}`, goal: `${desc}${c.pass ? '這次用八分音符，上下行兩次。' : '先用四分音符上行再下行。'}`, tips, notes: c.pass ? rep(s, 2) : s, key: rootName + (label.includes('小調') || label.includes('藍調') ? 'm' : ''), tab };
  };
  const blues12 = (k) => { const m = { A: ['A7', 'D7', 'E7'], E: ['E7', 'A7', 'B7'], G: ['G7', 'C7', 'D7'], D: ['D7', 'G7', 'A7'] }[k]; return [0, 0, 0, 0, 1, 1, 0, 0, 2, 1, 0, 2].map(i => m[i]); };

  const PG = {
    first: [{ k: 'Em', ch: ['Em', 'Am', 'Em', 'Am'] }, { k: 'A', ch: ['A', 'D', 'A', 'E'] }, { k: 'Am', ch: ['Am', 'E', 'Am', 'E'] }],
    five: [{ k: 'A', ch: ['A', 'D', 'E', 'A'] }, { k: 'Em', ch: ['Em', 'Am', 'D', 'Em'] }, { k: 'Am', ch: ['Am', 'D', 'E', 'Am'] }, { k: 'E', ch: ['E', 'A', 'E', 'D'] }],
    eight: [{ k: 'G', ch: ['G', 'D', 'Em', 'C'] }, { k: 'C', ch: ['C', 'Am', 'Dm', 'G'] }, { k: 'G', ch: ['G', 'Em', 'C', 'D'] }, { k: 'Em', ch: ['Em', 'C', 'G', 'D'] }, { k: 'Am', ch: ['Am', 'G', 'C', 'Em'] }],
    waltz: [{ k: 'G', ch: ['G', 'C', 'D', 'G'] }, { k: 'C', ch: ['C', 'Am', 'Dm', 'G'] }, { k: 'Am', ch: ['Am', 'Dm', 'E', 'Am'] }, { k: 'D', ch: ['D', 'G', 'A', 'D'] }],
    resolve: [{ k: 'C', ch: ['G', 'G7', 'C', 'C'] }, { k: 'G', ch: ['D', 'D7', 'G', 'G'] }, { k: 'A', ch: ['E', 'E7', 'A', 'A'] }, { k: 'D', ch: ['A', 'A7', 'D', 'D'] }],
    finger: [{ k: 'Em', ch: ['Em', 'Am', 'Em', 'Am'] }, { k: 'Am', ch: ['Am', 'Dm', 'E', 'Am'] }, { k: 'C', ch: ['C', 'Am', 'Dm', 'G'] }, { k: 'G', ch: ['G', 'Em', 'C', 'D'] }],
    rising: [{ k: 'Am', ch: ['Am', 'C', 'D', 'Fmaj7', 'Am', 'C', 'E', 'E'] }],
    ballad: [{ k: 'C', ch: ['C', 'G', 'Am', 'Em', 'Fmaj7', 'C', 'Fmaj7', 'G'] }],
    popF: [{ k: 'C', ch: ['C', 'G', 'Am', ['F', SMALL_F]] }, { k: 'Am', ch: ['Am', ['F', SMALL_F], 'C', 'G'] }, { k: 'C', ch: ['C', 'Am', ['F', SMALL_F], 'G'] }],
    popD: [{ k: 'D', ch: ['D', 'A', 'Bm', 'G'] }, { k: 'Bm', ch: ['Bm', 'G', 'D', 'A'] }],
    popA: [{ k: 'A', ch: ['A', 'E', 'F#m', 'D'] }, { k: 'F#m', ch: ['F#m', 'D', 'A', 'E'] }],
    canon: [{ k: 'D', ch: ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A'] }],
    pop: [{ k: 'G', ch: ['G', 'D', 'Em', 'C'] }, { k: 'C', ch: ['C', 'G', 'Am', 'F'] }, { k: 'D', ch: ['D', 'A', 'Bm', 'G'] }, { k: 'A', ch: ['A', 'E', 'F#m', 'D'] }, { k: 'E', ch: ['E', 'B', 'C#m', 'A'] }, { k: 'F', ch: ['F', 'C', 'Dm', 'Bb'] }],
    sad: [{ k: 'Em', ch: ['Em', 'C', 'G', 'D'] }, { k: 'Am', ch: ['Am', 'F', 'C', 'G'] }, { k: 'Bm', ch: ['Bm', 'G', 'D', 'A'] }, { k: 'F#m', ch: ['F#m', 'D', 'A', 'E'] }, { k: 'Dm', ch: ['Dm', 'Bb', 'F', 'C'] }],
    fifties: [{ k: 'C', ch: ['C', 'Am', 'F', 'G'] }, { k: 'G', ch: ['G', 'Em', 'C', 'D'] }, { k: 'D', ch: ['D', 'Bm', 'G', 'A'] }, { k: 'A', ch: ['A', 'F#m', 'D', 'E'] }],
    half: [{ k: 'G', ch: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'C'] }, { k: 'C', ch: ['C', 'G', 'Am', 'Em', 'F', 'C', 'G', 'G'] }, { k: 'D', ch: ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'A', 'A'] }],
    sus: [{ k: 'D', ch: ['D', 'Dsus4', 'D', 'Dsus2', 'D', 'Dsus4', 'D', 'Dsus2'] }, { k: 'A', ch: ['A', 'Asus4', 'A', 'Asus2', 'A', 'Asus4', 'A', 'Asus2'] }, { k: 'E', ch: ['E', 'Esus4', 'E', 'Esus4', 'A', 'Asus4', 'A', 'Asus2'] }],
    add9: [{ k: 'G', ch: [['G', BIG_G], 'Cadd9', 'Em7', 'Dsus4'] }, { k: 'Em', ch: ['Em7', 'Cadd9', ['G', BIG_G], 'Dsus4'] }],
    maj7: [{ k: 'C', ch: ['Cmaj7', 'Am7', 'Dm7', 'G7'] }, { k: 'G', ch: ['Gmaj7', 'Em7', 'Am7', 'D7'] }, { k: 'C', ch: ['Cmaj7', 'Fmaj7', 'Cmaj7', 'Fmaj7'] }, { k: 'D', ch: ['Dmaj7', 'Gmaj7', 'Dmaj7', 'Gmaj7'] }],
    iiVI: [{ k: 'C', ch: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'] }, { k: 'G', ch: ['Am7', 'D7', 'Gmaj7', 'Gmaj7'] }, { k: 'C', ch: ['Dm7', 'G7', 'Cmaj7', 'A7'] }],
    slash: [{ k: 'G', ch: ['G', 'D/F#', 'Em', 'C'] }, { k: 'C', ch: ['C', 'G/B', 'Am', 'G'] }, { k: 'C', ch: ['C', 'G/B', 'Am', 'Am/G'] }],
    funk: [{ k: 'Em', ch: ['Em7', 'A7', 'Em7', 'A7'] }, { k: 'Am', ch: ['Am7', 'D7', 'Am7', 'D7'] }],
    travis: [{ k: 'C', ch: ['C', 'Am', 'C', 'G'] }, { k: 'G', ch: ['G', 'Em', 'C', 'D'] }, { k: 'Am', ch: ['Am', 'C', 'G', 'Em'] }, { k: 'C', ch: ['C', 'G', 'Am', 'F'] }],
    spanish: [{ k: 'Am', ch: ['Am', 'G', 'F', 'E'] }, { k: 'Em', ch: ['Em', 'D', 'C', 'B7'] }],
    power: [{ k: 'E', ch: ['E5', 'A5', 'D5', 'A5'] }, { k: 'A', ch: ['A5', 'D5', 'E5', 'D5'] }, { k: 'G', ch: ['G5', 'C5', 'D5', 'C5'] }, { k: 'A', ch: ['A5', 'G5', 'F5', 'G5'] }],
    jazz: [{ k: 'C', ch: ['Dm7', 'G7', 'Cmaj7', 'A7'] }, { k: 'G', ch: ['Am7', 'D7', 'Gmaj7', 'E7'] }, { k: 'F', ch: ['Gm7', 'C7', 'Fmaj7', 'D7'] }],
    blues: [{ k: 'A', ch: blues12('A') }, { k: 'E', ch: blues12('E') }, { k: 'G', ch: blues12('G') }, { k: 'D', ch: blues12('D') }],
  };

  const TIP = {
    strum: ['右手像甩水一樣放鬆，手腕帶動、手臂跟著擺', '下刷刷到全部該彈的弦，上刷只要刷到細的 3～4 條弦就好', '沒有刷到弦的時候手還是要照常上下擺動，節奏才會穩'],
    finger: ['右手拇指（p）負責第 6、5、4 弦，食指（i）第 3 弦、中指（m）第 2 弦、無名指（a）第 1 弦', '左手按好整個和弦不要放開，讓每個音延續下去', '撥弦是手指往掌心方向勾，不是往上拉'],
    barre: ['食指稍微側轉，用靠拇指那一側比較硬的地方壓弦', '拇指放在琴頸後方、食指的正對面，像夾子一樣', '手肘往身體靠，利用手臂的重量而不是死命捏'],
    scale: ['第 1、2、3、4 格分別用食指、中指、無名指、小指', '右手下、上交替撥弦', '邊彈邊念出音名，幫助記憶指板'],
    lead: ['一指一格：食指管這個把位的第一格，小指管最後一格', '音與音之間要連貫', '熟了以後試著自己改變節奏、即興幾句'],
  };

  const T = {};

  // ===== 階段 1：第一步——空弦、撥弦與單音 =====
  const stringNotes = (title, sets, goal) => (c) => {
    const set = sets[c.pass % sets.length];
    const pos = set.pos; const order = c.pass < sets.length ? [0, 0, 1, 1, 2, 2, 1, 1, 0, 1, 2, 1, 0, 2, 1, 0] : [0, 1, 2, 1, 0, 1, 2, 2, 2, 1, 0, 1, 2, 0, 1, 0];
    const body = order.map(i => P(pos[i % pos.length][0], pos[i % pos.length][1], 1));
    const run = rep(pos.concat(pos.slice(0, -1).reverse()).map(([s, f]) => P(s, f, 0.5)), 2);
    return { title: `${title}：${set.n}`, goal: `${goal}${set.d}`, tips: ['按弦的手指盡量貼近琴衍後方，力道剛好讓聲音清楚就夠', '彈第 3 格的音時用無名指，第 1 格用食指、第 2 格用中指', '彈每個音時念出音名'], notes: body.concat(fill(run)), key: '' };
  };
  T.s1 = [
    (c) => {
      const o = [[0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0], [0, 2, 4, 1, 3, 5]][c.pass % 3];
      return { title: '空弦四分音符：認識六條弦', goal: `六條弦由粗到細是 E、A、D、G、B、E（第 6 弦到第 1 弦）。依序撥第 ${o.map(s => 6 - s).join('、')} 弦的空弦，每條弦 4 下。`, tips: ['坐正、琴身貼著身體，右手前臂輕靠在琴身上緣', '用 Pick 或拇指往下撥都可以，每一下的音量盡量一致', '第 1 弦最細、音最高；第 6 弦最粗、音最低'], notes: o.flatMap(s => [0, 1, 2, 3].map(() => P(s, 0, 1))), key: '' };
    },
    stringNotes('第 1 弦的音', [{ n: 'E、F、G', pos: [[5, 0], [5, 1], [5, 3]], d: '第 1 弦空弦是 E、第 1 格 F、第 3 格 G。' }, { n: 'E、F、G（變化）', pos: [[5, 0], [5, 1], [5, 3]], d: '同樣三個音，換一種順序，最後用八分音符跑兩趟。' }], '開始用左手按弦。'),
    stringNotes('第 2 弦的音', [{ n: 'B、C、D', pos: [[4, 0], [4, 1], [4, 3]], d: '第 2 弦空弦是 B、第 1 格 C、第 3 格 D。指型和第 1 弦一模一樣。' }, { n: 'B、C、D（變化）', pos: [[4, 0], [4, 1], [4, 3]], d: '同樣三個音，換一種順序。' }], '把剛學的指型搬到第 2 弦。'),
    (c) => {
      const p = [[0, 1, 2, 3, 4, 5, 4, 3], [5, 3, 4, 2, 3, 1, 2, 0], [0, 2, 1, 3, 2, 4, 3, 5]][c.pass % 3];
      return { title: '空弦八分音符：下上交替撥弦', goal: '八分音符一拍兩個音：正拍往下撥、反拍往上撥。用空弦練習在弦與弦之間移動。', tips: ['數「1 & 2 & 3 & 4 &」：數字往下撥、& 往上撥', 'Pick 只要露出一點點尖端，握太深會卡弦', '換弦時靠手腕小幅移動，不要整隻手臂跳'], notes: rep(p.map(s => P(s, 0, 0.5)), 4), key: '' };
    },
    stringNotes('第 3 弦的音', [{ n: 'G、A＋第 2 弦 B', pos: [[3, 0], [3, 2], [4, 0]], d: '第 3 弦空弦是 G、第 2 格 A，再往上就接到第 2 弦空弦的 B。' }, { n: 'G、A、B（變化）', pos: [[3, 0], [3, 2], [4, 0]], d: '換一種順序，練習跨到隔壁弦。' }], '認識第 3 弦，並把三條細弦接起來。'),
    (c) => {
      const ms = [55, 57, 59, 60, 62, 64, 65, 67];
      return { title: '三條細弦：G 到 G 的八個音', goal: `把第 3、2、1 弦學過的音串起來：G A B C D E F G，上行再下行。${c.pass ? '這次用八分音符彈兩趟。' : ''}`, tips: ['每條弦的指型：空弦、食指、無名指（第 3 弦是空弦、中指）', '下行時手指提早準備好', '這八個音已經夠彈很多旋律了'], notes: c.pass ? rep(seq(upDown(ms), 0.5), 2) : seq(upDown(ms), 1), key: '', tab: { maxFret: 3 } };
    },
    melody('twinkle'),
    melody('mary'),
    (c) => {
      const f0 = [1, 5, 3, 7][(c.pass + c.si) % 4]; const up = [], down = [];
      for (let s = 0; s < 6; s++) for (let k = 0; k < 4; k++) up.push(P(s, f0 + k, 0.5));
      for (let s = 5; s >= 0; s--) for (let k = 3; k >= 0; k--) down.push(P(s, f0 + k, 0.5));
      return { title: `爬格子 1-2-3-4（第 ${f0} 格起）`, goal: `左手四指各管一格，從第 ${f0} 格開始，由第 6 弦爬到第 1 弦再爬回來。這是練左手獨立與手指力量最經典的暖身。`, tips: ['食指、中指、無名指、小指分別按連續的四格', '按下一格時，前面的手指盡量留在弦上', '拇指放在琴頸後方中間，不要握太緊；手痠了就休息'], notes: up.concat(down), key: '' };
    },
    stringNotes('低音弦的音', [{ n: '第 4 弦 D、E、F', pos: [[2, 0], [2, 2], [2, 3]], d: '第 4 弦空弦是 D、第 2 格 E、第 3 格 F。' }, { n: '第 5 弦 A、B、C', pos: [[1, 0], [1, 2], [1, 3]], d: '第 5 弦空弦是 A、第 2 格 B、第 3 格 C。' }, { n: '第 6 弦 E、F、G', pos: [[0, 0], [0, 1], [0, 3]], d: '第 6 弦空弦是 E、第 1 格 F、第 3 格 G，和第 1 弦完全一樣，只是低兩個八度。' }], '粗的三條弦是之後和弦的「根音」所在。'),
    melody('ode'),
    melody('jacques'),
    (c) => ({ title: `C 大調音階：第一把位${c.pass ? '（八分音符）' : ''}`, goal: `Do Re Mi Fa Sol La Si Do！從第 5 弦第 3 格的 C 彈到第 2 弦第 1 格的 C，上行再下行。${c.pass ? '這次用八分音符彈兩趟。' : ''}`, tips: ['用到的格子只有 1、2、3 格，分別交給食指、中指、無名指', '大調音階的間隔是「全全半全全全半」：E–F、B–C 之間只差一格', '邊彈邊唱 Do Re Mi'], notes: c.pass ? rep(seq(upDown(scaleOf(48, SC.major)), 0.5), 2) : seq(upDown(scaleOf(48, SC.major)), 1), key: 'C', tab: { maxFret: 3 } }),
  ];

  // ===== 階段 2：第一批開放和弦 =====
  T.s2 = [
    know('Em'), know('Am'),
    change('Em', 'Am', 'Em 換 Am：中指、無名指一起往細弦移一條弦，再補上食指'),
    know('E'),
    change('Am', 'E', 'Am 和 E 的指型一模一樣，三根手指整組平移一條弦'),
    know('A'), know('D'),
    change('A', 'D', 'A 換 D：食指留在第 3 弦第 2 格附近當作定位點'),
    strumL('四分音符下刷', '每拍往下刷一下，一個和弦刷 4 下。', PG.five, 'DDDD', 1, TIP.strum),
    melody('saints'),
    strumL('根音＋刷弦', '第 1、3 拍只彈和弦的根音（最低的那條弦），第 2、4 拍往下刷——「蹦、恰、蹦、恰」。', PG.five, 'BDBD', 1, ['Em、E 的根音在第 6 弦；Am、A 在第 5 弦；D 在第 4 弦', '根音用 Pick 或拇指單獨撥一條弦，刷弦時刷細的那幾條', '這是民謠、鄉村伴奏最基本的型態'], { off: 1 }),
    change('E', 'A', 'E 換 A：三根手指都要移動，先讓食指找到位置'),
    (c) => {
      const f = [['A', 'A', 'D', 'A', 'A', 'A', 'E', 'E', 'A', 'A', 'D', 'A', 'A', 'E', 'A', 'A'], ['E', 'E', 'A', 'E', 'E', 'E', 'A', 'A', 'E', 'E', 'A', 'E', 'E', 'D', 'E', 'E']][c.pass % 2];
      return { title: `三和弦歌曲伴奏（${f[0]}）`, goal: `只要三個和弦就能伴奏上千首歌。這是一段 16 小節的曲式，每小節刷兩下（二分音符）：${[...new Set(f)].join('、')}。`, tips: ['每 4 小節是一句，心裡要數小節', '和弦撐滿兩拍再換，不要提早放開', '試著邊刷邊哼一首你熟的歌'], notes: strum(C(...f), 'D-D-', 1), key: f[0], ring: true };
    },
  ];

  // ===== 階段 3：C、G、Dm 與基本刷法 =====
  T.s3 = [
    know('C'),
    change('C', 'Am', 'C 換 Am 只要動無名指：食指和中指完全不用離開'),
    know('G'),
    change('G', 'Em', 'G 換 Em：食指留在第 5 弦第 2 格當軸心'),
    change('G', 'C', 'G 換 C 是初學最大的關卡：三根手指同時離開、同時落下，先慢慢練'),
    change('G', 'D', 'G 換 D：無名指從第 1 弦第 3 格移到第 2 弦第 3 格，其他手指跟著它'),
    strumL('八分音符下上刷', '一拍刷兩下：正拍往下、反拍往上。', PG.eight, 'DUDUDUDU', 0.5, TIP.strum, { mul: 0.85 }),
    know('Dm'),
    strumL('刷法：下・下上', '「下、下上、下、下上」——第 1、3 拍只有下刷，第 2、4 拍是下上兩下。', PG.eight, 'D-DUD-DU', 0.5, TIP.strum, { off: 1 }),
    strumL('民謠刷法：下・下上・上下上', '最經典的民謠刷法「下、下上、（空）上、下上」。第 3 拍的正拍手往下揮但不碰弦。', PG.eight, 'D-DU-UDU', 0.5, ['數「1、2 &、(3) &、4 &」，第 3 拍手照樣往下擺，只是不刷到弦', '先對著悶住的弦練右手，節奏熟了再加上和弦', '這個刷法可以伴奏絕大多數的流行歌'], { off: 2 }),
    strumL('三拍子：華爾滋伴奏', '3/4 拍：第 1 拍彈根音，第 2、3 拍往下刷——「蹦、恰、恰」。', PG.waltz, 'BDD', 1, ['數「1 2 3、1 2 3」，重音在第 1 拍', '根音要彈得飽滿，刷弦輕一點', '〈奇異恩典〉、〈生日快樂歌〉都是三拍子'], { bpb: 3, rep: 2 }),
    (c) => melody(c.pass % 2 ? 'susanna' : 'aura')(c),
    strumL('四和弦伴奏', '把民謠刷法套進四和弦循環，連續彈 8 小節不停。', PG.eight, 'D-DU-UDU', 0.5, ['換和弦發生在小節的最後一個上刷之後，動作要快', '如果來不及，最後一個上刷可以刷空弦，沒關係', '錄下來聽聽看節奏穩不穩'], { off: 3 }),
  ];

  // ===== 階段 4：七和弦與藍調 =====
  const lick = (root, idx) => { const p = scaleOf(root, SC.minPent, 2); p.push(root + 27); return idx.map(([i, d]) => i === null ? R(d) : N(p[i], d)); };
  const LICKS = [
    [[7, .5], [8, .5], [9, 1], [8, .5], [7, .5], [5, 1], [7, .5], [6, .5], [5, 1], [null, 2]],
    [[10, 1], [9, .5], [8, .5], [7, 1], [8, 1], [9, .5], [8, .5], [7, .5], [6, .5], [5, 2]],
    [[5, .5], [6, .5], [7, .5], [8, .5], [9, 1], [10, 1], [9, .5], [8, .5], [9, .5], [8, .5], [7, 2]],
    [[8, 1.5], [7, .5], [5, 1], [null, 1], [3, .5], [4, .5], [5, .5], [4, .5], [5, 2]],
  ];
  const boogie = (k) => { const roots = { A: [45, 50, 40], E: [40, 45, 47], G: [43, 48, 50] }[k]; return [0, 0, 0, 0, 1, 1, 0, 0, 2, 1, 0, 2].flatMap(i => seq([0, 4, 7, 9, 10, 9, 7, 4].map(x => roots[i] + x), 0.5)).concat([N(roots[0], 4)]); };
  T.s4 = [
    know('E7'), know('A7'), know('D7'),
    change('A7', 'D7', 'A7 換 D7：三根手指都要換位置，先記住 D7 的小三角形'),
    (c) => { const k = c.pass % 2 ? 'E' : 'A'; return { title: `12 小節藍調：四分音符（${k}）`, goal: `藍調最重要的曲式：12 小節、三個屬七和弦（${[...new Set(blues12(k))].join('、')}）。每拍下刷一下，走完一整輪。`, tips: ['結構：I I I I｜IV IV I I｜V IV I V', '每 4 小節一句，心裡數著現在是第幾小節', '藍調、搖滾、鄉村、爵士都從這個曲式長出來'], notes: strum(C(...blues12(k)), 'DDDD', 1).concat([S(chord(blues12(k)[0]), 4)]), key: k, ring: true }; },
    scaleL('小調五聲音階（開放把位）', 'E', 40, SC.minPent, 2, { maxFret: 3 }, 'E 小調五聲音階只有五個音（E G A B D），每條弦都是「空弦＋第 2 或第 3 格」，是藍調與搖滾獨奏的核心。', ['第 6、2、1 弦按第 3 格，第 5、4、3 弦按第 2 格', '這五個音怎麼組合都好聽，可以隨意即興', '右手下上交替撥弦']),
    know('B7'),
    strumL('Shuffle 搖擺刷法', '把一拍分成三等分，只刷第 1 和第 3 下——「長–短、長–短」的搖擺感。套進 12 小節藍調。', [PG.blues[1], PG.blues[0]], 'D-UD-UD-UD-U', 1 / 3, ['聽起來像「噠～噠 噠～噠」，不是平均的八分音符', '長的那下往下刷、短的那下往上刷', '放鬆、往後靠，不要趕'], { rep: 1 }),
    (c) => { const k = ['A', 'E', 'G'][c.pass % 3]; return { title: `藍調 Boogie 低音線（${k}）`, goal: '用單音彈出 1-3-5-6-b7-6-5-3 的 boogie 線條，走完 12 小節藍調。早期搖滾樂的招牌。', tips: ['每個和弦的指型相同，只是換一組弦', '八分音符可以平均彈，也可以彈成 shuffle 的長短感', '全程下撥會更有力'], notes: boogie(k), key: k, tab: { maxFret: 5 } }; },
    scaleL('藍調音階（開放把位）', 'E', 40, SC.blues, 2, { maxFret: 3 }, '在小調五聲加上 b5（Bb）這個「藍調音」，就是藍調音階。', ['b5 是經過音，不要停在上面太久', '第 5 弦第 1 格和第 3 弦第 3 格是新加入的音', '試著用滑音經過藍調音']),
    strumL('屬七和弦的解決', '屬七和弦聽起來「想要回家」。感受 V7 → I 的解決感：每個和弦一小節，下、下上。', PG.resolve, 'D-DUD-DU', 0.5, ['注意聽七和弦那個不安定的音', '兩個同根音的和弦之間通常只差一根手指', '所有調的 V7 → I 都是同樣的道理']),
    (c) => { const a = LICKS[c.pass % 4], b = LICKS[(c.pass + 1) % 4]; return { title: '藍調樂句：E 小調五聲', goal: '把五聲音階變成音樂！兩個 2 小節的樂句，各彈兩次。樂句之間的休止和長音就是「呼吸」。', tips: ['像說話一樣：一句、停頓、再一句', '長音可以輕輕搖動手指做出抖音（vibrato）', '背起來之後，自己改一兩個音試試'], notes: rep(lick(40, a), 2).concat(rep(lick(40, b), 2)), key: 'Em', tab: { maxFret: 3 } }; },
    (c) => melody(c.pass % 2 ? 'grace' : 'auld')(c),
  ];

  // ===== 階段 5：指彈入門 =====
  const romance = () => {
    const frets = [7, 7, 7, 7, 5, 3, 3, 2, 0, 0, 3, 7, 12, 12, 12, 12, 10, 8];
    const notes = frets.flatMap(f => [P(5, f, 1 / 3), P(4, 0, 1 / 3), P(3, 0, 1 / 3)]);
    return { title: '〈愛的羅曼史〉前段', goal: '古典吉他最有名的曲子之一（作者不詳）。旋律在第 1 弦，每一拍後面跟著第 2、3 弦的空弦，形成三連音分解。', tips: ['右手：無名指（a）彈第 1 弦旋律、中指（m）第 2 弦、食指（i）第 3 弦', '左手只需要在第 1 弦上移動，旋律音要彈得比伴奏大聲', '第 5 小節跳到第 12 格，眼睛先看好位置'], notes: notes.concat([P(5, 7, 3)]), key: 'Em', bpb: 3, ring: true, bpmMul: 0.8 };
  };
  T.s5 = [
    arpL('p-i-m-a 四指分工', '右手四根手指各管一條弦：拇指彈根音，食指、中指、無名指依序彈第 3、2、1 弦。每拍一個音。', PG.finger, 'p321', 1, TIP.finger),
    arpL('分解和弦：p-i-m-a-m-i', '八分音符的上行再下行：根音、3、2、1、2、3 弦，最後兩個音回到 2、3 弦。', PG.finger, 'p3212321', 0.5, TIP.finger, { off: 1 }),
    melody('green'),
    arpL('三拍子分解和弦', '3/4 拍的 p-i-m-a-m-i，一小節剛好六個八分音符。', [PG.waltz[2], PG.waltz[1], PG.waltz[0]], 'p32123', 0.5, TIP.finger, { bpb: 3 }),
    know('Fmaj7'),
    arpL('〈日昇之屋〉風格分解和弦', '6/8 拍的經典分解和弦（傳統民謠）。一小節六個八分音符，分成兩組三個：「1 2 3、4 5 6」。節拍器的一下是一個八分音符。', PG.rising, 'p32123', 1, ['重音在第 1、4 下', '每個和弦根音所在的弦不同：Am、C 在第 5 弦，D、Fmaj7 在第 4 弦，E 在第 6 弦', '左手提早準備下一個和弦，至少根音那根手指要先到'], { bpb: 6, rep: 1, mul: 2.2 }),
    arpL('拇指交替低音', '拇指在兩條低音弦之間來回，手指在中間穿插——這是 Travis 指法的預備練習。', PG.finger, 'p3q2p3q2', 0.5, ['拇指像節拍器一樣穩定地彈在每一拍上', '交替低音通常是根音上面那條弦（第 4 弦）', '先只練拇指，穩了再加上手指'], { off: 2 }),
    melody('scar'),
    arpL('分解和弦：p-i-m-i-a-i-m-i', '八分音符的另一個常用型：根音、3、2、3、1、3、2、3。食指像鐘擺一樣回到第 3 弦。', PG.eight, 'p3231323', 0.5, TIP.finger),
    arpL('下行分解：p-a-m-i', '反過來從第 1 弦往下撥：根音、1、2、3 弦，八分音符連續兩組。', PG.finger, 'p123p123', 0.5, TIP.finger, { off: 3 }),
    arpL('抒情分解和弦：八和弦進行', '把 p-i-m-i-a-i-m-i 套進 8 個和弦的抒情進行，一口氣彈完。', PG.ballad, 'p3231323', 0.5, ['和弦根音：C、Am 第 5 弦，G、Em 第 6 弦，Fmaj7 第 4 弦', '換和弦前的最後一個音可以是空弦，爭取換和弦的時間', '音量平均、像流水一樣'], { rep: 1 }),
    romance,
    arpL('根音加撥三弦', '拇指彈根音後，食指、中指、無名指「依序很快地」撥 3、2、1 弦，每拍一組，後半拍讓聲音延續。', PG.eight, 'p3-2-1--', 0.5, TIP.finger, { off: 2 }),
  ];

  // ===== 階段 6：F 和弦與封閉和弦 =====
  const shapeMove = (title, list, goal) => (c) => {
    const chs = list[c.pass % list.length].map(([n, sh]) => chord(n, sh));
    return { title: `${title}：${names(chs)}`, goal, tips: TIP.barre, notes: rep(strum(chs, 'DDDD', 1), 2).concat([S(chs[0], 4)]), key: chs[0].name, ring: true };
  };
  T.s6 = [
    know('F', SMALL_F, 'F（小封閉）'),
    change('C', ['F', SMALL_F], 'C 換小封閉 F：無名指、中指各往細弦移一條，食指躺下來同時壓第 1、2 弦'),
    strumL('C–G–Am–F 流行進行', '流行歌最常見的四個和弦。F 先用小封閉的按法。', PG.popF, 'D-DU-UDU', 0.5, TIP.strum),
    (c) => { const f = [5, 3, 1][c.pass % 3]; const up = [0, 1, 2, 3, 4, 5].map(s => P(s, f, 1)); return { title: `食指橫按練習（第 ${f} 格）`, goal: `用一根食指橫按第 ${f} 格的六條弦，逐弦撥出來，確認每一條都有聲音。封閉和弦的成敗就在這根手指。`, tips: TIP.barre, notes: up.concat(up.slice(0, -1).reverse().map(n => ({ ...n })), [P(0, f, 1)]), key: '' }; },
    know('F'),
    change('F', 'C', '大封閉 F 換 C：先放開食指的橫按，無名指落到第 5 弦第 3 格'),
    know('Bm'),
    strumL('D–A–Bm–G 進行', 'D 調的流行四和弦，Bm 是第一個 A 型的封閉和弦。', PG.popD, 'D-DU-UDU', 0.5, TIP.barre),
    know('F#m'),
    strumL('A–E–F#m–D 進行', 'A 調的流行四和弦，F#m 是 E 小調指型的封閉和弦。', PG.popA, 'D-DU-UDU', 0.5, TIP.barre),
    shapeMove('移動 E 型封閉和弦', [[['F', null], ['G', [3, 5, 5, 4, 3, 3]], ['A', [5, 7, 7, 6, 5, 5]], ['G', [3, 5, 5, 4, 3, 3]]], [['F#m', null], ['Gm', null], ['Am', [5, 7, 7, 5, 5, 5]], ['Gm', null]]], '同一個指型往高把位移動，就變成別的和弦——根音在第 6 弦：第 1 格 F、第 3 格 G、第 5 格 A。'),
    shapeMove('移動 A 型封閉和弦', [[['B', null], ['C', [-1, 3, 5, 5, 5, 3]], ['D', [-1, 5, 7, 7, 7, 5]], ['C', [-1, 3, 5, 5, 5, 3]]], [['Bm', null], ['Cm', null], ['Dm', [-1, 5, 7, 7, 6, 5]], ['Cm', null]]], '根音在第 5 弦的封閉和弦：第 2 格 B、第 3 格 C、第 5 格 D。第 6 弦不要刷到。'),
    strumL('卡農進行', '帕海貝爾〈卡農〉的八個和弦，流行歌引用最多的和弦進行。每小節「下、下、下、下上」。', PG.canon, 'D-D-D-DU', 0.5, ['Bm、F#m 兩個封閉和弦連在一起，是這段的難關', '手痠的時候甩甩手，封閉和弦需要幾週的時間長力氣', '和弦的根音連起來是一條下行的旋律線'], { rep: 1 }),
  ];

  // ===== 階段 7：大調音階與旋律 =====
  const seqL = (title, root, k, size, step, goal, tips, tab, mul) => () => {
    const s = scaleOf(root, SC.major, 2); const ms = [];
    for (let i = 0; i < 8; i++) for (let x = 0; x < size; x++) ms.push(s[i + (size === 2 ? x * 2 : x)]);
    ms.push(s[size === 2 ? 7 : 8]);
    return { title: `${k} ${title}`, goal, tips, notes: fill(seq(ms, step)), key: k, tab, bpmMul: mul };
  };
  T.s7 = [
    scaleL('大調音階（開放把位兩個八度）', 'G', 43, SC.major, 2, { maxFret: 4 }, 'G 大調有一個升記號（F#）。從第 6 弦第 3 格的 G 一路彈到第 1 弦第 3 格的 G。', TIP.scale),
    melody('jasmine'),
    seqL('大調三度音程', 48, 'C', 2, 0.5, '把音階兩個兩個跳著彈（Do-Mi、Re-Fa、Mi-Sol…），訓練手指跨弦與耳朵。', ['三度是和弦的基本材料', '很多組三度會落在相鄰的兩條弦上', '慢慢彈，聽清楚每一組'], { maxFret: 5 }),
    (c) => (c.pass % 2 ? scaleL('大調音階（開放把位兩個八度）', 'A', 45, SC.major, 2, { maxFret: 5 }, 'A 大調有三個升記號（F#、C#、G#）。', TIP.scale) : scaleL('大調音階（開放把位）', 'D', 50, SC.major, 1, { maxFret: 4 }, 'D 大調有兩個升記號（F#、C#）。從第 4 弦空弦開始。', TIP.scale))({ ...c, pass: 0 }),
    seqL('大調四音模進（1234）', 43, 'G', 4, 0.5, '1-2-3-4、2-3-4-5、3-4-5-6…四個音一組往上推進，是練速度與流暢度最好的材料。', ['每組第一個音稍微加重', '右手嚴格下上交替', '熟練後自己試著做下行版本'], { maxFret: 5 }),
    melody('minuet'),
    (c) => (c.pass % 2 ? scaleL('大調音階（開放把位兩個八度）', 'F', 41, SC.major, 2, { maxFret: 3 }, 'F 大調有一個降記號（Bb）。', TIP.scale) : scaleL('大調音階（開放把位兩個八度）', 'E', 40, SC.major, 2, { maxFret: 4 }, 'E 大調有四個升記號，從第 6 弦空弦彈到第 1 弦空弦。', TIP.scale))({ ...c, pass: 1 }),
    (c) => { const [k, r, f] = [['A', 45, 5], ['G', 43, 3], ['B', 47, 7], ['C', 48, 8]][c.pass % 4]; return { title: `可移動的大調指型（${k}，第 ${f - 1}～${f + 2} 格）`, goal: `不用空弦的大調音階指型：根音在第 6 弦第 ${f} 格，用中指起音。整個指型平移到任何一格，就是那個調的大調音階。`, tips: ['中指按根音，一指一格', '每條弦的指法：6 弦「2-4」、5 弦「1-2-4」、4 弦「1-3-4」、3 弦「1-3-4」、2 弦「2-4」、1 弦「1-2」', '背熟這個指型，12 個調一次到手'], notes: seq(upDown(scaleOf(r, SC.major, 2)), 0.5), key: k, tab: { minFret: f - 1, maxFret: f + 2 } }; },
    melody('birthday'),
    seqL('大調三音模進（三連音）', 48, 'C', 3, 1 / 3, '三個音一組（1-2-3、2-3-4…），用三連音彈：一拍三個音。', ['數「1-ta-ta、2-ta-ta」', '每組第一個音對齊節拍器', '下上交替會讓每組的起始方向不同，這正是練習重點'], { maxFret: 5 }, 0.8),
    (c) => { const s = [5, 4][c.pass % 2]; const notes = seq(upDown(scaleOf(OPEN[s], SC.major)), 1); assignTab(notes, { string: s, maxFret: 12 }); return { title: `單弦音階：第 ${6 - s} 弦`, goal: `只用第 ${6 - s} 弦彈完一個八度的大調音階，從空弦到第 12 格。沿著琴頸橫向移動，可以清楚「看見」全全半全全全半。`, tips: ['全音＝隔一格（跳 2 格），半音＝相鄰一格', '第 12 格有兩個圓點，是空弦的高八度', '用一根食指滑動也可以，重點是認識格子的距離'], notes, key: SN[s].toUpperCase(), fixed: true }; },
    seqL('大調四音模進：十六分音符', 43, 'G', 4, 0.25, '同樣的 1234 模進，改用十六分音符（一拍四個音）。', ['先在 70% 速度彈到乾淨再加速', '左右手同步最重要', '每拍第一個音對齊節拍器'], { maxFret: 5 }, 0.6),
    (c) => melody(c.pass % 2 ? 'susanna' : 'auld')(c),
  ];

  // ===== 階段 8：刷法進階 =====
  const T16 = ['把手的擺動速度加倍：一拍下上下上四個動作，數「1 e & a」', '手永遠保持十六分音符的擺動，沒有刷的地方只是揮空', '先悶住弦只練右手，節奏對了再加和弦'];
  T.s8 = [
    strumL('十六分音符全刷', '一拍四下：下上下上。先求平均，不求大聲。', PG.eight, 'DUDUDUDUDUDUDUDU', 0.25, T16, { mul: 0.75 }),
    strumL('十六分刷法 A', '每拍的第一下一定刷，第 2、4 拍尾巴加上「下上」。', PG.eight, mask('x.x.x.xxx.x.x.xx'), 0.25, T16, { off: 1 }),
    strumL('切分刷法', '八分音符的切分：「下、（空）上、（空）上、下」。重音落在反拍上，很有流行感。', PG.eight, mask('x..x.xx.'), 0.5, ['第 2、3 拍的正拍手往下揮空', '數「1、(2) &、(3) &、4」', '切分音是讓伴奏有律動的關鍵'], { off: 2 }),
    strumL('奔馬刷法', '「下、下上」連續四拍：一個八分加兩個十六分，像馬在跑。', PG.sad, mask('x.xxx.xxx.xxx.xx'), 0.25, T16, { mul: 0.9 }),
    strumL('一小節兩個和弦', '每個和弦只有兩拍就要換。刷法：下、下上。', PG.half, 'D-DU', 0.5, ['兩拍一換，左手要更果斷', '換和弦前的上刷可以刷到空弦', '這種和聲節奏常見於副歌'], { rep: 1 }),
    strumL('十六分抒情刷法', '慢歌常用的 16 Beat：長音和十六分音符穿插。', PG.pop, mask('x...x.x..xx.x.x.'), 0.25, T16, { off: 1 }),
    strumL('三拍子刷法', '3/4 拍的八分音符刷法：「下、下上、下上」。', PG.waltz, 'D-DUDU', 0.5, ['重音在每小節第 1 拍', '第 1 拍刷低音弦多一點，後面刷高音弦', '華爾滋的搖擺感'], { bpb: 3 }),
    strumL('3+3+2 切分', '把 16 個十六分音符分成「3+3+3+3+2+2」，重音不在拍點上，是拉丁與流行常見的節奏。', PG.sad, mask('x..x..x..x.xx.x.'), 0.25, T16, { off: 2 }),
    strumL('6/8 拍刷法', '6/8 拍：一小節六個八分音符，分成兩大拍。刷法「下、下上、下、下上」。節拍器的一下是一個八分音符。', PG.fifties, 'DDUDDU', 1, ['重音在第 1、4 下', '感覺是「強弱弱、次強弱弱」', '很多慢搖滾與藍調抒情歌都是 6/8'], { bpb: 6, mul: 2.2 }),
    strumL('休止刷法', '刷完馬上用右手掌側把弦悶掉，讓聲音「斷開」。休止和聲音一樣重要。', PG.pop, 'D.DUD.DU', 0.5, ['悶音：刷完後右手掌側（小指那側）順勢靠在弦上', '休止的地方要完全沒聲音', '乾淨的休止會讓節奏更有力'], { off: 3 }),
    strumL('十六分刷法 B', '「下、下上、上下、下上、上下、下上」——連續的切分推進。', PG.pop, mask('x.xx.xx.xx.xx.xx'), 0.25, T16, { off: 4 }),
    strumL('強弱拍：全下刷八分', '搖滾常用的全下刷八分音符。第 2、4 拍刷重一點，其他輕一點。', PG.sad, 'DDDDDDDD', 0.5, ['重音就是鼓手小鼓的位置（第 2、4 拍）', '輕的幾下只刷低音弦', '全下刷的音色比下上刷更紮實'], { off: 1 }),
    (c) => { const p = PG.pop[(c.pass + 2) % 3]; const v = C(...p.ch), ch = C(p.ch[3], p.ch[0], p.ch[1], p.ch[2]); return { title: `主歌＋副歌（${p.k}）`, goal: `一首歌的縮影：主歌 4 小節用輕的民謠刷法（${names(v)}），副歌 4 小節換成十六分刷法（${names(ch)}），再回主歌。`, tips: ['主歌輕、副歌重，用力度做出段落的對比', '換刷法的那一小節最容易亂，單獨多練幾次', '這就是彈唱伴奏的基本架構'], notes: strum(v, 'D-DU-UDU', 0.5).concat(strum(ch, mask('x.x.x.xxx.x.x.xx'), 0.25), strum(v, 'D-DU-UDU', 0.5), [S(v[0], 4)]), key: p.k, ring: true }; },
  ];

  // ===== 階段 9：小調、五聲與獨奏 =====
  const box = (r) => ({ minFret: r, maxFret: r + 3 });
  T.s9 = [
    (c) => { const [k, r, f] = [['A', 45, 5], ['G', 43, 3], ['B', 47, 7], ['C', 48, 8]][c.pass % 4]; const s = scaleOf(r, SC.minPent, 2); s.push(r + 27); return { title: `${k} 小調五聲：第一指型（第 ${f} 格）`, goal: `吉他手最重要的一個指型！每條弦兩個音，食指都在第 ${f} 格。六條弦依序是「1-4、1-3、1-3、1-3、1-4、1-4」指。`, tips: TIP.lead, notes: seq(upDown(s), 0.5), key: k + 'm', tab: box(f) }; },
    scaleL('自然小調（開放把位兩個八度）', 'A', 45, SC.minor, 2, { maxFret: 5 }, 'A 小調和 C 大調用同一組音（都沒有升降記號），只是從 A 開始，聽起來比較暗。', TIP.scale),
    (c) => { const s = scaleOf(45, SC.minPent, 2); s.push(72); const ms = []; for (let i = 0; i < 9; i++) ms.push(s[i], s[i + 1], s[i + 2]); ms.push(s[9], s[10], s[11]); return { title: 'A 小調五聲：三音模進', goal: '在五聲指型裡三個音一組往上爬（三連音）。搖滾獨奏裡常聽到的句型。', tips: TIP.lead, notes: fill(seq(ms, 1 / 3).concat([N(69, 1)])), key: 'Am', tab: box(5), bpmMul: 0.8 }; },
    (c) => { const s = scaleOf(45, SC.blues, 2); return { title: 'A 藍調音階（第 5 格）', goal: '五聲指型加上藍調音 Eb：第 5 弦第 6 格、第 3 弦第 8 格。', tips: ['藍調音是「經過」用的，前後接到 D 或 E', '第 3 弦的藍調音用小指按', '試著從 D 滑到 Eb 再到 E'], notes: rep(seq(upDown(s), 0.5), c.pass ? 2 : 1), key: 'Am', tab: box(5) }; },
    (c) => { const a = LICKS[(c.pass + 1) % 4], b = LICKS[(c.pass + 3) % 4]; return { title: 'A 小調五聲樂句（第 5 格）', goal: '把之前在開放把位學的藍調樂句搬到第 5 格的五聲指型。指型不同，但旋律完全一樣。', tips: ['樂句結束在根音 A 上會有「講完了」的感覺', '長音加上抖音，聲音會更像在唱歌', '試著推弦或滑音進到目標音'], notes: rep(lick(45, a), 2).concat(rep(lick(45, b), 2)), key: 'Am', tab: box(5) }; },
    melody('elise'),
    scaleL('自然小調（開放把位兩個八度）', 'E', 40, SC.minor, 2, { maxFret: 4 }, 'E 小調和 G 大調是同一組音（一個 F#）。六條弦都會用到空弦。', TIP.scale),
    scaleL('和聲小調', 'A', 45, SC.harmMinor, 2, { maxFret: 5 }, '把自然小調的第 7 個音升高半音（G 變 G#），就有濃濃的古典與異國風味。', ['F 到 G# 之間隔了三格，是這個音階的特色', '小調歌曲裡的 E 或 E7 和弦就是從這個音階來的', '慢慢彈，聽那個特別的音程']),
    () => ({ title: 'E 弗里吉安：西班牙風 Riff', goal: 'E 弗里吉安調式（E F G A B C D）帶有佛朗明哥的味道，秘密是 E 和 F 之間只差半音。', tips: ['全部在低音三條弦的開放把位', '用拇指或 Pick 下撥，彈重一點', '最後一行是整個調式的上行'], notes: mel('E2:.5 E2:.5 F2:.5 E2:.5 G2:.5 E2:.5 F2:.5 E2:.5 | A2:.5 G2:.5 F2:.5 E2:.5 F2:.5 G2:.5 F2 | E2:.5 E2:.5 F2:.5 E2:.5 G2:.5 E2:.5 F2:.5 E2:.5 | A2:.5 B2:.5 C3:.5 B2:.5 A2:.5 G2:.5 F2 | E2:.5 F2:.5 G2:.5 A2:.5 B2:.5 C3:.5 D3:.5 E3:.5 | E3:.5 D3:.5 C3:.5 B2:.5 A2:.5 G2:.5 F2:.5 E2:.5 | E2:4'), key: 'Em', tab: { maxFret: 3 } }),
    () => ({ title: '12 小節藍調獨奏（A）', goal: '把四個樂句排進 12 小節藍調：每 2 小節一句，像在說一個有起承轉合的故事。', tips: ['前 4 小節提出主題、中間 4 小節變化、最後 4 小節收尾', '請朋友刷 A7–D7–E7，或錄下自己的伴奏再疊上去', '不必每一拍都有音，留白更有味道'], notes: [0, 1, 2, 3, 0, 2].flatMap(i => lick(45, LICKS[i])), key: 'Am', tab: box(5) }),
    (c) => { const s = scaleOf(45, SC.minPent, 2); s.push(72); const ms = []; for (let i = 0; i < 8; i++) ms.push(s[i], s[i + 1], s[i + 2], s[i + 3]); return { title: 'A 小調五聲：四音模進（十六分）', goal: '四個音一組的模進，用十六分音符彈，把五聲指型練到滾瓜爛熟。', tips: TIP.lead, notes: fill(seq(ms, 0.25).concat([N(69, 2)])), key: 'Am', tab: box(5), bpmMul: 0.6 }; },
    scaleL('自然小調（開放把位）', 'D', 50, SC.minor, 1, { maxFret: 3 }, 'D 小調有一個降記號（Bb）：第 3 弦第 3 格。', TIP.scale),
    melody('green'),
  ];

  // ===== 階段 10：色彩和弦 =====
  T.s10 = [
    strumL('掛留和弦裝飾', '在原本的和弦上加一根或放一根手指，就是 sus4、sus2。每兩拍換一次，刷「下、下上」。', PG.sus, 'D-DU', 0.5, ['sus4：把三度音換成四度（多按一格）；sus2：換成二度（放開手指）', '掛留和弦聽起來懸在半空，會想回到原本的和弦', '很多歌的前奏就是這樣做出來的'], { rep: 1 }),
    know('Cadd9'),
    strumL('G–Cadd9–Em7–Dsus4', '無名指和小指固定在第 2、1 弦第 3 格不動，只動食指和中指——現代民謠流行的招牌聲音。', PG.add9, 'D-DU-UDU', 0.5, ['兩根「錨定」的手指全程不離開', '四個和弦共用高音的 D 和 G，所以聽起來特別連貫', '這組按法可以代替一般的 G–C–Em–D'], {}),
    know('Cmaj7'), know('Am7'),
    strumL('大七與小七和弦', '七和弦讓和聲更柔和、更有都會感。切分刷法。', PG.maj7, mask('x..x.xx.'), 0.5, ['maj7 溫暖、m7 柔和、屬七（7）帶有張力', '刷輕一點，讓每個音都聽得見', '很多 City Pop 與 R&B 都建立在這些和弦上']),
    know('Dm7'),
    strumL('ii–V–I', '爵士最重要的和弦進行：二級小七 → 五級屬七 → 一級大七。每拍下刷一下。', PG.iiVI, 'DDDD', 1, ['每拍刷完稍微放鬆左手，做出短促的「恰、恰、恰、恰」', 'V7 → Imaj7 是最強的解決感', '這組進行在爵士標準曲裡無所不在']),
    strumL('轉位和弦：低音線', '斜線後面是指定的低音。讓低音一步一步往下走，把和弦串成一條線。', PG.slash, 'B-DUB-DU', 0.5, ['D/F# 的低音在第 6 弦第 2 格，可以用拇指從琴頸上方繞過來按', '每個和弦先單獨彈低音，再刷', '聽低音：一路往下走'], {}),
    know('Gmaj7'),
    strumL('放克風十六分刷法', '只用兩個和弦，把注意力全部放在右手的十六分律動上。', PG.funk, mask('x.xx.x.xx.x.x.xx'), 0.25, T16, { mul: 0.9 }),
    arpL('色彩和弦分解', '把大七、小七和弦用指彈分解，每個音都清清楚楚。', PG.maj7, 'p3231323', 0.5, TIP.finger, {}),
    know('Dsus4'),
  ];

  // ===== 階段 11：指彈進階 =====
  const harm = (c) => {
    const f = c.pass % 2 ? 7 : 12, add = f === 12 ? 12 : 19;
    const hs = [0, 1, 2, 3, 4, 5].map(s => ({ m: OPEN[s] + add, d: 1, s, f }));
    const notes = hs.concat(hs.slice(0, -1).reverse().map(n => ({ ...n })), [{ ...hs[0], d: 1 }]);
    if (c.pass % 2) notes.push(...[3, 2, 1].flatMap(s => [{ m: OPEN[s] + 12, d: 1, s, f: 12 }, { m: OPEN[s] + 19, d: 1, s, f: 7 }]), { m: OPEN[3] + 12, d: 2, s: 3, f: 12 });
    return { title: `自然泛音：第 ${f} 格`, goal: `左手手指「輕輕碰」在第 ${f} 格琴衍的正上方（不要壓下去），右手撥弦後馬上把左手移開，就會出現鐘聲般的泛音。${f === 12 ? '第 12 格的泛音剛好比空弦高一個八度。' : '第 7 格的泛音比空弦高一個八度又五度；後半段和第 12 格的泛音交替。'}`, tips: ['手指要碰在金屬琴衍的正上方，不是格子中間', '右手靠近琴橋撥，泛音會更亮', '泛音也是調音的好幫手'], notes: fill(notes), key: '', fixed: true };
  };
  T.s11 = [
    arpL('Travis 指法：基本型', '拇指在根音弦與第 4 弦之間穩定交替（每拍一下），食指、中指在反拍穿插。Travis picking 是指彈吉他的招牌技巧。', PG.travis, 'p-q2p3q2', 0.5, ['拇指是引擎：先只彈拇指的四分音符，穩了再加手指', '右手掌根可以輕靠琴橋，讓低音悶一點、更有彈性', '很多民謠與鄉村名曲都用這個指法']),
    arpL('Travis 指法：變化型', '同樣的交替低音，手指改成每個反拍都彈，第 2 弦和第 3 弦輪流。', PG.travis, 'p2q3p2q3', 0.5, TIP.finger, { off: 1 }),
    harm,
    arpL('卡農：分解和弦', '用 p-i-m-a-m-i 分解卡農的八個和弦，Bm 和 F#m 要用封閉和弦按好。', PG.canon, 'p3212321', 0.5, ['封閉和弦分解時每條弦都會被檢驗，按不清楚的音會直接聽出來', '換和弦前的最後一個音可以稍微提早放開', '這是婚禮上最常被點的曲子之一'], { rep: 1 }),
    arpL('十六分音符分解', '把 p-i-m-a 加快成十六分音符：一拍一組四個音。', PG.finger, 'p321p321p321p321', 0.25, TIP.finger, { mul: 0.6, rep: 1 }),
    arpL('6/8 慢搖滾分解', '50 年代抒情歌的招牌：C–Am–F–G 配上 6/8 的分解和弦。節拍器一下是一個八分音符。', PG.fifties, 'p32123', 1, ['F 用大封閉，根音在第 6 弦', '重音在第 1、4 下', '左手每個和弦都要整個按好再撥'], { bpb: 6, mul: 2.2 }),
    romance,
    arpL('三連音分解', '一拍三個音：根音、第 3 弦、第 2 弦，連續四拍。', PG.spanish, 'p32p32p32p32', 1 / 3, ['數「1-ta-ta、2-ta-ta」', '拇指落在每一拍的正拍上', 'Am–G–F–E 是佛朗明哥的「安達魯西亞終止式」'], { mul: 0.85 }),
    arpL('低音下行的分解和弦', '轉位和弦讓低音一步步往下走，配上分解和弦，就是一段完整的前奏。', PG.slash, 'p3231323', 0.5, ['每個和弦的第一個音就是那條下行的低音線', 'G/B 的根音在第 5 弦第 2 格', '低音彈重一點，讓它像第二條旋律'], { off: 1 }),
    arpL('Travis 指法：四和弦', '把 Travis 基本型套進流行四和弦，連續彈 8 小節。', PG.travis, 'p-q2p3q2', 0.5, ['F 的根音在第 6 弦，交替低音在第 4 弦', '保持拇指的穩定，其他都是其次', '彈熟後試著邊彈邊哼歌'], { off: 3 }),
    arpL('內外交替：p-m-i-a', '手指的順序改成中指、食指、無名指，打破習慣的順序，訓練手指獨立。', PG.eight, 'p2313231', 0.5, TIP.finger, { off: 2 }),
    harm,
    arpL('西班牙風分解和弦', '安達魯西亞終止式的十六分分解，速度不快但要平均。', PG.spanish, 'p3212321', 0.5, TIP.finger, { off: 1 }),
  ];

  // ===== 階段 12：綜合曲風與彈唱伴奏 =====
  T.s12 = [
    strumL('民謠流行：四和弦', '民謠刷法配上各個調的流行四和弦，包含封閉和弦。', PG.pop, 'D-DU-UDU', 0.5, TIP.strum),
    strumL('搖滾：強力和弦', '強力和弦只有根音和五度（兩到三條弦），全下刷八分音符，搖滾的基本火力。', PG.power, 'DDDDDDDD', 0.5, ['只刷有按的那兩三條弦，其他弦用左手手指輕觸悶住', '指型固定：食指根音，無名指、小指在下兩條弦往後兩格', '右手掌側輕靠琴橋做悶音（palm mute）會更有力']),
    strumL('藍調：12 小節 Shuffle', '完整的 12 小節藍調配上 shuffle 刷法。', PG.blues, 'D-UD-UD-UD-U', 1 / 3, ['長短長短的搖擺感', '第 9～10 小節的 V–IV 是藍調的高潮', '可以請朋友在上面即興五聲音階'], { rep: 1 }),
    strumL('鄉村：交替低音', '「根音、刷、五音、刷」——低音在兩條弦之間交替，鄉村與民謠的標準伴奏。', PG.eight, 'B-D-A-D-', 0.5, ['低音單獨撥一條弦，刷弦只刷細的三四條', '交替低音在根音的上一條弦（第 4 弦）', '保持像火車一樣穩定的律動'], { off: 2 }),
    strumL('雷鬼：反拍', '正拍全部休息，只在每個「&」短短地往下刷一下。', PG.sad, '.D.D.D.D', 0.5, ['刷完馬上放鬆左手把聲音切斷', '腳踩正拍、手刷反拍', '放鬆、往後靠，不要趕'], { off: 1 }),
    strumL('巴薩諾瓦', '拇指彈低音、手指撥和弦的簡化版 Bossa Nova：低音在第 1、3 拍，和弦落在切分的位置。', PG.maj7, 'B-D-BD-D', 0.5, ['用手指撥（不用 Pick）音色更柔', '和弦撥完稍微悶掉，保持輕巧', '律動要平、要穩，像海浪一樣']),
    strumL('抒情：16 Beat 伴奏', '慢歌的十六分刷法，配上小調起頭的四和弦。', PG.sad, mask('x...x.x..xx.x.x.'), 0.25, T16, { off: 2 }),
    arpL('指彈抒情：Travis', '用 Travis 指法伴奏一整段。', PG.travis, 'p-q2p3q2', 0.5, TIP.finger, { off: 2 }),
    strumL('爵士：四拍刷', '每拍一下的 Freddie Green 式伴奏，配上 ii–V–I–VI 循環。', PG.jazz, 'DDDD', 1, ['每一下刷完就放鬆左手，讓聲音短而有彈性', '第 2、4 拍稍微重一點', '只刷中間幾條弦，音色比較集中']),
    strumL('放克：十六分切分', '兩個七和弦的放克律動，右手不停地擺動十六分音符。', PG.funk, mask('x.xx.xx.x.xx.x.x'), 0.25, T16, { mul: 0.9, off: 1 }),
    strumL('華爾滋：根音與和弦', '三拍子的「蹦恰恰」，速度比之前更快。', PG.waltz, 'BDD', 1, ['第 1 拍的根音要飽滿', '刷弦輕巧', '可以想像舞者在旋轉'], { bpb: 3, off: 2 }),
    arpL('6/8 抒情分解', '6/8 拍的分解和弦配上小調進行。節拍器一下是一個八分音符。', PG.sad, 'p32123', 1, TIP.finger, { bpb: 6, mul: 2.2 }),
    strumL('西班牙風刷法', '安達魯西亞終止式配上有力的刷奏。', PG.spanish, mask('x.xxx.xx'), 0.5, ['刷弦用指甲背面往下彈出去，更有佛朗明哥的味道', '最後一個和弦是全曲的張力所在', '重音在每小節第 1 拍']),
    () => ({ title: '獨奏：12 小節藍調（A）', goal: '在 A 小調五聲指型裡完成一段完整的 12 小節獨奏。', tips: TIP.lead, notes: [2, 0, 3, 1, 2, 3].flatMap(i => lick(45, LICKS[i])), key: 'Am', tab: box(5) }),
    strumL('卡農搖滾', '卡農的八個和弦配上全下刷八分音符，把古典變成搖滾。', PG.canon, 'DDDDDDDD', 0.5, ['兩個封閉和弦連續出現，考驗耐力', '第 2、4 拍刷重', '一年前的你一定想不到自己能彈這個'], { rep: 1 }),
  ];

  const STAGES = [
    { name: '第一步：空弦、撥弦與單音', days: 30, bpm: [50, 72], t: T.s1, desc: '認識六條弦、左手按弦、爬格子，彈出第一批旋律。' },
    { name: '第一批開放和弦', days: 30, bpm: [52, 76], t: T.s2, desc: 'Em、Am、E、A、D 五個和弦，換和弦與最基本的刷弦。' },
    { name: 'C、G、Dm 與基本刷法', days: 30, bpm: [56, 84], t: T.s3, desc: '湊齊八大開放和弦，學會民謠刷法與三拍子。' },
    { name: '七和弦與藍調', days: 30, bpm: [60, 90], t: T.s4, desc: '屬七和弦、12 小節藍調、shuffle 與五聲音階樂句。' },
    { name: '指彈入門', days: 30, bpm: [56, 84], t: T.s5, desc: 'p-i-m-a 分工、分解和弦、6/8 拍與〈綠袖子〉〈愛的羅曼史〉。' },
    { name: 'F 和弦與封閉和弦', days: 30, bpm: [58, 86], t: T.s6, desc: '小封閉、大封閉 F、Bm、F#m，以及可移動的和弦指型。' },
    { name: '大調音階與旋律', days: 30, bpm: [62, 96], t: T.s7, desc: '五個調的大調音階、模進練習、可移動指型與名曲旋律。' },
    { name: '刷法進階：十六分與切分', days: 30, bpm: [60, 88], t: T.s8, desc: '16 Beat、切分、6/8、休止刷法與主歌副歌的編排。' },
    { name: '小調、五聲與獨奏', days: 30, bpm: [64, 100], t: T.s9, desc: '五聲音階指型、藍調音階、小調音階與 12 小節獨奏。' },
    { name: '色彩和弦', days: 30, bpm: [62, 92], t: T.s10, desc: 'sus、add9、maj7、m7、ii–V–I 與轉位和弦。' },
    { name: '指彈進階', days: 30, bpm: [60, 92], t: T.s11, desc: 'Travis 指法、泛音、卡農與各種分解和弦。' },
    { name: '綜合曲風與彈唱伴奏', days: 35, bpm: [66, 104], t: T.s12, desc: '民謠、搖滾、藍調、鄉村、雷鬼、巴薩、爵士、放克。' },
  ];

  const round2 = (x) => Math.max(40, Math.round(x / 2) * 2);

  function build() {
    const lessons = []; let day = 1, start = 1;
    STAGES.forEach((st, si) => {
      st.start = start; st.end = start + st.days - 1; st.index = si;
      let j = 0;
      for (let i = 0; i < st.days; i++, day++) {
        const bpm0 = st.bpm[0] + (st.bpm[1] - st.bpm[0]) * (i / (st.days - 1));
        let L;
        if (day === 365) {
          const chs = C('C', 'G', 'Am', 'F');
          L = { title: '畢業演出：指彈前奏＋刷弦＋16 Beat', goal: '恭喜走到第 365 天！一首完整的小曲：Travis 指法的前奏、民謠刷法的主歌、十六分刷法的副歌，最後收在 C 和弦。', tips: ['先用第一顆星確認每個段落', '三個段落的力度：輕、中、強', '一年前你連和弦都不會按——現在你是一位吉他手了'], notes: arp(chs, 'p-q2p3q2', 0.5).concat(strum(chs, 'D-DU-UDU', 0.5), strum(chs, mask('x.x.x.xxx.x.x.xx'), 0.25), [S(chs[0], 4)]), bpm: 84, key: 'C', ring: true };
        } else if (day % 7 === 0 && lessons.length >= 2) {
          const a = lessons[lessons.length - 1];
          let b = null;
          for (let k = lessons.length - 2; k >= 0 && k >= lessons.length - 6; k--) if (!lessons[k].review && lessons[k].bpb === a.bpb) { b = lessons[k]; break; }
          const src = b ? [b, a] : [a, a];
          L = { title: `第 ${day / 7} 週複習`, goal: b ? `把這週的「${b.title}」和「${a.title}」串在一起，一口氣彈完。` : `把「${a.title}」連續彈兩次，檢查自己是不是真的熟了。`, tips: ['兩段之間不要停', '先求準確，再求速度', '複習日也是檢查自己進步的好時機'], notes: src.flatMap(x => x.notes.map(n => ({ ...n }))), bpm: Math.min(...src.map(x => x.bpm)), bpb: a.bpb, key: a.key.n, ring: src.some(x => x.ring), review: true, fixed: true };
        } else {
          const tpl = st.t[j % st.t.length];
          const pass = Math.floor(j / st.t.length);
          const o = tpl({ pass, si, j, rnd: rng(day * 7919) });
          L = { ...o, bpm: round2(bpm0 * (o.bpmMul || 1)) };
          j++;
        }
        L.bpb = L.bpb || 4;
        L.notes = fill(L.notes.map(n => ({ ...n })), L.bpb);
        if (L.notes.reduce((a, n) => a + n.d, 0) / L.bpb < 3.5) L.notes = rep(L.notes, 2);
        L.notes.forEach(n => { n.d = Math.round(n.d * 120) / 120; });
        if (!L.fixed) assignTab(L.notes, L.tab);
        L.key = { n: L.key || '' };
        L.day = day; L.stage = si; L.flat = FLATKEY.test(L.key.n);
        L.chords = [...new Set(L.notes.filter(n => n.c).map(n => n.c))];
        L.ring = !!L.ring || L.chords.length > 0;
        lessons.push(L);
      }
      start += st.days;
    });
    return lessons;
  }

  const LESSONS = build();
  const noteName = (m, flat) => (flat ? FLAT : SHARP)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const pcName = (m, flat) => (flat ? FLAT : SHARP)[((m % 12) + 12) % 12];
  const api = { LESSONS, STAGES, OPEN, SN, noteName, pcName, chord };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.GUITAR365 = api;
})();
