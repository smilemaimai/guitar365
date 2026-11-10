/* 開發用檢查：node test/check.js
 * 1) 課程資料完整性  2) 用合成吉他聲驗證單音／和弦／起音偵測
 */
const path = require('path');
const D = require(path.join(__dirname, '../js/dsp.js'));
const { LESSONS, STAGES, OPEN } = require(path.join(__dirname, '../js/lessons.js'));
let fail = 0;
const bad = (...a) => { fail++; console.log('✗', ...a); };

// ---------- 1) 課程 ----------
if (LESSONS.length !== 365) bad('lesson count', LESSONS.length);
const allChords = new Set();
LESSONS.forEach(L => {
  const tot = L.notes.reduce((a, n) => a + n.d, 0), bars = tot / L.bpb;
  const id = `Day ${L.day} ${L.title}`;
  if (Math.abs(bars - Math.round(bars)) > 1e-6) bad(id, 'bars', bars);
  if (bars < 4 || bars > 26) bad(id, 'length', bars, 'bars');
  if (!L.title || !L.goal || !(L.tips && L.tips.length >= 2)) bad(id, 'text');
  if (!(L.bpm >= 40 && L.bpm <= 240)) bad(id, 'bpm', L.bpm);
  if (/undefined|NaN|null/.test(L.title + L.goal + L.tips.join())) bad(id, 'text has undefined');
  const ev = L.notes.filter(n => !n.r);
  if (ev.length < 8 || ev.length > 200) bad(id, 'events', ev.length);
  L.notes.forEach((n, i) => {
    if (!(n.d > 0)) bad(id, 'dur', i, n.d);
    if (n.r) return;
    if (n.c) { allChords.add(n.c); return; }
    if (!(n.s >= 0 && n.s <= 5 && n.f >= 0 && n.f <= 15)) bad(id, 'pos', i, JSON.stringify(n));
    else if (!L.harm && OPEN[n.s] + n.f !== n.m && !/泛音/.test(L.title)) bad(id, 'pitch/pos mismatch', i, JSON.stringify(n));
  });
  if (L.tab && L.tab.maxFret !== undefined) ev.forEach(n => { if (!n.c && (n.f > L.tab.maxFret || n.f < (L.tab.minFret || 0))) bad(id, 'outside position', JSON.stringify(n)); });
});
allChords.forEach(c => { if (c.shape.length !== 6 || c.shape.some(f => f > 12) || c.pcs.length < 2) bad('chord', c.name, c.shape); });
console.log(`lessons: ${LESSONS.length}, stages: ${STAGES.length}, distinct chords: ${allChords.size}`);
STAGES.forEach(s => console.log(`  ${s.index + 1}. Day ${s.start}-${s.end} ${s.name}`));

// ---------- 2) 訊號 ----------
// 設定環境變數 BANK=<模組路徑>（匯出 { SR, note(m) }）可改用真實吉他取樣測試
const bank = process.env.BANK ? require(path.resolve(process.env.BANK)) : null;
const SR = bank ? bank.SR : 48000, FRAME = 8192, HOP = Math.round(SR * 0.015);
const cache = {};
const pl = (m) => cache[m] || (cache[m] = bank ? bank.note(m) : D.pluck(m, SR, 3));
console.log(bank ? 'source: real guitar samples' : 'source: synthesized plucks');
function render(events, dur, noise = 0.002) { // events: [{t, m, vol, str}]；同一條弦再撥一次時，前一個音會被切掉
  const out = new Float32Array(Math.floor(dur * SR));
  let s = 12345; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x3fffffff - 1; };
  for (let i = 0; i < out.length; i++) out[i] = rnd() * noise;
  const ev = [...events].sort((a, b) => a.t - b.t);
  ev.forEach((e, k) => {
    const b = pl(e.m), o = Math.floor(e.t * SR);
    const nx = e.str === undefined ? null : ev.slice(k + 1).find(x => x.str === e.str);
    const cut = nx ? Math.floor(nx.t * SR) - o : Infinity, fade = Math.floor(SR * 0.004);
    for (let i = 0; i < b.length && o + i < out.length && i < cut; i++) out[o + i] += b[i] * (e.vol || 0.3) * (i > cut - fade ? (cut - i) / fade : 1);
  });
  return out;
}
function frames(sig, chroma) {
  const det = new D.Detector(() => 0.012), evs = [];
  for (let end = FRAME; end <= sig.length; end += HOP) {
    const fr = D.analyze(sig.subarray(end - FRAME, end), SR, chroma, det.scale()); fr.t = end / SR;
    if (fr.chroma) fr.chroma = Float32Array.from(fr.chroma);
    evs.push(det.process(fr));
  }
  return evs;
}
const strumEv = (ch, t, up) => { let st = ch.shape.map((f, s) => ({ f, s })).filter(x => x.f >= 0); if (up) st = st.slice(-4).reverse(); return st.map((x, i) => ({ t: t + i * 0.012, m: OPEN[x.s] + x.f, vol: up ? 0.2 : 0.25, str: x.s })); };

// 2a 單音音高：每條弦 0–12 格
let ok = 0, n = 0, exact = 0;
for (let m = 40; m <= 76; m++) {
  const ev = frames(render([{ t: 0.3, m, vol: 0.4 }], 1.0), false);
  const st = ev.filter(e => e.stable !== null).map(e => e.stable);
  n++; if (st.length && st.filter(x => (x - m) % 12 === 0).length / st.length >= 0.9) ok++; else bad('pitch', m, [...new Set(st)]);
  if (st.length && st.every(x => x === m)) exact++;
}
console.log(`single-note pitch: ${ok}/${n} (exact octave ${exact}/${n})`);

