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
# PODMAN SERVICES (includes Bun server now)
# ==========================================
log "🦭 Rebuilding Podman containers..."
cd "$REPO_DIR/fluentxverse-server"

# Pull latest base images
podman-compose pull

# Rebuild and restart containers (--build rebuilds the Bun server image)
podman-compose down
podman-compose up -d --build

# Wait for containers to be healthy
log "⏳ Waiting for containers to be ready..."
sleep 15

# Check container status
podman-compose ps

# Check if the server is healthy
log "🏥 Checking server health..."
if curl -s http://localhost:8765/health > /dev/null; then
    log "✅ Server is healthy!"
else
    log "⚠️ Server health check failed, checking logs..."
    podman-compose logs --tail=20 fluentxverse-server
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
