// ═══════════════════════════════════════════
// IMAGE UPSCALE AND ALL — app.js FINAL
// ═══════════════════════════════════════════

let user = null;
let curScale = '2K';
let curMode = 'soft';
let isSU = false;
let curPlan = null;
let wfPlaying = false;
let freeSecondsLeft = 0;
let timerInterval = null;
let isPremium = false;

// ── INIT ──
window.onload = async () => {
  await checkSession();
  initFreeTimer();
  initAutoSliders();
  startOnlineCounter();
};

// ── FREE TIMER ──
function initFreeTimer() {
  const today = new Date().toDateString();
  const stored = localStorage.getItem('freeTimer');
  let data = stored ? JSON.parse(stored) : null;

  if (!data || data.date !== today) {
    // New day — reset timer
    data = { date: today, secondsUsed: 0 };
    localStorage.setItem('freeTimer', JSON.stringify(data));
  }

  const totalFree = 3 * 60 * 60; // 3 hours
  freeSecondsLeft = totalFree - data.secondsUsed;

  if (freeSecondsLeft <= 0 && !isPremium) {
    freeSecondsLeft = 0;
    updateTimerDisplay();
    return;
  }

  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (isPremium) {
      document.getElementById('free-timer').style.display = 'none';
      clearInterval(timerInterval);
      return;
    }
    freeSecondsLeft--;
    data.secondsUsed++;
    localStorage.setItem('freeTimer', JSON.stringify(data));
    updateTimerDisplay();

    if (freeSecondsLeft <= 0) {
      clearInterval(timerInterval);
      freeSecondsLeft = 0;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const h = Math.floor(freeSecondsLeft / 3600);
  const m = Math.floor((freeSecondsLeft % 3600) / 60);
  const s = freeSecondsLeft % 60;
  const display = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const el = document.getElementById('timer-display');
  if (el) el.textContent = display;

  const timerBox = document.getElementById('free-timer');
  if (timerBox) {
    if (freeSecondsLeft <= 600) timerBox.classList.add('timer-red');
    else timerBox.classList.remove('timer-red');
  }
}

function checkFreeLimit() {
  if (isPremium) return true;
  if (!user) { openLogin(); return false; }
  if (freeSecondsLeft <= 0) {
    document.getElementById('timeup-modal').classList.add('show');
    return false;
  }
  return true;
}

// ── ONLINE COUNTER ──
function startOnlineCounter() {
  fetchOnline();
  setInterval(fetchOnline, 30000);
}

async function fetchOnline() {
  try {
    const r = await fetch('/api/online', { credentials: 'include' });
    const d = await r.json();
    const el = document.getElementById('online-count');
    if (el) el.textContent = d.count;
  } catch(e) {}
}

// ── SESSION ──
async function checkSession() {
  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    const d = await r.json();
    if (d.loggedIn) {
      setUser(d.name, d.plan);
      if (d.plan && d.plan !== 'free') {
        isPremium = true;
        document.getElementById('free-timer').style.display = 'none';
      }
    }
  } catch(e) {}
}

// ── AUTO SLIDERS ──
function initAutoSliders() {
  setupAutoSlider('demo-enh','handle-enh');
  setupAutoSlider('demo-ups','handle-ups');
  setupBGDemoSlider();
  setupStemAutoSlider();
}

