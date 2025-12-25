# Build stage
FROM docker.io/oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install ALL dependencies (including dev for vite)
RUN bun install

# Copy source code (including .env.production for Vite)
COPY . .

# Set build-time environment variables for Vite
# These get baked into the JavaScript bundle at build time
ARG VITE_API_URL=https://api.fluentxverse.xyz
ARG VITE_SOCKET_URL=wss://ws.fluentxverse.xyz
ARG VITE_THIRDWEB_CLIENT_ID=1cb406c4735e4b76f671f143794eab4c

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_THIRDWEB_CLIENT_ID=$VITE_THIRDWEB_CLIENT_ID

# Build the app - Vite will use the ENV variables above
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
