#!/bin/bash
# ============================================================
# deploy.sh — Push local changes to AWS Lightsail and restart
# Usage: ./deploy.sh
# ============================================================

set -e

SERVER="ubuntu@3.77.106.114"
SSH_KEY="$HOME/.ssh/lightsail_docportal"
REMOTE_DIR="/opt/docportal"

echo "==> Syncing code to server..."
rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='backend/.env' \
  --exclude='uploads/' \
  --exclude='engineering-portal-frontend/dist/' \
  -e "ssh -i $SSH_KEY" \
  ./ "$SERVER:$REMOTE_DIR/"

echo "==> Rebuilding and restarting containers..."
ssh -i "$SSH_KEY" "$SERVER" bash << 'REMOTE'
  cd /opt/docportal

  # Pull latest images (optional, speeds up builds)
  # docker compose -f docker-compose.prod.yml pull

  # Rebuild only changed services and restart
  docker compose -f docker-compose.prod.yml build --no-cache backend frontend
  docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend

  # Wait for backend to be healthy
  echo "==> Waiting for backend..."
  sleep 10
  docker compose -f docker-compose.prod.yml ps
  curl -sf http://localhost:8000/health && echo " Backend healthy!" || echo " Backend not responding yet"
REMOTE

echo ""
echo "Deploy complete. Check https://docs.innospatium.com"