function setupAutoSlider(wrapId, handleId) {
  const wrap = document.getElementById(wrapId); if (!wrap) return;
  const handle = document.getElementById(handleId);
  const after = wrap.querySelector('.asl-after');
  let pos=15, dir=1, drag=false;

  function setPos(p) {
    p=Math.min(Math.max(p,0),100); pos=p;
    if(after) after.style.clipPath=`inset(0 ${100-p}% 0 0)`;
    if(handle) handle.style.left=p+'%';
  }

  wrap.addEventListener('mousedown',e=>{drag=true;move(e.clientX);});
  window.addEventListener('mousemove',e=>{if(drag)move(e.clientX);});
  window.addEventListener('mouseup',()=>drag=false);
  wrap.addEventListener('touchstart',e=>{drag=true;move(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchmove',e=>{if(drag)move(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchend',()=>drag=false);

  function move(x){const r=wrap.getBoundingClientRect();setPos(((x-r.left)/r.width)*100);}
  setPos(15);
  setInterval(()=>{if(drag)return;pos+=dir*0.3;if(pos>=85)dir=-1;if(pos<=15)dir=1;setPos(pos);},20);
}

function setupBGDemoSlider() {
  const wrap=document.getElementById('demo-bgr'); if(!wrap)return;
  const handle=document.getElementById('handle-bgr');
  const after=wrap.querySelector('.asl-after');
  if(after){
    after.style.backgroundImage=`linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)`;
    after.style.backgroundSize='20px 20px';
    after.style.backgroundPosition='0 0,0 10px,10px -10px,-10px 0';
  }
  let pos=10,dir=1,drag=false;
  function setPos(p){p=Math.min(Math.max(p,0),100);pos=p;if(after)after.style.clipPath=`inset(0 ${100-p}% 0 0)`;if(handle)handle.style.left=p+'%';}
  wrap.addEventListener('mousedown',e=>{drag=true;move(e.clientX);});
  window.addEventListener('mousemove',e=>{if(drag)move(e.clientX);});
  window.addEventListener('mouseup',()=>drag=false);
  function move(x){const r=wrap.getBoundingClientRect();setPos(((x-r.left)/r.width)*100);}
  setPos(10);
  setInterval(()=>{if(drag)return;pos+=dir*0.3;if(pos>=90)dir=-1;if(pos<=10)dir=1;setPos(pos);},20);
}

function setupStemAutoSlider() {
  const wrap=document.querySelector('.stem-demo-wrap'); if(!wrap)return;
  const handle=document.getElementById('handle-stem');
  const right=document.getElementById('stem-demo-right');
  let pos=5,dir=1,drag=false;
  function setPos(p){p=Math.min(Math.max(p,0),100);pos=p;if(right)right.style.clipPath=`inset(0 0 0 ${100-p}%)`;if(handle)handle.style.left=p+'%';}
  wrap.addEventListener('mousedown',e=>{drag=true;move(e.clientX);});
  window.addEventListener('mousemove',e=>{if(drag)move(e.clientX);});
  window.addEventListener('mouseup',()=>drag=false);
  function move(x){const r=wrap.getBoundingClientRect();setPos(((x-r.left)/r.width)*100);}
  setPos(5);
  setInterval(()=>{if(drag)return;pos+=dir*0.3;if(pos>=95)dir=-1;if(pos<=5)dir=1;setPos(pos);},20);
}

// ── NAV ──
function showPage(p) {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  const n=document.getElementById('nav-'+p); if(n)n.classList.add('active');
  window.scrollTo(0,0);
}

function goTool(p) {
  showPage(p);
  if (!user) {
    document.getElementById('lock-'+p).classList.add('show');
    document.getElementById('tool-'+p).style.display='none';
  } else {
    document.getElementById('lock-'+p).classList.remove('show');
    document.getElementById('tool-'+p).style.display='block';
  }
}

// ── THEME ──
function setTheme(cls,dot) {
  document.body.className=cls;
  document.querySelectorAll('.tdot').forEach(d=>d.classList.remove('on'));
  dot.classList.add('on');
}

// ── LOGIN ──
function openLogin() { document.getElementById('login-modal').classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function toggleForm() {
  isSU=!isSU;
  document.getElementById('lform').style.display=isSU?'none':'block';
  document.getElementById('sform').style.display=isSU?'block':'none';
  document.getElementById('ltitle').textContent=isSU?'CREATE ACCOUNT':'WELCOME BACK';
  document.getElementById('ltog').textContent=isSU?'Already have account? Sign In':"Don't have account? Sign Up";
}

async function doLogin() {
  const email=document.getElementById('lemail').value.trim();
  const pass=document.getElementById('lpass').value;
  document.getElementById('lerr').textContent='';
  if(!email||!pass){document.getElementById('lerr').textContent='Fill all fields';return;}
  try {
    const r=await fetch('/api/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const d=await r.json();
    if(!r.ok){document.getElementById('lerr').textContent=d.error;return;}
    setUser(d.name,d.plan); closeModal('login-modal'); toast('👋 Welcome, '+d.name+'!');
  } catch(e){document.getElementById('lerr').textContent='Server error';}
}

async function doSignup() {
  const name=document.getElementById('sname').value.trim();
  const email=document.getElementById('semail').value.trim();
  const pass=document.getElementById('spass').value;
  document.getElementById('serr').textContent='';
  if(!name||!email||!pass){document.getElementById('serr').textContent='Fill all fields';return;}
  try {
    const r=await fetch('/api/signup',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password:pass})});
    const d=await r.json();
    if(!r.ok){document.getElementById('serr').textContent=d.error;return;}
    setUser(d.name,d.plan); closeModal('login-modal'); toast('🎉 Welcome, '+d.name+'!');
  } catch(e){document.getElementById('serr').textContent='Server error';}
}

function googleSignIn() {
  // Real Google OAuth via Google Identity Services
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: show Google OAuth popup
        const width = 500, height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        const popup = window.open(
          `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com&redirect_uri=${encodeURIComponent(window.location.origin+'/auth/google/callback')}&response_type=code&scope=openid%20email%20profile`,
          'Google Sign In',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    });
  } else {
    // Google SDK not loaded — use server-side redirect
    window.location.href = '/auth/google';
  }
}

