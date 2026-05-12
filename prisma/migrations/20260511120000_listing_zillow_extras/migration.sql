-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "rentZestimateMonthly" INTEGER,
ADD COLUMN     "estimatedPaymentMonthly" INTEGER,
ADD COLUMN     "estimatedPAndIMonthly" INTEGER,
ADD COLUMN     "estimatedPropertyTaxMonthly" INTEGER,
ADD COLUMN     "estimatedInsuranceMonthly" INTEGER,
ADD COLUMN     "previousListPrice" INTEGER,
ADD COLUMN     "propertyType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mlsNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "daysOnZillow" INTEGER;
