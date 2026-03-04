# ============================================================
# Megawatt Organigram — Production Dockerfile
# Single container: Node API + built React frontend + Python face-crop
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


# --- Stage 2: Python face-crop environment ---
FROM python:3.12-slim AS python-env

RUN pip install --no-cache-dir face-crop-plus


# --- Stage 3: Production runtime ---
FROM node:20-slim

# Install Python runtime (needed for face-crop-plus at runtime)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json .

# Copy Prisma schema + migrations + seed (needed for migrate deploy + first-run seed)
COPY prisma/ prisma/

# Copy face-crop Python script
COPY server/lib/face_crop.py server/lib/face_crop.py

# Set up Python venv with face-crop-plus
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir face-crop-plus

# Create uploads dir
RUN mkdir -p /app/uploads

# Copy entrypoint script
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Persistent data volumes
VOLUME ["/app/prisma", "/app/uploads"]

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:./dev.db"

EXPOSE 3001

# Start: run migrations, seed if first run, then start server
CMD ["./docker-entrypoint.sh"]
