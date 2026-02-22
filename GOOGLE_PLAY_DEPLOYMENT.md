# Google Play Deployment Guide
## Engineering Documentation Portal

This guide walks you through publishing the DocPortal app on Google Play using a **Progressive Web App (TWA — Trusted Web Activity)** approach, which wraps your existing React web app into an Android APK — no full React Native rewrite required.

---

## Overview of Approach

```
Your React Web App (Already Built)
         ↓
    Deploy Backend to Cloud (VPS / Railway / Render)
         ↓
    Deploy Frontend to Cloud (same server or Vercel/Netlify)
         ↓
    Generate Android APK using Bubblewrap (TWA)
         ↓
    Submit APK to Google Play Console
```

**Total estimated time: 4–8 hours for first deployment**

---

## PHASE 1 — Deploy Backend to a Server

Your backend must be live on a public HTTPS URL before the app can work on mobile.

### Option A: Deploy on a VPS (Ubuntu) — Recommended for production

**Step 1: Get a VPS**
- DigitalOcean Droplet ($6/month) — go.digitalocean.com
- Linode, Hetzner, or any Ubuntu 22.04 server

**Step 2: Set up the server**
```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update and install dependencies
apt update && apt upgrade -y
apt install -y python3.12 python3.12-venv python3-pip nginx mysql-server certbot python3-certbot-nginx git

# Create app directory
mkdir -p /opt/docportal
cd /opt/docportal
```

**Step 3: Upload your backend code**
```bash
# On your LOCAL machine — copy backend to server
scp -r /home/kiplimo/Desktop/opt/Devs/backend root@YOUR_SERVER_IP:/opt/docportal/
```

**Step 4: Set up Python environment**
```bash
# On the SERVER
cd /opt/docportal/backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Step 5: Create .env file on server**
```bash
nano /opt/docportal/backend/.env
```
Paste and fill in:
```
APP_NAME=Engineering Documentation Portal
DEBUG=False
DATABASE_URL=mysql://docportal_user:YOUR_DB_PASSWORD@localhost:3306/docportal
SECRET_KEY=GENERATE_A_STRONG_KEY_HERE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_EXTENSIONS=[".pdf",".docx",".doc",".md",".txt",".xlsx",".pptx"]
CORS_ORIGINS=["https://YOUR_DOMAIN.com"]
OPENAI_API_KEY=YOUR_OPENAI_KEY
```

**Generate SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Step 6: Set up MySQL**
```bash
mysql_secure_installation   # Follow prompts

mysql -u root -p
CREATE DATABASE docportal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'docportal_user'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON docportal.* TO 'docportal_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Step 7: Run Alembic migrations**
```bash
cd /opt/docportal/backend
source venv/bin/activate
alembic upgrade head
```

**Step 8: Create systemd service**
```bash
nano /etc/systemd/system/docportal.service
```
```ini
[Unit]
Description=DocPortal Backend
After=network.target mysql.service

[Service]
User=root
WorkingDirectory=/opt/docportal/backend
Environment="PATH=/opt/docportal/backend/venv/bin"
EnvironmentFile=/opt/docportal/backend/.env
ExecStart=/opt/docportal/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable docportal
systemctl start docportal
systemctl status docportal   # Should show "active (running)"
```

---

### Option B: Deploy on Railway (Easiest — no server management)

1. Go to **railway.app** and sign up
2. Click "New Project" → "Deploy from GitHub"
3. Connect your GitHub repo
4. Add environment variables in the Railway dashboard (same as .env above)
5. Add a MySQL plugin from Railway marketplace
6. Railway gives you a public HTTPS URL automatically

---

## PHASE 2 — Deploy Frontend

### Build the React app
```bash
# On your LOCAL machine
cd /home/kiplimo/Desktop/opt/Devs/engineering-portal-frontend

# Set the API URL to your deployed backend
echo "VITE_API_URL=https://YOUR_DOMAIN.com/api/v1" > .env.production

# Build
npm run build
# Output: dist/ folder
```

### Option A: Serve via Nginx on same VPS