async function handleGoogleCredential(response) {
  try {
    const r = await fetch('/api/google-auth', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const d = await r.json();
    if (d.success) {
      setUser(d.name, d.plan);
      closeModal('login-modal');
      toast('🎉 Welcome, ' + d.name + '!');
    } else {
      toast('❌ Google sign-in failed');
    }
  } catch(e) { toast('❌ Google sign-in error'); }
}

function setUser(name, plan) {
  user={name,plan};
  if(plan&&plan!=='free') isPremium=true;
  document.getElementById('btn-login-nav').style.display='none';
  document.getElementById('btn-unlock-nav').style.display='inline-block';
  document.getElementById('uavatar').style.display='block';
  document.getElementById('uimg').src=`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00e5ff&color=000&size=80`;
  if(isPremium) document.getElementById('free-timer').style.display='none';
  ['bgr','ups','stem','enh'].forEach(t=>{
    const lock=document.getElementById('lock-'+t);
    const tool=document.getElementById('tool-'+t);
    if(lock)lock.classList.remove('show');
    if(tool)tool.style.display='block';
  });
}

// ── PRICING ──
function openPricing() {
  if(!user){openLogin();return;}
  document.getElementById('price-modal').classList.add('show');
}

// ── STRIPE PAYMENT ──
let stripe = null;
let stripeCard = null;
const PLAN_PRICES = { weekly: 200, monthly: 500, yearly: 1500, lifetime: 3000 }; // cents

function selectPlan(plan, price, card) {
  curPlan = plan;
  document.querySelectorAll('.pcard').forEach(c => { c.style.opacity='0.6'; c.style.borderColor=''; });
  card.style.opacity = '1'; card.style.borderColor = 'var(--accent)';
  document.getElementById('pay-plan-title').textContent = `PAYMENT — ${plan.toUpperCase()} ${price}`;
  document.getElementById('pay-form').classList.add('show');

  // Init Stripe
  if (!stripe) {
    stripe = Stripe('pk_live_YOUR_STRIPE_PUBLISHABLE_KEY'); // Replace with your key
    const elements = stripe.elements();
    stripeCard = elements.create('card', {
      style: {
        base: { color: getComputedStyle(document.body).getPropertyValue('--text') || '#fff', fontSize: '16px', '::placeholder': { color: '#888' } }
      }
    });
    stripeCard.mount('#stripe-card-element');
  }
}

async function doStripePayment() {
  const name = document.getElementById('pay-name').value.trim();
  const email = document.getElementById('pay-email').value.trim();
  document.getElementById('pay-err').textContent = '';

  if (!name || !email) { document.getElementById('pay-err').textContent = 'Fill all fields'; return; }
  if (!stripe || !stripeCard) { document.getElementById('pay-err').textContent = 'Payment not ready'; return; }

  const btn = document.getElementById('pay-btn');
  btn.textContent = 'Processing...'; btn.disabled = true;

  try {
    // Step 1: Create PaymentIntent on server
    const r = await fetch('/api/create-payment-intent', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: curPlan, email, name })
    });
    const { clientSecret, error: serverError } = await r.json();
    if (serverError) throw new Error(serverError);

    // Step 2: Confirm card payment via Stripe
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: stripeCard, billing_details: { name, email } }
    });

    if (error) throw new Error(error.message);

    if (paymentIntent.status === 'succeeded') {
      // Step 3: Activate plan on server
      await fetch('/api/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: curPlan, payment_intent: paymentIntent.id })
      });
      isPremium = true;
      document.getElementById('free-timer').style.display = 'none';
      closeModal('price-modal');
      document.getElementById('pay-form').classList.remove('show');
      toast('🎉 Payment success! ' + curPlan + ' plan active!');
    }
  } catch(e) {
    document.getElementById('pay-err').textContent = '❌ ' + e.message;
  }
  btn.textContent = '💳 PAY NOW'; btn.disabled = false;
}

