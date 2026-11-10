/* Guitar 365 — 音訊引擎：麥克風、撥弦合成示範、節拍器 */
(function () {
  const D = window.GDSP;
  let ctx = null, stream = null, src = null, inGain = null, analyser = null, buf = null;
  let master = null, noiseBuf = null, live = [];
  const plucks = {};

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  async function startMic(gain = 1) {
    ensureCtx();
    if (stream) return;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('INSECURE');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    src = ctx.createMediaStreamSource(stream);
    inGain = ctx.createGain(); inGain.gain.value = gain;
    analyser = ctx.createAnalyser();
    analyser.fftSize = ctx.sampleRate > 50000 ? 16384 : 8192;
    analyser.smoothingTimeConstant = 0;
    src.connect(inGain); inGain.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
  }

  function stopMic() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try { src && src.disconnect(); } catch (e) { }
    stream = src = analyser = null;
  }

  function setGain(g) { if (inGain) inGain.gain.value = g; }
  const micOn = () => !!stream;

  function read(wantChroma, scale) {
    if (!analyser) return null;
    analyser.getFloatTimeDomainData(buf);
    const fr = D.analyze(buf, ctx.sampleRate, wantChroma, scale);
    fr.t = ctx.currentTime;
    return fr;
  }

  // ---------- 輸出 ----------
  function out() {
    ensureCtx();
    if (!master) { master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); }
    return master;
  }
  function track(node, t0, t1) { live.push(node); node.onended = () => { live = live.filter(x => x !== node); }; node.start(t0); node.stop(t1); }

  // 單音：Karplus-Strong 撥弦。ring=true 時讓音自然延續（分解和弦）
  function note(m, t, dur, vol = 0.5, ring = false) {
    const o = out();
    if (!plucks[m]) { const d = D.pluck(m, ctx.sampleRate, 3); const b = ctx.createBuffer(1, d.length, ctx.sampleRate); b.getChannelData(0).set(d); plucks[m] = b; }
    const s = ctx.createBufferSource(); s.buffer = plucks[m];
    const g = ctx.createGain();
    const end = ring ? t + Math.max(dur, 1.6) : t + Math.max(0.1, dur * 0.95);
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0, end, 0.05);
    s.connect(g); g.connect(o);
    track(s, t, end + 0.35);
  }

  // 和弦刷奏：shape 為 6 條弦的格數（-1 不彈），up=true 為上刷（只刷高音 4 條弦）
  function strum(shape, open, t, dur, up, vol = 0.32) {
    let strings = shape.map((f, s) => ({ f, s })).filter(x => x.f >= 0);
    if (up) strings = strings.slice(-4).reverse();
    strings.forEach((x, i) => note(open[x.s] + x.f, t + i * 0.012, Math.max(0.15, dur - i * 0.012), vol * (up ? 0.8 : 1), false));
  }

  function click(t, accent, vol = 0.6) {
    const o = out();
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = accent ? 5200 : 3400; bp.Q.value = 1.4;
    const g = ctx.createGain();
    const v = vol * (accent ? 1.0 : 0.6);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.03);
    s.connect(bp); bp.connect(g); g.connect(o);
    track(s, t, t + 0.04);
  }

  function stopAll() {
    live.forEach(n => { try { n.stop(0); } catch (e) { } });
    live = [];
    if (master) { try { master.disconnect(); } catch (e) { } master = null; }
  }

  window.GuitarAudio = {
    ensureCtx, startMic, stopMic, setGain, micOn, read, note, strum, click, stopAll,
    now: () => (ctx ? ctx.currentTime : 0),
    get ctx() { return ctx; },
  };
})();