```bash
# Copy dist folder to server
scp -r dist root@YOUR_SERVER_IP:/opt/docportal/frontend/

# Create Nginx config
nano /etc/nginx/sites-available/docportal
```
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    # Frontend (React SPA)
    root /opt/docportal/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads (static files)
    location /uploads/ {
        alias /opt/docportal/backend/uploads/;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/docportal /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Enable HTTPS (REQUIRED for PWA)
certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com
```

### Option B: Deploy frontend on Vercel (Free)
1. Push frontend to GitHub
2. Go to **vercel.com** → Import project
3. Set environment variable: `VITE_API_URL=https://YOUR_BACKEND_DOMAIN.com/api/v1`
4. Deploy — Vercel gives you a free HTTPS URL

---

## PHASE 3 — Generate App Icons

You need PNG icons in multiple sizes. Use **pwa-asset-generator**:

```bash
cd /home/kiplimo/Desktop/opt/Devs/engineering-portal-frontend

# Install tool
npm install -g pwa-asset-generator

# Create icons folder
mkdir -p public/icons

# Generate all sizes from your SVG or a 512x512 PNG source image
# Option 1: From the existing SVG icon (inline)
pwa-asset-generator \
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234c6ef5'><path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/></svg>" \
  public/icons \
  --background "#ffffff" \
  --padding "10%"

# This creates: icon-72x72.png, icon-96x96.png, icon-128x128.png,
#               icon-144x144.png, icon-152x152.png, icon-192x192.png,
#               icon-384x384.png, icon-512x512.png
```

**Or use the online tool:**
1. Go to **realfavicongenerator.net**
2. Upload a 512x512 PNG logo
3. Download the icon pack
4. Place PNG files in `public/icons/`

---

## PHASE 4 — Build Android APK with Bubblewrap (TWA)

Bubblewrap converts your PWA into an Android app using Chrome's Trusted Web Activity.

### Prerequisites
```bash
# Install Java JDK (required for Android build)
sudo apt install -y openjdk-17-jdk   # Ubuntu
# Or on macOS: brew install openjdk@17

# Install Android Command Line Tools
# Download from: https://developer.android.com/studio#command-tools
# Extract to ~/android-sdk

# Set environment variables
export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Accept licenses
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### Install Bubblewrap
```bash
npm install -g @bubblewrap/cli
```

### Initialize your TWA project
```bash
mkdir docportal-android
cd docportal-android

bubblewrap init --manifest https://YOUR_DOMAIN.com/manifest.json
```

Bubblewrap will ask you questions — fill in:
```
Domain: YOUR_DOMAIN.com
Application name: Engineering Documentation Portal
Short name: DocPortal
Package ID: com.yourcompany.docportal
Start URL: /
Icon URL: https://YOUR_DOMAIN.com/icons/icon-512x512.png
Splash screen color: #4c6ef5
Theme color: #4c6ef5
Version: 1
```

### Build the APK
```bash
bubblewrap build
```

This generates:
- `app-release-signed.apk` — ready for Google Play
- `app-release.aab` — Android App Bundle (preferred by Google Play)

---

## PHASE 5 — Create Digital Asset Links (Required!)

This proves you own the domain. Create this file on your server:

```bash
# Create the file at: https://YOUR_DOMAIN.com/.well-known/assetlinks.json
mkdir -p /opt/docportal/frontend/dist/.well-known

cat > /opt/docportal/frontend/dist/.well-known/assetlinks.json << 'EOF'
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.docportal",
    "sha256_cert_fingerprints": ["YOUR_SIGNING_KEY_SHA256"]
  }
}]
EOF
```

**Get your SHA256 fingerprint:**
```bash
# After bubblewrap build, run:
keytool -list -v -keystore android.keystore -alias android -storepass android -keypass android | grep SHA256
```

Add this to your Nginx config to serve the file:
```nginx
location /.well-known/ {
    root /opt/docportal/frontend/dist;
    default_type application/json;
}
```

**Verify it works:** Visit `https://YOUR_DOMAIN.com/.well-known/assetlinks.json` in a browser — you should see the JSON.

---

## PHASE 6 — Publish to Google Play

### Step 1: Create a Google Play Developer Account
- Go to **play.google.com/console**
- Pay the one-time $25 registration fee
- Complete account details

### Step 2: Create the App
1. Click "Create app"
2. App name: **Engineering Documentation Portal**
3. Default language: English
4. App or Game: **App**
5. Free or Paid: **Free** (or Paid)
6. Click "Create app"

### Step 3: Set Up the Store Listing
Navigate to **Store presence → Main store listing**:

