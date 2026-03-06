import os, io, zipfile, wave, hashlib, time, requests, base64
from flask import Flask, request, send_file, jsonify, session
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

PICWISH_KEY = 'wxkmi7q6hdt31r4k1'
DEEP_IMAGE_KEY = 'a15686f0-1970-11f1-ab4c-05baad7d604f'

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

# ── ENHANCER ──
@app.route('/enhance', methods=['POST'])
def enhance_image():
    if 'image' not in request.files: return jsonify({'error':'No image'}), 400
    mode = request.form.get('mode', 'soft')
    img_bytes = request.files['image'].read()

    # Try Deep-Image first
    try:
        result = enhance_deepimage(img_bytes)
        if result:
            return send_file(io.BytesIO(result), mimetype='image/png',
                           as_attachment=True, download_name=f'enhanced-{mode}.png')
    except Exception as e:
        print(f"Deep-Image failed: {e}")

    # Try Picwish second
    try:
        result = enhance_picwish(img_bytes)
        if result:
            return send_file(io.BytesIO(result), mimetype='image/png',
                           as_attachment=True, download_name=f'enhanced-{mode}.png')
    except Exception as e:
        print(f"Picwish failed: {e}")

    # PIL fallback
    result = enhance_pil(img_bytes, mode)
    return send_file(io.BytesIO(result), mimetype='image/png',
                   as_attachment=True, download_name=f'enhanced-{mode}.png')

def enhance_deepimage(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=95)
    b64 = base64.b64encode(buf.getvalue()).decode()

    headers = {
        'x-api-key': DEEP_IMAGE_KEY,
        'Content-Type': 'application/json'
    }
    payload = {
        'url': f'data:image/jpeg;base64,{b64}',
        'enhancements': ['upscale', 'deblur', 'denoise'],
        'output_format': 'jpg',
        'width': 3840
    }

    r = requests.post('https://deep-image.ai/rest_api/process_result',
                     json=payload, headers=headers, timeout=120)

    print(f"Deep-Image: {r.status_code} | {r.text[:300]}")

    if not r.ok:
        raise Exception(f"Deep-Image {r.status_code}: {r.text[:100]}")

    resp = r.json()
    url = (resp.get('output_url') or resp.get('url') or
           resp.get('result_url') or resp.get('image'))
    if url:
        img_data = requests.get(url, timeout=60).content
        return img_data

    raise Exception(f"No URL: {resp}")

def enhance_picwish(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=95)

    headers = {'X-API-KEY': PICWISH_KEY}
    files = {'image': ('image.jpg', buf.getvalue(), 'image/jpeg')}

    r = requests.post('https://techhk.aoscdn.com/api/tasks/photo/upscale',
                     headers=headers, files=files,
                     data={'scale': 4, 'sync': 1}, timeout=60)

    print(f"Picwish: {r.status_code} | {r.text[:300]}")

    if not r.ok:
        raise Exception(f"Picwish {r.status_code}")

    resp = r.json()
    if resp.get('status') == 200:
        data = resp.get('data', {})
        url = data.get('image')
        if url:
            return requests.get(url, timeout=30).content
        task_id = data.get('task_id')
        if task_id:
            for _ in range(30):
                time.sleep(2)
                r2 = requests.get(
                    f'https://techhk.aoscdn.com/api/tasks/photo/upscale/{task_id}',
                    headers=headers, timeout=15)
                d2 = r2.json()
                if d2.get('status') == 200:
                    url = d2.get('data', {}).get('image')
                    if url:
                        return requests.get(url, timeout=30).content
    raise Exception(f"Picwish failed: {resp}")

def enhance_pil(img_bytes, mode):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    w, h = img.size
    # Denoise
    img = img.filter(ImageFilter.MedianFilter(size=3))
    # Unsharp mask — real blur removal
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=180, threshold=2))
    # 4K upscale
    tw = 3840
    img = img.resize((tw, int(tw*h/w)), Image.LANCZOS)
    # Post sharpen
    img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
    img = img.filter(ImageFilter.DETAIL)
    # Mode
    if mode == 'soft':
        img = ImageEnhance.Color(img).enhance(1.2)
        img = ImageEnhance.Contrast(img).enhance(1.1)
        img = ImageEnhance.Brightness(img).enhance(1.03)
    elif mode == 'softv2':
        img = ImageEnhance.Color(img).enhance(1.35)
        img = ImageEnhance.Contrast(img).enhance(1.25)
        img = ImageEnhance.Sharpness(img).enhance(2.0)
        img = ImageEnhance.Brightness(img).enhance(1.06)
    elif mode == 'sharp':
        img = ImageEnhance.Sharpness(img).enhance(3.5)
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.EDGE_ENHANCE)
        img = ImageEnhance.Contrast(img).enhance(1.35)
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
