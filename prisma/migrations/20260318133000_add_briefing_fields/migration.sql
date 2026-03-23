-- AlterTable: Add campaign fields to Project
ALTER TABLE "Project" ADD COLUMN "campaignDescription" TEXT;
ALTER TABLE "Project" ADD COLUMN "campaignMessage" TEXT;
ALTER TABLE "Project" ADD COLUMN "campaignTargetAudience" TEXT;
ALTER TABLE "Project" ADD COLUMN "campaignTarget" TEXT;
ALTER TABLE "Project" ADD COLUMN "clothing" TEXT;
ALTER TABLE "Project" ADD COLUMN "settingInstructions" TEXT;

-- RedefineTables: Add briefing fields to Activation
CREATE TABLE "new_Activation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "date" DATETIME,
    "briefingToken" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "scheduleItems" TEXT NOT NULL DEFAULT '[]',
    "tasks" TEXT,
    "storeList" TEXT,
    "photoRequirements" TEXT,
    "extraInfo" TEXT,
    "evaluationLink" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activation" ("id", "projectId", "location", "date", "createdAt", "updatedAt") SELECT "id", "projectId", "location", "date", "createdAt", "updatedAt" FROM "Activation";
DROP TABLE "Activation";
ALTER TABLE "new_Activation" RENAME TO "Activation";
CREATE UNIQUE INDEX "Activation_briefingToken_key" ON "Activation"("briefingToken");
CREATE INDEX "Activation_projectId_idx" ON "Activation"("projectId");

-- CreateTable: ActivationStaff
CREATE TABLE "ActivationStaff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "activationId" INTEGER NOT NULL,
    "superchargerId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'supercharger',
    CONSTRAINT "ActivationStaff_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "Activation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivationStaff_superchargerId_fkey" FOREIGN KEY ("superchargerId") REFERENCES "Supercharger" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ActivationStaff_activationId_idx" ON "ActivationStaff"("activationId");
CREATE INDEX "ActivationStaff_superchargerId_idx" ON "ActivationStaff"("superchargerId");
CREATE UNIQUE INDEX "ActivationStaff_activationId_superchargerId_key" ON "ActivationStaff"("activationId", "superchargerId");