**App details:**
- **App name:** Engineering Documentation Portal
- **Short description:** (80 chars) Centralized engineering docs with AI-powered search and collaboration
- **Full description:** (4000 chars)
```
Engineering Documentation Portal is a comprehensive platform for engineering teams to manage, search, and collaborate on technical documentation.

KEY FEATURES:
• AI-Powered Search — Find documents by meaning, not just keywords
• Document Management — Upload PDF, Word, PowerPoint, Markdown files
• Version Control — Track document revisions with change history
• Project Spaces — Organize docs by project with role-based access
• Collaboration — Comment threads, tags, and real-time notifications
• Knowledge Base — AI chat assistant for document Q&A
• Review Workflow — Submit, approve, and reject documents
• Offline Support — Access recently viewed documents offline

SECURITY:
• JWT-based authentication
• Role-based access (Admin, Engineer, Viewer)
• Activity logging and audit trails

Perfect for engineering teams that need a centralized, intelligent documentation hub.
```

### Step 4: Upload Graphics
- **App icon:** 512x512 PNG (use your icon-512x512.png)
- **Feature graphic:** 1024x500 PNG (create a banner image)
- **Screenshots:** At least 2 phone screenshots (1080x1920 or similar)
  - Take screenshots from Chrome DevTools mobile view
  - Or use your deployed app on an Android phone

### Step 5: Set Content Rating
- Complete the content rating questionnaire
- Your app is suitable for "Everyone"

### Step 6: Set Up Pricing & Distribution
- Pricing: Free
- Countries: Select all or specific countries

### Step 7: Upload APK/AAB
Navigate to **Release → Production → Create new release**:
1. Upload `app-release.aab` (Android App Bundle)
2. Add release notes: "Initial release of Engineering Documentation Portal"
3. Click "Save" then "Review release"

### Step 8: Submit for Review
- Click "Start rollout to Production"
- Google reviews take **3-7 business days** for first submission
- You'll receive an email when approved

---

## PHASE 7 — Post-Deployment Checklist

After your app is live:

- [ ] Test login on Android phone
- [ ] Test document upload from mobile
- [ ] Test KB search on mobile
- [ ] Verify offline page loads when disconnected
- [ ] Check push notifications work (if configured)
- [ ] Monitor Google Play Console for crashes/ANRs
- [ ] Set up crash reporting (add Sentry if needed)

---

## Common Issues & Fixes

### "Digital asset links verification failed"
- Ensure `assetlinks.json` is accessible at `https://YOUR_DOMAIN.com/.well-known/assetlinks.json`
- SHA256 fingerprint must match your signing key exactly
- Wait 24 hours after publishing for Google to re-verify

### "App opens in browser instead of TWA"
- Digital asset links must be verified
- Ensure manifest.json is served with `Content-Type: application/json`
- Check that `start_url` in manifest matches your deployed URL

### "Build fails with SDK error"
```bash
# Reinstall Android SDK tools
sdkmanager --update
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### "App crashes on startup"
- Check that backend is running and accessible from the internet
- Verify CORS is configured for your production domain
- Check Nginx proxy configuration

---

## Quick Reference — Key URLs After Deployment

| Service | URL |
|---------|-----|
| Backend API | `https://YOUR_DOMAIN.com/api/v1` |
| Frontend App | `https://YOUR_DOMAIN.com` |
| API Docs | `https://YOUR_DOMAIN.com/api/v1/docs` |
| Asset Links | `https://YOUR_DOMAIN.com/.well-known/assetlinks.json` |
| Manifest | `https://YOUR_DOMAIN.com/manifest.json` |
| Google Play Console | `play.google.com/console` |

---

## Alternative: Use Capacitor (More Native Feel)

If you want a more native Android app (with native APIs like camera, GPS):

```bash
cd engineering-portal-frontend
npm install @capacitor/core @capacitor/cli @capacitor/android

npx cap init "DocPortal" "com.yourcompany.docportal" --web-dir dist

npm run build

npx cap add android
npx cap sync android

# Open in Android Studio to build APK
npx cap open android
```

Then in Android Studio: **Build → Generate Signed Bundle/APK**

Capacitor gives you access to native Android features while keeping your React codebase.

---

## Cost Summary

| Item | Cost |
|------|------|
| Google Play Developer Account | $25 one-time |
| VPS Server (DigitalOcean 2GB) | ~$12/month |
| Domain name (.com) | ~$12/year |
| SSL Certificate | Free (Let's Encrypt) |
| OpenAI API (AI chat) | ~$5-20/month |
| **Total first month** | **~$50** |
| **Monthly recurring** | **~$20-35** |

---

*Good luck with your Google Play launch! 🚀*
