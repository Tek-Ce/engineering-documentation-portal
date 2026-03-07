# Complete Deployment Guide
## DocPortal on AWS Lightsail + Cloudflare DNS
## Domain: docs.innospatium.com
## Server: Lightsail 4 GB RAM ($20/month) — paid by AWS credits

---

## How Your Credits Work

Your $200 AWS credits sit in your account and automatically pay your
Lightsail bill each month. No card is charged until credits run out.

  Months 1–3   → Lightsail free trial ($0, credits untouched)
  Months 4–13  → $20/month deducted from $200 credits
  Month 14+    → Evaluate: continue at $20/month or upgrade

You have 13 months of fully-covered hosting.

---

## What You Are Building

```
  User types: https://docs.innospatium.com
          |
          v
  ┌─────────────────────┐
  │     CLOUDFLARE      │  DNS — translates the domain to your server IP
  └─────────────────────┘
          |
          v
  ┌──────────────────────────────────────────────────────┐
  │            AWS LIGHTSAIL SERVER                      │
  │         Ubuntu 22.04 · 4 GB RAM · $20/month         │
  │                                                      │
  │   NGINX ──── the front door of the server           │
  │     · Handles port 80 (HTTP) and 443 (HTTPS)        │
  │     · Redirects all HTTP to HTTPS                   │
  │     · Sends /api/* requests → FastAPI               │
  │     · Sends everything else → React frontend        │
  │     · Serves uploaded files directly                │
  │                                                      │
  │   FASTAPI BACKEND (port 8000, internal only)        │
  │     · Your Python API                               │
  │     · Reads/writes to MySQL                         │
  │     · Sends emails via Resend                       │
  │     · Runs AI knowledge base indexing               │
  │                                                      │
  │   REACT FRONTEND (port 3000, internal only)         │
  │     · Your pre-built JavaScript app                 │
  │     · Served by a small Nginx inside the container  │
  │                                                      │
  │   MYSQL DATABASE (port 3306, internal only)         │
  │     · All your data — users, documents, comments    │
  │     · Never exposed to the internet                 │
  │     · Data persists in a Docker volume on disk      │
  │                                                      │
  │   CERTBOT (runs in background)                      │
  │     · Automatically renews your SSL certificate     │
  │     · Certificates are free from Let's Encrypt      │
  └──────────────────────────────────────────────────────┘
```

All five services above run as Docker containers on your single Lightsail
server. Docker Compose starts and connects them all with one command.

---

## PHASE 1 — Create the Lightsail Server

### What is Lightsail?
Lightsail is Amazon's simple cloud hosting. One flat monthly fee, no
surprise billing. It uses your AWS account and credits automatically.

### Step 1.1 — Open Lightsail

1. Log into your AWS account at console.aws.amazon.com
2. In the top search bar type: **Lightsail**
3. Click **Amazon Lightsail** in the results
   > Lightsail has its own separate dashboard from the main AWS console.
   > This is normal.

### Step 1.2 — Create the Instance

1. Click the orange **Create instance** button

2. **Instance location**
   Pick the region closest to where your users are located.
   - East Africa users → choose **Frankfurt (eu-central-1)** or **London (eu-west-2)**
   - Nairobi-based team → Frankfurt has the lowest latency to East Africa

3. **Select a platform**
   Click **Linux/Unix**

4. **Select a blueprint**
   - Click **OS Only**
   - Click **Ubuntu 22.04 LTS**
   > Ubuntu 22.04 is the industry standard for servers. It is stable,
   > well-documented, and receives security updates until April 2027.

5. **Choose your instance plan**
   Scroll to find and click the **$20 USD/month** plan.
   It shows: 4 GB RAM · 2 vCPU · 80 GB SSD · 4 TB transfer
   > The 4 GB RAM gives your app comfortable headroom. MySQL, the AI
   > knowledge base model, FastAPI, and Nginx all run without memory pressure.

6. **Identify your instance**
   In the name field type: `docportal-production`

7. Click the orange **Create instance** button at the bottom

   The instance appears with status **Pending** — wait about 2 minutes
   until it changes to **Running** (green dot).

---

### Step 1.3 — Assign a Static IP Address

By default Lightsail gives your server a different IP address every time
it restarts. A static IP stays the same permanently so your domain always
points to the right place.

1. In the Lightsail console, click the **Networking** tab at the top
2. Click **Create static IP**
3. Under "Attach to an instance" select **docportal-production**
4. Name it: `docportal-ip`
5. Click **Create and attach**

