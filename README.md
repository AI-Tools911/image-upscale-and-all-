# ⚡ Image Upscale And All

Free AI-powered web tools for images and audio.

## 🛠️ Tools Included

| Tool | What it does |
|------|-------------|
| ✂️ BG Remover | Removes background from any photo (person, object, animal) |
| 🔬 Upscaler | Upscale image to 2K, 4K, 6K, 8K, 10K |
| 🎵 Stem Splitter | Splits song into Vocals, Drums, Bass, Instruments — ZIP download |
| ✨ Enhancer | Boost quality with Soft, Vivid, Sharp, HDR, or ALL mode |

---

## 📁 File Structure

```
image-upscale-and-all/
├── index.html        ← Website pages & layout
├── style.css         ← All visual design & themes
├── app.js            ← Frontend logic (sliders, uploads, downloads)
├── server.py         ← Python AI backend (Flask)
├── requirements.txt  ← Python packages list
├── .gitignore        ← Git ignore rules
└── README.md         ← This file
```

---

## ⚙️ How to Run Locally

### Step 1 — Install Python
Make sure Python 3.9 or newer is installed.
Download: https://python.org

### Step 2 — Open terminal in project folder
```bash
cd image-upscale-and-all
```

### Step 3 — Install packages
```bash
pip install -r requirements.txt
```
> First time takes 5–10 minutes (demucs and rembg download AI models)

### Step 4 — Run the server
```bash
python server.py
```

### Step 5 — Open in browser
```
http://localhost:5000
```

---

## 🌐 How to Put on GitHub

### Step 1 — Create GitHub account
Go to https://github.com and sign up (free)

### Step 2 — Create a new repository
- Click green "New" button
- Name it: `image-upscale-and-all`
- Set to Public
- Click "Create repository"

### Step 3 — Upload your files
**Option A — GitHub website (easy):**
- Open your new repo
- Click "uploading an existing file"
- Drag all 6 files into the box
- Click "Commit changes"

**Option B — Git commands (if Git is installed):**
```bash
cd image-upscale-and-all
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/image-upscale-and-all.git
git push -u origin main
```

---

## 🚀 How to Deploy Free (Make Website Live)

### Option 1: Render.com (Best — free Python hosting)
1. Go to https://render.com → Sign up free
2. Click "New Web Service"
3. Connect your GitHub repo
4. Set these settings:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python server.py`
5. Click Deploy
6. Your site will be live at: `https://image-upscale-and-all.onrender.com`

### Option 2: Railway.app (Easy)
1. Go to https://railway.app → Sign in with GitHub
2. Click "New Project" → "Deploy from GitHub Repo"
3. Select your repo → Deploy
4. Done! Live in 2 minutes

### Option 3: GitHub Pages (Frontend only — no Python)
> Only shows the website, no real AI processing
1. In GitHub repo → Settings → Pages
2. Source: main branch
3. Site live at: `https://YOURUSERNAME.github.io/image-upscale-and-all`

---

## 📝 Notes

- **Downloads:** All files download through browser's built-in download manager. IDM and other download managers automatically intercept these.
- **Stem Splitter:** First use downloads AI model (~80MB). After that it's fast.
- **Background Removal:** First use downloads U2Net model (~170MB).
- **Free forever:** No API keys needed for core features.
