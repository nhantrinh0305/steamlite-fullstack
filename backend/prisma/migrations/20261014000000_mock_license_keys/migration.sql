-- Preserve existing ownership records and assign each one a demo key.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LibraryItem" (
    "LibraryItemID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "licenseKey" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("UserID") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("GameID") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LibraryItem" ("LibraryItemID", "userId", "gameId", "purchasedAt", "licenseKey")
SELECT "LibraryItemID", "userId", "gameId", "purchasedAt",
    'DEMO-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2))
FROM "LibraryItem";
DROP TABLE "LibraryItem";
ALTER TABLE "new_LibraryItem" RENAME TO "LibraryItem";
CREATE UNIQUE INDEX "LibraryItem_userId_gameId_key" ON "LibraryItem"("userId", "gameId");
CREATE UNIQUE INDEX "LibraryItem_licenseKey_key" ON "LibraryItem"("licenseKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
