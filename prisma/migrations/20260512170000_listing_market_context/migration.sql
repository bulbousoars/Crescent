-- CreateTable
CREATE TABLE "ListingMarketContext" (
    "listingId" TEXT NOT NULL,
    "rentCompSummary" TEXT NOT NULL DEFAULT '',
    "neighborhoodTags" TEXT NOT NULL DEFAULT '',
    "floodZoneNote" TEXT NOT NULL DEFAULT '',
    "schoolTierNote" TEXT NOT NULL DEFAULT '',
    "rentControlNote" TEXT NOT NULL DEFAULT '',
    "hoaSpecialAssessmentNote" TEXT NOT NULL DEFAULT '',
    "macroStressNotes" TEXT NOT NULL DEFAULT '',
    "propertyTaxMonthlyOverride" INTEGER,
    "insuranceMonthlyOverride" INTEGER,
    "userNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingMarketContext_pkey" PRIMARY KEY ("listingId")
);

ALTER TABLE "ListingMarketContext" ADD CONSTRAINT "ListingMarketContext_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
