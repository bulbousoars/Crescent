-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('NEW', 'REVIEW', 'KEEP', 'DECLINED', 'OFFER', 'UNDER_CONTRACT', 'CLOSED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL DEFAULT 'zillow_email',
    "externalListingId" TEXT,
    "zpid" TEXT,
    "listingUrl" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "priceCut" INTEGER NOT NULL DEFAULT 0,
    "beds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sqft" INTEGER NOT NULL DEFAULT 0,
    "hoaMonthly" INTEGER NOT NULL DEFAULT 0,
    "yearBuilt" TEXT NOT NULL DEFAULT '',
    "lotSize" TEXT NOT NULL DEFAULT '',
    "notificationType" TEXT NOT NULL DEFAULT 'Unknown',
    "searchName" TEXT NOT NULL DEFAULT '',
    "sourceMessageId" TEXT NOT NULL DEFAULT '',
    "sourceThreadId" TEXT NOT NULL DEFAULT '',
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "rawPayloadJson" JSONB,
    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingAnalysis" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "assumptionSetId" TEXT,
    "rentUsed" INTEGER NOT NULL,
    "rentSource" TEXT NOT NULL,
    "hudFmrSelected" INTEGER NOT NULL DEFAULT 0,
    "hudMetro" TEXT NOT NULL DEFAULT '',
    "zillowZestimate" INTEGER NOT NULL DEFAULT 0,
    "rentcastEst" INTEGER NOT NULL DEFAULT 0,
    "rentcastLow" INTEGER NOT NULL DEFAULT 0,
    "rentcastHigh" INTEGER NOT NULL DEFAULT 0,
    "pAndI" INTEGER NOT NULL,
    "propertyTaxMonthly" INTEGER NOT NULL,
    "insuranceMonthly" INTEGER NOT NULL,
    "totalExpensesMonthly" INTEGER NOT NULL,
    "monthlyCf" INTEGER NOT NULL,
    "annualCf" INTEGER NOT NULL,
    "afterTaxCf" INTEGER NOT NULL,
    "noi" INTEGER NOT NULL,
    "capRate" DOUBLE PRECISION NOT NULL,
    "cashOnCash" DOUBLE PRECISION NOT NULL,
    "cashRequired" INTEGER NOT NULL,
    "equity5yr" INTEGER NOT NULL,
    "tag" TEXT NOT NULL,
    "criteriaPass" BOOLEAN NOT NULL DEFAULT false,
    "criteriaFailReasons" TEXT NOT NULL DEFAULT '',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPipeline" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'NEW',
    "manualDecision" TEXT NOT NULL DEFAULT '',
    "manualNotes" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ListingPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssumptionSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "downPaymentPct" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0.07,
    "loanTermYears" INTEGER NOT NULL DEFAULT 30,
    "vacancyPct" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "maintenancePct" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "propertyMgmtPct" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "insuranceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.006,
    "closingCostPct" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "rentMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.007,
    "appreciationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "maxHoa" INTEGER NOT NULL DEFAULT 300,
    "minPrice" INTEGER NOT NULL DEFAULT 50000,
    "minBeds" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "minBaths" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "minSqft" INTEGER NOT NULL DEFAULT 800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssumptionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'STARTED',
    "payloadJson" JSONB,
    "resultJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_zpid_key" ON "Listing"("zpid");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_listingUrl_key" ON "Listing"("listingUrl");

-- CreateIndex
CREATE INDEX "Listing_state_city_idx" ON "Listing"("state", "city");

-- CreateIndex
CREATE INDEX "Listing_notificationType_idx" ON "Listing"("notificationType");

-- CreateIndex
CREATE INDEX "Listing_ingestedAt_idx" ON "Listing"("ingestedAt");

-- CreateIndex
CREATE INDEX "ListingAnalysis_listingId_idx" ON "ListingAnalysis"("listingId");

-- CreateIndex
CREATE INDEX "ListingAnalysis_tag_idx" ON "ListingAnalysis"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ListingPipeline_listingId_key" ON "ListingPipeline"("listingId");

-- CreateIndex
CREATE INDEX "ListingEvent_listingId_idx" ON "ListingEvent"("listingId");

-- CreateIndex
CREATE INDEX "ListingEvent_eventType_idx" ON "ListingEvent"("eventType");

-- AddForeignKey
ALTER TABLE "ListingAnalysis" ADD CONSTRAINT "ListingAnalysis_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAnalysis" ADD CONSTRAINT "ListingAnalysis_assumptionSetId_fkey" FOREIGN KEY ("assumptionSetId") REFERENCES "AssumptionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPipeline" ADD CONSTRAINT "ListingPipeline_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEvent" ADD CONSTRAINT "ListingEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
