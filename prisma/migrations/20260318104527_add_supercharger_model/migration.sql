-- CreateTable
CREATE TABLE "Supercharger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "function" TEXT NOT NULL DEFAULT 'Supercharger',
    "email" TEXT,
    "phone" TEXT,
    "birthDate" DATETIME,
    "photo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineIndex
DROP INDEX "Admin_username_key";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
