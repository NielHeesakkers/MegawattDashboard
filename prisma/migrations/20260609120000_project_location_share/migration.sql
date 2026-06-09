-- Deelbare locatie-link per project (alleen-lezen overzicht voor klant)
ALTER TABLE "Project" ADD COLUMN "locationShareToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "locationSharePassword" TEXT;
CREATE UNIQUE INDEX "Project_locationShareToken_key" ON "Project"("locationShareToken");
