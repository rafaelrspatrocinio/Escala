-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "ministryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" DATETIME,
    "notificationError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleSlot_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleSlot" ("createdAt", "eventId", "id", "ministryId", "status", "userId") SELECT "createdAt", "eventId", "id", "ministryId", "status", "userId" FROM "ScheduleSlot";
DROP TABLE "ScheduleSlot";
ALTER TABLE "new_ScheduleSlot" RENAME TO "ScheduleSlot";
CREATE UNIQUE INDEX "ScheduleSlot_eventId_ministryId_userId_key" ON "ScheduleSlot"("eventId", "ministryId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
