-- CreateTable
CREATE TABLE "BulkTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fuelKind" TEXT NOT NULL,
    "litres" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromTankId" TEXT,
    "toTankId" TEXT,
    "actorId" TEXT,
    CONSTRAINT "BulkTransfer_fromTankId_fkey" FOREIGN KEY ("fromTankId") REFERENCES "BulkTank" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BulkTransfer_toTankId_fkey" FOREIGN KEY ("toTankId") REFERENCES "BulkTank" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BulkTransfer_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BulkTransfer_toTankId_createdAt_idx" ON "BulkTransfer"("toTankId", "createdAt");

-- CreateIndex
CREATE INDEX "BulkTransfer_fromTankId_createdAt_idx" ON "BulkTransfer"("fromTankId", "createdAt");
