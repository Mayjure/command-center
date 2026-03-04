// ═══════════════════════════════════════════════
//  MONEYBASE CHART ENGINE v3
// ═══════════════════════════════════════════════

// ── DATA GENERATION ───────────────────────────
function generateCandles(n = 300, base = 18000, vol = 80) {
  const out = [];
  let p = base;
  const now = Date.now();
  const ms  = 60 * 60 * 1000;
  for (let i = n; i >= 0; i--) {
    const o = p + (Math.random() - 0.5) * vol * 0.4;
    const c = o + (Math.random() - 0.5) * vol;
    const h = Math.max(o, c) + Math.random() * vol * 0.5;
    const l = Math.min(o, c) - Math.random() * vol * 0.5;
    out.push({ t: new Date(now - i * ms), o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2), v: +(1000 + Math.random() * 5000).toFixed(0) });
    p = c;
  }
  return out;
}

// ── INDICATORS ────────────────────────────────
function calcEMA(arr, p) {
  const k = 2 / (p + 1), out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i-1] * (1 - k));
  return out;
}
function calcRSI(arr, p = 14) {
  const out = new Array(p).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = arr[i] - arr[i-1]; d > 0 ? g += d : l -= d; }
  let ag = g / p, al = l / p;
  out.push(100 - 100 / (1 + ag / (al || 1e-10)));
  for (let i = p + 1; i < arr.length; i++) {
    const d = arr[i] - arr[i-1];
    ag = (ag * (p-1) + Math.max(d, 0)) / p;
    al = (al * (p-1) + Math.max(-d, 0)) / p;
    out.push(100 - 100 / (1 + ag / (al || 1e-10)));
  }
  return out;
}
function calcMACD(arr, f = 12, s = 26, sig = 9) {
  const ef = calcEMA(arr, f), es = calcEMA(arr, s);
  const ml = ef.map((v, i) => v - es[i]);
  const sl = calcEMA(ml.slice(s-1), sig);
  const hist = arr.map((_, i) => {
    const si = i - (s-1);
    return si >= 0 && si < sl.length ? ml[i] - sl[si] : null;
  });
  return { ml, sl, hist, offset: s - 1 };
}
function calcVWAP(candles) {
  let cv = 0, cV = 0;
  return candles.map(c => { const tp = (c.h+c.l+c.c)/3; cv += tp*c.v; cV += c.v; return cv/cV; });
}
function calcATR(candles, p = 14) {
  const tr = candles.map((c, i) => i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i-1].c), Math.abs(c.l - candles[i-1].c)));
  return calcEMA(tr, p);
}
function calcBB(arr, p = 20, mult = 2) {
  return arr.map((_, i) => {
    if (i < p) return null;
    const sl = arr.slice(i-p+1, i+1);
    const mean = sl.reduce((a,b) => a+b, 0) / p;
    const std  = Math.sqrt(sl.reduce((a,b) => a + (b-mean)**2, 0) / p);
    return { mid: mean, upper: mean + mult*std, lower: mean - mult*std };
  });
}
function calcStoch(candles, k = 14, d = 3) {
  const kLine = candles.map((_, i) => {
    if (i < k) return null;
    const sl = candles.slice(i-k+1, i+1);
    const hi = Math.max(...sl.map(c => c.h)), lo = Math.min(...sl.map(c => c.l));
    return ((candles[i].c - lo) / (hi - lo)) * 100;
  });
  const dLine = kLine.map((_, i) => {
    const sl = kLine.slice(Math.max(0, i-d+1), i+1).filter(v => v !== null);
    return sl.length === d ? sl.reduce((a,b) => a+b, 0) / d : null;
  });
  return { kLine, dLine };
}
function calcCCI(candles, p = 20) {
  return candles.map((_, i) => {
    if (i < p) return null;
    const sl = candles.slice(i-p+1, i+1);
    const tps = sl.map(c => (c.h+c.l+c.c)/3);
    const mean = tps.reduce((a,b) => a+b, 0) / p;
    const md   = tps.reduce((a,b) => a + Math.abs(b-mean), 0) / p;
    return (tps[tps.length-1] - mean) / (0.015 * md);
  });
}
function calcOBV(candles) {
  let obv = 0;
  return candles.map((c, i) => {
    if (i > 0) obv += c.c > candles[i-1].c ? c.v : c.c < candles[i-1].c ? -c.v : 0;
    return obv;
  });
}
function calcWillR(candles, p = 14) {
  return candles.map((_, i) => {
    if (i < p) return null;
    const sl = candles.slice(i-p+1, i+1);
    const hi = Math.max(...sl.map(c => c.h)), lo = Math.min(...sl.map(c => c.l));
    return ((hi - candles[i].c) / (hi - lo)) * -100;
  });
}
function calcSignals(candles, e9, e21) {
  const out = [];
  for (let i = 1; i < candles.length; i++) {
    if (e9[i-1] <= e21[i-1] && e9[i] > e21[i]) out.push({ i, type:'buy',  price: candles[i].l });
    if (e9[i-1] >= e21[i-1] && e9[i] < e21[i]) out.push({ i, type:'sell', price: candles[i].h });
  }
  return out;
}

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
const TOTAL = 300;
let candles, closes, ema9, ema21, vwap, rsiData, macdData, atrData, bbData, stochData, signals;
let visibleStart = 240;
let visibleCount = 60;
const MIN_VIS = 10, MAX_VIS = 280;

