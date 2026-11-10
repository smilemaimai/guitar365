/* 開發用：在瀏覽器裡用合成吉他聲代替麥克風，實際跑一次練習流程。
 * 在 console 載入：  const s = document.createElement('script'); s.src = 'test/sim.js'; document.head.appendChild(s);
 * 然後：            __arm(day, 'pitch' | 'rhythm', { wrong: true, shift: 7, late: 0.2, gap: 0.5 })  再按「開始練習」
 */
(() => {
  const A = window.GuitarAudio, D = window.GDSP, G = window.GUITAR365, SR = 48000;
  const cache = {}; const pl = m => cache[m] || (cache[m] = D.pluck(m, SR, 3));
  A.startMic = async () => { A.ensureCtx(); };
  const origClick = A.click; let firstClick = null;
  A.click = (t, a, v) => { if (firstClick === null) firstClick = t; return origClick(t, a, v); };
  window.__arm = (day, mode, opts = {}) => { firstClick = null; window.__perf = { day, mode, opts, sig: null, base: 0, reads: 0 }; };
  const same = (a, b) => a.pcs.length === b.pcs.length && a.pcs.every(p => b.pcs.includes(p));
  function build(L, times, opts) {
    const evs = []; let k = 0;
    L.notes.forEach((n) => {
      if (n.r) return; const t = times[k++];
      if (n.c) {
        let c = n.c; if (opts.wrong) c = L.chords.find(x => x !== n.c && !same(x, n.c)) || G.chord(n.c.name === 'D' ? 'E' : 'D');
        let st = c.shape.map((f, s) => ({ f, s })).filter(x => x.f >= 0); if (n.u) st = st.slice(-4).reverse();
        st.forEach((x, i) => evs.push({ t: t + i * 0.012, m: G.OPEN[x.s] + x.f, vol: n.u ? 0.2 : 0.25, str: x.s }));
      } else evs.push({ t, m: n.m + (opts.shift || (opts.wrong ? 1 : 0)), vol: 0.3, str: n.s });
    });
    evs.sort((a, b) => a.t - b.t);
    const out = new Float32Array(Math.floor((times[times.length - 1] + 3) * SR));
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * 0.002;
    evs.forEach((e, j) => {
      const b = pl(e.m), o = Math.floor(e.t * SR); let cut = Infinity;
      for (let q = j + 1; q < evs.length; q++) if (evs[q].str === e.str) { cut = Math.floor(evs[q].t * SR) - o; break; }
      for (let i = 0; i < b.length && o + i < out.length && i < cut; i++) out[o + i] += b[i] * e.vol * (i > cut - 200 ? (cut - i) / 200 : 1);
    });
    return out;
  }
  A.read = (wantChroma, scale) => {
    const P = window.__perf; if (!P) return null; const now = A.now(); const L = G.LESSONS[P.day - 1];
    const zero = { rms: 0, flux: 0, freq: 0, clarity: 0, chroma: null, t: now };
    if (!P.sig) {
      const n = L.notes.filter(x => !x.r).length; const times = [];
      if (P.mode === 'rhythm') {
        if (firstClick === null) return zero;
        const bpm = +document.querySelector('#bpmVal').textContent, spb = 60 / bpm, t0 = firstClick + L.bpb * spb;
        let pos = 0; L.notes.forEach(x => { if (!x.r) times.push(1 + pos * spb + (P.opts.late || 0)); pos += x.d; });
        P.base = t0 + 0.08 - 1;   // 0.08 = 預設的延遲補償
      } else { for (let i = 0; i < n; i++) times.push(0.5 + i * (P.opts.gap || 0.5)); P.base = now; }
      P.sig = build(L, times, P.opts);
    }
    P.reads++;
    const end = Math.floor((now - P.base) * SR); if (end < 8192 || end > P.sig.length) return zero;
    const fr = D.analyze(P.sig.subarray(end - 8192, end), SR, wantChroma, scale); fr.t = now; return fr;
  };
  window.__status = () => ({ score: document.querySelector('#scoreVal').textContent, sub: document.querySelector('#scoreSub').textContent, result: (document.querySelector('#result').innerText || '').replace(/\s+/g, ' ').slice(0, 160) });
})();
