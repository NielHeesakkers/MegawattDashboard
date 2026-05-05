-- CreateTable: Specialisme
CREATE TABLE "Specialisme" (
    "id"   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "naam" TEXT    NOT NULL UNIQUE
);

-- CreateTable: ToeleverancierSpecialisme (koppeltabel)
CREATE TABLE "ToeleverancierSpecialisme" (
    "toeleverancierId" INTEGER NOT NULL,
    "specialismeId"    INTEGER NOT NULL,

    PRIMARY KEY ("toeleverancierId", "specialismeId"),
    CONSTRAINT "ToeleverancierSpecialisme_toeleverancierId_fkey"
        FOREIGN KEY ("toeleverancierId") REFERENCES "Toeleverancier" ("id") ON DELETE CASCADE,
    CONSTRAINT "ToeleverancierSpecialisme_specialismeId_fkey"
        FOREIGN KEY ("specialismeId") REFERENCES "Specialisme" ("id") ON DELETE CASCADE
);
