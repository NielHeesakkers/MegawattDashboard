CREATE TABLE "ProjectLocationSupercharger" (
  "id"                INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "projectLocationId" INTEGER NOT NULL,
  "superchargerId"    INTEGER NOT NULL,
  "availability"      TEXT NOT NULL DEFAULT '{}',
  "order"             INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProjectLocationSupercharger_projectLocationId_fkey" FOREIGN KEY ("projectLocationId") REFERENCES "ProjectLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectLocationSupercharger_superchargerId_fkey"    FOREIGN KEY ("superchargerId")    REFERENCES "Supercharger"("id")    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectLocationSupercharger_projectLocationId_superchargerId_key" ON "ProjectLocationSupercharger"("projectLocationId", "superchargerId");
CREATE INDEX "ProjectLocationSupercharger_projectLocationId_idx" ON "ProjectLocationSupercharger"("projectLocationId");
CREATE INDEX "ProjectLocationSupercharger_superchargerId_idx"    ON "ProjectLocationSupercharger"("superchargerId");
