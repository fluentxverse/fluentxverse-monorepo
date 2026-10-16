FROM node:24.10.0-bookworm-slim AS builder
WORKDIR /app
ARG VITE_STUDENT_API_URL=https://api.fluentxverse.com
ARG VITE_STUDENT_SOCKET_URL=https://ws.fluentxverse.com
ARG VITE_PRIVY_APP_ID
ENV VITE_STUDENT_API_URL=$VITE_STUDENT_API_URL
ENV VITE_STUDENT_SOCKET_URL=$VITE_STUDENT_SOCKET_URL
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID
COPY package.json package-lock.json ./
RUN npm ci --workspaces=false
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
