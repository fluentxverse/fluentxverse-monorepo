# Use official Bun image
FROM docker.io/oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Expose ports (HTTP API + Socket.IO)
EXPOSE 8765 8767

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8765/health || exit 1

# Start the server
CMD ["bun", "run", "src/index.ts"]
