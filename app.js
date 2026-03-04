// ── TAB SWITCHING ─────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  const content = document.getElementById('tab-' + name);
  if (content) content.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes("'" + name + "'")) btn.classList.add('active');
  });
}

function switchNav(el, name) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el?.classList) el.classList.add('active');
  switchTab(name);
}

// ── ENGINE TOGGLE (expand/collapse) ──────────
function toggleEngine(bodyId) {
  document.getElementById(bodyId)?.classList.toggle('open');
}

// ── TOGGLE BOT ON/OFF ─────────────────────────
function toggleBot(cardId) {
  const card = document.getElementById(cardId);
  const btn  = document.getElementById('btn-' + cardId);
  if (card.classList.contains('running')) {
    card.classList.replace('running', 'pending');
    if (btn) { btn.textContent = '▶ Resume Engine'; btn.classList.remove('active-btn'); }
    showToast('⏸ Engine paused');
  } else {
    card.classList.replace('pending', 'running');
    if (btn) { btn.textContent = '⏸ Pause Engine'; btn.classList.add('active-btn'); }
    showToast('✅ Engine restarted!');
  }
}

// ── ACTIVATE A SINGLE ENGINE ─────────────────
function activateEngine(cardId, btnId) {
  const card = document.getElementById(cardId);
  const btn  = document.getElementById(btnId);
  if (!card) return;
  card.classList.replace('pending', 'running');
  if (btn) { btn.textContent = '⏸ Pause Engine'; btn.classList.add('active-btn'); }
  card.querySelectorAll('.engine-status').forEach(el => {
    el.textContent = '● RUNNING';
    el.className = 'engine-status status-running';
  });
  showToast('✅ Engine activated!');
}

// ── ACTIVATE ALL ENGINES ─────────────────────
function activateAll() {
  ['eng3', 'eng5'].forEach(id => {
    const card = document.getElementById(id);
    if (card?.classList.contains('pending')) {
      card.classList.replace('pending', 'running');
      card.querySelectorAll('.engine-status').forEach(el => {
        el.textContent = '● RUNNING';
        el.className = 'engine-status status-running';
      });
      const btn = document.getElementById('btn-' + id);
      if (btn) { btn.textContent = '⏸ Pause Engine'; btn.classList.add('active-btn'); }
    }
  });
  showToast('🚀 All engines are now running!');
}

// ── TOAST NOTIFICATION ────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── LIVE YIELD TICKER (simulates DeFi block rewards) ──
let autoEarned = 0;

function tick() {
  const micro = Math.random() * 0.004 + 0.001;
  autoEarned += micro;

  const liveEl   = document.getElementById('live-earn');
  const statEl   = document.getElementById('auto-stat');
  const defiEl   = document.getElementById('defi-earn');
  const faucetPct = document.getElementById('faucet-pct');
  const faucetBar = document.getElementById('faucet-bar');
  const defiBar   = document.getElementById('defi-bar');

  if (liveEl)    liveEl.textContent  = '$' + autoEarned.toFixed(4);
  if (statEl)    statEl.textContent  = '+$' + (43.20 + autoEarned).toFixed(2);
  if (defiEl)    defiEl.textContent  = '$' + (0.23 + autoEarned).toFixed(4);

  const pct = Math.min(68 + autoEarned * 40, 100);
  if (faucetPct) faucetPct.textContent = Math.floor(pct) + '%';
  if (faucetBar) faucetBar.style.width = pct + '%';
  if (defiBar)   defiBar.style.width   = Math.min(23 + autoEarned * 100, 100) + '%';
}

setInterval(tick, 2500);

// ── ANIMATE TOTAL VALUE ON LOAD ───────────────
function animateValue(el, start, end, duration) {
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const value = start + (end - start) * progress;
    el.textContent = '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

window.addEventListener('load', () => {
  const valEl = document.getElementById('total-val');
  if (valEl) animateValue(valEl, 4500, 4821.50, 1200);
  setTimeout(() => showToast('⚡ Auto-Earn Engine Active!'), 1000);
});
