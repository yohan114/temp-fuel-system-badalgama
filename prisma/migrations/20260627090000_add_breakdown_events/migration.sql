-- CreateTable
CREATE TABLE "BreakdownEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,
    "startedById" TEXT,
    "resolvedById" TEXT,
    CONSTRAINT "BreakdownEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BreakdownEvent_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BreakdownEvent_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BreakdownEvent_assetId_resolvedAt_idx" ON "BreakdownEvent"("assetId", "resolvedAt");

-- CreateIndex
CREATE INDEX "BreakdownEvent_startedAt_idx" ON "BreakdownEvent"("startedAt");
