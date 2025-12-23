#!/bin/bash
# ===========================================
# Auto-deploy script for FluentXverse Server
# Triggered by GitHub webhook
# Uses Podman instead of Docker
# ===========================================

set -e

REPO_DIR="/home/paulanthonyarriola/Desktop/fluentxverse"
LOG_FILE="/home/paulanthonyarriola/fluentxverse-deploy.log"
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

# ==========================================
# PODMAN SERVICES
# ==========================================
log "🦭 Rebuilding Podman containers..."
cd "$REPO_DIR/fluentxverse-server"

# Pull latest images (postgres, redis, memgraph, seaweedfs)
podman-compose pull

# Rebuild and restart containers
podman-compose down
podman-compose up -d

# Wait for containers to be healthy
log "⏳ Waiting for containers to be ready..."
sleep 10

# Check container status
podman-compose ps

# ==========================================
# BUN/NODE SERVER
# ==========================================
log "📦 Installing server dependencies..."
bun install

# Restart the Bun server
log "🔄 Restarting Bun server..."
# Try systemd first, fall back to direct process
if systemctl --user is-active --quiet fluentxverse-server 2>/dev/null; then
    systemctl --user restart fluentxverse-server
    log "✅ Restarted via systemd"
else
    # Kill existing process and start new one
    pkill -f "bun.*src/index.ts" || true
    cd "$REPO_DIR/fluentxverse-server"
    nohup bun run src/index.ts > /home/paulanthonyarriola/fluentxverse-server.log 2>&1 &
    log "✅ Started Bun server in background"
fi

# ==========================================
# CLEANUP
# ==========================================
log "🧹 Cleaning up old Podman images..."
podman image prune -f

# ==========================================
# RESTART WEBHOOK SERVER (so it picks up any changes)
# ==========================================
log "🎣 Restarting webhook server..."
pkill -f "bun.*webhook-server.ts" || true
sleep 2
cd "$REPO_DIR/fluentxverse-server"
nohup bun run scripts/webhook-server.ts > /home/paulanthonyarriola/webhook.log 2>&1 &
log "✅ Webhook server restarted"

log "✅ Deployment complete!"
log "📊 Container status:"
podman-compose ps
