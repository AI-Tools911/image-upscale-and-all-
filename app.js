/* ═══════════════════════════════════════════════════════
   IMAGE UPSCALE AND ALL — app.js
   Handles: Navigation, Theme, BG Remover, Upscaler,
            Stem Splitter, Enhancer, Login, Pricing
   All downloads go through browser/IDM download manager
═══════════════════════════════════════════════════════ */

// ── GLOBAL STATE ──────────────────────────────────────
let isLoggedIn   = false;
let currentUser  = { name: '', email: '', avatar: '' };
let selectedScale = '2K';
let selectedMode  = 'soft';
let isSignupMode  = false;

// ═══════════════════════════════════════════════════════
// NAVIGATION — switch between pages
// ═══════════════════════════════════════════════════════
function showPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Remove active from all nav links
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  // Show selected page and mark nav link active
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('nav-' + page).classList.add('active');
  // Scroll to top
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════════════════
// THEME SWITCHER — changes CSS variables on <body>
// ═══════════════════════════════════════════════════════
function setTheme(name, dot) {
  document.body.className = 'theme-' + name;
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active-dot'));
  dot.classList.add('active-dot');
}

// ═══════════════════════════════════════════════════════
// HERO SLIDER — auto-animates + drag to compare
// Shows Enhanced vs Original on home page
// ═══════════════════════════════════════════════════════
(function initHeroSlider() {
  const wrap   = document.getElementById('hero-slider');
  const sharp  = document.getElementById('hero-sharp');
  const handle = document.getElementById('hero-handle');
  if (!wrap) return;

  let dragging = false;

  function setPos(x) {
    const rect = wrap.getBoundingClientRect();
    let pct = Math.min(Math.max((x - rect.left) / rect.width * 100, 0), 100);
    sharp.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    handle.style.left = pct + '%';
  }

  // Mouse events
  wrap.addEventListener('mousedown', e => { dragging = true; setPos(e.clientX); });
  window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
  window.addEventListener('mouseup', () => dragging = false);

  // Touch events (mobile)
  wrap.addEventListener('touchstart', e => { dragging = true; setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (dragging) setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => dragging = false);

  // Auto demo animation — bounces back and forth
  let dir = 1, pos = 25;
  setInterval(() => {
    if (!dragging) {
      pos += dir * 0.4;
      if (pos > 82 || pos < 18) dir *= -1;
      sharp.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
      handle.style.left = pos + '%';
    }
  }, 25);
})();

// ═══════════════════════════════════════════════════════
// DRAG & DROP — for upload zones
// ═══════════════════════════════════════════════════════
function dragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add('dragover');
}
function dragLeave(zoneId) {
  document.getElementById(zoneId).classList.remove('dragover');
}
function dropFile(e, inputId, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length) {
    const input = document.getElementById(inputId);
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  }
}

// ═══════════════════════════════════════════════════════
// BG REMOVER
// — Sends image to Flask /remove-bg
// — Shows slider: original vs removed
// — Download as PNG triggers browser/IDM download
// ═══════════════════════════════════════════════════════
async function handleBGR(input) {
  const file = input.files[0];
  if (!file) return;

  // Show processing
  const proc = document.getElementById('bgr-processing');
  const preview = document.getElementById('bgr-preview');
  proc.classList.add('show');
  preview.classList.remove('show');
  document.getElementById('bgr-proc-text').textContent = 'Removing background with AI...';

  // Show original in slider
  const origUrl = URL.createObjectURL(file);
  document.getElementById('bgr-original').style.backgroundImage = `url('${origUrl}')`;

  // Send to backend
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/remove-bg', { method: 'POST', body: formData });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error');
    }

    // Backend returns PNG blob with background removed
    const blob = await res.blob();
    const removedUrl = URL.createObjectURL(blob);

    // Show removed image in slider
    document.getElementById('bgr-removed').style.backgroundImage = `url('${removedUrl}')`;

    // Setup download link — browser/IDM will handle it
    const dlLink = document.getElementById('bgr-download-link');
    dlLink.href = removedUrl;

    // Setup slider interaction
    setupBGSlider();

    proc.classList.remove('show');
    preview.classList.add('show');
    document.getElementById('bgr-status').textContent = '✅ Background removed! Slide to compare.';
    showToast('✅ Background removed!');

  } catch (err) {
    proc.classList.remove('show');
    showToast('❌ Error: ' + err.message + ' — Make sure Python server is running');
    document.getElementById('bgr-status').textContent = '❌ ' + err.message;
    document.getElementById('bgr-status').className = 'status-msg error';
  }

  input.value = '';
}

