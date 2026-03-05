// ═══════════════════════════════════════════════════
// IMAGE UPSCALE AND ALL — app.js PROFESSIONAL FINAL
// ═══════════════════════════════════════════════════

// ── STATE ──
let user       = null;
let curScale   = '2K';
let curMode    = 'soft';
let isSU       = false;
let curPlan    = null;
const SIDHU_IMG = 'https://picsum.photos/seed/sidhu99/600/340';

// ── INIT ──
window.onload = async () => {
  await checkSession();
  initAutoSliders();
};

// ── SESSION CHECK ──
async function checkSession() {
  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    const d = await r.json();
    if (d.loggedIn) setUser(d.name, d.plan);
  } catch(e) {}
}

// ══════════════════════════════════════════
// AUTO SLIDERS — Home page, no touch needed
// ══════════════════════════════════════════
function initAutoSliders() {
  // 1. ENHANCER — blur → sharp auto loop
  setupAutoSlider('demo-enh', 'handle-enh', '.asl-after', true);

  // 2. UPSCALER — 2K blurry → 8K crystal
  setupAutoSlider('demo-ups', 'handle-ups', '.asl-after', true);

  // 3. STEM — upload side → stems side
  setupStemAutoSlider();

  // 4. BG REMOVER — original → transparent
  setupBGDemoSlider();
}

function setupAutoSlider(wrapId, handleId, afterSel, autoPlay) {
  const wrap   = document.getElementById(wrapId);
  if (!wrap) return;
  const handle = document.getElementById(handleId);
  const after  = wrap.querySelector(afterSel);
  let pos = 20; // start left
  let dir = 1;
  let drag = false;

  function setPos(p) {
    p = Math.min(Math.max(p, 0), 100);
    pos = p;
    after.style.clipPath  = `inset(0 ${100 - p}% 0 0)`;
    handle.style.left     = p + '%';
  }

  // Manual drag
  wrap.addEventListener('mousedown', e => { drag = true; moveAt(e.clientX, wrap); });
  window.addEventListener('mousemove', e => { if (drag) moveAt(e.clientX, wrap); });
  window.addEventListener('mouseup', () => { drag = false; });
  wrap.addEventListener('touchstart', e => { drag = true; moveAt(e.touches[0].clientX, wrap); }, { passive: true });
  window.addEventListener('touchmove', e => { if (drag) moveAt(e.touches[0].clientX, wrap); }, { passive: true });
  window.addEventListener('touchend', () => { drag = false; });

  function moveAt(x, el) {
    const r = el.getBoundingClientRect();
    setPos(((x - r.left) / r.width) * 100);
  }

  // Auto animation
  if (autoPlay) {
    setPos(20);
    setInterval(() => {
      if (drag) return;
      pos += dir * 0.35;
      if (pos >= 85) dir = -1;
      if (pos <= 15) dir = 1;
      setPos(pos);
    }, 20);
  }
}