// Active overlay indicators
let overlays = { ema9: true, ema21: true, vwap: true, bb: false };
// Active sub panes: array of { paneId, indicator }
let panes = [
  { id: 'pane-rsi',  indicator: 'rsi'  },
  { id: 'pane-macd', indicator: 'macd' }
];
let activePaneTarget = null;

function rebuildData(n = TOTAL, base = 18000, vol = 80) {
  candles   = generateCandles(n, base, vol);
  closes    = candles.map(c => c.c);
  ema9      = calcEMA(closes, 9);
  ema21     = calcEMA(closes, 21);
  vwap      = calcVWAP(candles);
  rsiData   = calcRSI(closes);
  macdData  = calcMACD(closes);
  atrData   = calcATR(candles);
  bbData    = calcBB(closes);
  stochData = calcStoch(candles);
  signals   = calcSignals(candles, ema9, ema21);
  document.getElementById('sig-count').textContent = signals.length + ' signals · ' + Math.round(signals.filter(s => s.type==='buy').length / signals.length * 100) + '% long';
}
rebuildData();

// ── CANVAS REFS ───────────────────────────────
const mainCanvas  = document.getElementById('mainChart');
const equityCanvas = document.getElementById('equityChart');
const mainCtx     = mainCanvas.getContext('2d');
const equityCtx   = equityCanvas.getContext('2d');

function getPaneCanvas(id) { return document.querySelector('#' + id + ' canvas'); }

// ── RESIZE ────────────────────────────────────
function resize() {
  const wrap = document.getElementById('chartWrap');
  const subPanes = document.getElementById('subPanes');
  const timeAxis = document.getElementById('timeAxis');
  const pills    = document.getElementById('indicatorPills');
  const paneEls  = subPanes.querySelectorAll('.sub-pane');
  const subH     = Array.from(paneEls).reduce((a, el) => a + el.offsetHeight, 0);
  const mainH    = wrap.clientHeight - subH - timeAxis.offsetHeight;

  mainCanvas.width  = wrap.clientWidth;
  mainCanvas.height = Math.max(mainH, 150);

  paneEls.forEach(el => {
    const c = el.querySelector('canvas');
    if (c) { c.width = wrap.clientWidth; c.height = el.clientHeight; }
  });

  equityCanvas.width  = equityCanvas.parentElement.clientWidth - 20;
  equityCanvas.height = 130;

  updateScrubber();
  drawAll();
  drawEquity();
}

// ── DRAW ALL ──────────────────────────────────
function drawAll() {
  drawMain();
  panes.forEach(p => drawPane(p));
  updateLiveValues();
  updateTimeLabels();
}

