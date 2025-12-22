#!/bin/bash
# ===========================================
# Auto-deploy script for FluentXverse Server
# Triggered by GitHub webhook
# ===========================================

set -e

REPO_DIR="/home/maryann/fluentxverse-monorepo"
LOG_FILE="/home/maryann/fluentxverse-deploy.log"
BRANCH="main"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Starting deployment..."

cd "$REPO_DIR"

# Pull latest changes
log "📥 Pulling from GitHub..."
git fetch origin
git reset --hard origin/$BRANCH

# Install dependencies
log "📦 Installing server dependencies..."
cd "$REPO_DIR/fluentxverse-server"
bun install

# Build if needed (TypeScript)
# log "🔨 Building..."
# bun run build

# Restart the server
log "🔄 Restarting server..."
pm2 restart fluentxverse-server || pm2 start src/index.ts --name fluentxverse-server --interpreter bun

log "✅ Deployment complete!"
