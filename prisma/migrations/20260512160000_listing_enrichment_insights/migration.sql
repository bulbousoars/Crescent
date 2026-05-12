-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "censusMedianHouseholdIncome" INTEGER,
ADD COLUMN     "neighborhoodContextScore" DOUBLE PRECISION,
ADD COLUMN     "enrichmentFetchedAt" TIMESTAMP(3);