// ── MAIN CHART ────────────────────────────────
function drawMain() {
  const W = mainCanvas.width, H = mainCanvas.height;
  const ctx = mainCtx;
  ctx.clearRect(0, 0, W, H);

  const end   = Math.min(visibleStart + visibleCount, candles.length);
  const start = Math.max(0, end - visibleCount);
  const slice = candles.slice(start, end);
  if (!slice.length) return;

  const PAD_L = 8, PAD_R = 54, PAD_T = 36, PAD_B = 6;
  const cW = W - PAD_L - PAD_R;
  const cH = H - PAD_T - PAD_B;

  const hi  = Math.max(...slice.map(c => c.h));
  const lo  = Math.min(...slice.map(c => c.l));
  const pad = (hi - lo) * 0.05 || 1;
  const pMax = hi + pad, pMin = lo - pad;

  const candleW = cW / visibleCount;
  const bodyW   = Math.max(candleW * 0.65, 1.5);
  const toX = i => PAD_L + (i + 0.5) * candleW;
  const toY = p => PAD_T + cH - ((p - pMin) / (pMax - pMin)) * cH;

  // Background grid
  ctx.strokeStyle = 'rgba(26,40,64,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = PAD_T + (cH / 6) * i;
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    const p = pMax - ((pMax - pMin) / 6) * i;
    ctx.fillStyle = '#3a5070'; ctx.font = '9px Space Mono';
    ctx.textAlign = 'right';
    ctx.fillText(p.toFixed(0), W - PAD_R + 48, y + 3);
  }
  // Vertical gridlines every ~10 candles
  for (let i = 0; i < slice.length; i += Math.max(1, Math.floor(visibleCount / 8))) {
    const x = toX(i);
    ctx.strokeStyle = 'rgba(26,40,64,0.4)';
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + cH); ctx.stroke();
  }

  // Volume bars
  const maxVol = Math.max(...slice.map(c => c.v));
  slice.forEach((c, i) => {
    const vh = (c.v / maxVol) * cH * 0.18;
    ctx.fillStyle = c.c >= c.o ? 'rgba(0,200,122,0.07)' : 'rgba(255,71,87,0.07)';
    ctx.fillRect(toX(i) - bodyW/2, PAD_T + cH - vh, bodyW, vh);
  });

  // Bollinger Bands
  if (overlays.bb) {
    const sliceBB = bbData.slice(start, end);
    ['upper','lower'].forEach(key => {
      ctx.strokeStyle = 'rgba(139,92,246,0.5)';
      ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath();
      let first = true;
      sliceBB.forEach((b, i) => {
        if (!b) return;
        first ? ctx.moveTo(toX(i), toY(b[key])) : ctx.lineTo(toX(i), toY(b[key]));
        first = false;
      });
      ctx.stroke(); ctx.setLineDash([]);
    });
    // Mid
    ctx.strokeStyle = 'rgba(139,92,246,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); let first = true;
    bbData.slice(start, end).forEach((b, i) => {
      if (!b) return;
      first ? ctx.moveTo(toX(i), toY(b.mid)) : ctx.lineTo(toX(i), toY(b.mid));
      first = false;
    });
    ctx.stroke();
  }

  // VWAP
  if (overlays.vwap) {
    ctx.strokeStyle = 'rgba(240,180,41,0.75)';
    ctx.lineWidth = 1.5; ctx.setLineDash([5,4]);
    ctx.beginPath();
    vwap.slice(start, end).forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke(); ctx.setLineDash([]);
  }

  // EMA 21
  if (overlays.ema21) {
    ctx.strokeStyle = 'rgba(255,107,157,0.85)';
    ctx.lineWidth = 1.5; ctx.beginPath();
    ema21.slice(start, end).forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
  }

  // EMA 9
  if (overlays.ema9) {
    ctx.strokeStyle = 'rgba(58,134,255,0.9)';
    ctx.lineWidth = 1.5; ctx.beginPath();
    ema9.slice(start, end).forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
  }

  // Candles
  slice.forEach((c, i) => {
    const x = toX(i), isUp = c.c >= c.o;
    const col = isUp ? '#00c87a' : '#ff4757';
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, toY(c.h)); ctx.lineTo(x, toY(c.l)); ctx.stroke();
    const bTop = toY(Math.max(c.o, c.c));
    const bBot = toY(Math.min(c.o, c.c));
    ctx.fillStyle = isUp ? '#00c87a' : '#ff4757';
    ctx.fillRect(x - bodyW/2, bTop, bodyW, Math.max(bBot - bTop, 1));
  });

  // Signals
  ctx.font = 'bold 10px Space Mono'; ctx.textAlign = 'center';
  signals.filter(s => s.i >= start && s.i < end).forEach(s => {
    const li = s.i - start, x = toX(li);
    if (s.type === 'buy') {
      ctx.fillStyle = '#00c87a';
      ctx.fillText('▲', x, toY(s.price) + 14);
    } else {
      ctx.fillStyle = '#ff4757';
      ctx.fillText('▼', x, toY(s.price) - 6);
    }
  });

  // Last price line
  const last = slice[slice.length - 1];
  if (last) {
    const lY = toY(last.c), isUp = last.c >= last.o;
    ctx.strokeStyle = isUp ? 'rgba(0,200,122,0.4)' : 'rgba(255,71,87,0.4)';
    ctx.lineWidth = 1; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(PAD_L, lY); ctx.lineTo(W - PAD_R, lY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isUp ? '#00c87a' : '#ff4757';
    ctx.fillRect(W - PAD_R + 1, lY - 8, 52, 16);
    ctx.fillStyle = '#000'; ctx.font = 'bold 9px Space Mono'; ctx.textAlign = 'center';
    ctx.fillText(last.c.toFixed(0), W - PAD_R + 27, lY + 3);
  }

  // Update pill values
  const li = end - 1;
  if (overlays.ema9)  setEl('pv-ema9',  ema9[li]?.toFixed(0) || '—');
  if (overlays.ema21) setEl('pv-ema21', ema21[li]?.toFixed(0) || '—');
  if (overlays.vwap)  setEl('pv-vwap',  vwap[li]?.toFixed(0) || '—');
}