**Write this IP address down.** You will use it in Phase 2.

> Static IPs in Lightsail are completely free while attached to a
> running instance. You are not charged anything extra.

---

### Step 1.4 — Open the Firewall Ports

Your server has a firewall. By default only SSH (port 22) is open.
You need to open ports 80 and 443 for web traffic.

1. Click on your **docportal-production** instance
2. Click the **Networking** tab
3. Under **IPv4 Firewall** click **Add rule** and add:

   **First rule:**
   ```
   Application: HTTP
   Protocol:    TCP
   Port:        80
   ```
   Click **Save**

   **Second rule:**
   ```
   Application: HTTPS
   Protocol:    TCP
   Port:        443
   ```
   Click **Save**

   > Port 80 (HTTP) is needed so Let's Encrypt can verify you own
   > the domain before issuing your SSL certificate.
   > Port 443 (HTTPS) is what your users connect to.
   > Port 3306 (MySQL) must NOT be opened — it stays internal only.

---

## PHASE 2 — Cloudflare DNS Setup

### What is DNS?
DNS (Domain Name System) is the internet's phonebook. When someone types
`docs.innospatium.com` into their browser, DNS tells the browser which
IP address to connect to. You need to create a record that says:
"docs.innospatium.com → your Lightsail static IP".

### Step 2.1 — Add the Subdomain Record

1. Log into https://dash.cloudflare.com
2. Click on **innospatium.com**
3. In the left sidebar click **DNS** then **Records**
4. Click **Add record**

5. Fill in exactly:
   ```
   Type:    A
   Name:    docs
   IPv4:    [YOUR LIGHTSAIL STATIC IP]
   Proxy:   OFF  ← click the orange cloud to turn it grey
   TTL:     Auto
   ```

   > **Why must proxy be OFF (grey cloud)?**
   > When Cloudflare proxy is ON (orange), it intercepts your traffic.
   > Let's Encrypt cannot reach your server directly to verify you own
   > the domain, so the SSL certificate request fails.
   > Turn it grey for now. After deployment is complete you can optionally
   > turn it back orange for extra DDoS protection.

6. Click **Save**

### Step 2.2 — Verify DNS is Working

Wait 3 minutes, then test from your local computer:

**On Mac or Linux:**
```bash
nslookup docs.innospatium.com
# Should return your Lightsail IP address
```

**On Windows (Command Prompt):**
```
nslookup docs.innospatium.com
```

If it returns your IP, DNS is working. Continue to Phase 3.

---

## PHASE 3 — Connect to Your Server

### Step 3.1 — Open the Browser Terminal

The easiest way to connect — no setup required:

1. In Lightsail, click your **docportal-production** instance
2. Click the **Connect** tab
3. Click **Connect using SSH**
   > A black terminal window opens in your browser. This is your server.
   > Everything you type here runs on the Lightsail server, not your laptop.

You will see a prompt like: `ubuntu@ip-xxx-xxx-xxx-xxx:~$`

This means you are inside the server. Keep this window open throughout
the deployment.

---

## PHASE 4 — Install Docker on the Server

### What is Docker?
Docker is software that runs your application in isolated containers.
Each service (backend, frontend, database, etc.) runs in its own container.
If one crashes, the others keep running. Docker Compose starts all
containers together with a single command.

Run each block of commands by copying and pasting into the terminal:

```bash
# Update Ubuntu's package list — like refreshing an app store
sudo apt update && sudo apt upgrade -y
```

```bash
# Install tools needed to add Docker's repository
sudo apt install -y ca-certificates curl gnupg
```

```bash
# Add Docker's official signing key
# This proves that Docker software you download is genuine
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

```bash
# Tell Ubuntu where to find Docker's software
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
# Install Docker and Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

```bash
# Allow ubuntu user to run Docker without needing sudo every time
sudo usermod -aG docker ubuntu
newgrp docker
```

**Verify Docker is installed correctly:**
```bash
docker --version
docker compose version
```

You should see version numbers printed. If so, Docker is ready.

---

## PHASE 5 — Upload Your Application Code

### Step 5.1 — Create the App Directory

In the server terminal:
```bash
sudo mkdir -p /opt/docportal
sudo chown ubuntu:ubuntu /opt/docportal
cd /opt/docportal
```

> `/opt/` is the standard Linux location for installed applications.
> `chown` makes the ubuntu user the owner so you don't need sudo for
> every command inside this folder.

