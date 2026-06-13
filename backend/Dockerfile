# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production dependencies only ─────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: Minimal runtime ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Non-root user
RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nestjs -G nodejs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist        ./dist
COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package*.json ./

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]