// ── DRAW SUB PANE ─────────────────────────────
function drawPane({ id, indicator }) {
  const el = document.getElementById(id);
  if (!el) return;
  const c = el.querySelector('canvas');
  if (!c) return;
  const W = c.width, H = c.height;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const start = Math.max(0, Math.min(visibleStart, candles.length - visibleCount));
  const end   = Math.min(start + visibleCount, candles.length);

  const PT = 20, PB = 4, PL = 6, PR = 28;
  const cW = W - PL - PR, cH = H - PT - PB;
  const toX = i => PL + (i / (visibleCount - 1)) * cW;

  if (indicator === 'rsi') {
    const sl = rsiData.slice(start, end);
    const toY = v => PT + cH - (v / 100) * cH;
    // zones
    ctx.fillStyle = 'rgba(255,71,87,0.05)'; ctx.fillRect(PL, PT, cW, toY(70) - PT);
    ctx.fillStyle = 'rgba(0,200,122,0.05)'; ctx.fillRect(PL, toY(30), cW, PT + cH - toY(30));
    [70, 50, 30].forEach(lvl => {
      ctx.strokeStyle = lvl === 50 ? 'rgba(74,96,128,0.3)' : 'rgba(74,96,128,0.5)';
      ctx.lineWidth = 1; ctx.setLineDash(lvl !== 50 ? [] : [2,4]);
      ctx.beginPath(); ctx.moveTo(PL, toY(lvl)); ctx.lineTo(W - PR, toY(lvl)); ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;
    sl.forEach((v, i) => {
      if (v === null) return;
      first ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
      first = false;
    });
    ctx.stroke();
    const cur = sl.filter(v => v !== null).pop();
    if (cur) {
      const curEl = document.getElementById('rsi-cur');
      if (curEl) curEl.textContent = cur.toFixed(1);
      setEl('live-rsi', cur.toFixed(1));
      const cY = toY(cur);
      ctx.fillStyle = cur > 70 ? '#ff4757' : cur < 30 ? '#00c87a' : '#8b5cf6';
      ctx.fillRect(W - PR + 2, cY - 7, PR - 4, 14);
      ctx.fillStyle = '#000'; ctx.font = 'bold 8px Space Mono'; ctx.textAlign = 'center';
      ctx.fillText(cur.toFixed(0), W - PR/2 + 2, cY + 3);
    }

  } else if (indicator === 'macd') {
    const hist = macdData.hist.slice(start, end);
    const valid = hist.filter(v => v !== null);
    if (!valid.length) return;
    const maxA = Math.max(...valid.map(Math.abs)) || 1;
    const mid  = PT + cH / 2;
    const barW = cW / visibleCount;
    ctx.strokeStyle = 'rgba(74,96,128,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PL, mid); ctx.lineTo(W - PR, mid); ctx.stroke();
    hist.forEach((v, i) => {
      if (v === null) return;
      const bH = (Math.abs(v) / maxA) * (cH * 0.45);
      ctx.fillStyle = v >= 0 ? 'rgba(0,200,122,0.75)' : 'rgba(255,71,87,0.75)';
      ctx.fillRect(PL + i * barW + 1, v >= 0 ? mid - bH : mid, barW - 2, bH);
    });
    const curH = hist.filter(v => v !== null).pop() || 0;
    setEl('live-macd', (curH >= 0 ? '+' : '') + curH.toFixed(1));
    const macdVals = document.getElementById('macd-vals');
    if (macdVals) macdVals.textContent = 'Hist: ' + (curH >= 0 ? '+' : '') + curH.toFixed(1);

  } else if (indicator === 'stoch') {
    const kSl = stochData.kLine.slice(start, end);
    const dSl = stochData.dLine.slice(start, end);
    const toY = v => v === null ? null : PT + cH - (v / 100) * cH;
    [80, 50, 20].forEach(lvl => {
      ctx.strokeStyle = 'rgba(74,96,128,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, toY(lvl)); ctx.lineTo(W - PR, toY(lvl)); ctx.stroke();
    });
    [[kSl, '#00c87a', 1.5], [dSl, '#ff4757', 1]].forEach(([sl, col, lw]) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      let f = true;
      sl.forEach((v, i) => {
        if (v === null) return;
        f ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); f = false;
      });
      ctx.stroke();
    });
    const paneEl = document.getElementById(id);
    const lbl = paneEl?.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = 'Stochastic (14,3)';

  } else if (indicator === 'cci') {
    const cciSlice = calcCCI(candles.slice(start, end));
    const valid = cciSlice.filter(v => v !== null);
    if (!valid.length) return;
    const maxA = Math.max(...valid.map(Math.abs), 100);
    const toY = v => v === null ? null : PT + cH/2 - (v / maxA) * (cH/2);
    [100, 0, -100].forEach(lvl => {
      ctx.strokeStyle = lvl === 0 ? 'rgba(74,96,128,0.5)' : 'rgba(74,96,128,0.3)';
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PL, toY(lvl)); ctx.lineTo(W-PR, toY(lvl)); ctx.stroke();
    });
    ctx.strokeStyle = '#f0b429'; ctx.lineWidth = 1.5; ctx.beginPath();
    let f = true;
    cciSlice.forEach((v, i) => {
      if (v === null) return;
      f ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); f = false;
    });
    ctx.stroke();
    const paneEl = document.getElementById(id);
    const lbl = paneEl?.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = 'CCI (20)';

  } else if (indicator === 'atr') {
    const sl = atrData.slice(start, end);
    const maxA = Math.max(...sl), minA = Math.min(...sl);
    const toY = v => PT + cH - ((v - minA) / (maxA - minA || 1)) * cH;
    ctx.strokeStyle = '#3a86ff'; ctx.lineWidth = 1.5; ctx.beginPath();
    sl.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.stroke();
    const paneEl = document.getElementById(id);
    const lbl = paneEl?.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = 'ATR (14)';

  } else if (indicator === 'obv') {
    const sl = calcOBV(candles.slice(start, end));
    const maxV = Math.max(...sl), minV = Math.min(...sl);
    const toY = v => PT + cH - ((v - minV) / (maxV - minV || 1)) * cH;
    ctx.strokeStyle = '#ff6b9d'; ctx.lineWidth = 1.5; ctx.beginPath();
    sl.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.stroke();
    const paneEl = document.getElementById(id);
    const lbl = paneEl?.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = 'OBV';

  } else if (indicator === 'willr') {
    const sl = calcWillR(candles.slice(start, end));
    const toY = v => v === null ? null : PT + cH - ((v + 100) / 100) * cH;
    [-20, -50, -80].forEach(lvl => {
      ctx.strokeStyle = 'rgba(74,96,128,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, toY(lvl)); ctx.lineTo(W-PR, toY(lvl)); ctx.stroke();
    });
    ctx.strokeStyle = '#00c87a'; ctx.lineWidth = 1.5; ctx.beginPath();
    let f = true;
    sl.forEach((v, i) => {
      if (v === null) return;
      f ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); f = false;
    });
    ctx.stroke();
    const paneEl = document.getElementById(id);
    const lbl = paneEl?.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = 'Williams %R (14)';

  } else if (indicator === 'volume') {
    const sl = candles.slice(start, end);
    const maxV = Math.max(...sl.map(c => c.v));
    const barW = cW / visibleCount;
    sl.forEach((c, i) => {
      const bH = ((c.v / maxV) * cH * 0.92);
      ctx.fillStyle = c.c >= c.o ? 'rgba(0,200,122,0.7)' : 'rgba(255,71,87,0.7)';
      ctx.fillRect(PL + i * barW + 1, PT + cH - bH, barW - 2, bH);
    });
    const paneEl = document.getElementById(id);
    const lbl = paneEl?.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = 'Volume';
  }
}

