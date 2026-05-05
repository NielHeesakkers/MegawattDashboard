CREATE TABLE "LocProjectContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "locProjectId" INTEGER NOT NULL,
    "naam" TEXT NOT NULL,
    "email" TEXT,
    "telefoon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LocProjectContact_locProjectId_fkey" FOREIGN KEY ("locProjectId") REFERENCES "LocProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LocProjectContact_locProjectId_idx" ON "LocProjectContact"("locProjectId");

-- Migreer bestaande single-contact velden naar eerste contact-rij
INSERT INTO "LocProjectContact" ("locProjectId", "naam", "email", "telefoon", "order")
SELECT "id", COALESCE("contactPerson", ''), "email", "telefoon", 0
FROM "LocProject"
WHERE ("contactPerson" IS NOT NULL AND "contactPerson" != '')
   OR ("email" IS NOT NULL AND "email" != '')
   OR ("telefoon" IS NOT NULL AND "telefoon" != '');