### Step 5.2 — Upload Your Code

Open a **new terminal on your local laptop** (not the server terminal).

**On Mac or Linux:**
```bash
rsync -avz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env*' \
  -e "ssh -i ~/Downloads/LightsailDefaultKey.pem" \
  /home/kiplimo/Desktop/opt/Devs/ \
  ubuntu@YOUR_LIGHTSAIL_IP:/opt/docportal/
```

Replace `YOUR_LIGHTSAIL_IP` with your actual static IP address.

> **What rsync does:** Copies your project files to the server over an
> encrypted SSH connection. It is smart — if you run it again later it
> only transfers files that changed, making updates fast.
> The --exclude flags skip files that don't belong on the server.

**On Windows:**
Download and install WinSCP (free). Connect using:
- Protocol: SFTP
- Host: your Lightsail IP
- Username: ubuntu
- Private key: your Lightsail .pem key file

Then drag your project folder to `/opt/docportal/` on the server.

### Step 5.3 — Verify Upload Succeeded

In the server terminal:
```bash
ls /opt/docportal/
```

You should see folders like: `backend/  engineering-portal-frontend/  nginx/`
and files like: `docker-compose.prod.yml`

---

## PHASE 6 — Create the Environment Configuration

### What is this file?
`.env.production` holds all your secret configuration values — database
passwords, API keys, your domain name. This file lives only on the server.
It is never uploaded to Git or shared anywhere.

```bash
cd /opt/docportal
nano .env.production
```

> `nano` is a simple text editor. It opens in your terminal.

Paste the entire block below, then replace every value marked with
CHANGE_THIS or YOUR_:

```env
# ── Application ───────────────────────────────────────────────
APP_NAME=Engineering Documentation Portal
APP_VERSION=1.0.0
DEBUG=False
APP_URL=https://docs.innospatium.com

# ── Database ──────────────────────────────────────────────────
# IMPORTANT: MYSQL_PASSWORD and the password in DATABASE_URL must be identical
DATABASE_URL=mysql+aiomysql://docportal_user:CHANGE_THIS_DB_PASS@mysql:3306/docportal
MYSQL_ROOT_PASSWORD=CHANGE_THIS_ROOT_PASS
MYSQL_DATABASE=docportal
MYSQL_USER=docportal_user
MYSQL_PASSWORD=CHANGE_THIS_DB_PASS

# ── Security ──────────────────────────────────────────────────
SECRET_KEY=GENERATE_THIS_BELOW
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGINS=["https://docs.innospatium.com"]

# ── File Uploads ──────────────────────────────────────────────
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_EXTENSIONS=[".pdf",".docx",".doc",".md",".txt",".xlsx",".pptx"]

# ── Resend Email ──────────────────────────────────────────────
RESEND_API_KEY=re_YOUR_KEY_FROM_RESEND
EMAIL_FROM_DOMAIN=innospatium.com
EMAIL_FROM_ADDRESS=noreply@innospatium.com
EMAIL_FROM_NAME=DocPortal

# ── OpenAI (AI knowledge base chat) ──────────────────────────
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY
```

**To save and exit nano:**
Press `Ctrl+O` → press `Enter` → press `Ctrl+X`

### Generate a Secure SECRET_KEY

Your SECRET_KEY signs all login tokens. It must be random and secret.
Run this command to generate one:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output (64 random characters). Open the file again:
```bash
nano .env.production
```
Replace `GENERATE_THIS_BELOW` with the generated value. Save and exit.

### Choose Strong Passwords for the Database