// ── EQUITY CURVE ──────────────────────────────
function drawEquity() {
  const W = equityCanvas.width, H = equityCanvas.height;
  if (!W || !H) return;
  const ctx = equityCtx;
  ctx.clearRect(0, 0, W, H);
  const pts = []; let v = 10000;
  for (let i = 0; i < 60; i++) { v += (Math.random() - 0.38) * 120; pts.push(v); }
  const min = Math.min(...pts)*0.998, max = Math.max(...pts)*1.002;
  const toX = i => (i / (pts.length-1)) * W;
  const toY = v => H - 18 - ((v-min)/(max-min)) * (H-26);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,200,122,0.3)'); g.addColorStop(1, 'rgba(0,200,122,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
  pts.forEach((p, i) => ctx.lineTo(toX(i), toY(p)));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#00c87a'; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
  ctx.stroke();
  ctx.fillStyle = '#4a6080'; ctx.font = '9px Space Mono'; ctx.textAlign = 'left';
  ctx.fillText('$'+pts[0].toFixed(0), 4, H-2);
  ctx.textAlign = 'right'; ctx.fillStyle = '#00c87a';
  ctx.fillText('$'+pts[pts.length-1].toFixed(0), W-4, H-2);
}

// ── LIVE VALUES UPDATE ────────────────────────
function updateLiveValues() {
  const li = Math.min(visibleStart + visibleCount - 1, candles.length - 1);
  setEl('live-ema9',  ema9[li]?.toFixed(1)  || '—');
  setEl('live-ema21', ema21[li]?.toFixed(1) || '—');
  setEl('live-vwap',  vwap[li]?.toFixed(1)  || '—');
  setEl('live-atr',   atrData[li]?.toFixed(1) || '—');
}

