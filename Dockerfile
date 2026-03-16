# ============================================================
# Megawatt Dashboard — Production Dockerfile
# Single container: Node API + built React frontend
# ============================================================

# --- Stage 1: Build frontend + backend ---
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY client/ client/
COPY server/ server/
COPY prisma/ prisma/
COPY tsconfig*.json ./

# Generate Prisma client + build everything
RUN npx prisma generate && \
    npx vite build --config client/vite.config.ts && \
    npx tsc -p tsconfig.server.json


# --- Stage 2: Production runtime ---
FROM node:20-slim

WORKDIR /app

# Install openssl (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json .

# Copy Prisma schema + migrations + seed (needed for migrate deploy + first-run seed)
COPY prisma/ prisma/

# Copy face-crop source (needed by seed.ts via tsx)
COPY --from=builder /app/server/lib/face-crop.ts server/lib/

# Create data + uploads dirs
RUN mkdir -p /app/data /app/uploads

# Copy entrypoint script
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Only persistent DATA volumes (not prisma schema!)
VOLUME ["/app/data", "/app/uploads"]

# Environment — database lives in /app/data so volume doesn't overwrite prisma schema
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/app/data/dev.db"

EXPOSE 3001

# Start: run migrations, seed if first run, then start server
CMD ["./docker-entrypoint.sh"]
