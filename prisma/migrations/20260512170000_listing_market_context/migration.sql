-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "linkedListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerContact_name_idx" ON "PartnerContact"("name");

CREATE INDEX "PartnerContact_linkedListingId_idx" ON "PartnerContact"("linkedListingId");

ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_linkedListingId_fkey" FOREIGN KEY ("linkedListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
