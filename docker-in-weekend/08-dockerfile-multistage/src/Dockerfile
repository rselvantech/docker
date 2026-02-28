# ──────────────────────────────────────────
# Stage 1: Builder — install tools and build
# ──────────────────────────────────────────
FROM node:alpine AS builder

LABEL org.opencontainers.image.authors="RSelvanTech"

WORKDIR /app

# Install html-minifier
COPY package*.json .
RUN npm install

# Copy source files and minify
COPY app/ ./app/
RUN npm run build
# Minified output is now in /app/dist/index.html

# ──────────────────────────────────────────
# Stage 2: Final — clean nginx image
# ──────────────────────────────────────────
FROM nginx:alpine-slim AS final

LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: Multi-Stage Build"
LABEL org.opencontainers.image.description="Static site minified with Node.js, served with Nginx"

# Copy ONLY the minified output from Stage 1
# node, npm, node_modules, source files are all left behind
COPY --from=builder /app/dist/index.html /usr/share/nginx/html/index.html

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Run nginx in foreground — keeps container alive
CMD ["nginx", "-g", "daemon off;"]
