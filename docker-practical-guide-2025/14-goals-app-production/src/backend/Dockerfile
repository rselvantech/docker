# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# The app writes access logs here — directory must exist in the image
# (no bind mount in production to create it at runtime)
RUN mkdir -p logs

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 80

CMD ["node", "app.js"]