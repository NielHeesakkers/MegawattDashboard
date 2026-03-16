#!/bin/sh
set -e

echo "=== Megawatt Dashboard Starting ==="

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed on first run (marker file in persistent data volume)
if [ ! -f /app/data/.seeded ]; then
  echo "First run detected - seeding database..."
  if npx tsx prisma/seed.ts; then
    touch /app/data/.seeded
    echo "Database seeded successfully."
  else
    echo "WARNING: Seeding failed - starting server anyway (you can seed manually later)"
  fi
fi

echo "Starting server on port ${PORT:-3001}..."
exec node dist/server/index.js