// BG Remover slider — drag to compare original vs removed
function setupBGSlider() {
  const wrap   = document.getElementById('bgr-slider-wrap');
  const removed = document.getElementById('bgr-removed');
  const handle = document.getElementById('bgr-handle');
  if (!wrap) return;

  let dragging = false;

  function setPos(x) {
    const rect = wrap.getBoundingClientRect();
    let pct = Math.min(Math.max((x - rect.left) / rect.width * 100, 0), 100);
    removed.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    handle.style.left = pct + '%';
  }

  // Start at center
  removed.style.clipPath = 'inset(0 50% 0 0)';
  handle.style.left = '50%';

  wrap.addEventListener('mousedown', e => { dragging = true; setPos(e.clientX); });
  window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
  window.addEventListener('mouseup', () => dragging = false);
  wrap.addEventListener('touchstart', e => { dragging = true; setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (dragging) setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => dragging = false);
}

// Change background color behind removed image
function setBGColor(color, btn) {
  document.querySelectorAll('.bg-color-btn').forEach(b => b.classList.remove('active-bg'));
  btn.classList.add('active-bg');

  const el = document.getElementById('bgr-removed');
  if (color === 'transparent') {
    // Show checkerboard (default CSS)
    el.style.backgroundColor = 'transparent';
  } else {
    el.style.backgroundImage = el.style.backgroundImage; // keep the PNG
    el.style.backgroundColor = color;
    // Override the checkerboard
    el.style.backgroundImage = el.style.backgroundImage
      .replace(/linear-gradient[^)]+\)/g, '')
      .replace(/,\s*,/g, ',')
      .replace(/^,|,$/g, '');
  }
}

// ═══════════════════════════════════════════════════════
// UPSCALER
// — Sends image to Flask /upscale?scale=2K
// — Uses canvas to upscale locally if no backend
// — Download triggers browser/IDM
// ═══════════════════════════════════════════════════════
function selectScale(btn, val) {
  document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedScale = val;
}

async function handleUpscale(input) {
  const file = input.files[0];
  if (!file) return;

  const proc    = document.getElementById('ups-processing');
  const preview = document.getElementById('ups-preview');
  proc.classList.add('show');
  preview.classList.remove('show');
  document.getElementById('ups-proc-text').textContent = `Upscaling to ${selectedScale}...`;

  const origUrl = URL.createObjectURL(file);
  document.getElementById('ups-before').src = origUrl;
  document.getElementById('ups-badge-label').textContent = selectedScale;

  // Try backend first
  const formData = new FormData();
  formData.append('image', file);
  formData.append('scale', selectedScale);

  try {
    const res = await fetch('/upscale', { method: 'POST', body: formData });

    let upscaledUrl;

    if (res.ok) {
      // Backend returned upscaled image
      const blob = await res.blob();
      upscaledUrl = URL.createObjectURL(blob);
    } else {
      // Fallback: upscale using canvas (client-side simulation)
      upscaledUrl = await upscaleWithCanvas(file, selectedScale);
    }

    document.getElementById('ups-after').src = upscaledUrl;

    // Setup download — browser/IDM handles it
    const dlLink = document.getElementById('ups-download-link');
    dlLink.href = upscaledUrl;
    dlLink.download = `upscaled-${selectedScale}.png`;

    proc.classList.remove('show');
    preview.classList.add('show');
    document.getElementById('ups-status').textContent = `✅ Upscaled to ${selectedScale}!`;
    showToast(`✅ Image upscaled to ${selectedScale}!`);

  } catch (err) {
    // Fallback canvas upscale
    const upscaledUrl = await upscaleWithCanvas(file, selectedScale);
    document.getElementById('ups-after').src = upscaledUrl;
    document.getElementById('ups-download-link').href = upscaledUrl;
    proc.classList.remove('show');
    preview.classList.add('show');
    document.getElementById('ups-status').textContent = `✅ Upscaled to ${selectedScale}! (client-side)`;
  }

  input.value = '';
}

// Client-side canvas upscale (applies sharpening filters)
function upscaleWithCanvas(file, scale) {
  return new Promise((resolve) => {
    const scaleMap = { '2K': 2048, '4K': 3840, '6K': 5760, '8K': 7680, '10K': 9600 };
    const targetW = scaleMap[scale] || 2048;

    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width;
      const canvas = document.createElement('canvas');
      canvas.width  = targetW;
      canvas.height = Math.round(targetW * ratio);
      const ctx = canvas.getContext('2d');

      // Enable image smoothing for quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply sharpening filter via pixel manipulation
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const sharpened = sharpenFilter(imageData);
      ctx.putImageData(sharpened, 0, 0);

      canvas.toBlob(blob => {
        resolve(URL.createObjectURL(blob));
      }, 'image/png', 1.0);
    };
    img.src = URL.createObjectURL(file);
  });
}

