-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "naam" TEXT NOT NULL,
    "land" TEXT NOT NULL,
    "adres" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "omgevingType" TEXT NOT NULL DEFAULT 'centrum',
    "orientatie" TEXT NOT NULL DEFAULT 'N',
    "eigendomType" TEXT NOT NULL DEFAULT 'particulier',
    "vergunningNodig" BOOLEAN NOT NULL DEFAULT false,
    "vergunningLink" TEXT,
    "truckBereikbaar" BOOLEAN NOT NULL DEFAULT false,
    "geschiktActivatie" BOOLEAN NOT NULL DEFAULT false,
    "geschiktSampling" BOOLEAN NOT NULL DEFAULT false,
    "stroom" BOOLEAN NOT NULL DEFAULT false,
    "verlichting" BOOLEAN NOT NULL DEFAULT false,
    "lengte" REAL,
    "breedte" REAL,
    "m2" REAL,
    "notities" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LocationContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "locationId" INTEGER NOT NULL,
    "naam" TEXT NOT NULL,
    "email" TEXT,
    "telefoon" TEXT,
    "website" TEXT,
    "rol" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "LocationContact_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "locationId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationPhoto_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationCost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "locationId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Locatiehuur',
    "bedragCents" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    CONSTRAINT "LocationCost_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LocationContact_locationId_idx" ON "LocationContact"("locationId");

-- CreateIndex
CREATE INDEX "LocationPhoto_locationId_idx" ON "LocationPhoto"("locationId");

-- CreateIndex
CREATE INDEX "LocationCost_locationId_idx" ON "LocationCost"("locationId");
