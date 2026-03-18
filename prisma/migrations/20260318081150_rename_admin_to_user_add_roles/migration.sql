-- RenameAdmin -> User and add role-based access columns
ALTER TABLE "Admin" RENAME TO "User";
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "allowedTabs" TEXT NOT NULL DEFAULT '[]';
UPDATE "User" SET "role" = 'admin', "allowedTabs" = '["intern","planning"]';