// Sharpening convolution filter
function sharpenFilter(imageData) {
  const kernel = [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0
  ];
  const data   = imageData.data;
  const w      = imageData.width;
  const h      = imageData.height;
  const output = new Uint8ClampedArray(data);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            val += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        output[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, val));
      }
    }
  }
  return new ImageData(output, w, h);
}

// ═══════════════════════════════════════════════════════
// STEM SPLITTER
// — Sends file to Flask /split-stems
// — Shows 30 sec countdown spinner
// — Returns ZIP with vocals.wav, drums.wav, bass.wav, instruments.wav
// — Each stem previews in <audio> player
// — Download ZIP button triggers browser/IDM
// ═══════════════════════════════════════════════════════
async function handleStem(input) {
  const file = input.files[0];
  if (!file) return;

  // Show 30-second countdown timer
  const timer   = document.getElementById('stem-timer');
  const preview = document.getElementById('stem-preview');
  const countEl = document.getElementById('stem-countdown');
  const zone    = document.getElementById('stem-zone');

  timer.classList.add('show');
  preview.classList.remove('show');
  zone.style.opacity = '0.5';
  zone.style.pointerEvents = 'none';

  let secs = 30;
  countEl.textContent = secs;
  const countdownIv = setInterval(() => {
    secs--;
    countEl.textContent = secs;
    if (secs <= 0) clearInterval(countdownIv);
  }, 1000);

  // Send to backend (runs in parallel with countdown)
  const formData = new FormData();
  formData.append('audio', file);

  try {
    const res = await fetch('/split-stems', { method: 'POST', body: formData });

    // Wait for at least 30 seconds (UX — countdown finishes)
    await waitUntilCountdownDone(secs);
    clearInterval(countdownIv);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error');
    }

    // Get ZIP blob
    const zipBlob = await res.blob();
    const zipUrl  = URL.createObjectURL(zipBlob);

    // Extract individual WAV files from ZIP for preview
    await extractAndPreviewStems(zipBlob);

    // Setup ZIP download — triggers browser/IDM
    const dlLink = document.getElementById('stem-zip-link');
    dlLink.href     = zipUrl;
    dlLink.download = 'stems-' + file.name.replace(/\.[^.]+$/, '') + '.zip';

    timer.classList.remove('show');
    preview.classList.add('show');
    zone.style.opacity = '';
    zone.style.pointerEvents = '';
    document.getElementById('stem-status').textContent = '✅ Stems ready! Preview below then download ZIP.';
    showToast('✅ Stems separated! Download ZIP.');

  } catch (err) {
    clearInterval(countdownIv);
    timer.classList.remove('show');
    zone.style.opacity = '';
    zone.style.pointerEvents = '';
    showToast('❌ ' + err.message + ' — Make sure Python server is running');
  }

  input.value = '';
}

// Helper: wait until countdown reaches 0
function waitUntilCountdownDone(remainingSecs) {
  return new Promise(resolve => setTimeout(resolve, remainingSecs * 1000));
}

// Extracts individual WAV files from ZIP and puts them in <audio> players
async function extractAndPreviewStems(zipBlob) {
  // We use JSZip (loaded from CDN in server.py or via script tag)
  if (typeof JSZip === 'undefined') {
    console.warn('JSZip not loaded — audio preview unavailable');
    return;
  }
  const zip = await JSZip.loadAsync(zipBlob);
  const stemMap = {
    'vocals.wav':      'stem-audio-vocals',
    'drums.wav':       'stem-audio-drums',
    'bass.wav':        'stem-audio-bass',
    'other.wav':       'stem-audio-other',
    'instruments.wav': 'stem-audio-other',
  };
  for (const [filename, audioId] of Object.entries(stemMap)) {
    const zipFile = zip.file(filename);
    if (zipFile) {
      const blob = await zipFile.async('blob');
      const url  = URL.createObjectURL(blob);
      const audioEl = document.getElementById(audioId);
      if (audioEl) audioEl.src = url;
    }
  }
}

// ═══════════════════════════════════════════════════════
// IMAGE ENHANCER
// — Sends image to Flask /enhance?mode=soft
// — Falls back to canvas CSS filter
// — Download triggers browser/IDM
// ═══════════════════════════════════════════════════════
function selectMode(btn, val) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedMode = val;
}

