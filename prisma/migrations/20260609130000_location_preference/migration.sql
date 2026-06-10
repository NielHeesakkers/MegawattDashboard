CREATE TABLE "LocationPreference" (
  "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "projectId"  INTEGER NOT NULL,
  "locationId" INTEGER NOT NULL,
  "voterName"  TEXT NOT NULL,
  "voterEmail" TEXT NOT NULL,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocationPreference_projectId_fkey"  FOREIGN KEY ("projectId")  REFERENCES "Project"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LocationPreference_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LocationPreference_projectId_locationId_voterEmail_key" ON "LocationPreference"("projectId", "locationId", "voterEmail");
CREATE INDEX "LocationPreference_projectId_idx" ON "LocationPreference"("projectId");