function setupStemAutoSlider() {
  const wrap   = document.getElementById('demo-stem');
  const handle = document.getElementById('handle-stem');
  const right  = document.getElementById('stem-demo-right');
  if (!wrap || !handle || !right) return;

  let pos  = 5;
  let dir  = 1;
  let drag = false;

  function setPos(p) {
    p = Math.min(Math.max(p, 0), 100);
    pos = p;
    right.style.clipPath = `inset(0 0 0 ${100 - p}%)`;
    handle.style.left    = p + '%';
  }

  wrap.addEventListener('mousedown', e => { drag = true; moveAt(e.clientX); });
  window.addEventListener('mousemove', e => { if (drag) moveAt(e.clientX); });
  window.addEventListener('mouseup', () => { drag = false; });
  wrap.addEventListener('touchstart', e => { drag = true; moveAt(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (drag) moveAt(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => { drag = false; });

  function moveAt(x) {
    const r = wrap.getBoundingClientRect();
    setPos(((x - r.left) / r.width) * 100);
  }

  setPos(5);
  setInterval(() => {
    if (drag) return;
    pos += dir * 0.3;
    if (pos >= 95) dir = -1;
    if (pos <= 5)  dir = 1;
    setPos(pos);
  }, 20);
}

function setupBGDemoSlider() {
  const wrap   = document.getElementById('demo-bgr');
  const handle = document.getElementById('handle-bgr');
  const after  = wrap ? wrap.querySelector('.asl-after') : null;
  if (!wrap || !handle || !after) return;

  // BG removed look: checkerboard + no bg
  after.style.backgroundImage = `
    linear-gradient(45deg,#333 25%,transparent 25%),
    linear-gradient(-45deg,#333 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#333 75%),
    linear-gradient(-45deg,transparent 75%,#333 75%)
  `;
  after.style.backgroundSize = '20px 20px';
  after.style.backgroundPosition = '0 0,0 10px,10px -10px,-10px 0';

  let pos = 10, dir = 1, drag = false;

  function setPos(p) {
    p = Math.min(Math.max(p, 0), 100);
    pos = p;
    after.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    handle.style.left    = p + '%';
  }

  wrap.addEventListener('mousedown', e => { drag = true; moveAt(e.clientX); });
  window.addEventListener('mousemove', e => { if (drag) moveAt(e.clientX); });
  window.addEventListener('mouseup', () => { drag = false; });
  wrap.addEventListener('touchstart', e => { drag = true; moveAt(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (drag) moveAt(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => { drag = false; });

  function moveAt(x) {
    const r = wrap.getBoundingClientRect();
    setPos(((x - r.left) / r.width) * 100);
  }

  setPos(10);
  setInterval(() => {
    if (drag) return;
    pos += dir * 0.3;
    if (pos >= 90) dir = -1;
    if (pos <= 10) dir = 1;
    setPos(pos);
  }, 20);
}

// ══════════════════════════════════════════
// NAV
// ══════════════════════════════════════════
function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const navEl = document.getElementById('nav-' + p);
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0, 0);
}

function goTool(p) {
  showPage(p);
  if (!user) {
    document.getElementById('lock-' + p).classList.add('show');
    document.getElementById('tool-' + p).style.display = 'none';
  } else {
    document.getElementById('lock-' + p).classList.remove('show');
    document.getElementById('tool-' + p).style.display = 'block';
  }
}

// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════
function setTheme(cls, dot) {
  document.body.className = cls;
  document.querySelectorAll('.tdot').forEach(d => d.classList.remove('on'));
  dot.classList.add('on');
}

// ══════════════════════════════════════════
// LOGIN / SIGNUP
// ══════════════════════════════════════════
function openLogin() {
  document.getElementById('login-modal').classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

function toggleForm() {
  isSU = !isSU;
  document.getElementById('lform').style.display  = isSU ? 'none' : 'block';
  document.getElementById('sform').style.display  = isSU ? 'block' : 'none';
  document.getElementById('ltitle').textContent   = isSU ? 'CREATE ACCOUNT' : 'WELCOME BACK';
  document.getElementById('lsub').textContent     = isSU ? 'Join free' : 'Sign in to use all tools';
  document.getElementById('ltog').textContent     = isSU ? 'Already have account? Sign In' : "Don't have account? Sign Up";
}

async function doLogin() {
  const email = document.getElementById('lemail').value.trim();
  const pass  = document.getElementById('lpass').value;
  document.getElementById('lerr').textContent = '';
  if (!email || !pass) { document.getElementById('lerr').textContent = 'Fill all fields'; return; }
  try {
    const r = await fetch('/api/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const d = await r.json();
    if (!r.ok) { document.getElementById('lerr').textContent = d.error; return; }
    setUser(d.name, d.plan);
    closeModal('login-modal');
    toast('👋 Welcome back, ' + d.name + '!');
  } catch(e) { document.getElementById('lerr').textContent = 'Server error'; }
}

async function doSignup() {
  const name  = document.getElementById('sname').value.trim();
  const email = document.getElementById('semail').value.trim();
  const pass  = document.getElementById('spass').value;
  document.getElementById('serr').textContent = '';
  if (!name || !email || !pass) { document.getElementById('serr').textContent = 'Fill all fields'; return; }
  try {
    const r = await fetch('/api/signup', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: pass })
    });
    const d = await r.json();
    if (!r.ok) { document.getElementById('serr').textContent = d.error; return; }
    setUser(d.name, d.plan);
    closeModal('login-modal');
    toast('🎉 Welcome, ' + d.name + '!');
  } catch(e) { document.getElementById('serr').textContent = 'Server error'; }
}

function setUser(name, plan) {
  user = { name, plan };
  document.getElementById('btn-login-nav').style.display  = 'none';
  document.getElementById('btn-unlock-nav').style.display = 'inline-block';
  document.getElementById('uavatar').style.display        = 'block';
  document.getElementById('uimg').src =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00e5ff&color=000&size=80`;
  // Unlock all tools
  ['bgr','ups','stem','enh'].forEach(t => {
    const lock = document.getElementById('lock-' + t);
    const tool = document.getElementById('tool-' + t);
    if (lock) lock.classList.remove('show');
    if (tool) tool.style.display = 'block';
  });
}

// ══════════════════════════════════════════
// PRICING & PAYMENT
// ══════════════════════════════════════════
function openPricing() {
  if (!user) { openLogin(); return; }
  document.getElementById('price-modal').classList.add('show');
}

function selectPlan(plan, price, card) {
  curPlan = plan;
  document.querySelectorAll('.pcard').forEach(c => c.style.opacity = '0.6');
  card.style.opacity = '1';
  card.style.borderColor = 'var(--accent)';
  document.getElementById('pay-plan-title').textContent = `PAYMENT — ${plan.toUpperCase()} ${price}`;
  document.getElementById('pay-form').classList.add('show');
}

function fmtCard(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

async function doPayment() {
  const name    = document.getElementById('pay-name').value.trim();
  const addr    = document.getElementById('pay-addr').value.trim();
  const card    = document.getElementById('pay-card').value.trim();
  const exp     = document.getElementById('pay-exp').value.trim();
  const cvv     = document.getElementById('pay-cvv').value.trim();
  const email   = document.getElementById('pay-email').value.trim();
  document.getElementById('pay-err').textContent = '';
  if (!name || !addr || !card || !exp || !cvv || !email) {
    document.getElementById('pay-err').textContent = 'Please fill all payment fields';
    return;
  }
  try {
    await fetch('/api/unlock', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: curPlan })
    });
    closeModal('price-modal');
    document.getElementById('pay-form').classList.remove('show');
    toast('🎉 Payment successful! ' + curPlan + ' plan activated!');
  } catch(e) {
    document.getElementById('pay-err').textContent = 'Payment failed. Try again.';
  }
}

// ══════════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════════
function dragOver(e, z) { e.preventDefault(); document.getElementById(z).classList.add('dragover'); }
function dragLeave(z) { document.getElementById(z).classList.remove('dragover'); }
function dropFile(e, inputId, zoneId) {
  e.preventDefault();
  dragLeave(zoneId);
  const files = e.dataTransfer.files;
  if (!files.length) return;
  const input = document.getElementById(inputId);
  const dt = new DataTransfer();
  dt.items.add(files[0]);
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
}

// ══════════════════════════════════════════
// ✂️ BG REMOVER
// ══════════════════════════════════════════
async function handleBGR(input) {
  if (!user) { openLogin(); return; }
  const file = input.files[0]; if (!file) return;
  const origUrl = URL.createObjectURL(file);

  // Show original on both sides
  document.getElementById('bgr-orig').style.backgroundImage = `url('${origUrl}')`;
  document.getElementById('bgr-rem').style.backgroundImage  = `url('${origUrl}')`;
  document.getElementById('bgr-proc').classList.add('show');
  document.getElementById('bgr-prev').classList.remove('show');

  const fd = new FormData(); fd.append('image', file);
  try {
    const r = await fetch('/remove-bg', { method: 'POST', body: fd, credentials: 'include' });
    if (!r.ok) throw new Error('Server error');
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const remEl = document.getElementById('bgr-rem');
    remEl.style.backgroundImage = `url('${url}')`;
    remEl.style.backgroundColor = '#1a1a1a';
    document.getElementById('bgr-dl').href = url;
    setupBGToolSlider();
    document.getElementById('bgr-proc').classList.remove('show');
    document.getElementById('bgr-prev').classList.add('show');
    toast('✅ Background removed!');
  } catch(e) {
    document.getElementById('bgr-proc').classList.remove('show');
    toast('❌ Error: ' + e.message);
  }
  input.value = '';
}

function setupBGToolSlider() {
  const wrap  = document.getElementById('bgr-wrap');
  const rem   = document.getElementById('bgr-rem');
  const hand  = document.getElementById('bgr-hand');
  let drag = false;
  rem.style.clipPath = 'inset(0 50% 0 0)';
  hand.style.left    = '50%';

  function setPos(x) {
    const r = wrap.getBoundingClientRect();
    let p = Math.min(Math.max(((x - r.left) / r.width) * 100, 0), 100);
    rem.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    hand.style.left    = p + '%';
  }
  wrap.addEventListener('mousedown', e => { drag = true; setPos(e.clientX); });
  window.addEventListener('mousemove', e => { if (drag) setPos(e.clientX); });
  window.addEventListener('mouseup', () => { drag = false; });
  wrap.addEventListener('touchstart', e => { drag = true; setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (drag) setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => { drag = false; });
}

function setBG(c, btn) {
  document.querySelectorAll('.cbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('bgr-rem').style.backgroundColor = c;
}

// ══════════════════════════════════════════
// 🔬 UPSCALER
// ══════════════════════════════════════════
function selScale(btn, val) {
  document.querySelectorAll('.sbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  curScale = val;
  const badge = document.getElementById('ups-badge');
  if (badge) badge.textContent = val;
}

async function handleUps(input) {
  if (!user) { openLogin(); return; }
  const file = input.files[0]; if (!file) return;
  const origUrl = URL.createObjectURL(file);
  document.getElementById('ups-bef').src = origUrl;
  document.getElementById('ups-proc').classList.add('show');
  document.getElementById('ups-prev').classList.remove('show');
  document.getElementById('ups-pt').textContent = `Upscaling to ${curScale}...`;

  const fd = new FormData(); fd.append('image', file); fd.append('scale', curScale);
  try {
    const r = await fetch('/upscale', { method: 'POST', body: fd, credentials: 'include' });
    if (!r.ok) throw new Error('Server error');
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    document.getElementById('ups-aft').src = url;
    document.getElementById('ups-dl').href = url;
    document.getElementById('ups-dl').download = `upscaled-${curScale}.png`;
    document.getElementById('ups-msg').textContent = `✅ Upscaled to ${curScale}!`;
    document.getElementById('ups-proc').classList.remove('show');
    document.getElementById('ups-prev').classList.add('show');
    toast(`✅ Upscaled to ${curScale}!`);
  } catch(e) {
    document.getElementById('ups-proc').classList.remove('show');
    toast('❌ ' + e.message);
  }
  input.value = '';
}

// ══════════════════════════════════════════
// 🎵 STEM SPLITTER
// ══════════════════════════════════════════
async function handleStem(input) {
  if (!user) { openLogin(); return; }
  const file = input.files[0]; if (!file) return;

  document.getElementById('stem-timer').classList.add('show');
  document.getElementById('stem-prev').classList.remove('show');

  let secs = 45;
  document.getElementById('stem-cnt').textContent = secs;
  const iv = setInterval(() => {
    secs--;
    document.getElementById('stem-cnt').textContent = Math.max(secs, 0);
    if (secs <= 0) clearInterval(iv);
  }, 1000);

  const fd = new FormData(); fd.append('audio', file);
  try {
    const r = await fetch('/split-stems', { method: 'POST', body: fd, credentials: 'include' });
    if (!r.ok) throw new Error('Server error');
    const blob = await r.blob();
    const zipUrl = URL.createObjectURL(blob);

    // Try to extract WAVs for preview using JSZip
    try {
      const JSZip = (await import('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')).default;
      const zip   = await JSZip.loadAsync(blob);
      const map   = { 'vocals.wav':'sa-v', 'drums.wav':'sa-d', 'bass.wav':'sa-b', 'instruments.wav':'sa-i' };
      for (const [name, id] of Object.entries(map)) {
        const f = zip.file(name);
        if (f) {
          const ab = await f.async('blob');
          const src = URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
          document.getElementById(id).src = src;
        }
      }
    } catch(e) { console.log('JSZip preview failed:', e); }

    document.getElementById('stem-dl').href     = zipUrl;
    document.getElementById('stem-dl').download = file.name.replace(/\.[^.]+$/, '') + '-stems.zip';

    clearInterval(iv);
    document.getElementById('stem-timer').classList.remove('show');
    document.getElementById('stem-prev').classList.add('show');
    toast('✅ Stems ready! Download ZIP.');
  } catch(e) {
    clearInterval(iv);
    document.getElementById('stem-timer').classList.remove('show');
    toast('❌ ' + e.message);
  }
  input.value = '';
}

// ══════════════════════════════════════════
// ✨ ENHANCER
// ══════════════════════════════════════════
function selMode(btn, val) {
  document.querySelectorAll('.mbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  curMode = val;
}

async function handleEnh(input) {
  if (!user) { openLogin(); return; }
  const file = input.files[0]; if (!file) return;
  const origUrl = URL.createObjectURL(file);
  document.getElementById('enh-bef').src = origUrl;
  document.getElementById('enh-proc').classList.add('show');
  document.getElementById('enh-prev').classList.remove('show');

  const fd = new FormData(); fd.append('image', file); fd.append('mode', curMode);
  try {
    const r = await fetch('/enhance', { method: 'POST', body: fd, credentials: 'include' });
    if (!r.ok) throw new Error('Server error');
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    document.getElementById('enh-aft').src  = url;
    document.getElementById('enh-dl').href  = url;
    document.getElementById('enh-dl').download = `enhanced-${curMode}.png`;
    document.getElementById('enh-msg').textContent = `✅ Enhanced (${curMode})!`;
    document.getElementById('enh-proc').classList.remove('show');
    document.getElementById('enh-prev').classList.add('show');
    toast(`✅ Enhanced (${curMode})!`);
  } catch(e) {
    document.getElementById('enh-proc').classList.remove('show');
    toast('❌ ' + e.message);
  }
  input.value = '';
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// Close modals on overlay click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); });
  });
});
