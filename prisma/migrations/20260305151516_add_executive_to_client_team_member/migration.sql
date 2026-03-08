-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClientTeamMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientTeamId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "executiveId" INTEGER,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ClientTeamMember_clientTeamId_fkey" FOREIGN KEY ("clientTeamId") REFERENCES "ClientTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientTeamMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientTeamMember_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "Executive" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClientTeamMember" ("clientTeamId", "id", "memberId", "order", "role") SELECT "clientTeamId", "id", "memberId", "order", "role" FROM "ClientTeamMember";
DROP TABLE "ClientTeamMember";
ALTER TABLE "new_ClientTeamMember" RENAME TO "ClientTeamMember";
CREATE UNIQUE INDEX "ClientTeamMember_clientTeamId_memberId_key" ON "ClientTeamMember"("clientTeamId", "memberId");
CREATE UNIQUE INDEX "ClientTeamMember_clientTeamId_executiveId_key" ON "ClientTeamMember"("clientTeamId", "executiveId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