For `CHANGE_THIS_DB_PASS` and `CHANGE_THIS_ROOT_PASS` use long random
passwords. Generate them:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(20))"
# Run twice — once for each password
```

---

## PHASE 7 — Configure Resend Email

### What is Resend?
Resend is the email delivery service your app uses to send:
- Welcome and verification emails when admin creates a user account
- Password reset links
- Document approval and rejection notifications

### Step 7.1 — Verify Your Domain in Resend

1. Log into https://resend.com
2. Go to **Domains** → **Add Domain**
3. Type `innospatium.com` → click **Add**
4. Resend shows you DNS records to add. They look like:

   ```
   Type: TXT  Name: resend._domainkey  Value: p=MIGfMA0...
   Type: TXT  Name: @                  Value: v=spf1 include:...
   ```

5. Add each record in Cloudflare:
   - Go to Cloudflare → innospatium.com → DNS → Records → Add record
   - Copy Type, Name, and Value exactly from Resend
   - Leave Proxy OFF (grey) for these records
   - Click Save for each

   > **What these records do:**
   > SPF (TXT record starting with v=spf1): Tells receiving email servers
   > that Resend is authorized to send email from your domain.
   > DKIM (TXT record with the long value): Digitally signs each email
   > so it cannot be tampered with. Prevents your emails going to spam.

6. Back in Resend click **Verify DNS Records**
   Green checkmarks appear when verified (takes 2–15 minutes)

### Step 7.2 — Create API Key

1. In Resend go to **API Keys** → **Create API Key**
2. Name: `docportal-production`
3. Permission: **Sending access**
4. Click **Add**
5. Copy the key (starts with `re_`)
6. On the server: `nano /opt/docportal/.env.production`
   Replace `re_YOUR_KEY_FROM_RESEND` with your real key. Save and exit.

---

## PHASE 8 — Update Nginx Config with Your Domain

Your Nginx configuration file has `YOUR_DOMAIN.com` as a placeholder.
Replace it with your actual domain:

```bash
sed -i 's/YOUR_DOMAIN\.com/docs.innospatium.com/g' \
  /opt/docportal/nginx/nginx.prod.conf
```

Confirm the replacement worked:
```bash
grep "docs.innospatium.com" /opt/docportal/nginx/nginx.prod.conf
```

You should see several lines containing your domain.

---

## PHASE 9 — Get the SSL Certificate

### What is SSL?
SSL (Secure Sockets Layer) is what gives your site the padlock icon and
`https://`. Without it browsers show "Not Secure" warnings.
Let's Encrypt provides SSL certificates completely free. They expire
every 90 days but your Certbot container renews them automatically.

### How the verification works:
Let's Encrypt checks that you actually control `docs.innospatium.com`
by placing a file on your server and fetching it over HTTP.
This is why port 80 must be open and DNS must be working first.

### Step 9.1 — Create Required Directories

```bash
mkdir -p /opt/docportal/certbot/conf
mkdir -p /opt/docportal/certbot/www
```

### Step 9.2 — Start a Temporary Nginx for Verification

This runs a minimal web server just long enough for Let's Encrypt to
verify your domain:

```bash
cat > /tmp/nginx-init.conf << 'NGINXEOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name docs.innospatium.com;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'SSL setup in progress';
            add_header Content-Type text/plain;
        }
    }
}
NGINXEOF

docker run --rm -d \
  --name nginx-init \
  -p 80:80 \
  -v /opt/docportal/certbot/www:/var/www/certbot:ro \
  -v /tmp/nginx-init.conf:/etc/nginx/nginx.conf:ro \
  nginx:alpine

echo "Waiting 5 seconds for Nginx to start..."
sleep 5
```

### Step 9.3 — Request the SSL Certificate

```bash
docker run --rm \
  -v /opt/docportal/certbot/conf:/etc/letsencrypt \
  -v /opt/docportal/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email YOUR_EMAIL@example.com \
  --agree-tos \
  --no-eff-email \
  -d docs.innospatium.com
```

Replace `YOUR_EMAIL@example.com` with your real email address.
Let's Encrypt sends certificate expiry warnings to this address.

**Successful output looks like:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/docs.innospatium.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/docs.innospatium.com/privkey.pem
This certificate expires on 2026-06-07.
```

If you see this, your SSL certificate is ready. Continue.

If you see an error, the most common causes are:
- DNS not yet propagated (wait 5 more minutes and retry)
- Port 80 not open in Lightsail firewall (check Phase 1.4)

### Step 9.4 — Stop the Temporary Nginx

```bash
docker stop nginx-init
```

---

## PHASE 10 — Deploy the Full Application

Everything is prepared. This phase launches all containers and makes
your application live on the internet.

### Step 10.1 — Build and Start All Containers

```bash
cd /opt/docportal

