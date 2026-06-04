-- Unify projects: drop LocProject tables, extend Project, add new join tables
-- Existing project data is wiped (user agreed to fake new data)

-- Drop LocProject related tables
DROP TABLE IF EXISTS "LocProjectLocation";
DROP TABLE IF EXISTS "LocProjectContact";
DROP TABLE IF EXISTS "LocProject";

-- Wipe existing Project data (and cascading Activations)
DELETE FROM "ActivationStaff";
DELETE FROM "Activation";
DELETE FROM "Project";

-- Add new fields to Project
ALTER TABLE "Project" ADD COLUMN "needsLocations"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "needsSuperchargers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "notities"           TEXT    NOT NULL DEFAULT '';

-- ProjectLocation join table
CREATE TABLE "ProjectLocation" (
    "id"          INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId"   INTEGER  NOT NULL,
    "locationId"  INTEGER  NOT NULL,
    "order"       INTEGER  NOT NULL DEFAULT 0,
    "startDate"   DATETIME,
    "endDate"     DATETIME,
    "available"   TEXT     NOT NULL DEFAULT 'unknown',
    "actionOpen"  BOOLEAN  NOT NULL DEFAULT false,
    "actionLabel" TEXT,
    "opmerkingen" TEXT     NOT NULL DEFAULT '',
    CONSTRAINT "ProjectLocation_projectId_fkey"  FOREIGN KEY ("projectId")  REFERENCES "Project"  ("id") ON DELETE CASCADE,
    CONSTRAINT "ProjectLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE
);
CREATE INDEX "ProjectLocation_projectId_idx"  ON "ProjectLocation"("projectId");
CREATE INDEX "ProjectLocation_locationId_idx" ON "ProjectLocation"("locationId");

-- ProjectContact table
CREATE TABLE "ProjectContact" (
    "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "naam"      TEXT    NOT NULL,
    "email"     TEXT,
    "telefoon"  TEXT,
    "order"     INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE
);
CREATE INDEX "ProjectContact_projectId_idx" ON "ProjectContact"("projectId");
