// ════════════════════════════════════════
//  MONEYBASE CHART ENGINE
// ════════════════════════════════════════

// ── GENERATE SYNTHETIC NQ CANDLES ────────
function generateCandles(n = 120, base = 18000, volatility = 80) {
  const candles = [];
  let price = base;
  const now = Date.now();
  const interval = 60 * 60 * 1000; // 1h

  for (let i = n; i >= 0; i--) {
    const open  = price + (Math.random() - 0.5) * volatility * 0.4;
    const close = open  + (Math.random() - 0.5) * volatility;
    const high  = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low   = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = 1000 + Math.random() * 4000;
    candles.push({
      t: new Date(now - i * interval),
      o: +open.toFixed(2),
      h: +high.toFixed(2),
      l: +low.toFixed(2),
      c: +close.toFixed(2),
      v: +volume.toFixed(0)
    });
    price = close;
  }
  return candles;
}

// ── EMA CALCULATION ───────────────────────
function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  const ema = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    ema.push(closes[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// ── RSI CALCULATION ───────────────────────
function calcRSI(closes, period = 14) {
  const rsi = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    d > 0 ? (gains += d) : (losses -= d);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push(100 - 100 / (1 + avgGain / (avgLoss || 0.0001)));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    rsi.push(100 - 100 / (1 + avgGain / (avgLoss || 0.0001)));
  }
  return rsi;
}

// ── MACD CALCULATION ──────────────────────
function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast   = calcEMA(closes, fast);
  const emaSlow   = calcEMA(closes, slow);
  const macdLine  = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calcEMA(macdLine.slice(slow - 1), signal);
  const histogram  = [];
  const offset = slow - 1;
  for (let i = 0; i < closes.length; i++) {
    const si = i - offset;
    histogram.push(si >= 0 && si < signalLine.length
      ? macdLine[i] - signalLine[si]
      : null);
  }
  return { macdLine, signalLine, histogram, offset };
}

// ── VWAP ──────────────────────────────────
function calcVWAP(candles) {
  let cumPV = 0, cumV = 0;
  return candles.map(c => {
    const tp = (c.h + c.l + c.c) / 3;
    cumPV += tp * c.v;
    cumV  += c.v;
    return cumPV / cumV;
  });
}

// ── BUY/SELL SIGNALS (EMA cross) ─────────
function calcSignals(candles, ema9, ema21) {
  const signals = [];
  for (let i = 1; i < candles.length; i++) {
    if (ema9[i - 1] <= ema21[i - 1] && ema9[i] > ema21[i]) {
      signals.push({ i, type: 'buy',  price: candles[i].l  - 20 });
    }
    if (ema9[i - 1] >= ema21[i - 1] && ema9[i] < ema21[i]) {
      signals.push({ i, type: 'sell', price: candles[i].h + 20 });
    }
  }
  return signals;
}

// ════════════════════════════════════════
//  STATE
// ════════════════════════════════════════
let candles  = generateCandles(120, 18000, 80);
let closes   = candles.map(c => c.c);
let ema9     = calcEMA(closes, 9);
let ema21    = calcEMA(closes, 21);
let vwap     = calcVWAP(candles);
let rsi      = calcRSI(closes);
let macdData = calcMACD(closes);
let signals  = calcSignals(candles, ema9, ema21);

let showEMA9 = true, showEMA21 = true, showVWAP = true;
let visibleStart = 60;  // index of first visible candle
const VISIBLE_COUNT = 60;

// ── CANVAS SETUP ──────────────────────────
const mainCanvas  = document.getElementById('mainChart');
const rsiCanvas   = document.getElementById('rsiChart');
const macdCanvas  = document.getElementById('macdChart');
const equityCanvas = document.getElementById('equityChart');
const mainCtx  = mainCanvas.getContext('2d');
const rsiCtx   = rsiCanvas.getContext('2d');
const macdCtx  = macdCanvas.getContext('2d');
const equityCtx = equityCanvas.getContext('2d');

