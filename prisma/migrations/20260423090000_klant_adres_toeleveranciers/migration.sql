-- Klant adres-velden
ALTER TABLE "Klant" ADD COLUMN "adres" TEXT;
ALTER TABLE "Klant" ADD COLUMN "postcode" TEXT;
ALTER TABLE "Klant" ADD COLUMN "stad" TEXT;
ALTER TABLE "Klant" ADD COLUMN "land" TEXT;

-- Toeleverancier (mirror van Klant, zonder project-relaties)
CREATE TABLE "Toeleverancier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "adres" TEXT,
    "postcode" TEXT,
    "stad" TEXT,
    "land" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Toeleverancier_name_key" ON "Toeleverancier"("name");

CREATE TABLE "ToeleverancierContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "toeleverancierId" INTEGER NOT NULL,
    "naam" TEXT NOT NULL,
    "email" TEXT,
    "telefoon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ToeleverancierContact_toeleverancierId_fkey" FOREIGN KEY ("toeleverancierId") REFERENCES "Toeleverancier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ToeleverancierContact_toeleverancierId_idx" ON "ToeleverancierContact"("toeleverancierId");