async function handleEnhance(input) {
  const file = input.files[0];
  if (!file) return;

  const proc    = document.getElementById('enh-processing');
  const preview = document.getElementById('enh-preview');
  proc.classList.add('show');
  preview.classList.remove('show');

  const origUrl = URL.createObjectURL(file);
  document.getElementById('enh-before').src = origUrl;

  // Try backend
  const formData = new FormData();
  formData.append('image', file);
  formData.append('mode', selectedMode);

  try {
    const res = await fetch('/enhance', { method: 'POST', body: formData });

    let enhancedUrl;

    if (res.ok) {
      const blob = await res.blob();
      enhancedUrl = URL.createObjectURL(blob);
    } else {
      // Fallback: canvas-based enhancement
      enhancedUrl = await enhanceWithCanvas(file, selectedMode);
    }

    document.getElementById('enh-after').src = enhancedUrl;

    // Setup download — browser/IDM
    const dlLink = document.getElementById('enh-download-link');
    dlLink.href = enhancedUrl;
    dlLink.download = `enhanced-${selectedMode}.png`;

    proc.classList.remove('show');
    preview.classList.add('show');
    document.getElementById('enh-status').textContent = `✅ Enhanced with mode: ${selectedMode}`;
    showToast(`✅ Image enhanced (${selectedMode})!`);

  } catch (err) {
    const enhancedUrl = await enhanceWithCanvas(file, selectedMode);
    document.getElementById('enh-after').src = enhancedUrl;
    document.getElementById('enh-download-link').href = enhancedUrl;
    proc.classList.remove('show');
    preview.classList.add('show');
    document.getElementById('enh-status').textContent = `✅ Enhanced (${selectedMode}) — client-side`;
  }

  input.value = '';
}

// Canvas-based enhancement fallback
function enhanceWithCanvas(file, mode) {
  return new Promise((resolve) => {
    const filterMap = {
      soft:  'brightness(1.08) saturate(1.2) contrast(1.05)',
      vivid: 'brightness(1.14) saturate(1.85) contrast(1.12)',
      sharp: 'contrast(1.45) saturate(1.3) brightness(1.04)',
      hdr:   'contrast(1.5) saturate(2.0) brightness(1.1)',
      all:   'contrast(1.4) saturate(1.9) brightness(1.15) drop-shadow(0 0 4px #00e5ff44)',
    };

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.filter = filterMap[mode] || filterMap.soft;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        resolve(URL.createObjectURL(blob));
      }, 'image/png', 1.0);
    };
    img.src = URL.createObjectURL(file);
  });
}

// ═══════════════════════════════════════════════════════
// LOGIN MODAL
// ═══════════════════════════════════════════════════════
function openLogin() {
  document.getElementById('login-modal').classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

function toggleSignup() {
  isSignupMode = !isSignupMode;
  document.getElementById('login-form').style.display   = isSignupMode ? 'none'  : 'block';
  document.getElementById('signup-form').style.display  = isSignupMode ? 'block' : 'none';
  document.getElementById('login-title').textContent    = isSignupMode ? 'CREATE ACCOUNT' : 'WELCOME BACK';
  document.getElementById('login-sub').textContent      = isSignupMode ? 'Join free — all tools unlocked' : 'Sign in to your account';
  document.getElementById('toggle-link').textContent    = isSignupMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up";
}

function googleSignIn() {
  // In production: replace with real Google OAuth
  signInUser('Google User', 'user@gmail.com', 'https://picsum.photos/seed/googleuser/80/80');
}

function emailSignIn() {
  const email = document.getElementById('login-email').value;
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('❌ Enter email and password'); return; }
  signInUser(email.split('@')[0], email, `https://picsum.photos/seed/${email}/80/80`);
}

function emailSignUp() {
  const name  = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const pass  = document.getElementById('signup-pass').value;
  if (!name || !email || !pass) { showToast('❌ Fill all fields'); return; }
  signInUser(name, email, `https://picsum.photos/seed/${name}/80/80`);
}

function signInUser(name, email, avatar) {
  isLoggedIn = true;
  currentUser = { name, email, avatar };

  // Update navbar
  document.getElementById('btn-login-nav').style.display   = 'none';
  document.getElementById('btn-support-nav').style.display = 'inline-block';
  document.getElementById('user-avatar-wrap').style.display = 'block';
  document.getElementById('user-avatar-img').src = avatar;

  // Update pricing modal
  document.getElementById('pricing-name').textContent = name;
  document.getElementById('pricing-avatar-wrap').innerHTML =
    `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;

  closeModal('login-modal');
  showToast('👋 Welcome, ' + name + '!');
}

// ═══════════════════════════════════════════════════════
// PRICING / SUPPORT MODAL
// ═══════════════════════════════════════════════════════
function openPricing() {
  document.getElementById('pricing-modal').classList.add('show');
}

function selectPlan(card, plan, price) {
  const msg = document.getElementById('unlock-success');
  msg.textContent = `❤️ Thank you for supporting! ${plan} ${price}`;
  msg.classList.add('show');
  showToast(`❤️ Thank you! ${plan} supporter — ${price}`);
  setTimeout(() => closeModal('pricing-modal'), 2000);
}

// ═══════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════════════════
// CLOSE MODALS ON OVERLAY CLICK
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('show');
  });
});
