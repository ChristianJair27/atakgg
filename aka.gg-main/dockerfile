# ---- Build (Vite/React) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit
COPY . .
RUN npm run build

# ---- Run (Nginx) ----
FROM nginx:1.25-alpine
# Necesario para el healthcheck de Coolify
RUN apk add --no-cache curl

# Nginx para SPA (fallback a index.html) + endpoint /healthz
RUN rm -f /etc/nginx/conf.d/default.conf
COPY <<'NGINX' /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  # Health endpoint simple
  location /healthz {
    add_header Content-Type text/plain;
    return 200 'ok';
  }
}
NGINX

COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck que Coolify puede ejecutar dentro del contenedor
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1/healthz || exit 1

EXPOSE 80
CMD ["nginx","-g","daemon off;"]
