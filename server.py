# ═══════════════════════════════════════════════════════
# IMAGE UPSCALE AND ALL — server.py
# Python Flask backend
#
# WHAT THIS FILE DOES:
#   /remove-bg   → Real AI background removal (rembg)
#   /upscale     → Real image upscaling (Pillow + realesrgan if available)
#   /split-stems → Real audio stem splitting (demucs)
#   /enhance     → Real image enhancement (Pillow)
#
# HOW TO RUN:
#   pip install -r requirements.txt
#   python server.py
#   Open http://localhost:5000 in browser
# ═══════════════════════════════════════════════════════

import os
import io
import zipfile
import tempfile
import subprocess
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

# ── Try importing optional packages ──
try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
    print("✅ rembg loaded — background removal ready")
except ImportError:
    HAS_REMBG = False
    print("⚠️  rembg not installed — run: pip install rembg")

try:
    import demucs
    HAS_DEMUCS = True
    print("✅ demucs loaded — stem splitting ready")
except ImportError:
    HAS_DEMUCS = False
    print("⚠️  demucs not installed — run: pip install demucs")

# ── App setup ──
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Allow frontend to call backend

# ── Serve frontend ──
@app.route('/')
def index():
    """Serve the main HTML page"""
    return app.send_static_file('index.html')

# ════════════════════════════════════════════
# ROUTE: /remove-bg
# Method: POST
# Input: form-data with 'image' file
# Output: PNG image with background removed
# Uses: rembg (AI-based background removal)
# ════════════════════════════════════════════
@app.route('/remove-bg', methods=['POST'])
def remove_background():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    img_bytes = file.read()

    if HAS_REMBG:
        # Use rembg — real AI background removal
        # Works on people, objects, animals etc.
        output_bytes = rembg_remove(img_bytes)
    else:
        # Fallback: simple edge-based removal (not great but works)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
        output_bytes = simple_bg_remove(img)

    return send_file(
        io.BytesIO(output_bytes),
        mimetype='image/png',
        as_attachment=False
    )

def simple_bg_remove(img):
    """Basic fallback background removal using color difference"""
    img = img.convert('RGBA')
    data = np.array(img)
    # Get corner colors as background sample
    corners = [data[0,0], data[0,-1], data[-1,0], data[-1,-1]]
    bg_color = np.mean(corners, axis=0)[:3]
    # Remove pixels similar to background
    diff = np.abs(data[:,:,:3].astype(float) - bg_color).sum(axis=2)
    data[:,:,3] = np.where(diff < 80, 0, 255).astype(np.uint8)
    out = Image.fromarray(data)
    buf = io.BytesIO()
    out.save(buf, format='PNG')
    return buf.getvalue()

# ════════════════════════════════════════════
# ROUTE: /upscale
# Method: POST
# Input: form-data with 'image' file + 'scale' (2K/4K/8K/10K)
# Output: PNG image at requested resolution
# Uses: Pillow with Lanczos resampling + sharpening
# ════════════════════════════════════════════
@app.route('/upscale', methods=['POST'])
def upscale_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file  = request.files['image']
    scale = request.form.get('scale', '2K')

    # Resolution map
    scale_map = {
        '2K':  2048,
        '4K':  3840,
        '6K':  5760,
        '8K':  7680,
        '10K': 9600
    }
    target_width = scale_map.get(scale, 2048)

    # Open and upscale
    img = Image.open(file).convert('RGB')
    w, h = img.size
    ratio = h / w
    new_w = target_width
    new_h = int(target_width * ratio)

    # Lanczos = highest quality resampling filter
    upscaled = img.resize((new_w, new_h), Image.LANCZOS)

    # Apply sharpening to enhance details
    upscaled = upscaled.filter(ImageFilter.SHARPEN)
    upscaled = upscaled.filter(ImageFilter.DETAIL)

    # Enhance contrast and color slightly
    upscaled = ImageEnhance.Contrast(upscaled).enhance(1.1)
    upscaled = ImageEnhance.Sharpness(upscaled).enhance(1.3)
    upscaled = ImageEnhance.Color(upscaled).enhance(1.05)

    # Save to memory and return
    buf = io.BytesIO()
    upscaled.save(buf, format='PNG', optimize=True)
    buf.seek(0)

    return send_file(
        buf,
        mimetype='image/png',
        as_attachment=True,
        download_name=f'upscaled-{scale}.png'
    )

