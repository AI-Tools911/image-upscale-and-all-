import os, io, zipfile, wave, hashlib, time, requests, base64, json
from flask import Flask, request, send_file, jsonify, session
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

try:
    import stripe
    stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
    HAS_STRIPE = bool(stripe.api_key)
except ImportError:
    HAS_STRIPE = False

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GMAIL_NOTIFY = os.environ.get('GMAIL_NOTIFY', 'shehryar@gmail.com')  # your email

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'iua-secret-key-2024')
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
CORS(app, supports_credentials=True, origins='*')

USERS = {}
ONLINE = {}      # sid -> {time, country}
IP_CACHE = {}    # ip -> country (cache to avoid repeated API calls)

def hash_pass(p): return hashlib.sha256(p.encode()).hexdigest()

def get_country_from_ip(ip):
    try:
        if not ip or ip in ('127.0.0.1', '::1', '0.0.0.0', 'localhost'): 
            return 'Pakistan'  # default for local
        # Try ip-api.com (free, fast, no key needed)
        r = requests.get(f'http://ip-api.com/json/{ip}?fields=country', timeout=2)
        if r.ok:
            data = r.json()
            return data.get('country', 'Unknown')
    except:
        pass
    return 'Unknown'

def send_email_notification(subject, body):
    """Send Gmail notification via Gmail API or simple SMTP"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        gmail_user = os.environ.get('GMAIL_USER', '')
        gmail_pass = os.environ.get('GMAIL_APP_PASSWORD', '')
        if not gmail_user or not gmail_pass:
            print(f"EMAIL NOTIFICATION: {subject}\n{body}")
            return
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = gmail_user
        msg['To'] = gmail_user
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(gmail_user, gmail_pass)
            smtp.sendmail(gmail_user, gmail_user, msg.as_string())
        print(f"Email sent: {subject}")
    except Exception as e:
        print(f"Email error: {e}")

@app.before_request
def track_online():
    import uuid
    sid = session.get('_id')
    if not sid:
        session['_id'] = str(uuid.uuid4())
        sid = session['_id']
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    if sid not in ONLINE:
        # Use cache to avoid repeated API calls
        if ip not in IP_CACHE:
            IP_CACHE[ip] = get_country_from_ip(ip)
        country = IP_CACHE[ip]
        ONLINE[sid] = {'time': time.time(), 'country': country}
    else:
        ONLINE[sid]['time'] = time.time()
    cutoff = time.time() - 120
    for k in list(ONLINE.keys()):
        if ONLINE[k]['time'] < cutoff: del ONLINE[k]

@app.route('/api/online')
def online_count():
    cutoff = time.time() - 120
    active = {k: v for k, v in ONLINE.items() if v['time'] > cutoff}
    count = max(len(active), 1)
    # Build country stats
    countries = {}
    for v in active.values():
        c = v.get('country', 'Unknown')
        countries[c] = countries.get(c, 0) + 1
    return jsonify({'count': count, 'countries': countries})

@app.route('/')
def index(): return app.send_static_file('index.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    d = request.json
    email = d.get('email','').lower().strip()
    name = d.get('name',''); pwd = d.get('password','')
    if not email or not pwd or not name:
        return jsonify({'error':'Fill all fields'}), 400
    if email in USERS:
        return jsonify({'error':'Email already exists'}), 400
    USERS[email] = {'name':name,'password':hash_pass(pwd),'plan':'free','joined':time.time()}
    session['user'] = email
    return jsonify({'success':True,'name':name,'plan':'free'})

@app.route('/api/login', methods=['POST'])
def login():
    d = request.json
    email = d.get('email','').lower().strip()
    pwd = d.get('password','')
    user = USERS.get(email)
    if not user or user['password'] != hash_pass(pwd):
        return jsonify({'error':'Wrong email or password'}), 401
    session['user'] = email
    return jsonify({'success':True,'name':user['name'],'plan':user.get('plan','free')})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'success':True})

@app.route('/api/me')
def me():
    email = session.get('user')
    if not email or email not in USERS: return jsonify({'loggedIn':False})
    u = USERS[email]
    return jsonify({'loggedIn':True,'name':u['name'],'plan':u.get('plan','free')})

# ── GOOGLE AUTH ──
@app.route('/auth/google')
def auth_google():
    if not GOOGLE_CLIENT_ID:
        return 'Google OAuth not configured', 500
    redirect_uri = request.host_url.rstrip('/') + '/auth/google/callback'
    url = (f'https://accounts.google.com/o/oauth2/v2/auth'
           f'?client_id={GOOGLE_CLIENT_ID}'
           f'&redirect_uri={redirect_uri}'
           f'&response_type=code'
           f'&scope=openid%20email%20profile')
    from flask import redirect
    return redirect(url)

@app.route('/auth/google/callback')
def auth_google_callback():
    code = request.args.get('code')
    if not code: return 'No code', 400
    redirect_uri = request.host_url.rstrip('/') + '/auth/google/callback'
    token_r = requests.post('https://oauth2.googleapis.com/token', data={
        'code': code, 'client_id': GOOGLE_CLIENT_ID,
        'client_secret': os.environ.get('GOOGLE_CLIENT_SECRET',''),
        'redirect_uri': redirect_uri, 'grant_type': 'authorization_code'
    })
    tokens = token_r.json()
    id_token = tokens.get('id_token','')
    # Decode JWT payload
    parts = id_token.split('.')
    if len(parts) >= 2:
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
        email = payload.get('email','')
        name = payload.get('name', email.split('@')[0])
        if email not in USERS:
            USERS[email] = {'name':name,'password':'google_oauth','plan':'free','joined':time.time()}
        session['user'] = email
    return '<script>window.close();window.opener.location.reload();</script>'

@app.route('/api/google-auth', methods=['POST'])
def google_auth_token():
    """Handle Google One Tap credential"""
    credential = request.json.get('credential','')
    try:
        parts = credential.split('.')
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
        email = payload.get('email','')
        name = payload.get('name', email.split('@')[0] if email else 'User')
        if not email: return jsonify({'error':'No email'}), 400
        if email not in USERS:
            USERS[email] = {'name':name,'password':'google_oauth','plan':'free','joined':time.time()}
        session['user'] = email
        return jsonify({'success':True,'name':name,'plan':USERS[email].get('plan','free')})
    except Exception as e:
        return jsonify({'error':str(e)}), 400

# ── STRIPE PAYMENT ──
PLAN_AMOUNTS = {'weekly':200,'monthly':500,'yearly':1500,'lifetime':3000}  # cents USD

@app.route('/api/create-payment-intent', methods=['POST'])
def create_payment_intent():
    if not HAS_STRIPE:
        return jsonify({'error':'Payment not configured — add STRIPE_SECRET_KEY'}), 500
    d = request.json
    plan = d.get('plan','monthly')
    email = d.get('email','')
    name = d.get('name','')
    amount = PLAN_AMOUNTS.get(plan, 500)
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency='usd',
            metadata={'plan':plan,'email':email,'name':name},
            description=f'Image Upscale And All — {plan} plan'
        )
        return jsonify({'clientSecret': intent.client_secret})
    except Exception as e:
        return jsonify({'error':str(e)}), 400

@app.route('/api/unlock', methods=['POST'])
def unlock():
    email = session.get('user')
    if not email: return jsonify({'error':'Not logged in'}), 401
    d = request.json or {}
    plan = d.get('plan','monthly')
    payment_intent_id = d.get('payment_intent','')

    # Verify payment with Stripe
    if HAS_STRIPE and payment_intent_id:
        try:
            pi = stripe.PaymentIntent.retrieve(payment_intent_id)
            if pi.status != 'succeeded':
                return jsonify({'error':'Payment not confirmed'}), 400
            amount = pi.amount / 100
            # Send Gmail notification
            send_email_notification(
                f'💰 NEW PAYMENT — {plan.upper()} ${amount:.2f}',
                f'New payment received!\n\nPlan: {plan}\nAmount: ${amount:.2f}\nEmail: {email}\nPayment ID: {payment_intent_id}\nTime: {time.strftime("%Y-%m-%d %H:%M:%S")}'
            )
        except Exception as e:
            return jsonify({'error':f'Payment verification failed: {e}'}), 400

    USERS[email]['plan'] = plan
    return jsonify({'success':True})

@app.route('/api/webhook/stripe', methods=['POST'])
def stripe_webhook():
    if not HAS_STRIPE: return jsonify({}), 200
    payload = request.data
    sig = request.headers.get('Stripe-Signature','')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET','')
    try:
        event = stripe.Webhook.construct_event(payload, sig, webhook_secret) if webhook_secret else stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        if event['type'] == 'payment_intent.succeeded':
            pi = event['data']['object']
            plan = pi['metadata'].get('plan','')
            email = pi['metadata'].get('email','')
            amount = pi['amount'] / 100
            send_email_notification(
                f'✅ STRIPE WEBHOOK — {plan.upper()} ${amount:.2f}',
                f'Payment confirmed via webhook!\nEmail: {email}\nPlan: {plan}\nAmount: ${amount:.2f}'
            )
    except Exception as e:
        print(f'Webhook error: {e}')
    return jsonify({'status':'ok'})

# ── BG REMOVER ──
@app.route('/remove-bg', methods=['POST'])
def remove_background():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    img_bytes = request.files['image'].read()
    result = rembg_remove(img_bytes) if HAS_REMBG else edge_bg_remove(Image.open(io.BytesIO(img_bytes)).convert('RGBA'))
    return send_file(io.BytesIO(result), mimetype='image/png', as_attachment=True, download_name='background-removed.png')

def edge_bg_remove(img):
    data = np.array(img)
    edge = np.concatenate([data[0,:,:3],data[-1,:,:3],data[:,0,:3],data[:,-1,:3]])
    bg = np.median(edge, axis=0)
    diff = np.sqrt(np.sum((data[:,:,:3].astype(float)-bg)**2, axis=2))
    data[:,:,3] = np.where(diff<60,0,255).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(data).save(buf,'PNG'); return buf.getvalue()

# ── UPSCALER ──
@app.route('/upscale', methods=['POST'])
def upscale_image():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    scale = request.form.get('scale','2K')
    tw = {'2K':2048,'4K':3840,'6K':5760,'8K':7680,'10K':9600}.get(scale,2048)
    img = Image.open(request.files['image']).convert('RGB'); w,h = img.size
    up = img.resize((tw, int(tw*h/w)), Image.LANCZOS)
    up = ImageEnhance.Sharpness(up).enhance(2.0)
    up = ImageEnhance.Contrast(up).enhance(1.1)
    buf = io.BytesIO(); up.save(buf,'PNG'); buf.seek(0)
    return send_file(buf, mimetype='image/png', as_attachment=True, download_name=f'upscaled-{scale}.png')

# ── ENHANCER ──
@app.route('/enhance', methods=['POST'])
def enhance_image():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    mode = request.form.get('mode', 'soft')
    img_bytes = request.files['image'].read()
    try:
        result = enhance_waifu2x(img_bytes)
        if result:
            return send_file(io.BytesIO(result), mimetype='image/png', as_attachment=True, download_name=f'enhanced-{mode}.png')
    except Exception as e:
        print(f"Waifu2x error: {e}")
    result = enhance_pil(img_bytes)
    return send_file(io.BytesIO(result), mimetype='image/png', as_attachment=True, download_name=f'enhanced-{mode}.png')

def enhance_waifu2x(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    w, h = img.size
    if w > 1024 or h > 1024:
        ratio = min(1024/w, 1024/h)
        img = img.resize((int(w*ratio), int(h*ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    r = requests.post(
        'https://allvocalsremover-real-esrgan-api.hf.space/run/predict',
        json={'data': ['data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()]},
        timeout=120
    )
    if r.ok:
        resp = r.json()
        data = resp.get('data', [])
        if data:
            img_b64 = data[0]
            if img_b64.startswith('data:'): img_b64 = img_b64.split(',')[1]
            result_img = Image.open(io.BytesIO(base64.b64decode(img_b64))).convert('RGB')
            rw, rh = result_img.size
            tw = 3840
            if rw < tw: result_img = result_img.resize((tw, int(tw*rh/rw)), Image.LANCZOS)
            out = io.BytesIO(); result_img.save(out, 'PNG'); out.seek(0)
            return out.getvalue()
    raise Exception(f"HF Space failed: {r.status_code}")

def enhance_pil(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    w, h = img.size
    img = img.filter(ImageFilter.MedianFilter(size=3))
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=180, threshold=2))
    tw = 3840
    img = img.resize((tw, int(tw*h/w)), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
    buf = io.BytesIO(); img.save(buf, 'PNG'); buf.seek(0)
    return buf.getvalue()

# ── STEM SPLITTER ──
@app.route('/split-stems', methods=['POST'])
def split_stems():
    if 'audio' not in request.files: return jsonify({'error':'No audio'}), 400
    file = request.files['audio']; filename = file.filename; raw = file.read()
    try:
        samples, sr = read_wav_data(raw)
        if samples is None: raise Exception('Please upload WAV format')
        v, d, b, ins = fft_split(samples, sr)
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf,'w',zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('vocals.wav', make_wav(v, sr))
            zf.writestr('drums.wav',  make_wav(d, sr))
            zf.writestr('bass.wav',   make_wav(b, sr))
            zf.writestr('instruments.wav', make_wav(ins, sr))
        zip_buf.seek(0)
        return send_file(zip_buf, mimetype='application/zip', as_attachment=True,
                        download_name=f'{os.path.splitext(filename)[0]}-stems.zip')
    except Exception as e:
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf,'w') as zf:
            zf.writestr(filename, raw)
            zf.writestr('README.txt', f'Error: {str(e)}')
        zip_buf.seek(0)
        return send_file(zip_buf, mimetype='application/zip', as_attachment=True, download_name='stems.zip')

def read_wav_data(wav_bytes):
    try:
        buf = io.BytesIO(wav_bytes)
        with wave.open(buf,'rb') as wf:
            sr=wf.getframerate(); sw=wf.getsampwidth(); ch=wf.getnchannels(); raw=wf.readframes(wf.getnframes())
        s = np.frombuffer(raw, dtype=np.int16 if sw==2 else np.uint8).astype(np.float32)
        if ch==2: s = s.reshape(-1,2).mean(axis=1)
        mx = np.max(np.abs(s))
        if mx>0: s = s/mx
        return s, sr
    except: return None, None

def fft_split(samples, sr):
    chunk=8192; n=(len(samples)//chunk)*chunk; s=samples[:n]
    v=np.zeros(n,np.float32); d=np.zeros(n,np.float32)
    b=np.zeros(n,np.float32); ins=np.zeros(n,np.float32)
    for i in range(n//chunk):
        seg=s[i*chunk:(i+1)*chunk]; fft=np.fft.rfft(seg); freqs=np.fft.rfftfreq(chunk,1.0/sr)
        vf=fft.copy(); vf[(freqs<300)|(freqs>3400)]=0; v[i*chunk:(i+1)*chunk]=np.fft.irfft(vf)
        df=fft.copy(); df[~(((freqs>=50)&(freqs<=180))|(freqs>=6000))]=0; d[i*chunk:(i+1)*chunk]=np.fft.irfft(df)
        bf=fft.copy(); bf[freqs>250]=0; b[i*chunk:(i+1)*chunk]=np.fft.irfft(bf)
        inf=fft.copy(); inf[(freqs<250)|(freqs>6000)]=0; ins[i*chunk:(i+1)*chunk]=np.fft.irfft(inf)
    return v, d, b, ins

def make_wav(samples, sr):
    mx = np.max(np.abs(samples))
    if mx>0: samples = samples/mx*0.92
    pcm = np.clip(samples*32767,-32768,32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf,'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes(pcm.tobytes())
    return buf.getvalue()

if __name__=='__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting on port {port}")
    app.run(host='0.0.0.0', port=port)

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = 'iua-secret-key-2024'
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
CORS(app, supports_credentials=True, origins='*')

USERS = {}
ONLINE = {}

def hash_pass(p): return hashlib.sha256(p.encode()).hexdigest()

@app.before_request
def track_online():
    import uuid
    sid = session.get('_id')
    if not sid:
        session['_id'] = str(uuid.uuid4())
        sid = session['_id']
    ONLINE[sid] = time.time()
    cutoff = time.time() - 120
    for k in list(ONLINE.keys()):
        if ONLINE[k] < cutoff: del ONLINE[k]

@app.route('/api/online')
def online_count():
    cutoff = time.time() - 120
    count = sum(1 for v in ONLINE.values() if v > cutoff)
    return jsonify({'count': max(count, 1)})

@app.route('/')
def index(): return app.send_static_file('index.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    d = request.json
    email = d.get('email','').lower().strip()
    name = d.get('name',''); pwd = d.get('password','')
    if not email or not pwd or not name:
        return jsonify({'error':'Fill all fields'}), 400
    if email in USERS:
        return jsonify({'error':'Email already exists'}), 400
    USERS[email] = {'name':name,'password':hash_pass(pwd),'plan':'free','joined':time.time()}
    session['user'] = email
    return jsonify({'success':True,'name':name,'plan':'free'})

@app.route('/api/login', methods=['POST'])
def login():
    d = request.json
    email = d.get('email','').lower().strip()
    pwd = d.get('password','')
    user = USERS.get(email)
    if not user or user['password'] != hash_pass(pwd):
        return jsonify({'error':'Wrong email or password'}), 401
    session['user'] = email
    return jsonify({'success':True,'name':user['name'],'plan':user.get('plan','free')})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'success':True})

@app.route('/api/me')
def me():
    email = session.get('user')
    if not email or email not in USERS: return jsonify({'loggedIn':False})
    u = USERS[email]
    return jsonify({'loggedIn':True,'name':u['name'],'plan':u.get('plan','free')})

@app.route('/api/unlock', methods=['POST'])
def unlock():
    email = session.get('user')
    if not email: return jsonify({'error':'Not logged in'}), 401
    USERS[email]['plan'] = request.json.get('plan','weekly')
    return jsonify({'success':True})

# ── BG REMOVER ──
@app.route('/remove-bg', methods=['POST'])
def remove_background():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    img_bytes = request.files['image'].read()
    result = rembg_remove(img_bytes) if HAS_REMBG else edge_bg_remove(Image.open(io.BytesIO(img_bytes)).convert('RGBA'))
    return send_file(io.BytesIO(result), mimetype='image/png', as_attachment=True, download_name='background-removed.png')

def edge_bg_remove(img):
    data = np.array(img)
    edge = np.concatenate([data[0,:,:3],data[-1,:,:3],data[:,0,:3],data[:,-1,:3]])
    bg = np.median(edge, axis=0)
    diff = np.sqrt(np.sum((data[:,:,:3].astype(float)-bg)**2, axis=2))
    data[:,:,3] = np.where(diff<60,0,255).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(data).save(buf,'PNG'); return buf.getvalue()

# ── UPSCALER ──
@app.route('/upscale', methods=['POST'])
def upscale_image():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    scale = request.form.get('scale','2K')
    tw = {'2K':2048,'4K':3840,'6K':5760,'8K':7680,'10K':9600}.get(scale,2048)
    img = Image.open(request.files['image']).convert('RGB'); w,h = img.size
    up = img.resize((tw, int(tw*h/w)), Image.LANCZOS)
    up = ImageEnhance.Sharpness(up).enhance(2.0)
    up = ImageEnhance.Contrast(up).enhance(1.1)
    buf = io.BytesIO(); up.save(buf,'PNG'); buf.seek(0)
    return send_file(buf, mimetype='image/png', as_attachment=True, download_name=f'upscaled-{scale}.png')

# ── ENHANCER — Waifu2x + PIL ──
@app.route('/enhance', methods=['POST'])
def enhance_image():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    mode = request.form.get('mode', 'soft')
    img_bytes = request.files['image'].read()

    # Try waifu2x
    try:
        result = enhance_waifu2x(img_bytes)
        if result:
            return send_file(io.BytesIO(result), mimetype='image/png',
                           as_attachment=True, download_name=f'enhanced-{mode}.png')
    except Exception as e:
        print(f"Waifu2x error: {e}")

    # PIL fallback
    result = enhance_pil(img_bytes)
    return send_file(io.BytesIO(result), mimetype='image/png',
                   as_attachment=True, download_name=f'enhanced-{mode}.png')

def enhance_waifu2x(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    w, h = img.size
    if w > 1024 or h > 1024:
        ratio = min(1024/w, 1024/h)
        img = img.resize((int(w*ratio), int(h*ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'PNG')

    # HuggingFace Space — Real-ESRGAN
    r = requests.post(
        'https://allvocalsremover-real-esrgan-api.hf.space/run/predict',
        json={'data': ['data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()]},
        timeout=120
    )

    print(f"HF Space: {r.status_code} | {r.text[:200]}")

    if r.ok:
        resp = r.json()
        data = resp.get('data', [])
        if data:
            img_b64 = data[0]
            if img_b64.startswith('data:'):
                img_b64 = img_b64.split(',')[1]
            result_img = Image.open(io.BytesIO(base64.b64decode(img_b64))).convert('RGB')
            rw, rh = result_img.size
            tw = 3840
            if rw < tw:
                result_img = result_img.resize((tw, int(tw*rh/rw)), Image.LANCZOS)
            out = io.BytesIO()
            result_img.save(out, 'PNG')
            out.seek(0)
            return out.getvalue()

    raise Exception(f"HF Space failed: {r.status_code} {r.text[:100]}")

def enhance_pil(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    w, h = img.size
    # Blur removal
    img = img.filter(ImageFilter.MedianFilter(size=3))
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=180, threshold=2))
    # 4K upscale
    tw = 3840
    img = img.resize((tw, int(tw*h/w)), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    buf.seek(0)
    return buf.getvalue()

# ── STEM SPLITTER ──
@app.route('/split-stems', methods=['POST'])
def split_stems():
    if 'audio' not in request.files: return jsonify({'error':'No audio'}), 400
    file = request.files['audio']; filename = file.filename; raw = file.read()
    try:
        samples, sr = read_wav_data(raw)
        if samples is None: raise Exception('Please upload WAV format')
        v, d, b, ins = fft_split(samples, sr)
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf,'w',zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('vocals.wav', make_wav(v, sr))
            zf.writestr('drums.wav',  make_wav(d, sr))
            zf.writestr('bass.wav',   make_wav(b, sr))
            zf.writestr('instruments.wav', make_wav(ins, sr))
        zip_buf.seek(0)
        return send_file(zip_buf, mimetype='application/zip', as_attachment=True,
                        download_name=f'{os.path.splitext(filename)[0]}-stems.zip')
    except Exception as e:
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf,'w') as zf:
            zf.writestr(filename, raw)
            zf.writestr('README.txt', f'Error: {str(e)}')
        zip_buf.seek(0)
        return send_file(zip_buf, mimetype='application/zip', as_attachment=True, download_name='stems.zip')

def read_wav_data(wav_bytes):
    try:
        buf = io.BytesIO(wav_bytes)
        with wave.open(buf,'rb') as wf:
            sr=wf.getframerate(); sw=wf.getsampwidth(); ch=wf.getnchannels(); raw=wf.readframes(wf.getnframes())
        s = np.frombuffer(raw, dtype=np.int16 if sw==2 else np.uint8).astype(np.float32)
        if ch==2: s = s.reshape(-1,2).mean(axis=1)
        mx = np.max(np.abs(s))
        if mx>0: s = s/mx
        return s, sr
    except: return None, None

def fft_split(samples, sr):
    chunk=8192; n=(len(samples)//chunk)*chunk; s=samples[:n]
    v=np.zeros(n,np.float32); d=np.zeros(n,np.float32)
    b=np.zeros(n,np.float32); ins=np.zeros(n,np.float32)
    for i in range(n//chunk):
        seg=s[i*chunk:(i+1)*chunk]; fft=np.fft.rfft(seg); freqs=np.fft.rfftfreq(chunk,1.0/sr)
        vf=fft.copy(); vf[(freqs<300)|(freqs>3400)]=0; v[i*chunk:(i+1)*chunk]=np.fft.irfft(vf)
        df=fft.copy(); df[~(((freqs>=50)&(freqs<=180))|(freqs>=6000))]=0; d[i*chunk:(i+1)*chunk]=np.fft.irfft(df)
        bf=fft.copy(); bf[freqs>250]=0; b[i*chunk:(i+1)*chunk]=np.fft.irfft(bf)
        inf=fft.copy(); inf[(freqs<250)|(freqs>6000)]=0; ins[i*chunk:(i+1)*chunk]=np.fft.irfft(inf)
    return v, d, b, ins

def make_wav(samples, sr):
    mx = np.max(np.abs(samples))
    if mx>0: samples = samples/mx*0.92
    pcm = np.clip(samples*32767,-32768,32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf,'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes(pcm.tobytes())
    return buf.getvalue()

if __name__=='__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting on port {port}")
    app.run(host='0.0.0.0', port=port)
