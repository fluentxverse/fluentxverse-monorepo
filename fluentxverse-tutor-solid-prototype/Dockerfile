FROM node:24.10.0-bookworm-slim AS builder
WORKDIR /app
ARG VITE_TUTOR_API_URL=https://api.fluentxverse.com
ARG VITE_TUTOR_SOCKET_URL=https://ws.fluentxverse.com
ARG VITE_ENABLE_NOTIFICATION_SOCKET=true
ENV VITE_TUTOR_API_URL=$VITE_TUTOR_API_URL
ENV VITE_TUTOR_SOCKET_URL=$VITE_TUTOR_SOCKET_URL
ENV VITE_ENABLE_NOTIFICATION_SOCKET=$VITE_ENABLE_NOTIFICATION_SOCKET
COPY package.json package-lock.json ./
RUN npm ci --workspaces=false
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