# ════════════════════════════════════════════
# ROUTE: /split-stems
# Method: POST
# Input: form-data with 'audio' file (mp3/mp4/wav)
# Output: ZIP file containing:
#           vocals.wav
#           drums.wav
#           bass.wav
#           other.wav (instruments)
# Uses: demucs (Meta AI stem separation)
# ════════════════════════════════════════════
@app.route('/split-stems', methods=['POST'])
def split_stems():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file uploaded'}), 400

    file = request.files['audio']
    filename = file.filename

    # Save uploaded file to temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path  = os.path.join(tmpdir, filename)
        output_dir  = os.path.join(tmpdir, 'output')
        os.makedirs(output_dir, exist_ok=True)

        file.save(input_path)

        if HAS_DEMUCS:
            # Run demucs — Meta's open-source stem separator
            # htdemucs model separates into: drums, bass, other, vocals
            result = subprocess.run(
                ['python', '-m', 'demucs', '--mp3',
                 '-o', output_dir,
                 '-n', 'htdemucs',  # model: htdemucs is best quality
                 input_path],
                capture_output=True, text=True, timeout=300
            )

            if result.returncode != 0:
                return jsonify({'error': 'Demucs failed: ' + result.stderr}), 500

            # Find output folder (demucs creates: output/htdemucs/<songname>/)
            stem_folder = None
            for root, dirs, files in os.walk(output_dir):
                if any(f.endswith('.mp3') or f.endswith('.wav') for f in files):
                    stem_folder = root
                    break

            if not stem_folder:
                return jsonify({'error': 'Stems not found after processing'}), 500

            # Create ZIP with all stems
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                for stem_name in ['vocals', 'drums', 'bass', 'other']:
                    # Try both .mp3 and .wav
                    for ext in ['.mp3', '.wav']:
                        stem_path = os.path.join(stem_folder, stem_name + ext)
                        if os.path.exists(stem_path):
                            # Name clearly in ZIP
                            zip_filename = stem_name + ext
                            if stem_name == 'other':
                                zip_filename = 'instruments' + ext
                            zf.write(stem_path, zip_filename)
                            break

        else:
            # Fallback: return the original file in ZIP with explanation
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.write(input_path, 'original-' + filename)
                # Add README explaining demucs needed
                readme = "Install demucs: pip install demucs\nThen restart server.py"
                zf.writestr('README.txt', readme)

        zip_buf.seek(0)
        base_name = os.path.splitext(filename)[0]
        return send_file(
            zip_buf,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'{base_name}-stems.zip'
        )

# ════════════════════════════════════════════
# ROUTE: /enhance
# Method: POST
# Input: form-data with 'image' file + 'mode' string
# Output: Enhanced PNG image
# Modes: soft, vivid, sharp, hdr, all
# ════════════════════════════════════════════
@app.route('/enhance', methods=['POST'])
def enhance_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    mode = request.form.get('mode', 'soft')

    img = Image.open(file).convert('RGB')

    # Apply enhancement based on mode
    if mode == 'soft':
        img = ImageEnhance.Brightness(img).enhance(1.08)
        img = ImageEnhance.Color(img).enhance(1.2)
        img = ImageEnhance.Contrast(img).enhance(1.05)

    elif mode == 'vivid':
        img = ImageEnhance.Brightness(img).enhance(1.14)
        img = ImageEnhance.Color(img).enhance(1.85)
        img = ImageEnhance.Contrast(img).enhance(1.12)
        img = ImageEnhance.Sharpness(img).enhance(1.3)

    elif mode == 'sharp':
        img = ImageEnhance.Contrast(img).enhance(1.45)
        img = ImageEnhance.Color(img).enhance(1.3)
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.EDGE_ENHANCE)
        img = ImageEnhance.Sharpness(img).enhance(2.0)

    elif mode == 'hdr':
        img = ImageEnhance.Contrast(img).enhance(1.5)
        img = ImageEnhance.Color(img).enhance(2.0)
        img = ImageEnhance.Brightness(img).enhance(1.1)
        img = img.filter(ImageFilter.DETAIL)

    elif mode == 'all':
        # Apply all enhancements combined
        img = ImageEnhance.Brightness(img).enhance(1.12)
        img = ImageEnhance.Color(img).enhance(1.9)
        img = ImageEnhance.Contrast(img).enhance(1.4)
        img = ImageEnhance.Sharpness(img).enhance(1.8)
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.DETAIL)

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)

    return send_file(
        buf,
        mimetype='image/png',
        as_attachment=True,
        download_name=f'enhanced-{mode}.png'
    )

# ── Run server ──
if __name__ == '__main__':
    print("\n🚀 Image Upscale And All — Server Starting")
    print("=" * 45)
    print("📍 Open in browser: http://localhost:5000")
    print("=" * 45)
    print(f"✅ Background Removal : {'rembg (AI)'    if HAS_REMBG   else 'Basic fallback'}")
    print(f"✅ Stem Splitting     : {'demucs (Meta AI)' if HAS_DEMUCS else 'Not available — pip install demucs'}")
    print(f"✅ Image Upscaling    : Pillow (Lanczos)")
    print(f"✅ Image Enhancement  : Pillow filters")
    print("=" * 45 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
