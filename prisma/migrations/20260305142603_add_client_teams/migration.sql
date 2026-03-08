-- CreateTable
CREATE TABLE "ClientTeam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "executiveId" INTEGER,
    CONSTRAINT "ClientTeam_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "Executive" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientTeamMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientTeamId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ClientTeamMember_clientTeamId_fkey" FOREIGN KEY ("clientTeamId") REFERENCES "ClientTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientTeamMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "clientTeamId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Client_clientTeamId_fkey" FOREIGN KEY ("clientTeamId") REFERENCES "ClientTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientTeamMember_clientTeamId_memberId_key" ON "ClientTeamMember"("clientTeamId", "memberId");
