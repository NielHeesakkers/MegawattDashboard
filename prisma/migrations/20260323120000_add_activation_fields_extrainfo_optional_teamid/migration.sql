-- AlterTable: make Member.teamId optional
-- SQLite doesn't support ALTER COLUMN, so we recreate the table
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "photo" TEXT,
    "teamId" INTEGER,
    "isVacancy" BOOLEAN NOT NULL DEFAULT false,
    "isTeamLead" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "subGroup" TEXT,
    CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Member" ("id", "name", "role", "email", "phone", "photo", "teamId", "isVacancy", "isTeamLead", "order", "subGroup")
SELECT "id", "name", "role", "email", "phone", "photo", "teamId", "isVacancy", "isTeamLead", "order", "subGroup" FROM "Member";

DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";

-- Recreate foreign keys for ClientTeamMember referencing Member
-- (Prisma handles this via the schema, but we need the index)

-- Add new columns to Activation
ALTER TABLE "Activation" ADD COLUMN "locationLat" REAL;
ALTER TABLE "Activation" ADD COLUMN "locationLon" REAL;
ALTER TABLE "Activation" ADD COLUMN "locationZoom" INTEGER;
ALTER TABLE "Activation" ADD COLUMN "target" TEXT;

-- Add extraInfo to Project
ALTER TABLE "Project" ADD COLUMN "extraInfo" TEXT;