// ── TIME AXIS LABELS ──────────────────────────
function updateTimeLabels() {
  const labelsEl = document.getElementById('timeLabels');
  if (!labelsEl) return;
  const start = Math.max(0, Math.min(visibleStart, candles.length - visibleCount));
  const end   = Math.min(start + visibleCount, candles.length);
  const count = 7;
  const step  = Math.floor((end - start) / count);
  labelsEl.innerHTML = '';
  for (let i = 0; i <= count; i++) {
    const idx = start + Math.min(i * step, end - start - 1);
    const d   = candles[idx]?.t;
    if (!d) continue;
    const s = document.createElement('span');
    s.textContent = d.toLocaleString('en-US', { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    labelsEl.appendChild(s);
  }
}

// ── SCRUBBER ──────────────────────────────────
function updateScrubber() {
  const track  = document.getElementById('timeScrubber');
  const handle = document.getElementById('scrubberHandle');
  if (!track || !handle) return;
  const total  = candles.length;
  const tW     = track.clientWidth;
  const hW     = Math.max(30, (visibleCount / total) * tW);
  const hX     = (visibleStart / (total - visibleCount)) * (tW - hW);
  handle.style.width = hW + 'px';
  handle.style.left  = Math.max(0, Math.min(hX, tW - hW)) + 'px';
}

// Scrubber drag
let scrubDragging = false, scrubStartX = 0, scrubStartVS = 0;
document.getElementById('scrubberHandle').addEventListener('mousedown', e => {
  scrubDragging = true;
  scrubStartX   = e.clientX;
  scrubStartVS  = visibleStart;
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!scrubDragging) return;
  const track = document.getElementById('timeScrubber');
  const handle = document.getElementById('scrubberHandle');
  const tW = track.clientWidth;
  const hW = parseFloat(handle.style.width) || 40;
  const dx = e.clientX - scrubStartX;
  const ratio = dx / (tW - hW);
  const newVS = Math.round(scrubStartVS + ratio * (candles.length - visibleCount));
  visibleStart = Math.max(0, Math.min(candles.length - visibleCount, newVS));
  drawAll(); updateScrubber();
});
document.addEventListener('mouseup', () => { scrubDragging = false; });

// Click on track (not handle) to jump
document.getElementById('timeScrubber').addEventListener('click', e => {
  if (e.target.id === 'scrubberHandle') return;
  const track  = e.currentTarget;
  const tW     = track.clientWidth;
  const handle = document.getElementById('scrubberHandle');
  const hW     = parseFloat(handle.style.width) || 40;
  const relX   = e.clientX - track.getBoundingClientRect().left;
  const ratio  = (relX - hW/2) / (tW - hW);
  visibleStart = Math.max(0, Math.min(candles.length - visibleCount, Math.round(ratio * (candles.length - visibleCount))));
  drawAll(); updateScrubber();
});

// ── MOUSE WHEEL: ZOOM + SCROLL ─────────────────
document.getElementById('mainChart').addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    // ZOOM: shrink/grow visible window
    const delta = e.deltaY > 0 ? 4 : -4;
    const newVC = Math.max(MIN_VIS, Math.min(MAX_VIS, visibleCount + delta));
    // Keep center stable
    const center = visibleStart + visibleCount / 2;
    visibleCount = newVC;
    visibleStart = Math.max(0, Math.min(candles.length - visibleCount, Math.round(center - visibleCount / 2)));
  } else {
    // SCROLL LEFT/RIGHT
    const step = Math.max(1, Math.floor(visibleCount / 10));
    visibleStart = Math.max(0, Math.min(candles.length - visibleCount, visibleStart + (e.deltaY > 0 ? step : -step)));
  }
  drawAll(); updateScrubber();
}, { passive: false });

