# Use official Bun image
FROM docker.io/oven/bun:1-alpine

# Create non-root user early (before any files are copied)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY --chown=appuser:appgroup package.json ./

# Install dependencies (--no-save prevents lockfile changes error)
RUN bun install --production --no-save

# Copy source code
COPY --chown=appuser:appgroup src ./src
COPY --chown=appuser:appgroup tsconfig.json ./

# Switch to non-root user
USER appuser

# Expose ports (HTTP API + Socket.IO)
EXPOSE 8765 8767

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8765/health || exit 1

# Start the server
CMD ["bun", "run", "src/index.ts"]
