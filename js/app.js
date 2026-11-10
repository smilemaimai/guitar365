/* Guitar 365 — 介面與練習邏輯 */
(function () {
  const { LESSONS, STAGES, OPEN, SN, noteName, pcName } = window.GUITAR365;
  const A = window.GuitarAudio, D = window.GDSP;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 儲存 ----------
  const LS = 'guitar365.v1';
  const DEF = { gain: 1, gate: 0.012, tol: 'std', chordTol: 'std', latency: 0.08, octave: false, metro: 'full', clickVol: 0.6, pass: 80, pitchMetro: true, introDone: false };
  let store = {};
  try { store = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { store = {}; }
  store.lessons = store.lessons || {}; store.days = store.days || [];
  store.settings = Object.assign({}, DEF, store.settings || {});
  const S = () => store.settings;
  function save() { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) { } }
  const rec = (d) => (store.lessons[d] = store.lessons[d] || { p: false, r: false, ps: 0, rs: 0 });
  const stars = (d) => { const r = store.lessons[d]; return r ? (r.p ? 1 : 0) + (r.r ? 1 : 0) : 0; };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function markPracticed() { const d = fmt(new Date()); if (!store.days.includes(d)) store.days.push(d); }
  function streak() { const set = new Set(store.days); let n = 0; const d = new Date(); if (!set.has(fmt(d))) d.setDate(d.getDate() - 1); while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); } return n; }
  function nextDay() { for (const L of LESSONS) if (stars(L.day) < 2) return L.day; return 365; }
  const TOL = { easy: 0.15, std: 0.1, hard: 0.06 };
  const pc = (m) => ((m % 12) + 12) % 12;
  const match = (a, b) => S().octave ? a === b : pc(a - b) === 0;
  const totalBeats = (L) => L.notes.reduce((a, n) => a + n.d, 0);
  const unit = (L) => L.bpb === 6 ? '♪' : '♩';

  function toast(msg, ms = 3200) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
  }
  async function needMic() {
    try { await A.startMic(S().gain); return true; }
    catch (e) {
      toast(e.message === 'INSECURE' ? '麥克風需要在 HTTPS（例如 GitHub Pages）或 localhost 下才能使用' : '無法開啟麥克風，請在瀏覽器允許麥克風權限', 5000);
      return false;
    }
  }

  // ---------- 偵測迴圈 ----------
  function makeLoop(onFrame, wantChroma) {
    const det = new D.Detector(() => S().gate);
    const id = setInterval(() => { const fr = A.read(wantChroma, det.scale()); if (fr) onFrame(det.process(fr), fr); }, 15);
    return { stop() { clearInterval(id); } };
  }
  // 這個音框是否支持「目標事件 n 被彈出來了」。v = { midi, chroma }
  function others(L, c) { return L.chords.filter(x => x !== c).map(x => x.pcs); }
  function frameOK(L, n, v) {
    if (n.c) return !!v.chroma && D.chordMatch(v.chroma, n.c.pcs, others(L, n.c), S().chordTol, n.u);
    if (v.midi !== null && v.midi !== undefined && match(v.midi, n.m)) return true;
    return !!v.chroma && D.salient(v.chroma, pc(n.m));
  }
  function bestChord(L, ch) {
    let best = null, bs = 0;
    for (const c of L.chords) { const s = D.score(ch, c.pcs); if (s > bs && D.inFrac(ch, c.pcs) >= 0.35) { bs = s; best = c; } }
    return best;
  }

  let sess = null;
  function stopSession() { if (sess) { try { sess.stop(); } catch (e) { } sess = null; } A.stopAll(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden && sess) { stopSession(); route(); } });

  // ---------- 路由 ----------
  function route() {
    if (sess) { try { sess.stop(); } catch (e) { } sess = null; }
    A.stopAll();
    const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
    const p = parts[0] || 'home';
    if (p === 'lesson') viewLesson(+parts[1]);
    else if (p === 'tuner') viewTuner();
    else if (p === 'settings') viewSettings();
    else viewHome();
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.p === (p === 'lesson' ? 'home' : p)));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- 首頁 ----------
  function viewHome() {
    const tot = LESSONS.reduce((a, L) => a + stars(L.day), 0);
    const done = LESSONS.filter(L => stars(L.day) === 2).length;
    const nd = nextDay(), NL = LESSONS[nd - 1];
    app.innerHTML = `
      ${S().introDone ? '' : `<section class="card intro">
        <h2>開始之前</h2>
        <ol>
          <li><b>每一課兩顆星</b>：① 彈對（不限時間）→ ② 彈對＋節奏（跟節拍器）。兩顆都拿到就是 <span class="cbadge">COMPLETE</span>。</li>
          <li><b>收音</b>：把手機或筆電放在吉他正前方約 30～50 公分，對著音孔。單音和和弦刷奏都聽得懂。</li>
          <li><b>節奏模式建議戴耳機</b>聽節拍器，避免麥克風收到點擊聲。</li>
          <li>先到 <a href="#/tuner">調音器</a> 把六條弦調準；第一次使用也請到 <a href="#/settings">設定</a> 做一次「延遲校正」。</li>
        </ol>
        <button class="btn primary" id="introOk">知道了</button>
      </section>`}
      <section class="card hero">
        <div class="hero-top">
          <div><div class="eyebrow">年度進度</div><div class="big">${done}<span> / 365 課 COMPLETE</span></div></div>
          <div class="stats"><div><b>${tot}</b><small>★ / 730</small></div><div><b>${streak()}</b><small>連續天數</small></div></div>
        </div>
        <div class="bar"><i style="width:${(tot / 730 * 100).toFixed(2)}%"></i></div>
        <a class="next" href="#/lesson/${nd}">
          <div><small>今天練這課 · Day ${nd} · ${esc(STAGES[NL.stage].name)}</small><strong>${esc(NL.title)}</strong></div><span class="play">▶</span>
        </a>
      </section>
      <section class="stages">${STAGES.map(st => stageCard(st, st.index === NL.stage, nd)).join('')}</section>`;
    const ok = $('#introOk'); if (ok) ok.onclick = () => { S().introDone = true; save(); viewHome(); };
  }
  function stageCard(st, open, nd) {
    const days = LESSONS.slice(st.start - 1, st.end);
    const s = days.reduce((a, L) => a + stars(L.day), 0), max = days.length * 2;
    const c = days.filter(L => stars(L.day) === 2).length;
    return `<details class="card stage" ${open ? 'open' : ''}>
      <summary>
        <div class="st-head"><span class="st-num">${st.index + 1}</span>
          <div class="st-t"><strong>${esc(st.name)}</strong><small>Day ${st.start}–${st.end} · ${esc(st.desc)}</small></div>
          <span class="st-pct">${c}/${days.length}</span></div>
        <div class="bar thin"><i style="width:${(s / max * 100).toFixed(1)}%"></i></div>
      </summary>
      <div class="days">${days.map(L => { const k = stars(L.day); return `<a href="#/lesson/${L.day}" class="day s${k}${L.day === nd ? ' cur' : ''}${L.review ? ' rev' : ''}" title="${esc(L.title)}"><b>${L.day}</b><i>${k === 2 ? '✓' : '★'.repeat(k) + '☆'.repeat(2 - k)}</i></a>`; }).join('')}</div>
    </details>`;
  }

  // ---------- 六線譜 ----------
  function renderTab(L) {
    const minD = Math.min(...L.notes.map(n => n.d));
    const ppb = Math.max(L.bpb === 6 ? 36 : 54, Math.min(136, 34 / minD));
    const left = 34, top = 30, sp = 20, tot = totalBeats(L), bot = top + 5 * sp;
    const W = Math.ceil(left + tot * ppb + 20), H = bot + 44;
    L._g = { ppb, left, top, sp };
    let s = `<svg class="tab" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    for (let i = 0; i < 6; i++) { const y = top + i * sp; s += `<line x1="${left - 8}" x2="${W - 8}" y1="${y}" y2="${y}" class="str"/><text x="12" y="${y + 4}" class="sl">${SN[5 - i]}</text>`; }
    const nb = Math.round(tot / L.bpb);
    for (let b = 0; b <= nb; b++) {
      const x = left + b * L.bpb * ppb;
      s += `<line x1="${x}" x2="${x}" y1="${top}" y2="${bot}" class="barl"/>`;
      if (b < nb) for (let k = 0; k < L.bpb; k++) s += `<text x="${x + k * ppb + 12}" y="${top - 14}" class="beat${k === 0 || (L.bpb === 6 && k === 3) ? ' b1' : ''}">${k + 1}</text>`;
    }
    let pos = 0, lastCh = null;
    L.notes.forEach((n, i) => {
      const x = left + pos * ppb + 12;
      const barStart = Math.abs(pos / L.bpb - Math.round(pos / L.bpb)) < 1e-6;
      if (n.r) s += `<rect x="${x - 6}" y="${top + 2.5 * sp - 3}" width="12" height="6" rx="2" class="rest"/>`;
      else if (n.c) {
        let played = n.c.shape.map((f, k) => f >= 0 ? k : -1).filter(k => k >= 0);
        if (n.u) played = played.slice(-4);
        const y1 = top + (5 - played[played.length - 1]) * sp - 8, y2 = top + (5 - played[0]) * sp + 8;
        s += `<g class="nt ch" id="n${i}"><rect x="${x - 8}" y="${y1}" width="16" height="${y2 - y1}" rx="8"/><text x="${x}" y="${(y1 + y2) / 2 + 5}">${n.u ? '↑' : '↓'}</text></g>`;
        if (n.c !== lastCh || barStart) s += `<text x="${x}" y="${bot + 26}" class="nn cn" id="nn${i}">${esc(n.c.name)}</text>`;
        lastCh = n.c;
      } else {
        const y = top + (5 - n.s) * sp;
        s += `<g class="nt" id="n${i}"><circle cx="${x}" cy="${y}" r="9.5"/><text x="${x}" y="${y + 4.5}">${n.f}</text></g><text x="${x}" y="${bot + 26}" class="nn" id="nn${i}">${pcName(n.m, L.flat)}</text>`;
        lastCh = null;
      }
      pos += n.d;
    });
    s += `<line id="playhead" x1="-20" x2="-20" y1="${top - 8}" y2="${bot + 8}" class="ph"/>`;
    return s + '</svg>';
  }
  const noteX = (L, i) => { let p = 0; for (let k = 0; k < i; k++) p += L.notes[k].d; return L._g.left + p * L._g.ppb + 12; };

  // 和弦指法圖
  function chordDiagram(ch) {
    const fr = ch.shape.filter(f => f > 0), mx = Math.max(0, ...fr), base = mx <= 4 ? 1 : Math.min(...fr);
    const x0 = 16, y0 = 32, dx = 10, dy = 12, W = x0 + 5 * dx + 16, H = y0 + 4 * dy + 8;
    let s = `<svg class="cd" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><text x="${x0 + 2.5 * dx}" y="13" class="cdn">${esc(ch.name)}</text>`;
    for (let i = 0; i < 6; i++) s += `<line x1="${x0 + i * dx}" x2="${x0 + i * dx}" y1="${y0}" y2="${y0 + 4 * dy}" class="cdl"/>`;
    for (let r = 0; r <= 4; r++) s += `<line x1="${x0}" x2="${x0 + 5 * dx}" y1="${y0 + r * dy}" y2="${y0 + r * dy}" class="${r === 0 && base === 1 ? 'cdnut' : 'cdl'}"/>`;
    if (base > 1) s += `<text x="${x0 - 5}" y="${y0 + dy * 0.5 + 4}" class="cdf">${base}</text>`;
    ch.shape.forEach((f, i) => {
      const x = x0 + i * dx;
      if (f < 0) s += `<text x="${x}" y="${y0 - 5}" class="cdx">×</text>`;
      else if (f === 0) s += `<circle cx="${x}" cy="${y0 - 8}" r="2.8" class="cdo"/>`;
      else s += `<circle cx="${x}" cy="${y0 + (f - base + 0.5) * dy}" r="4" class="cdd"/>`;
    });
    return s + '</svg>';
  }

  // ---------- 課程頁 ----------
  function viewLesson(day) {
    const L = LESSONS[day - 1]; if (!L) { location.hash = '#/'; return; }
    const st = STAGES[L.stage];
    const r0 = store.lessons[day] || {};
    let mode = r0.p && !r0.r ? 'rhythm' : 'pitch';
    let bpm = L.bpm;
    const evs = L.notes.filter(n => !n.r), nStrum = evs.filter(n => n.c).length;
    const count = nStrum === 0 ? `${evs.length} 個音` : nStrum === evs.length ? `刷 ${nStrum} 下` : `${evs.length - nStrum} 個音＋刷 ${nStrum} 下`;
    app.innerHTML = `
      <div class="crumbs"><a href="#/">← 全部課程</a><span>階段 ${st.index + 1}・${esc(st.name)}</span></div>
      <section class="card lesson-head">
        <div class="lh-top"><span class="daytag">DAY ${day}<small> / 365</small></span><div class="lstars" id="lstars"></div></div>
        <h1>${esc(L.title)}</h1>
        <div class="chips">${L.key.n ? `<span>${esc(L.key.n)} 調</span>` : ''}<span>${L.bpb === 6 ? '6/8 拍' : L.bpb + '/4 拍'}</span><span>目標 ${unit(L)}= ${L.bpm}</span><span>${Math.round(totalBeats(L) / L.bpb)} 小節</span><span>${count}</span>${L.review ? '<span class="rv">複習日</span>' : ''}</div>
        <p class="goal">${esc(L.goal)}</p>
        <ul class="tips">${L.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        ${L.chords.length ? `<div class="chordbox">${L.chords.map(chordDiagram).join('')}</div><p class="cdhelp">和弦圖：左邊是第 6 弦（最粗），× 不彈、○ 空弦，左側數字是起始格數。</p>` : ''}
      </section>
      <section class="card practice">
        <div class="modes">
          <button data-mode="pitch"><span>①</span> 彈對</button>
          <button data-mode="rhythm"><span>②</span> 彈對＋節奏</button>
        </div>
        <p class="mode-desc" id="modeDesc"></p>
        <div class="tabwrap" id="tabwrap">${renderTab(L)}</div>
        <div class="live">
          <div class="cell"><small>目標</small><b id="tgtNote">–</b><span id="tgtPos"></span></div>
          <div class="cell"><small>聽到</small><b id="heard">–</b><div class="meter"><i id="meter"></i><em id="gateMark"></em></div></div>
          <div class="cell"><small id="scoreLbl">進度</small><b id="scoreVal">0%</b><span id="scoreSub"></span></div>
        </div>
        <div class="controls">
          <button class="btn ghost" id="demoBtn">🔊 聽示範</button>
          <div class="bpm"><button id="bpmDown" aria-label="減速">−</button><span><b id="bpmVal">${bpm}</b><small> BPM</small></span><button id="bpmUp" aria-label="加速">+</button></div>
          <button class="btn primary" id="startBtn">🎤 開始練習</button>
        </div>
        <div id="result"></div>
      </section>
      <nav class="pager">${day > 1 ? `<a href="#/lesson/${day - 1}">← Day ${day - 1}</a>` : '<span></span>'}${day < 365 ? `<a href="#/lesson/${day + 1}">Day ${day + 1} →</a>` : ''}</nav>`;

    const wrap = $('#tabwrap');
    $('#gateMark').style.left = Math.min(100, Math.sqrt(S().gate / 0.25) * 100) + '%';
    let curEl = null, curN = null;
    const ui = {
      setCurrent(i) {
        if (curEl) curEl.classList.remove('cur');
        curEl = i == null ? null : $('#n' + i);
        curN = i == null ? null : L.notes[i];
        if (curEl) {
          curEl.classList.add('cur');
          const n = curN;
          $('#tgtNote').textContent = n.c ? n.c.name : pcName(n.m, L.flat);
          $('#tgtPos').textContent = n.c ? (n.u ? '上刷 ↑' : '下刷 ↓') : `第 ${6 - n.s} 弦 ${n.f === 0 ? '空弦' : '第 ' + n.f + ' 格'}`;
          this.follow(noteX(L, i));
        }
      },
      // 「彈對」模式：目標音跑出畫面時才平滑捲動一次
      follow(x) {
        if (this.live) return;
        const w = wrap.clientWidth;
        if (x < wrap.scrollLeft + 40 || x > wrap.scrollLeft + w - 90) wrap.scrollTo({ left: Math.max(0, x - w * 0.3), behavior: 'smooth' });
      },
      mark(i, cls) { const el = $('#n' + i); if (el) { el.classList.remove('cur', 'hit', 'miss', 'wrong'); el.classList.add(cls); } },
      flashWrong(i) {
        const el = $('#n' + i); if (el) { el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 350); }
        const h = $('#heard'); h.classList.add('err'); setTimeout(() => h.classList.remove('err'), 400);
      },
      heard(ev) {
        let txt = '–';
        if (curN && curN.c) { const b = ev.chroma && ev.rms > S().gate * 0.6 ? bestChord(L, ev.chroma) : null; if (b) txt = b.name; }
        else { const m = ev.stable ?? ev.midi; if (m != null) txt = pcName(m, L.flat); }
        $('#heard').textContent = txt;
        $('#meter').style.width = Math.min(100, Math.sqrt(ev.rms / 0.25) * 100) + '%';
      },
      score(v, lbl, sub) { $('#scoreVal').textContent = v; if (lbl) $('#scoreLbl').textContent = lbl; $('#scoreSub').textContent = sub || ''; },
      // 示範與節奏模式：播放線每一格都在動，譜直接跟著定位（不用平滑捲動，否則動畫會一直被重啟而卡住）
      playhead(x) {
        const ph = $('#playhead'); ph.setAttribute('x1', x); ph.setAttribute('x2', x);
        this.live = x >= 0;
        if (this.live) wrap.scrollLeft = Math.max(0, x - wrap.clientWidth * 0.3);
      },
      reset() {
        document.querySelectorAll('.tab .nt').forEach(e => e.classList.remove('cur', 'hit', 'miss', 'wrong', 'bad'));
        ui.playhead(-20); wrap.scrollLeft = 0; ui.score('0%', mode === 'pitch' ? '正確率' : '命中', ''); $('#result').innerHTML = '';
        curEl = null; curN = null; $('#tgtNote').textContent = '–'; $('#tgtPos').textContent = ''; $('#heard').textContent = '–';
      },
    };

    function paintStars() {
      const r = store.lessons[day] || {};
      $('#lstars').innerHTML = `<span class="${r.p ? 'on' : ''}" title="彈對">★<small>彈對</small></span><span class="${r.r ? 'on' : ''}" title="彈對＋節奏">★<small>節奏</small></span>${r.p && r.r ? '<span class="cbadge">COMPLETE</span>' : ''}`;
      const rb = document.querySelector('[data-mode=rhythm]');
      rb.classList.toggle('locked', !r.p);
      rb.innerHTML = `<span>②</span> 彈對＋節奏${r.p ? '' : ' 🔒'}`;
    }
    function setMode(m) {
      const r = store.lessons[day] || {};
      if (m === 'rhythm' && !r.p) { toast('先完成 ① 彈對，拿到第一顆星才能解鎖節奏挑戰'); return; }
      stopAll(); mode = m;
      document.querySelectorAll('.modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
      $('#modeDesc').innerHTML = m === 'pitch'
        ? `照著六線譜一個一個彈，<b>不限時間</b>。彈對才會前進，彈錯會記一次失誤。${L.chords.length ? '↓ ↑ 是下刷、上刷整個和弦。' : ''}正確率 ≥ ${S().pass}% 拿到 <b>第一顆星 ★</b>。<label class="pm"><input type="checkbox" id="pMetro" ${S().pitchMetro ? 'checked' : ''}> 背景節拍器<small>照目前的 BPM 響，可以自己跟著拍子彈；不計分</small></label>`
        : `預備拍 ${L.bpb} 下後，跟著節拍器在<b>正確的時間</b>彈出<b>正確的音或和弦</b>。命中率 ≥ ${S().pass}% 且速度 ≥ ${L.bpm} BPM，拿到 <b>第二顆星 ★</b> 並完成本課。可以先降速練習。`;
      const pm = $('#pMetro'); if (pm) pm.onchange = () => { S().pitchMetro = pm.checked; save(); };
      ui.reset();
    }
    function stopAll() { stopSession(); demoing = false; practicing = false; $('#demoBtn').textContent = '🔊 聽示範'; $('#startBtn').textContent = '🎤 開始練習'; $('#startBtn').classList.remove('stop'); }

    // 示範
    let demoing = false, practicing = false;
    $('#demoBtn').onclick = () => {
      if (demoing) { stopAll(); ui.reset(); return; }
      stopAll(); ui.reset(); A.ensureCtx(); demoing = true; $('#demoBtn').textContent = '■ 停止示範';
      const spb = 60 / bpm, t0 = A.now() + 0.3 + L.bpb * spb;
      for (let b = 0; b < L.bpb; b++) metro(L, t0 - (L.bpb - b) * spb, b, S().clickVol);
      let pos = 0; const evl = [];
      L.notes.forEach((n, i) => {
        const t = t0 + pos * spb;
        if (n.c) A.strum(n.c.shape, OPEN, t, n.d * spb, n.u);
        else if (!n.r) A.note(n.m, t, n.d * spb, 0.5, L.ring);
        if (!n.r) evl.push({ i, t });
        pos += n.d;
      });
      const tb = totalBeats(L); for (let b = 0; b < tb; b++) metro(L, t0 + b * spb, b, S().clickVol * 0.4);
      const end = t0 + tb * spb; let k = 0;
      let alive = true;
      sess = { stop() { alive = false; } };
      (function anim() {
        if (!alive) return;
        const now = A.now();
        const beats = (now - t0) / spb;
        ui.playhead(L._g.left + beats * L._g.ppb + 12);
        if (beats < 0) ui.score(String(Math.ceil(-beats)), '預備', '');
        while (k < evl.length && evl[k].t <= now) { ui.setCurrent(evl[k].i); k++; }
        if (beats >= 0) ui.score(`${Math.min(100, Math.round(beats / tb * 100))}%`, '示範', '');
        if (now > end + 0.3) { stopAll(); ui.reset(); return; }
        requestAnimationFrame(anim);
      })();
    };

    $('#bpmDown').onclick = () => { bpm = Math.max(40, bpm - (L.bpb === 6 ? 10 : 5)); $('#bpmVal').textContent = bpm; };
    $('#bpmUp').onclick = () => { bpm = Math.min(260, bpm + (L.bpb === 6 ? 10 : 5)); $('#bpmVal').textContent = bpm; };
    document.querySelectorAll('.modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));

    $('#startBtn').onclick = async () => {
      if (practicing) { stopAll(); ui.reset(); return; }
      stopAll(); ui.reset();
      if (!(await needMic())) return;
      practicing = true; $('#startBtn').textContent = '■ 停止'; $('#startBtn').classList.add('stop');
      sess = mode === 'pitch' ? pitchSession(L, ui, done, () => bpm) : rhythmSession(L, bpm, ui, done);
    };

    function done(res) {
      practicing = false; sess = null; $('#startBtn').textContent = '🎤 再練一次'; $('#startBtn').classList.remove('stop');
      const r = rec(day); const before = stars(day);
      let passed = false, msg = '';
      if (res.mode === 'pitch') {
        r.ps = Math.max(r.ps || 0, res.score);
        passed = res.score >= S().pass;
        if (passed) r.p = true;
        msg = `正確率 ${res.score}%（失誤 ${res.mistakes} 次）`;
      } else {
        r.rs = Math.max(r.rs || 0, res.score);
        const fastEnough = bpm >= L.bpm;
        passed = res.score >= S().pass && fastEnough;
        if (passed) r.r = true;
        msg = `命中 ${res.hits}/${res.total}（${res.score}%）・速度 ${bpm} BPM`;
        if (res.avgOff != null) msg += `・平均${res.avgOff < 0 ? '偏早' : '偏晚'} ${Math.abs(Math.round(res.avgOff * 1000))} ms`;
        if (res.score >= S().pass && !fastEnough) msg += `<br>彈得很好！把速度調到 ${L.bpm} BPM 再挑戰一次就能拿星。`;
      }
      markPracticed(); save(); paintStars();
      const after = stars(day);
      const complete = after === 2 && before < 2;
      $('#result').innerHTML = `<div class="result ${passed ? 'ok' : 'no'} ${complete ? 'complete' : ''}">
        <div class="r-icon">${complete ? '🏆' : passed ? '★' : '↻'}</div>
        <div class="r-body"><strong>${complete ? 'COMPLETE！這課完成了' : passed ? (res.mode === 'pitch' ? '拿到第一顆星！節奏挑戰已解鎖' : '通過！') : '再試一次'}</strong><p>${msg}</p>
        ${!passed ? `<p class="hint">需要 ≥ ${S().pass}%。${res.mode === 'rhythm' ? '可以先降低 BPM、戴耳機，或到設定裡做延遲校正。' : (L.chords.length ? '和弦一直被判錯時，先逐弦檢查有沒有悶掉的音，或到設定把「和弦判定」調寬鬆。' : '每個音彈清楚、彈完整，偵測會更穩。')}</p>` : ''}</div>
        <div class="r-act">${passed && res.mode === 'pitch' && !r.r ? '<button class="btn primary" id="goR">挑戰 ② 節奏 →</button>' : ''}${complete || (passed && r.r && day < 365) ? `<a class="btn primary" href="#/lesson/${day + 1}">下一課 →</a>` : ''}</div>
      </div>`;
      const g = $('#goR'); if (g) g.onclick = () => setMode('rhythm');
    }

    paintStars(); setMode(mode);
  }

  function metro(L, t, b, vol) {
    const strong = b % L.bpb === 0, mid = L.bpb === 6 && b % 3 === 0;
    A.click(t, strong || mid, strong ? vol : mid ? vol * 0.75 : vol);
  }

  // 模式 ①：彈對（不限時間）
  // 吉他的前一個音常常還在響（空弦、和弦餘音），所以不等「單一穩定音高」，
  // 而是：偵測到起音後的一小段時間內，只要有音框符合目標（音高或音級能量）就算對。
  function pitchSession(L, ui, done, getBpm) {
    const idx = L.notes.map((n, i) => n.r ? -1 : i).filter(i => i >= 0);
    let k = 0, mistakes = 0, pending = false, attackT = 0, hitT = -1, nearClick = false;
    ui.setCurrent(idx[0]); ui.score('0%', '進度', `0 / ${idx.length}`);
    const prog = () => ui.score(`${Math.round(k / idx.length * 100)}%`, '進度', `${k} / ${idx.length}・失誤 ${mistakes}`);
    const miss = () => { mistakes++; ui.flashWrong(idx[k]); prog(); };

    // 背景節拍器：只是陪練，不影響判定。每 100 ms 預排接下來 0.3 秒內的拍點，所以中途改 BPM 或開關都會立刻生效
    A.ensureCtx();
    let nextT = A.now() + 0.35, beat = 0; const clicks = [];
    const tick = () => {
      const now = A.now();
      if (!S().pitchMetro) { nextT = Math.max(nextT, now + 0.1); return; }
      while (nextT < now + 0.3) { metro(L, nextT, beat++, S().clickVol * 0.6); clicks.push(nextT); nextT += 60 / getBpm(); }
      while (clicks.length && clicks[0] < now - 1) clicks.shift();
    };
    tick(); const mi = setInterval(tick, 100);
    // 麥克風可能收到節拍器的聲音：拍點附近的起音如果對不上目標，就當作沒發生，不算失誤
    const byClick = (t) => clicks.some(c => t - c > -0.03 && t - c < S().latency + 0.12);

    const loop = makeLoop((ev, fr) => {
      ui.heard(ev);
      if (k >= idx.length) return;
      if (ev.onset && fr.t - hitT > 0.13) {
        if (pending && !nearClick && fr.t - attackT > 0.15) miss();   // 上一下還沒被判定成「對」就又彈了下一下
        pending = true; attackT = fr.t; nearClick = byClick(fr.t);
      }
      if (!pending) return;
      const n = L.notes[idx[k]];
      const ok = frameOK(L, n, ev);
      if (!ok && fr.t - attackT <= (n.c ? 0.6 : 0.45)) return;
      pending = false;
      if (!ok) { if (!nearClick) miss(); return; }
      hitT = fr.t; ui.mark(idx[k], 'hit'); k++; prog();
      if (k >= idx.length) { stop(); A.stopAll(); setTimeout(() => done({ mode: 'pitch', score: Math.round(idx.length / (idx.length + mistakes) * 100), mistakes }), 250); }
      else ui.setCurrent(idx[k]);
    }, true);
    function stop() { loop.stop(); clearInterval(mi); }
    return { stop };
  }

  // 模式 ②：彈對＋節奏
  function rhythmSession(L, bpm, ui, done) {
    A.ensureCtx();
    const spb = 60 / bpm, t0 = A.now() + 0.4 + L.bpb * spb, tb = totalBeats(L);
    for (let b = 0; b < L.bpb; b++) metro(L, t0 - (L.bpb - b) * spb, b, S().clickVol);
    if (S().metro === 'full') for (let b = 0; b < tb; b++) metro(L, t0 + b * spb, b, S().clickVol * 0.7);
    let pos = 0; const exp = [];
    L.notes.forEach((n, i) => { if (!n.r) exp.push({ i, n, t: t0 + pos * spb, res: null }); pos += n.d; });
    let minGap = Infinity; for (let i = 1; i < exp.length; i++) minGap = Math.min(minGap, exp[i].t - exp[i - 1].t);
    const tol = Math.min(TOL[S().tol] || 0.1, minGap * 0.45);
    const lat = S().latency, voteWin = 0.36;
    const onsets = []; let k = 0, c = -1, hits = 0; const offs = [];
    const loop = makeLoop((ev, fr) => {
      ui.heard(ev);
      const now = fr.t, tc = now - lat;
      const beats = (now - t0) / spb;
      ui.playhead(L._g.left + beats * L._g.ppb + 12);
      if (beats < 0) ui.score(String(Math.ceil(-beats)), '預備', '');
      if (ev.onset) onsets.push({ t: tc, raw: now, votes: [], used: false });
      const lo = onsets[onsets.length - 1];
      if (lo && now - lo.raw >= 0.02 && now - lo.raw < voteWin && (ev.midi !== null || ev.chroma)) lo.votes.push({ midi: ev.midi, chroma: ev.chroma ? Float32Array.from(ev.chroma) : null });
      const pc0 = c;
      while (c + 1 < exp.length && (c < 0 || exp[c].t + tol < tc)) c++;
      if (c !== pc0) ui.setCurrent(exp[c].i);
      while (k < exp.length && tc > exp[k].t + tol + voteWin) { judge(exp[k]); k++; }
      if (k >= exp.length) {
        loop.stop();
        const score = Math.round(hits / exp.length * 100);
        const avgOff = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : null;
        setTimeout(() => done({ mode: 'rhythm', score, hits, total: exp.length, avgOff }), 200);
      }
    }, true);
    function voteOK(v, n) { const ok = v.filter(x => frameOK(L, n, x)).length; return ok >= 2 || (v.length > 0 && ok / v.length >= 0.4); }
    function judge(e) {
      const cand = onsets.filter(o => !o.used && Math.abs(o.t - e.t) <= tol);
      let best = null;
      for (const o of cand) if (voteOK(o.votes, e.n) && (!best || Math.abs(o.t - e.t) < Math.abs(best.t - e.t))) best = o;
      if (best) { best.used = true; e.res = 'hit'; hits++; offs.push(best.t - e.t); }
      else e.res = cand.length ? 'wrong' : 'miss';
      ui.mark(e.i, e.res);
      ui.score(`${Math.round(hits / exp.length * 100)}%`, '命中', `${hits} / ${exp.length}`);
    }
    return { stop() { loop.stop(); A.stopAll(); } };
  }

  // ---------- 調音器 ----------
  function viewTuner() {
    app.innerHTML = `<section class="card tuner">
      <h1>調音器</h1><p class="muted">標準調音：第 6 弦到第 1 弦是 E2 · A2 · D3 · G3 · B3 · E4。一次彈一條空弦，讓指針停在中間。</p>
      <div class="tn-note" id="tnNote">–</div>
      <div class="tn-gauge"><div class="tn-scale"><span>-50 偏低</span><span>0</span><span>偏高 +50</span></div><i id="tnNeedle"></i></div>
      <div class="tn-freq" id="tnFreq">— Hz</div>
      <div class="tn-strings six">${OPEN.map((m, s) => `<div id="tns${s}"><b>${SN[s].toUpperCase()}</b><small>第 ${6 - s} 弦<br>${(440 * Math.pow(2, (m - 69) / 12)).toFixed(1)} Hz</small></div>`).join('')}</div>
      <button class="btn primary" id="tnStart">🎤 開始調音</button>
    </section>`;
    let ema = 0;
    $('#tnStart').onclick = async () => {
      if (sess) { stopSession(); $('#tnStart').textContent = '🎤 開始調音'; return; }
      if (!(await needMic())) return;
      $('#tnStart').textContent = '■ 停止';
      sess = makeLoop((ev, fr) => {
        if (fr.rms < S().gate * 0.6 || fr.clarity < 0.8 || fr.freq < 60) return;
        ema = ema && Math.abs(Math.log2(fr.freq / ema)) < 0.03 ? ema * 0.7 + fr.freq * 0.3 : fr.freq;
        const mf = 69 + 12 * Math.log2(ema / 440), m = Math.round(mf), cents = Math.round((mf - m) * 100);
        $('#tnNote').innerHTML = `${pcName(m)}<sub>${Math.floor(m / 12) - 1}</sub>`;
        $('#tnNote').className = 'tn-note ' + (Math.abs(cents) <= 5 ? 'ok' : '');
        $('#tnNeedle').style.left = (50 + cents) + '%';
        $('#tnFreq').textContent = `${ema.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents} cents`;
        let near = 0; OPEN.forEach((om, s) => { if (Math.abs(om - mf) < Math.abs(OPEN[near] - mf)) near = s; });
        OPEN.forEach((om, s) => $('#tns' + s).classList.toggle('on', s === near && Math.abs(om - mf) < 2.5));
      }, false);
    };
  }

  // ---------- 設定 ----------
  function viewSettings() {
    const s = S();
    app.innerHTML = `
      <section class="card settings">
        <h1>設定</h1>
        <h3>麥克風</h3>
        <div class="meterbig"><i id="sMeter"></i><em id="sGate"></em></div>
        <p class="muted" id="sHeard">按「測試麥克風」後彈幾個音，綠色條要明顯超過白線（門檻）；不彈的時候要低於白線。</p>
        <button class="btn ghost" id="sTest">🎤 測試麥克風</button>
        <label class="row"><span>輸入增益 <b id="gainV">${s.gain.toFixed(1)}×</b></span><input type="range" id="gain" min="1" max="10" step="0.5" value="${s.gain}"></label>
        <label class="row"><span>靈敏度門檻 <b id="gateV">${s.gate.toFixed(3)}</b><small>環境吵就調高</small></span><input type="range" id="gate" min="0.003" max="0.08" step="0.001" value="${s.gate}"></label>
        <label class="row"><span>和弦判定<small>刷和弦一直被判錯時改成寬鬆</small></span><select id="chordTol"><option value="easy">寬鬆</option><option value="std">標準</option><option value="hard">嚴格</option></select></label>
        <label class="row chk"><input type="checkbox" id="octave" ${s.octave ? 'checked' : ''}><span>單音要求正確八度<small>預設關閉：音名對就算對，高低八度不計較</small></span></label>

        <h3>節奏判定</h3>
        <label class="row"><span>容許誤差</span><select id="tol"><option value="easy">寬鬆 ±150ms</option><option value="std">標準 ±100ms</option><option value="hard">嚴格 ±60ms</option></select></label>
        <label class="row"><span>通過門檻</span><select id="pass"><option value="70">70%</option><option value="80">80%</option><option value="90">90%</option></select></label>
        <label class="row"><span>節拍器</span><select id="metro"><option value="full">全程</option><option value="count">只有預備拍</option></select></label>
        <label class="row"><span>節拍器音量</span><input type="range" id="clickVol" min="0.1" max="1" step="0.05" value="${s.clickVol}"></label>
        <div class="row"><span>延遲補償 <b id="latV">${Math.round(s.latency * 1000)} ms</b><small>麥克風與音訊處理的延遲</small></span><input type="range" id="lat" min="0" max="0.4" step="0.005" value="${s.latency}"></div>
        <button class="btn ghost" id="calib">⏱ 自動延遲校正</button>
        <p class="muted" id="calibMsg">會先響 4 下預備拍，接著 8 下，請在每一下的同時撥一下第 1 弦空弦（或任何一個音）。</p>

        <h3>進度備份</h3>
        <p class="muted">進度存在這個瀏覽器裡。電腦和手機要同步時，先在一台匯出，再到另一台匯入。</p>
        <div class="btnrow"><button class="btn ghost" id="exp">⬇ 匯出進度</button><label class="btn ghost">⬆ 匯入進度<input type="file" id="imp" accept="application/json" hidden></label><button class="btn danger" id="reset">重設進度</button></div>
      </section>`;
    $('#tol').value = s.tol; $('#metro').value = s.metro; $('#pass').value = String(s.pass); $('#chordTol').value = s.chordTol;
    const gm = () => { $('#sGate').style.left = Math.min(100, Math.sqrt(S().gate / 0.25) * 100) + '%'; }; gm();
    $('#gain').oninput = e => { s.gain = +e.target.value; $('#gainV').textContent = s.gain.toFixed(1) + '×'; A.setGain(s.gain); save(); };
    $('#gate').oninput = e => { s.gate = +e.target.value; $('#gateV').textContent = s.gate.toFixed(3); gm(); save(); };
    $('#octave').onchange = e => { s.octave = e.target.checked; save(); };
    $('#chordTol').onchange = e => { s.chordTol = e.target.value; save(); };
    $('#tol').onchange = e => { s.tol = e.target.value; save(); };
    $('#pass').onchange = e => { s.pass = +e.target.value; save(); };
    $('#metro').onchange = e => { s.metro = e.target.value; save(); };
    $('#clickVol').oninput = e => { s.clickVol = +e.target.value; save(); };
    $('#clickVol').onchange = () => { A.ensureCtx(); A.click(A.now() + 0.05, true, s.clickVol); };
    $('#lat').oninput = e => { s.latency = +e.target.value; $('#latV').textContent = Math.round(s.latency * 1000) + ' ms'; save(); };

    $('#sTest').onclick = async () => {
      if (sess) { stopSession(); $('#sTest').textContent = '🎤 測試麥克風'; return; }
      if (!(await needMic())) return;
      $('#sTest').textContent = '■ 停止測試';
      sess = makeLoop((ev) => {
        $('#sMeter').style.width = Math.min(100, Math.sqrt(ev.rms / 0.25) * 100) + '%';
        $('#sMeter').classList.toggle('over', ev.rms > S().gate);
        const m = ev.stable ?? ev.midi;
        if (m != null) $('#sHeard').textContent = `聽到：${noteName(m)}（${ev.freq.toFixed(1)} Hz）`;
      }, false);
    };

    $('#calib').onclick = async () => {
      stopSession(); $('#sTest').textContent = '🎤 測試麥克風';
      if (!(await needMic())) return;
      const spb = 0.75, t0 = A.now() + 0.6, N = 12;
      for (let b = 0; b < N; b++) A.click(t0 + b * spb, b % 4 === 0, Math.max(0.5, S().clickVol));
      const clicks = []; for (let b = 4; b < N; b++) clicks.push(t0 + b * spb);
      const ons = [];
      const msg = $('#calibMsg');
      sess = makeLoop((ev, fr) => {
        const b = Math.floor((fr.t - t0) / spb);
        msg.textContent = b < 0 ? '準備…' : b < 4 ? `預備 ${4 - b}…` : b < N ? `跟著彈！${b - 3} / 8` : '分析中…';
        if (ev.onset) ons.push({ raw: fr.t });
        if (fr.t > t0 + N * spb + 0.5) {
          stopSession();
          const valid = ons;
          const diffs = [];
          clicks.forEach(c => { let best = null; valid.forEach(o => { const d = o.raw - c; if (Math.abs(d) < 0.35 && (best === null || Math.abs(d) < Math.abs(best))) best = d; }); if (best !== null) diffs.push(best); });
          if (diffs.length >= 4) {
            diffs.sort((a, b) => a - b);
            const med = diffs[Math.floor(diffs.length / 2)];
            S().latency = Math.max(0, Math.min(0.4, med)); save();
            $('#lat').value = S().latency; $('#latV').textContent = Math.round(S().latency * 1000) + ' ms';
            msg.textContent = `校正完成：延遲 ${Math.round(S().latency * 1000)} ms（偵測到 ${diffs.length}/8 下）`;
          } else msg.textContent = `只偵測到 ${diffs.length}/8 下，請靠近麥克風、彈大聲一點，或調低門檻後再試一次。`;
        }
      }, false);
    };

    $('#exp').onclick = () => {
      const blob = new Blob([JSON.stringify({ app: 'guitar365', v: 1, lessons: store.lessons, days: store.days, settings: store.settings }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `guitar365-progress-${fmt(new Date())}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('#imp').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (d.app !== 'guitar365') throw new Error();
        store.lessons = d.lessons || {}; store.days = d.days || []; if (d.settings) store.settings = Object.assign({}, DEF, d.settings);
        save(); toast('匯入完成'); viewSettings();
      } catch (err) { toast('檔案格式不正確'); }
    };
    $('#reset').onclick = () => {
      if (confirm('確定要清除所有課程進度嗎？這個動作無法復原（設定會保留）。')) { store.lessons = {}; store.days = []; save(); toast('進度已重設'); }
    };
  }

  route();
})();