function resize() {
  const cw = mainCanvas.parentElement;
  const rsiPane  = document.getElementById('rsiPane');
  const macdPane = document.getElementById('macdPane');

  // main chart fills remaining height
  const totalH   = cw.clientHeight;
  const subH     = rsiPane.offsetHeight + macdPane.offsetHeight;
  const mainH    = totalH - subH;

  mainCanvas.width  = cw.clientWidth;
  mainCanvas.height = Math.max(mainH, 200);
  rsiCanvas.width   = rsiPane.clientWidth;
  rsiCanvas.height  = rsiPane.clientHeight;
  macdCanvas.width  = macdPane.clientWidth;
  macdCanvas.height = macdPane.clientHeight;
  equityCanvas.width  = equityCanvas.parentElement.clientWidth;
  equityCanvas.height = 140;

  draw();
  drawEquity();
}

// ── MAIN CHART DRAW ───────────────────────
function draw() {
  const W = mainCanvas.width;
  const H = mainCanvas.height;
  const ctx = mainCtx;
  ctx.clearRect(0, 0, W, H);

  const slice   = candles.slice(visibleStart, visibleStart + VISIBLE_COUNT);
  const sliceE9 = ema9.slice(visibleStart, visibleStart + VISIBLE_COUNT);
  const sliceE21 = ema21.slice(visibleStart, visibleStart + VISIBLE_COUNT);
  const sliceVW  = vwap.slice(visibleStart, visibleStart + VISIBLE_COUNT);

  if (!slice.length) return;

  const allH = slice.map(c => c.h);
  const allL = slice.map(c => c.l);
  const priceMax = Math.max(...allH) * 1.001;
  const priceMin = Math.min(...allL) * 0.999;

  const PAD_L = 8, PAD_R = 50, PAD_T = 40, PAD_B = 20;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const candleW = chartW / VISIBLE_COUNT;
  const bodyW   = Math.max(candleW * 0.6, 2);

  const toX = i => PAD_L + (i + 0.5) * candleW;
  const toY = p => PAD_T + chartH - ((p - priceMin) / (priceMax - priceMin)) * chartH;

  // Grid lines
  ctx.strokeStyle = 'rgba(26,40,64,0.8)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = PAD_T + (chartH / 5) * i;
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    const price = priceMax - ((priceMax - priceMin) / 5) * i;
    ctx.fillStyle = '#4a6080';
    ctx.font = '9px Space Mono';
    ctx.textAlign = 'left';
    ctx.fillText(price.toFixed(0), W - PAD_R + 4, y + 3);
  }

  // Volume bars (background)
  const maxVol = Math.max(...slice.map(c => c.v));
  slice.forEach((c, i) => {
    const x = toX(i);
    const volH = (c.v / maxVol) * (chartH * 0.2);
    ctx.fillStyle = c.c >= c.o
      ? 'rgba(0,200,122,0.08)'
      : 'rgba(255,71,87,0.08)';
    ctx.fillRect(x - bodyW / 2, PAD_T + chartH - volH, bodyW, volH);
  });

  // VWAP line
  if (showVWAP) {
    ctx.strokeStyle = 'rgba(240,180,41,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    sliceVW.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // EMA 21
  if (showEMA21) {
    ctx.strokeStyle = 'rgba(255,107,157,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    sliceE21.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
  }

  // EMA 9
  if (showEMA9) {
    ctx.strokeStyle = 'rgba(58,134,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    sliceE9.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
  }

  // Candles
  slice.forEach((c, i) => {
    const x   = toX(i);
    const isUp = c.c >= c.o;
    const col  = isUp ? '#00c87a' : '#ff4757';

    // Wick
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(c.h));
    ctx.lineTo(x, toY(c.l));
    ctx.stroke();

    // Body
    const bodyTop = toY(Math.max(c.o, c.c));
    const bodyBot = toY(Math.min(c.o, c.c));
    const bH = Math.max(bodyBot - bodyTop, 1);
    ctx.fillStyle = isUp ? '#00c87a' : '#ff4757';
    ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bH);
  });

  // Buy/Sell signals
  const visSignals = signals.filter(s => s.i >= visibleStart && s.i < visibleStart + VISIBLE_COUNT);
  visSignals.forEach(s => {
    const li = s.i - visibleStart;
    const x  = toX(li);
    const y  = toY(s.price);
    ctx.font = 'bold 11px Space Mono';
    ctx.textAlign = 'center';
    if (s.type === 'buy') {
      ctx.fillStyle = '#00c87a';
      ctx.fillText('▲', x, y + 4);
    } else {
      ctx.fillStyle = '#ff4757';
      ctx.fillText('▼', x, y - 4);
    }
  });

  // Latest price line
  const lastC = slice[slice.length - 1];
  if (lastC) {
    const lY = toY(lastC.c);
    const isUp = lastC.c >= lastC.o;
    ctx.strokeStyle = isUp ? 'rgba(0,200,122,0.5)' : 'rgba(255,71,87,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD_L, lY); ctx.lineTo(W - PAD_R, lY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isUp ? '#00c87a' : '#ff4757';
    ctx.fillRect(W - PAD_R + 1, lY - 8, PAD_R - 1, 16);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px Space Mono';
    ctx.textAlign = 'center';
    ctx.fillText(lastC.c.toFixed(0), W - PAD_R + (PAD_R / 2), lY + 3);
  }
}