// ── COUNTRY COUNTER ──
let countryData = {};

function toggleCountryList() {
  const dd = document.getElementById('country-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
  const box = document.getElementById('shehryar-box');
  if (box && !box.contains(e.target)) {
    const dd = document.getElementById('country-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

async function fetchOnline() {
  try {
    const r = await fetch('/api/online', { credentials: 'include' });
    const d = await r.json();
    const el = document.getElementById('online-count');
    if (el) el.textContent = d.count;

    // Update country list
    if (d.countries) {
      countryData = d.countries;
      renderCountryList();
    }
  } catch(e) {}
}

function renderCountryList() {
  const list = document.getElementById('country-list');
  if (!list) return;
  const entries = Object.entries(countryData).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    list.innerHTML = '<div style="color:var(--muted);text-align:center">No data yet</div>';
    return;
  }
  list.innerHTML = entries.map(([country, count]) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--border)">
      <span>${getFlagEmoji(country)} ${country}</span>
      <span style="color:var(--accent);font-weight:700">${count}</span>
    </div>`
  ).join('');
}

function getFlagEmoji(country) {
  const flags = {
    'Pakistan':'🇵🇰','United States':'🇺🇸','India':'🇮🇳','United Kingdom':'🇬🇧',
    'Germany':'🇩🇪','France':'🇫🇷','Canada':'🇨🇦','Australia':'🇦🇺',
    'Saudi Arabia':'🇸🇦','UAE':'🇦🇪','Turkey':'🇹🇷','Bangladesh':'🇧🇩',
    'Indonesia':'🇮🇩','Brazil':'🇧🇷','Nigeria':'🇳🇬','Philippines':'🇵🇭',
    'Unknown':'🌍'
  };
  return flags[country] || '🌍';
}

// ── DRAG & DROP ──
function dragOver(e,z){e.preventDefault();document.getElementById(z).classList.add('dragover');}
function dragLeave(z){document.getElementById(z).classList.remove('dragover');}
function dropFile(e,inputId,zoneId){
  e.preventDefault();dragLeave(zoneId);
  const files=e.dataTransfer.files; if(!files.length)return;
  const input=document.getElementById(inputId);
  const dt=new DataTransfer(); dt.items.add(files[0]); input.files=dt.files;
  input.dispatchEvent(new Event('change'));
}

// ── BG REMOVER ──
async function handleBGR(input) {
  if(!checkFreeLimit())return;
  const file=input.files[0]; if(!file)return;
  const origUrl=URL.createObjectURL(file);
  document.getElementById('bgr-orig').style.backgroundImage=`url('${origUrl}')`;
  document.getElementById('bgr-rem').style.backgroundImage=`url('${origUrl}')`;
  document.getElementById('bgr-proc').classList.add('show');
  document.getElementById('bgr-prev').classList.remove('show');
  const fd=new FormData(); fd.append('image',file);
  try {
    const r=await fetch('/remove-bg',{method:'POST',body:fd,credentials:'include'});
    if(!r.ok)throw new Error('Server error');
    const blob=await r.blob(); const url=URL.createObjectURL(blob);
    const remEl=document.getElementById('bgr-rem');
    remEl.style.backgroundImage=`url('${url}')`;
    remEl.style.backgroundColor='#1a1a1a';
    document.getElementById('bgr-dl').href=url;
    setupBGToolSlider();
    document.getElementById('bgr-proc').classList.remove('show');
    document.getElementById('bgr-prev').classList.add('show');
    toast('✅ Background removed!');
  } catch(e){document.getElementById('bgr-proc').classList.remove('show');toast('❌ '+e.message);}
  input.value='';
}

function setupBGToolSlider() {
  const wrap=document.getElementById('bgr-wrap');
  const rem=document.getElementById('bgr-rem');
  const hand=document.getElementById('bgr-hand');
  let drag=false;
  rem.style.clipPath='inset(0 50% 0 0)'; hand.style.left='50%';
  function setPos(x){const r=wrap.getBoundingClientRect();let p=Math.min(Math.max(((x-r.left)/r.width)*100,0),100);rem.style.clipPath=`inset(0 ${100-p}% 0 0)`;hand.style.left=p+'%';}
  wrap.addEventListener('mousedown',e=>{drag=true;setPos(e.clientX);});
  window.addEventListener('mousemove',e=>{if(drag)setPos(e.clientX);});
  window.addEventListener('mouseup',()=>drag=false);
  wrap.addEventListener('touchstart',e=>{drag=true;setPos(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchmove',e=>{if(drag)setPos(e.touches[0].clientX);},{passive:true});
  window.addEventListener('touchend',()=>drag=false);
}

function setBG(c,btn) {
  document.querySelectorAll('.cbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('bgr-rem').style.backgroundColor=c;
}

// ── UPSCALER ──
function selScale(btn,val) {
  document.querySelectorAll('.sbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); curScale=val;
  const b=document.getElementById('ups-badge'); if(b)b.textContent=val;
}

async function handleUps(input) {
  if(!checkFreeLimit())return;
  const file=input.files[0]; if(!file)return;
  document.getElementById('ups-bef').src=URL.createObjectURL(file);
  document.getElementById('ups-proc').classList.add('show');
  document.getElementById('ups-prev').classList.remove('show');
  document.getElementById('ups-pt').textContent=`Upscaling to ${curScale}...`;
  const fd=new FormData(); fd.append('image',file); fd.append('scale',curScale);
  try {
    const r=await fetch('/upscale',{method:'POST',body:fd,credentials:'include'});
    if(!r.ok)throw new Error('Server error');
    const blob=await r.blob(); const url=URL.createObjectURL(blob);
    document.getElementById('ups-aft').src=url;
    document.getElementById('ups-dl').href=url;
    document.getElementById('ups-dl').download=`upscaled-${curScale}.png`;
    document.getElementById('ups-proc').classList.remove('show');
    document.getElementById('ups-prev').classList.add('show');
    toast(`✅ Upscaled to ${curScale}!`);
  } catch(e){document.getElementById('ups-proc').classList.remove('show');toast('❌ '+e.message);}
  input.value='';
}

// ── ENHANCER ──
function selMode(btn,val) {
  document.querySelectorAll('.hp-mode-btn,.mbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); curMode=val;
}

function resetEnhancer() {
  document.getElementById('enh-prev').classList.remove('show');
  document.getElementById('enh-zone').style.display='';
  document.getElementById('enh-in').value='';
}

async function loadSampleEnh(src) {
  if(!checkFreeLimit())return;
  try {
    const resp = await fetch(src);
    const blob = await resp.blob();
    const file = new File([blob], 'sample.jpg', {type: blob.type});
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById('enh-in');
    input.files = dt.files;
    handleEnh(input);
  } catch(e) { toast('❌ Could not load sample'); }
}

async function handleEnh(input) {
  if(!checkFreeLimit())return;
  const file=input.files[0]; if(!file)return;
  document.getElementById('enh-bef').src=URL.createObjectURL(file);
  document.getElementById('enh-zone').style.display='none';
  document.getElementById('enh-proc').classList.add('show');
  document.getElementById('enh-prev').classList.remove('show');
  const fd=new FormData(); fd.append('image',file); fd.append('mode',curMode);
  try {
    const r=await fetch('/enhance',{method:'POST',body:fd,credentials:'include'});
    if(!r.ok)throw new Error('Server error');
    const blob=await r.blob(); const url=URL.createObjectURL(blob);
    document.getElementById('enh-aft').src=url;
    document.getElementById('enh-dl').href=url;
    document.getElementById('enh-dl').download=`enhanced-${curMode}.png`;
    document.getElementById('enh-proc').classList.remove('show');
    document.getElementById('enh-prev').classList.add('show');
    setTimeout(initEnhSlider, 150);
    toast(`✅ Enhanced (${curMode})!`);
  } catch(e){
    document.getElementById('enh-proc').classList.remove('show');
    document.getElementById('enh-zone').style.display='';
    toast('❌ '+e.message);
  }
  input.value='';
}

// ── STEM SPLITTER ──
async function handleStem(input) {
  if(!checkFreeLimit())return;
  const file=input.files[0]; if(!file)return;
  wfPlaying=false;
  const btn=document.getElementById('wf-playbtn'); if(btn)btn.textContent='▶';
  document.getElementById('stem-timer').classList.add('show');
  document.getElementById('stem-prev').classList.remove('show');
  let secs=45;
  document.getElementById('stem-cnt').textContent=secs;
  const iv=setInterval(()=>{secs--;document.getElementById('stem-cnt').textContent=Math.max(secs,0);if(secs<=0)clearInterval(iv);},1000);
  const fd=new FormData(); fd.append('audio',file);
  try {
    const r=await fetch('/split-stems',{method:'POST',body:fd,credentials:'include'});
    if(!r.ok)throw new Error('Server error');
    const blob=await r.blob();
    const zipUrl=URL.createObjectURL(blob);
    // Extract WAVs from ZIP
    try {
      const {default:JSZip}=await import('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const zip=await JSZip.loadAsync(blob);
      const map={'vocals.wav':['sa-v','cv-v','#00ff88'],'drums.wav':['sa-d','cv-d','#a855f7'],'bass.wav':['sa-b','cv-b','#00e5ff'],'instruments.wav':['sa-i','cv-i','#f59e0b']};
      for(const[name,[aid,cvid,color]] of Object.entries(map)){
        const f=zip.file(name);
        if(f){
          const ab=await f.async('blob');
          const src=URL.createObjectURL(new Blob([ab],{type:'audio/wav'}));
          const a=document.getElementById(aid); a.src=src;
          setTimeout(()=>drawWaveform(a,cvid,color),600);
        }
      }
    } catch(e){console.log('zip err:',e);}
    document.getElementById('stem-dl').href=zipUrl;
    document.getElementById('stem-dl').download=file.name.replace(/\.[^.]+$/,'')+'-stems.zip';
    clearInterval(iv);
    document.getElementById('stem-timer').classList.remove('show');
    document.getElementById('stem-prev').classList.add('show');
    toast('✅ Stems ready! Press ▶ to play!');
  } catch(e){
    clearInterval(iv);
    document.getElementById('stem-timer').classList.remove('show');
    toast('❌ '+e.message);
  }
  input.value='';
}

// ── WAVEFORM ──
function drawWaveform(audioEl, canvasId, color) {
  try {
    const canvas=document.getElementById(canvasId); if(!canvas)return;
    const actx=new(window.AudioContext||window.webkitAudioContext)();
    fetch(audioEl.src).then(r=>r.arrayBuffer()).then(buf=>actx.decodeAudioData(buf)).then(decoded=>{
      const data=decoded.getChannelData(0);
      const W=canvas.width=canvas.offsetWidth||600;
      const H=canvas.height=canvas.offsetHeight||60;
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,W,H);
      const step=Math.ceil(data.length/W);
      ctx.strokeStyle=color; ctx.lineWidth=1.5;
      for(let i=0;i<W;i++){
        let min=1,max=-1;
        for(let j=0;j<step;j++){const v=data[i*step+j]||0;if(v<min)min=v;if(v>max)max=v;}
        ctx.beginPath(); ctx.moveTo(i,(1+min)*H/2); ctx.lineTo(i,(1+max)*H/2); ctx.stroke();
      }
    }).catch(()=>{});
  } catch(e){}
}

function setVol(id,val){const a=document.getElementById(id);if(a)a.volume=parseFloat(val);}

function togglePlay(){
  wfPlaying=!wfPlaying;
  const btn=document.getElementById('wf-playbtn');
  ['sa-v','sa-d','sa-b','sa-i'].forEach(id=>{const a=document.getElementById(id);if(!a||!a.src)return;wfPlaying?a.play():a.pause();});
  if(btn)btn.textContent=wfPlaying?'⏸':'▶';
  if(wfPlaying)updateProgress();
}

function seekBack(){['sa-v','sa-d','sa-b','sa-i'].forEach(id=>{const a=document.getElementById(id);if(a&&a.src)a.currentTime=Math.max(0,a.currentTime-15);});}
function seekFwd(){['sa-v','sa-d','sa-b','sa-i'].forEach(id=>{const a=document.getElementById(id);if(a&&a.src)a.currentTime+=15;});}

function seekToClick(e, primaryId) {
  const wrap=e.currentTarget; const r=wrap.getBoundingClientRect();
  const pct=(e.clientX-r.left)/r.width;
  const a=document.getElementById(primaryId);
  if(a&&a.duration){
    const t=pct*a.duration;
    ['sa-v','sa-d','sa-b','sa-i'].forEach(id=>{const au=document.getElementById(id);if(au&&au.src)au.currentTime=t;});
  }
}

function updateProgress(){
  if(!wfPlaying)return;
  const a=document.getElementById('sa-v');
  if(!a||!a.duration){requestAnimationFrame(updateProgress);return;}
  const pct=(a.currentTime/a.duration)*100;
  ['pr-v','pr-d','pr-b','pr-i'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.width=pct+'%';});
  const te=document.getElementById('wf-time');
  if(te)te.textContent=fmtTime(a.currentTime)+' / '+fmtTime(a.duration);
  requestAnimationFrame(updateProgress);
}

function fmtTime(s){if(isNaN(s))return'00:00';const m=Math.floor(s/60);const sec=Math.floor(s%60);return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}

// ── HITPAW ENHANCER SLIDER ──
function initEnhSlider() {
  const wrap = document.getElementById('enh-slider-wrap');
  const after = document.getElementById('enh-aft');
  const line = document.getElementById('enh-line');
  const handle = document.getElementById('enh-handle');
  if (!wrap || !after || !line) return;

  let drag = false;

  function setPos(x) {
    const r = wrap.getBoundingClientRect();
    let p = Math.min(Math.max(((x - r.left) / r.width) * 100, 0), 100);
    after.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    line.style.left = p + '%';
    if(handle) handle.style.left = p + '%';
  }

  wrap.addEventListener('mousedown', e => { drag = true; setPos(e.clientX); });
  window.addEventListener('mousemove', e => { if (drag) setPos(e.clientX); });
  window.addEventListener('mouseup', () => drag = false);
  wrap.addEventListener('touchstart', e => { drag = true; setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', e => { if (drag) setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => drag = false);

  setPos(wrap.getBoundingClientRect().width / 2);
}

// ── TOAST ──
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500);}

// ── CLOSE ON OVERLAY CLICK ──
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});});
});
