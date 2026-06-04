-- Add email column to User
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- Set admin email
UPDATE "User" SET "email" = 'development@heesakkers.com' WHERE "username" = 'admin';

-- PasswordResetToken table
CREATE TABLE "PasswordResetToken" (
    "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token"     TEXT    NOT NULL UNIQUE,
    "userId"    INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