// ── RSI PANE ──────────────────────────────
function drawRSI() {
  const W = rsiCanvas.width;
  const H = rsiCanvas.height;
  const ctx = rsiCtx;
  ctx.clearRect(0, 0, W, H);

  const slice = rsi.slice(visibleStart, visibleStart + VISIBLE_COUNT);
  const valid = slice.filter(v => v !== null);
  if (!valid.length) return;

  const toX = i => (i / (VISIBLE_COUNT - 1)) * W;
  const toY = v => H - (v / 100) * H;

  // OB/OS zones
  ctx.fillStyle = 'rgba(255,71,87,0.06)';
  ctx.fillRect(0, 0, W, toY(70));
  ctx.fillStyle = 'rgba(0,200,122,0.06)';
  ctx.fillRect(0, toY(30), W, H - toY(30));

  // Level lines
  [70, 50, 30].forEach(lvl => {
    ctx.strokeStyle = lvl === 50 ? 'rgba(74,96,128,0.4)' : 'rgba(74,96,128,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash(lvl === 50 ? [2,4] : []);
    ctx.beginPath();
    ctx.moveTo(0, toY(lvl)); ctx.lineTo(W, toY(lvl));
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // RSI line
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let first = true;
  slice.forEach((v, i) => {
    if (v === null) return;
    first ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    first = false;
  });
  ctx.stroke();

  // Current RSI value
  const cur = valid[valid.length - 1];
  document.getElementById('rsiVal').textContent = cur.toFixed(1);
  document.getElementById('live-rsi').textContent = cur.toFixed(1);
}

// ── MACD PANE ─────────────────────────────
function drawMACD() {
  const W = macdCanvas.width;
  const H = macdCanvas.height;
  const ctx = macdCtx;
  ctx.clearRect(0, 0, W, H);

  const hist = macdData.histogram.slice(visibleStart, visibleStart + VISIBLE_COUNT);
  const valid = hist.filter(v => v !== null);
  if (!valid.length) return;

  const maxAbs = Math.max(...valid.map(Math.abs)) || 1;
  const mid = H / 2;
  const barW = W / VISIBLE_COUNT;

  // Zero line
  ctx.strokeStyle = 'rgba(74,96,128,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

  // Histogram bars
  hist.forEach((v, i) => {
    if (v === null) return;
    const x = i * barW;
    const h = (Math.abs(v) / maxAbs) * (H * 0.45);
    ctx.fillStyle = v >= 0 ? 'rgba(0,200,122,0.7)' : 'rgba(255,71,87,0.7)';
    ctx.fillRect(x + 1, v >= 0 ? mid - h : mid, barW - 2, h);
  });
}

// ── EQUITY CURVE ──────────────────────────
function drawEquity() {
  const W = equityCanvas.width;
  const H = equityCanvas.height;
  const ctx = equityCtx;
  ctx.clearRect(0, 0, W, H);

  // Simulated equity points
  const pts = [];
  let val = 10000;
  for (let i = 0; i < 60; i++) {
    val += (Math.random() - 0.38) * 120;
    pts.push(val);
  }

  const min = Math.min(...pts) * 0.998;
  const max = Math.max(...pts) * 1.002;
  const toX = i => (i / (pts.length - 1)) * W;
  const toY = v => H - 20 - ((v - min) / (max - min)) * (H - 30);

  // Fill gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(0,200,122,0.3)');
  grad.addColorStop(1, 'rgba(0,200,122,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(toX(0), H);
  pts.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(pts.length - 1), H);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = '#00c87a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.stroke();

  // Start / end labels
  ctx.fillStyle = '#4a6080';
  ctx.font = '9px Space Mono';
  ctx.textAlign = 'left';
  ctx.fillText('$' + pts[0].toFixed(0), 4, H - 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#00c87a';
  ctx.fillText('$' + pts[pts.length - 1].toFixed(0), W - 4, H - 4);
}

// ── CROSSHAIR ────────────────────────────
mainCanvas.addEventListener('mousemove', e => {
  const rect = mainCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const W  = mainCanvas.width;
  const PAD_L = 8, PAD_R = 50;
  const chartW = W - PAD_L - PAD_R;
  const candleW = chartW / VISIBLE_COUNT;
  const idx = Math.floor((mx - PAD_L) / candleW);

  if (idx >= 0 && idx < VISIBLE_COUNT) {
    const c = candles[visibleStart + idx];
    if (c) {
      const info = document.getElementById('crosshairInfo');
      info.style.display = 'flex';
      document.getElementById('ci-date').textContent = c.t.toLocaleString('en-US', { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      document.getElementById('ci-o').textContent = c.o.toFixed(2);
      document.getElementById('ci-h').textContent = c.h.toFixed(2);
      document.getElementById('ci-l').textContent = c.l.toFixed(2);
      document.getElementById('ci-c').textContent = c.c.toFixed(2);
    }
  }
});
mainCanvas.addEventListener('mouseleave', () => {
  document.getElementById('crosshairInfo').style.display = 'none';
});

// ── SCROLL / ZOOM ─────────────────────────
mainCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  visibleStart = Math.max(0, Math.min(candles.length - VISIBLE_COUNT, visibleStart + (e.deltaY > 0 ? 3 : -3)));
  draw(); drawRSI(); drawMACD();
}, { passive: false });

// ── TIMEFRAME SWITCH ──────────────────────
function setTF(btn, tf) {
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const vols = { '1m':10, '5m':25, '15m':40, '1h':80, '4h':160, '1D':320 };
  candles  = generateCandles(120, 18000, vols[tf] || 80);
  closes   = candles.map(c => c.c);
  ema9     = calcEMA(closes, 9);
  ema21    = calcEMA(closes, 21);
  vwap     = calcVWAP(candles);
  rsi      = calcRSI(closes);
  macdData = calcMACD(closes);
  signals  = calcSignals(candles, ema9, ema21);
  visibleStart = 60;
  draw(); drawRSI(); drawMACD();
  showToast('Timeframe: ' + tf);
}

// ── SYMBOL SWITCH ─────────────────────────
function switchSymbol(el, sym, exchange, price, changePct) {
  document.querySelectorAll('.sym-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('active-symbol').textContent = sym;
  document.getElementById('symbol-exchange') && (document.getElementById('symbol-exchange').textContent = exchange);
  document.getElementById('cur-price').textContent = price.toLocaleString('en-US', { minimumFractionDigits:2 });
  const isUp = changePct >= 0;
  const changeEl = document.getElementById('cur-change');
  changeEl.textContent = (isUp ? '▲ +' : '▼ ') + changePct.toFixed(2) + '%';
  changeEl.className = 'cur-change ' + (isUp ? 'up' : 'down');

  const newBase = price;
  const vol = price > 1000 ? 80 : price > 100 ? 4 : 200;
  candles  = generateCandles(120, newBase, vol);
  closes   = candles.map(c => c.c);
  ema9     = calcEMA(closes, 9);
  ema21    = calcEMA(closes, 21);
  vwap     = calcVWAP(candles);
  rsi      = calcRSI(closes);
  macdData = calcMACD(closes);
  signals  = calcSignals(candles, ema9, ema21);
  visibleStart = 60;
  draw(); drawRSI(); drawMACD();
}

// ── RIGHT PANEL TABS ──────────────────────
function rpTab(btn, panel) {
  document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.rp-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rp-' + panel)?.classList.add('active');
}

// ── TOOL SELECTION ────────────────────────
function setTool(btn) {
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function clearDrawings() { showToast('Drawings cleared'); }

// ── INDICATOR TOGGLE ─────────────────────
function toggleIndicator(name) {
  if (name === 'ema9')  { showEMA9  = !showEMA9;  document.getElementById('pill-ema9')?.classList.toggle('dim');  }
  if (name === 'ema21') { showEMA21 = !showEMA21; document.getElementById('pill-ema21')?.classList.toggle('dim'); }
  if (name === 'vwap')  { showVWAP  = !showVWAP;  document.getElementById('pill-vwap')?.classList.toggle('dim');  }
  draw();
}

// ── INDICATOR MENU ────────────────────────
function showIndicatorMenu() { document.getElementById('indModal').classList.add('open'); }
function hideIndicatorMenu() { document.getElementById('indModal').classList.remove('open'); }
function addIndicator(name) {
  hideIndicatorMenu();
  showToast(name + ' added to chart');
}

// ── BACKTEST RUNNER ───────────────────────
function runBacktest() {
  const btn = document.querySelector('.bt-run-btn');
  btn.textContent = '⏳ Running...';
  btn.disabled = true;

  setTimeout(() => {
    const winrate = (65 + Math.random() * 20).toFixed(0);
    const pf      = (1.5 + Math.random() * 1.2).toFixed(1);
    const trades  = (30 + Math.floor(Math.random() * 40));
    const ret     = (10 + Math.random() * 25).toFixed(1);
    const dd      = (2 + Math.random() * 8).toFixed(1);
    const sharpe  = (1.2 + Math.random() * 1.2).toFixed(2);

    document.getElementById('bt-winrate').textContent = winrate + '%';
    document.getElementById('bt-pf').textContent      = pf;
    document.getElementById('bt-trades').textContent  = trades;
    document.getElementById('bt-return').textContent  = '+' + ret + '%';
    document.getElementById('bt-dd').textContent      = '-' + dd + '%';
    document.getElementById('bt-sharpe').textContent  = sharpe;

    document.getElementById('bt-results').style.display = 'block';
    btn.textContent = '▶ RUN BACKTEST';
    btn.disabled = false;
    showToast('✅ Backtest complete · ' + trades + ' trades');
  }, 1400);
}

// ── LIVE PRICE TICK ───────────────────────
setInterval(() => {
  if (!candles.length) return;
  const last = candles[candles.length - 1];
  const change = (Math.random() - 0.5) * 8;
  last.c = +(last.c + change).toFixed(2);
  last.h = Math.max(last.h, last.c);
  last.l = Math.min(last.l, last.c);
  closes[closes.length - 1] = last.c;

  document.getElementById('cur-price').textContent = last.c.toLocaleString('en-US', { minimumFractionDigits:2 });
  document.getElementById('ohlc-h').textContent = last.h.toFixed(0);
  document.getElementById('ohlc-l').textContent = last.l.toFixed(0);
  document.getElementById('ohlc-c').textContent = last.c.toFixed(0);

  draw(); drawRSI(); drawMACD();
}, 1500);

// ── TOAST ─────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── INIT ──────────────────────────────────
window.addEventListener('load', () => {
  resize();
  draw();
  drawRSI();
  drawMACD();
  drawEquity();
});
window.addEventListener('resize', resize);
