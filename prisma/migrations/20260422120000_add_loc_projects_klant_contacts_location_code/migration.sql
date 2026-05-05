-- AlterTable: add optional new fields to Location
ALTER TABLE "Location" ADD COLUMN "code" TEXT;
ALTER TABLE "Location" ADD COLUMN "stad" TEXT;
ALTER TABLE "Location" ADD COLUMN "geschiktAnder" TEXT;

-- CreateIndex: unique constraint on code (partial - only when not null)
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateTable: KlantContact
CREATE TABLE "KlantContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "klantId" INTEGER NOT NULL,
    "naam" TEXT NOT NULL,
    "email" TEXT,
    "telefoon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "KlantContact_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KlantContact_klantId_idx" ON "KlantContact"("klantId");

-- Migrate existing Klant.contactPerson/email into KlantContact
INSERT INTO "KlantContact" ("klantId", "naam", "email", "telefoon", "order")
SELECT "id", COALESCE("contactPerson", ''), "email", NULL, 0
FROM "Klant"
WHERE ("contactPerson" IS NOT NULL AND "contactPerson" != '') OR ("email" IS NOT NULL AND "email" != '');

-- CreateTable: LocProject
CREATE TABLE "LocProject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "klantId" INTEGER NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "name" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "notities" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocProject_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LocProject_projectNumber_key" ON "LocProject"("projectNumber");
CREATE INDEX "LocProject_klantId_idx" ON "LocProject"("klantId");

-- CreateTable: LocProjectLocation
CREATE TABLE "LocProjectLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "locProjectId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "available" TEXT NOT NULL DEFAULT 'unknown',
    "actionOpen" BOOLEAN NOT NULL DEFAULT false,
    "actionLabel" TEXT,
    "opmerkingen" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "LocProjectLocation_locProjectId_fkey" FOREIGN KEY ("locProjectId") REFERENCES "LocProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LocProjectLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LocProjectLocation_locProjectId_idx" ON "LocProjectLocation"("locProjectId");
CREATE INDEX "LocProjectLocation_locationId_idx" ON "LocProjectLocation"("locationId");