// ── CROSSHAIR ─────────────────────────────────
let crosshairCanvas = mainCanvas;
mainCanvas.addEventListener('mousemove', e => {
  const rect = mainCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const W  = mainCanvas.width;
  const PAD_L = 8, PAD_R = 54;
  const cW = W - PAD_L - PAD_R;
  const cStep = cW / visibleCount;
  const idx = Math.floor((mx - PAD_L) / cStep);
  if (idx >= 0 && idx < visibleCount) {
    const ci = Math.min(visibleStart + idx, candles.length - 1);
    const c  = candles[ci];
    if (!c) return;
    const info = document.getElementById('crosshairInfo');
    info.style.display = 'flex';
    setEl('ci-date', c.t.toLocaleString('en-US',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}));
    setEl('ci-o', c.o.toFixed(2));
    setEl('ci-h', c.h.toFixed(2));
    setEl('ci-l', c.l.toFixed(2));
    setEl('ci-c', c.c.toFixed(2));
    const chg = ((c.c - c.o) / c.o * 100);
    const chgEl = document.getElementById('ci-chg');
    chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
    chgEl.className = chg >= 0 ? 'up' : 'down';
  }
});
mainCanvas.addEventListener('mouseleave', () => {
  document.getElementById('crosshairInfo').style.display = 'none';
});

// ── TOOLBAR ───────────────────────────────────
let activeTool = 'cursor';
function setTool(btn, tool) {
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeTool = tool;
  if (tool === 'cursor' || tool === 'crosshair') {
    mainCanvas.style.cursor = 'crosshair';
  } else {
    mainCanvas.style.cursor = 'crosshair';
  }
  showToast('Tool: ' + tool);
}
function clearDrawings() { showToast('Drawings cleared'); }

// ── TIMEFRAME SWITCH ──────────────────────────
function setTF(btn, tf) {
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const vols = { '1m':10, '5m':20, '15m':40, '1h':80, '4h':160, '1D':320 };
  rebuildData(TOTAL, 18000, vols[tf] || 80);
  visibleStart = TOTAL - visibleCount;
  drawAll(); updateScrubber();
  showToast('Timeframe: ' + tf);
}

