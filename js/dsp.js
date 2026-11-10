/* Guitar 365 — 純運算的訊號處理（瀏覽器與 Node 測試共用）
 * yin：單音音高偵測｜chroma：12 音級能量（和弦辨識用）｜pluck：Karplus-Strong 撥弦合成
 */
(function (root) {
  // YIN 音高偵測，涵蓋 70–1100 Hz（木吉他第 6 弦空弦 82 Hz ～ 第 1 弦高把位）
  function yin(x, n, sr) {
    const tauMin = Math.max(2, Math.floor(sr / 1100));
    const tauMax = Math.min(Math.floor(sr / 70), Math.floor(n / 2));
    const W = n - tauMax;
    const d = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const df = x[j] - x[j + tau]; s += df * df; }
      d[tau] = s;
    }
    d[0] = 1; let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; d[tau] = run > 0 ? d[tau] * tau / run : 1; }
    const TH = 0.15;
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < TH) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) {
      let mi = tauMin; for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[mi]) mi = t;
      if (d[mi] < 0.3) tau = mi; else return { freq: 0, clarity: 0 };
    }
    let better = tau;
    if (tau > 1 && tau < tauMax) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = a + c - 2 * b;
      if (den) better = tau + (a - c) / (2 * den);
    }
    return { freq: sr / better, clarity: 1 - d[tau] };
  }

  // ---------- FFT ----------
  const cache = {};
  function plan(n) {
    if (cache[n]) return cache[n];
    const rev = new Uint32Array(n), bits = Math.log2(n);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rev[i] = r; }
    const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2), win = new Float32Array(n);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    return (cache[n] = { rev, cos, sin, win, re: new Float32Array(n), im: new Float32Array(n), mag: new Float32Array(n / 2) });
  }
  function spectrum(x, n) {
    const p = plan(n), { rev, cos, sin, win, re, im, mag } = p;
    for (let i = 0; i < n; i++) { re[rev[i]] = x[i] * win[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half;
          const tr = re[b] * cos[k] + im[b] * sin[k], ti = im[b] * cos[k] - re[b] * sin[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
    for (let i = 0; i < n / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    return mag;
  }

  // 12 音級能量：只取頻譜峰值、78–2500 Hz，結果總和為 1（沒有聲音時全為 0）
  function chroma(x, n, sr, out) {
    out = out || new Float32Array(12); out.fill(0);
    const mag = spectrum(x, n), hz = sr / n;
    const k0 = Math.max(2, Math.floor(78 / hz)), k1 = Math.min(n / 2 - 2, Math.ceil(2500 / hz));
    let mx = 0; for (let k = k0; k <= k1; k++) if (mag[k] > mx) mx = mag[k];
    if (mx <= 0) return out;
    const floor = mx * 0.04; let sum = 0;
    for (let k = k0; k <= k1; k++) {
      const b = mag[k];
      if (b < floor || b <= mag[k - 1] || b < mag[k + 1]) continue;
      const a = mag[k - 1], c = mag[k + 1], den = a + c - 2 * b;
      const f = (k + (den ? (a - c) / (2 * den) : 0)) * hz;
      const p = 69 + 12 * Math.log2(f / 440), r = Math.round(p);
      if (Math.abs(p - r) > 0.4) continue;
      const w = Math.sqrt(b);
      out[((r % 12) + 12) % 12] += w; sum += w;
    }
    if (sum > 0) for (let i = 0; i < 12; i++) out[i] /= sum;
    return out;
  }

  // 和弦樣板（判定「聽起來最像哪個和弦」時的比較對象）
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7], '5': [0, 7] };
  const TEMPLATES = [];
  for (let r = 0; r < 12; r++) for (const q in QUAL) TEMPLATES.push(QUAL[q].map(i => (r + i) % 12));
  function score(ch, pcs) {
    let s = 0, n2 = 0;
    for (let i = 0; i < 12; i++) n2 += ch[i] * ch[i];
    for (const p of pcs) s += ch[p];
    return n2 > 0 ? s / Math.sqrt(pcs.length * n2) : 0;
  }
  const inFrac = (ch, pcs) => { let s = 0; for (const p of pcs) s += ch[p]; return s; };
  const samePcs = (a, b) => a.length === b.length && a.every(p => b.includes(p));
  // 門檻以真實木吉他取樣校正：[和弦內能量比例, 相對最佳樣板, 相對同課其他和弦, 每個和弦音的最低能量]
  const STRICT = { easy: [0.35, 0.8, 0.95, 0.02], std: [0.42, 0.87, 1.0, 0.04], hard: [0.5, 0.92, 1.03, 0.055] };
  // target：目標和弦的音級陣列；others：這一課其他和弦的音級陣列；partial：上刷（只刷到部分的弦）
  function chordMatch(ch, target, others, level, partial) {
    const [minIn, mAll, mLesson, minPc] = STRICT[level] || STRICT.std;
    if (inFrac(ch, target) < minIn) return false;
    if (partial) return true;
    for (const p of target) if (ch[p] < minPc) return false;
    const st = score(ch, target);
    for (const o of others || []) if (!samePcs(o, target) && score(ch, o) * mLesson > st) return false;
    let best = 0; for (const t of TEMPLATES) { const v = score(ch, t); if (v > best) best = v; }
    return st >= best * mAll;
  }
  // 單音在一片餘音中是否明顯（指彈分解和弦用）
  function salient(ch, pc) { let mx = 0; for (let i = 0; i < 12; i++) if (ch[i] > mx) mx = ch[i]; return mx > 0 && ch[pc] >= mx * 0.6; }

  // Karplus-Strong 撥弦合成（含分數延遲，音準才會對）
  function pluck(midi, sr, dur, seed) {
    const f = 440 * Math.pow(2, (midi - 69) / 12), D = sr / f;
    const N = Math.floor(D - 0.5 - 1e-4), dl = D - 0.5 - N, C = (1 - dl) / (1 + dl);
    const len = Math.floor(sr * dur), out = new Float32Array(len), line = new Float32Array(N + 1);
    let s = (seed || midi * 7919) | 0;
    const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 2147483648 - 1; };
    // 激發訊號：雜訊經兩個低通，讓泛音大致以 1/n 遞減（接近真實撥弦的頻譜）
    let lp = 0, lp2 = 0; const a1 = Math.min(0.9, 2 * Math.PI * f * 1.2 / sr), a2 = Math.min(0.9, 2 * Math.PI * f * 5 / sr);
    for (let k = 0; k < 3; k++) for (let i = 0; i < N; i++) { lp += a1 * (rnd() - lp); lp2 += a2 * (lp - lp2); line[i] = lp2; }
    let m = 0; for (let i = 0; i < N; i++) m += line[i]; m /= N; for (let i = 0; i < N; i++) line[i] -= m;
    const decay = Math.pow(0.001, 1 / (f * Math.max(1.2, 4.5 - (midi - 40) * 0.06)));
    let ptr = 0, prev = 0, apx = 0, apy = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[ptr];
      const avg = 0.5 * (cur + prev) * decay; prev = cur;
      const y = C * avg + apx - C * apy; apx = avg; apy = y;
      line[ptr] = y; out[i] = cur;
      if (++ptr >= N) ptr = 0;
    }
    let pk = 0; for (let i = 0; i < len; i++) if (Math.abs(out[i]) > pk) pk = Math.abs(out[i]);
    if (pk > 0) for (let i = 0; i < len; i++) out[i] /= pk;
    return out;
  }

  // 起音強度：最近一段頻譜「超過前三段最大值」的部分（max-filtered spectral flux）。
  // 比單看音量可靠：和弦餘音的拍頻不會誤觸發，連續刷弦也分得開。scale 用來抵銷收音音量的差異
  let fxRef = null;
  function onsetFlux(buf, sr, scale) {
    const W = sr > 50000 ? 4096 : 2048, H = W >> 2, L = buf.length, hz = sr / W;
    if (L < W + 3 * H) return 0;
    const k0 = Math.floor(100 / hz), k1 = Math.min(W / 2 - 1, Math.floor(6000 / hz));
    if (!fxRef || fxRef.length !== k1 + 1) fxRef = new Float32Array(k1 + 1);
    fxRef.fill(0);
    for (let d = 1; d <= 3; d++) {
      const m = spectrum(buf.subarray(L - d * H - W, L - d * H), W);
      for (let k = k0; k <= k1; k++) { const v = Math.log(1 + m[k] * scale); if (v > fxRef[k]) fxRef[k] = v; }
    }
    const m = spectrum(buf.subarray(L - W, L), W); let f = 0;
    for (let k = k0; k <= k1; k++) { const v = Math.log(1 + m[k] * scale); if (v > fxRef[k]) f += v - fxRef[k]; }
    return f / (k1 - k0 + 1);
  }

  // 分析一個音框：buf 為最近 L 個取樣（L 為 2 的次方）
  let ds = null; const chBuf = new Float32Array(12);
  function analyze(buf, sr, wantChroma, scale) {
    const L = buf.length, recent = Math.floor(sr * 0.023);
    let s = 0;
    for (let i = L - recent; i < L; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / recent);
    const half = L >> 1, D = Math.max(1, Math.round(sr / 24000)), n = Math.floor(half / D);
    if (!ds || ds.length !== n) ds = new Float32Array(n);
    for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < D; k++) a += buf[half + i * D + k]; ds[i] = a / D; }
    const loud = rms > 0.002;
    const p = loud ? yin(ds, n, sr / D) : { freq: 0, clarity: 0 };
    const ch = wantChroma && loud ? chroma(buf, L, sr, chBuf) : null;
    return { rms, flux: loud ? onsetFlux(buf, sr, scale || 1) : 0, freq: p.freq, clarity: p.clarity, chroma: ch };
  }

  // 起音（撥弦／刷弦）＋穩定音高偵測。gate() 回傳目前的音量門檻
  class Detector {
    constructor(gate) { this.gate = gate; this.lastOnset = -1; this.lastT = null; this.armed = true; this.level = 0; this.buf = []; this.stable = null; this.silent = null; }
    // 交給 analyze 的音量正規化係數：以最近幾秒的最大音量為準
    scale() { return 0.12 / Math.max(this.level, this.gate() * 2, 0.01); }
    process(fr) {
      const gate = this.gate();
      const dt = this.lastT === null ? 0.015 : Math.max(0, fr.t - this.lastT); this.lastT = fr.t;
      this.level = Math.max(fr.rms, this.level * Math.pow(0.5, dt / 4));
      if (fr.flux < 0.02) this.armed = true;
      const onset = this.armed && fr.flux > 0.03 && fr.rms > gate && fr.t - this.lastOnset > 0.07;
      if (onset) { this.lastOnset = fr.t; this.armed = false; this.buf = []; }
      let midi = null;
      if (fr.rms > gate * 0.6 && fr.freq > 68 && fr.freq < 1150 && fr.clarity > 0.75) midi = Math.round(69 + 12 * Math.log2(fr.freq / 440));
      this.buf.push(midi); if (this.buf.length > 3) this.buf.shift();
      let stable = null;
      if (this.buf.length === 3 && this.buf.every(x => x !== null && (x - this.buf[0]) % 12 === 0)) stable = Math.min(...this.buf);
      let pitchChange = false;
      if (stable !== null) {
        if (this.stable === null || (((stable - this.stable) % 12) + 12) % 12 !== 0) pitchChange = true;
        this.stable = stable; this.silent = null;
      } else if (fr.rms < gate) {
        if (this.silent === null) this.silent = fr.t;
        if (fr.t - this.silent > 0.08) this.stable = null;
      }
      return { onset, midi, stable, pitchChange, rms: fr.rms, flux: fr.flux, freq: fr.freq, chroma: fr.chroma, t: fr.t };
    }
  }

  const api = { yin, spectrum, chroma, chordMatch, salient, score, inFrac, pluck, analyze, Detector, TEMPLATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GDSP = api;
})(typeof window !== 'undefined' ? window : globalThis);
