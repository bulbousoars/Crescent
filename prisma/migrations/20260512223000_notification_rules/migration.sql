-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT '',
    "recipientEmail" TEXT NOT NULL,
    "minMonthlyCf" INTEGER,
    "maxMonthlyCf" INTEGER,
    "minCapRate" DOUBLE PRECISION,
    "maxCapRate" DOUBLE PRECISION,
    "minPricePerSqft" DOUBLE PRECISION,
    "maxPricePerSqft" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_ruleId_listingId_analysisId_key" ON "NotificationLog"("ruleId", "listingId", "analysisId");

-- CreateIndex
CREATE INDEX "NotificationLog_listingId_idx" ON "NotificationLog"("listingId");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