docker compose -f docker-compose.prod.yml up -d --build
```

**What this command does:**
- `--build` — Docker reads your backend Python code and builds a Docker
  image (installs all pip packages). Then builds the React frontend image
  (runs `npm install` and `npm run build` creating optimised static files).
  This takes 5–15 minutes the first time.
- `-d` — Detached mode. Runs all containers in the background so you
  get your terminal back.

**Watch the build as it happens:**
```bash
docker compose -f docker-compose.prod.yml logs -f
```
Press Ctrl+C to stop watching. The containers keep running.

### Step 10.2 — Check All Containers Are Running

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output (all should show **Up** or **healthy**):
```
NAME         IMAGE        STATUS
nginx        ...          Up (healthy)
backend      ...          Up (healthy)
frontend     ...          Up
mysql        ...          Up (healthy)
certbot      ...          Up
```

If any show **Exit** instead of **Up**, check that container's logs:
```bash
docker compose -f docker-compose.prod.yml logs [name] --tail=50
# Example: docker compose -f docker-compose.prod.yml logs backend --tail=50
```

### Step 10.3 — Set Up the Database

The database is empty. Alembic creates all the required tables.

```bash
# Wait for MySQL to finish starting (takes about 30 seconds)
echo "Waiting 40 seconds for MySQL to be ready..."
sleep 40

# Run all database migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

> **What Alembic does:** Your Python models define what tables and columns
> the database needs. Alembic reads these and creates the actual MySQL
> tables to match. It is like a version control system for your database
> structure. It records which migrations have been applied so it never
> runs the same one twice.

Expected output ends with something like:
```
INFO  [alembic.runtime.migration] Running upgrade -> baseline_001
INFO  [alembic.runtime.migration] Running upgrade baseline_001 -> a9f3e1b7c2d4
```

### Step 10.4 — Create the Admin Account

```bash
docker compose -f docker-compose.prod.yml exec backend python scripts/create_admin.py
```

The admin credentials are printed in the terminal. Write them down.

### Step 10.5 — Verify the Application is Live

Open your browser and go to: **https://docs.innospatium.com**

You should see:
- Your login page
- A padlock icon in the browser address bar (green or grey depending on browser)
- The URL shows `https://` not `http://`

**The system is live.**

---

## PHASE 11 — Test Everything Before Using in Production

Work through these tests before sharing the link with your team:

### Test 1 — Login
Log in with the admin credentials from Step 10.4.

### Test 2 — Create a User and Verify Email
1. Go to Admin → Users → Create User
2. Enter a real email address you can check
3. Check that inbox — a welcome email should arrive within 1 minute
4. Click the verification link in the email
5. Log in as that user — should succeed

### Test 3 — Upload a Document
1. Create a project
2. Upload a PDF document
3. Verify it appears in the project

### Test 4 — Password Reset
1. Log out
2. Click "Forgot password?" on the login page
3. Enter the email address
4. Check inbox — reset email should arrive
5. Click the reset link and change the password

### Test 5 — SSL Certificate
Visit https://docs.innospatium.com in an incognito window.
The padlock should appear with no warnings.

**Change the admin password** from the default immediately after testing.

---

## PHASE 12 — Security Hardening

### Step 12.1 — Enable Ubuntu Firewall (UFW)

UFW is Ubuntu's built-in firewall. It blocks all ports except the ones
you explicitly allow.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Type `y` when prompted. Verify:
```bash
sudo ufw status
```

> Your MySQL port (3306) is not in this list — it stays internal to Docker.

### Step 12.2 — Enable Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Select **Yes** when the prompt appears.

> This silently installs OS security patches in the background.
> Essential for any public-facing server.

### Step 12.3 — Install Fail2ban

Fail2ban watches login logs and automatically bans IP addresses that
repeatedly fail to authenticate (automated brute force attacks).

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## PHASE 13 — Ongoing Operations

### Updating the Application (After Code Changes)

Upload the updated code from your laptop:
```bash
rsync -avz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env*' \
  -e "ssh -i ~/Downloads/LightsailDefaultKey.pem" \
  /home/kiplimo/Desktop/opt/Devs/ \
  ubuntu@YOUR_LIGHTSAIL_IP:/opt/docportal/
```

On the server, rebuild and restart:
```bash
cd /opt/docportal
docker compose -f docker-compose.prod.yml up -d --build
```

If you changed database models, run migrations:
```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Viewing Logs

```bash
# All containers
docker compose -f docker-compose.prod.yml logs -f

# Just the backend
docker compose -f docker-compose.prod.yml logs -f backend

# Just Nginx
docker compose -f docker-compose.prod.yml logs -f nginx
```

Press Ctrl+C to stop watching.

### Restarting Services

```bash
# Restart everything
docker compose -f docker-compose.prod.yml restart

# Restart one service only (e.g. after changing .env.production)
docker compose -f docker-compose.prod.yml restart backend
```

### Backing Up the Database

```bash
# Run this on the server to create a backup file
DB_PASS=$(grep MYSQL_ROOT_PASSWORD /opt/docportal/.env.production | cut -d= -f2)

docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -u root -p"$DB_PASS" docportal \
  > /opt/docportal/backup_$(date +%Y%m%d_%H%M).sql

echo "Backup complete."
ls -lh /opt/docportal/backup_*.sql
```

Download the backup to your laptop (run on your local machine):
```bash
scp -i ~/Downloads/LightsailDefaultKey.pem \
  ubuntu@YOUR_LIGHTSAIL_IP:/opt/docportal/backup_*.sql \
  ~/Desktop/
```

### SSL Auto-Renewal

The `certbot` container checks for renewal every 12 hours automatically.
Let's Encrypt certificates expire every 90 days. Certbot renews them
at 30 days before expiry. No action needed — it is fully automatic.

---

## Complete Go-Live Checklist

**Lightsail Server**
- [ ] Instance created: 4 GB RAM, Ubuntu 22.04, region chosen
- [ ] Status shows: Running (green dot)
- [ ] Static IP assigned and written down
- [ ] Firewall: port 80 and 443 open in Lightsail networking tab

**Cloudflare DNS**
- [ ] A record created: Name=docs, Points to=Lightsail IP, Proxy=OFF
- [ ] nslookup docs.innospatium.com returns the correct IP

**Resend Email**
- [ ] Domain innospatium.com verified in Resend (green checkmarks)
- [ ] SPF and DKIM records added in Cloudflare DNS
- [ ] API key created and added to .env.production

**Server Setup**
- [ ] Docker installed (docker --version works)
- [ ] Code uploaded to /opt/docportal/
- [ ] .env.production created with all real values (no placeholder text)
- [ ] SECRET_KEY generated and set
- [ ] Nginx config updated with docs.innospatium.com

**SSL**
- [ ] certbot/conf/live/docs.innospatium.com/ directory exists with certificate files
- [ ] Temporary Nginx stopped before Phase 10

**Deployment**
- [ ] docker compose up -d --build completed without errors
- [ ] All 5 containers show Up or healthy
- [ ] alembic upgrade head completed without errors
- [ ] Admin account created

**Testing**
- [ ] https://docs.innospatium.com loads with padlock
- [ ] Admin login works
- [ ] Test user created → welcome email received
- [ ] Verify email link works → user can log in
- [ ] Document upload works
- [ ] Password reset email works
- [ ] Admin password changed from default

**Security**
- [ ] UFW firewall enabled (ufw status shows active)
- [ ] Automatic updates enabled
- [ ] Fail2ban installed and running

---

## Troubleshooting

### "502 Bad Gateway" in browser
The backend container crashed or is not ready.
```bash
docker compose -f docker-compose.prod.yml logs backend --tail=50
```
Look for the error. Most common cause: a value in .env.production is
wrong (mismatched MYSQL_PASSWORD, bad DATABASE_URL format, missing key).

### SSL certificate error / site not secure
Certificate files not found.
```bash
ls /opt/docportal/certbot/conf/live/docs.innospatium.com/
# Must show: cert.pem  chain.pem  fullchain.pem  privkey.pem
```
If empty or directory does not exist, re-run Phase 9.

### Emails not sending
Check the backend logs:
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i "email\|resend\|Error"
```
Then check the Resend dashboard → Logs tab. API calls appear there
within seconds if the key is correct.
Common fix: check RESEND_API_KEY in .env.production has no extra spaces.

### Database error on startup
MySQL takes 30–60 seconds to fully start. The backend retries automatically.
If it fails after 2 minutes:
```bash
docker compose -f docker-compose.prod.yml logs mysql --tail=30
```
Common cause: MYSQL_PASSWORD in .env.production has a special character
that needs quoting. Wrap the value in single quotes in the file.

### Cannot SSH into the server
Use the browser terminal in Lightsail console instead (Connect tab).
Or verify SSH (port 22) is in the Lightsail firewall rules.

---

## Monthly Cost Summary

| Item                              | Cost          |
|-----------------------------------|---------------|
| Lightsail $20/month plan          | $20.00/month  |
| Static IP (attached = free)       | $0.00         |
| Resend (up to 3,000 emails/month) | Free          |
| Cloudflare DNS                    | Free          |
| Let's Encrypt SSL                 | Free          |
| **Total per month**               | **$20.00**    |

**Months 1–3:** Lightsail free trial → $0 charged, credits untouched
**Months 4–13:** $20/month deducted from your $200 AWS credits
**Month 14+:** Assess usage and decide whether to continue