// 2b 和弦辨識：每個和弦刷一下，目標要通過；課程中同課的其他和弦不可通過
let cOk = 0, cN = 0, fp = 0, fpN = 0;
const chordFrames = (ch, up) => frames(render(strumEv(ch, 0.3, up), 0.9), true).filter(e => e.t > 0.42 && e.t < 0.7 && e.chroma);
const frameCache = new Map();
const cf = (ch, up) => { const k = ch.name + ch.shape + up; if (!frameCache.has(k)) frameCache.set(k, chordFrames(ch, up)); return frameCache.get(k); };
for (const ch of allChords) for (const up of [false, true]) {
  const fr = cf(ch, up); const hit = fr.filter(e => D.chordMatch(e.chroma, ch.pcs, [], 'std', up)).length;
  cN++; if (hit / fr.length >= 0.6) cOk++; else bad('chord not recognised', ch.name, up ? 'up' : 'down', `${hit}/${fr.length}`);
}
const same = (a, b) => a.pcs.length === b.pcs.length && a.pcs.every(p => b.pcs.includes(p));
LESSONS.forEach(L => L.chords.forEach(target => L.chords.forEach(played => {
  if (played === target || same(played, target)) return;
  const others = L.chords.filter(x => x !== target).map(x => x.pcs);
  const fr = cf(played, false); const hit = fr.filter(e => D.chordMatch(e.chroma, target.pcs, others, 'std')).length;
  fpN++; if (hit / fr.length >= 0.4) { fp++; if (fp <= 12) console.log(`  confusable: play ${played.name} judged as ${target.name} ${hit}/${fr.length} (Day ${L.day})`); }
})));
console.log(`chord recognition: ${cOk}/${cN} pass; wrong-chord accepted: ${fp}/${fpN}`);

// 2c 起音：連續刷弦（八分、十六分）與分解和弦
function onsetTest(label, evList, times) { for (const g of [1, 0.25, 3]) onsetAt(`${label} ×${g}`, evList, times, g); }
function onsetAt(label, evList, times, g) {
  const dur = times[times.length - 1] + 0.8;
  const sig = render(evList, dur, 0.002 / g); for (let i = 0; i < sig.length; i++) sig[i] *= g;
  const ev = frames(sig, false).filter(e => e.onset).map(e => e.t);
  let hit = 0; const used = new Set();
  times.forEach(t => { const i = ev.findIndex((x, k) => !used.has(k) && x - t > -0.02 && x - t < 0.13); if (i >= 0) { used.add(i); hit++; } });
  const extra = ev.length - used.size;
  console.log(`onsets ${label}: ${hit}/${times.length} detected, ${extra} extra`);
  if (hit / times.length < 0.9 || extra > times.length * 0.1) bad('onset', label);
  return ev;
}
const G = [...allChords].find(c => c.name === 'G'), Cc = [...allChords].find(c => c.name === 'C'), Am = [...allChords].find(c => c.name === 'Am');
for (const [label, gap] of [['8th strum @100', 0.3], ['8th strum @140', 60 / 140 / 2], ['16th strum @80', 60 / 80 / 4], ['16th strum @100', 0.15]]) {
  const times = [], list = [];
  for (let i = 0; i < 16; i++) { const t = 0.4 + i * gap; times.push(t); list.push(...strumEv(i < 8 ? G : Cc, t, i % 2 === 1)); }
  onsetTest(label, list, times);
}
{ const times = [], list = []; [G, Cc, Am, G].forEach((ch, i) => { const t = 0.4 + i * 2.4; times.push(t); list.push(...strumEv(ch, t, false)); }); onsetTest('whole-note strums', list, times); }
{ const times = [], list = []; [64, 65, 67, 65, 64, 62, 60, 62, 55, 57, 59, 60].forEach((m, i) => { const t = 0.4 + i * 0.4; times.push(t); list.push({ t, m, vol: 0.3, str: 9 }); }); onsetTest('melody', list, times); }
{ const times = [], list = []; const order = [1, 3, 4, 3, 5, 3, 4, 3];
  for (let i = 0; i < 16; i++) { const t = 0.4 + i * 0.27; const s = order[i % 8]; times.push(t); list.push({ t, m: OPEN[s] + Am.shape[s], vol: 0.3, str: s }); }
  onsetTest('fingerstyle arpeggio 8ths', list, times);
  // 分解和弦的單音判定：目標音要被聽出來（YIN 或音級顯著）
  const ev = frames(render(list, 5.2), true); let good = 0;
  times.forEach((t, i) => { const pc = (OPEN[order[i % 8]] + Am.shape[order[i % 8]]) % 12; const w = ev.filter(e => e.t > t + 0.03 && e.t < t + 0.3); if (w.some(e => (e.midi !== null && e.midi % 12 === pc) || (e.chroma && D.salient(e.chroma, pc)))) good++; });
  console.log(`arpeggio note check: ${good}/${times.length}`); if (good < 14) bad('arpeggio notes');
}
console.log(fail ? `\n${fail} problem(s)` : '\nall checks passed');
process.exit(fail ? 1 : 0);
