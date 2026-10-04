# Build stage
FROM docker.io/oven/bun:1 AS builder

WORKDIR /app

# Build-time Vite env vars (baked into the bundle)
ARG VITE_API_URL
ARG VITE_SOCKET_URL=https://ws.fluentxverse.xyz
ARG VITE_PRIVY_APP_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID

# Copy package files
COPY package.json bun.lock* ./

# The app uses the monorepo lockfile, which is outside this Docker build context.
RUN bun install --no-save --network-concurrency=8

# Copy source code
COPY . .

# Build the app
RUN bun run build

# Production stage - use nginx to serve static files
FROM docker.io/library/nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