// ── SYMBOL SWITCH ─────────────────────────────
function switchSymbol(el, sym, exchange, price, changePct) {
  document.querySelectorAll('.sym-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  setEl('active-symbol', sym);
  setEl('active-exchange', exchange);
  const priceEl = document.getElementById('cur-price');
  priceEl.textContent = price.toLocaleString('en-US', { minimumFractionDigits:2 });
  const changeEl = document.getElementById('cur-change');
  changeEl.textContent = (changePct >= 0 ? '▲ +' : '▼ ') + changePct.toFixed(2) + '%';
  changeEl.className = 'cur-change ' + (changePct >= 0 ? 'up' : 'down');
  const vol = price > 10000 ? 80 : price > 1000 ? 60 : price > 100 ? 5 : 200;
  rebuildData(TOTAL, price, vol);
  visibleStart = TOTAL - visibleCount;
  drawAll(); updateScrubber();
}

// ── RIGHT PANEL TABS ──────────────────────────
function rpTab(btn, panel) {
  document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.rp-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rp-' + panel)?.classList.add('active');
}

// ── INDICATOR OVERLAY MANAGEMENT ─────────────
function removeIndicator(name) {
  overlays[name] = false;
  const pill = document.getElementById('pill-' + name);
  if (pill) pill.style.display = 'none';
  drawMain();
}
function addIndicator(name) {
  hideIndicatorMenu();
  const n = name.toLowerCase();
  if (n === 'ema') {
    overlays.ema9 = true; overlays.ema21 = true;
    showPill('pill-ema9'); showPill('pill-ema21');
  } else if (n === 'vwap') {
    overlays.vwap = true; showPill('pill-vwap');
  } else if (n === 'bb') {
    overlays.bb = true;
    let pill = document.getElementById('pill-bb');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'ind-pill bb'; pill.id = 'pill-bb';
      pill.innerHTML = 'BB 20 <span class="pill-val" id="pv-bb">—</span> <span class="pill-x" onclick="removeIndicator(\'bb\')">×</span>';
      document.getElementById('indicatorPills').insertBefore(pill, document.querySelector('.add-ind'));
    } else { pill.style.display = ''; }
  } else if (n === 'rsi' || n === 'macd' || n === 'stoch' || n === 'atr' || n === 'cci' || n === 'obv' || n === 'willr' || n === 'vol') {
    // Add as new sub pane
    addSubPane(n === 'vol' ? 'volume' : n);
    return;
  }
  drawMain();
  showToast(name + ' added');
}
function showPill(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

// ── SUB PANE MANAGEMENT ───────────────────────
function addSubPane(indicator) {
  const existing = panes.find(p => p.indicator === indicator);
  if (existing) { showToast(indicator.toUpperCase() + ' already shown'); return; }
  const id = 'pane-' + Date.now();
  const div = document.createElement('div');
  div.className = 'sub-pane'; div.id = id; div.dataset.indicator = indicator;
  div.innerHTML = `
    <div class="sub-pane-header">
      <span class="sub-pane-label">${indicator.toUpperCase()}</span>
      <div class="sub-pane-controls">
        <span class="spc-btn" onclick="changePaneIndicator('${id}')">⚙</span>
        <span class="spc-btn" onclick="removePaneIndicator('${id}')">×</span>
      </div>
    </div>
    <canvas></canvas>
    <div class="sub-pane-cur" id="${id}-cur">—</div>
  `;
  document.getElementById('subPanes').appendChild(div);
  panes.push({ id, indicator });
  resize();
  showToast(indicator.toUpperCase() + ' pane added');
}

function removePaneIndicator(paneId) {
  const el = document.getElementById(paneId);
  if (el) el.remove();
  panes = panes.filter(p => p.id !== paneId);
  resize();
  showToast('Pane removed');
}

function changePaneIndicator(paneId) {
  activePaneTarget = paneId;
  document.getElementById('paneModal').classList.add('open');
}
function hidePaneModal() {
  document.getElementById('paneModal').classList.remove('open');
  activePaneTarget = null;
}
function setPaneIndicator(indicator) {
  if (!activePaneTarget) return;
  const pane = panes.find(p => p.id === activePaneTarget);
  if (pane) pane.indicator = indicator;
  const el = document.getElementById(activePaneTarget);
  if (el) {
    el.dataset.indicator = indicator;
    const lbl = el.querySelector('.sub-pane-label');
    if (lbl) lbl.textContent = indicator.toUpperCase();
  }
  hidePaneModal();
  resize();
  showToast('Pane → ' + indicator.toUpperCase());
}

// ── INDICATOR MENU ────────────────────────────
function showIndicatorMenu() { document.getElementById('indModal').classList.add('open'); }
function hideIndicatorMenu() { document.getElementById('indModal').classList.remove('open'); }
function showManagePane() { showIndicatorMenu(); }
function filterIndicators(q) {
  document.querySelectorAll('#indicatorGrid .modal-ind').forEach(el => {
    el.classList.toggle('hidden', !el.dataset.name.toLowerCase().includes(q.toLowerCase()));
  });
}

// ── BACKTEST ──────────────────────────────────
function runBacktest() {
  const btn = document.querySelector('.bt-run-btn');
  btn.textContent = '⏳ Running...'; btn.disabled = true;
  setTimeout(() => {
    const wr = (62 + Math.random() * 20).toFixed(0);
    const pf = (1.4 + Math.random() * 1.4).toFixed(1);
    const tr = 28 + Math.floor(Math.random() * 50);
    const rt = (8 + Math.random() * 28).toFixed(1);
    const dd = (1.5 + Math.random() * 8).toFixed(1);
    const sh = (1.1 + Math.random() * 1.4).toFixed(2);
    setEl('bt-winrate', wr+'%'); setEl('bt-pf', pf);
    setEl('bt-trades', tr);     setEl('bt-return', '+'+rt+'%');
    setEl('bt-dd', '-'+dd+'%'); setEl('bt-sharpe', sh);
    document.getElementById('bt-results').style.display = 'block';
    btn.textContent = '▶ RUN BACKTEST'; btn.disabled = false;
    showToast('✅ Backtest · ' + tr + ' trades · ' + wr + '% win rate');
  }, 1400);
}

// ── LIVE TICK ─────────────────────────────────
setInterval(() => {
  if (!candles?.length) return;
  const last = candles[candles.length - 1];
  const chg  = (Math.random() - 0.495) * 10;
  last.c = +(last.c + chg).toFixed(2);
  last.h = Math.max(last.h, last.c);
  last.l = Math.min(last.l, last.c);
  closes[closes.length - 1] = last.c;

  // Recalc last values
  ema9[ema9.length - 1]   = calcEMA(closes, 9)[closes.length - 1];
  ema21[ema21.length - 1] = calcEMA(closes, 21)[closes.length - 1];
  vwap[vwap.length - 1]   = calcVWAP(candles)[candles.length - 1];

  const priceEl = document.getElementById('cur-price');
  const prev    = parseFloat(priceEl.textContent.replace(/,/g,'')) || last.c;
  priceEl.textContent = last.c.toLocaleString('en-US', { minimumFractionDigits:2 });
  priceEl.style.color = chg >= 0 ? '#00c87a' : '#ff4757';
  setTimeout(() => priceEl.style.color = '', 300);
  setEl('ohlc-h', last.h.toFixed(0));
  setEl('ohlc-l', last.l.toFixed(0));
  setEl('ohlc-c', last.c.toFixed(0));

  drawAll(); updateScrubber();
}, 1500);

// ── UTIL ──────────────────────────────────────
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── INIT ──────────────────────────────────────
window.addEventListener('load', () => {
  visibleStart = TOTAL - visibleCount;
  resize();
  drawEquity();
  showToast('⚡ Live chart active');
});
window.addEventListener('resize', resize);
