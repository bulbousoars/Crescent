import { PrismaClient } from '@prisma/client';
import { calculateListingAnalysis } from '../src/lib/analysis';

const prisma = new PrismaClient();

async function main() {
  const assumptions = await prisma.assumptionSet.upsert({
    where: { id: 'default-assumptions' },
    create: {
      id: 'default-assumptions',
      name: 'Default underwriting',
      isDefault: true,
    },
    update: {
      isDefault: true,
    },
  });

  const listing = await prisma.listing.upsert({
    where: { zpid: 'seed-08102' },
    create: {
      externalListingId: 'seed-08102',
      zpid: 'seed-08102',
      listingUrl: 'https://www.zillow.com/homedetails/seed-08102_zpid/',
      address: '10 Market St, Camden, NJ 08102',
      city: 'Camden',
      state: 'NJ',
      zip: '08102',
      price: 175000,
      priceCut: 5000,
      beds: 3,
      baths: 2,
      sqft: 1280,
      hoaMonthly: 75,
      notificationType: 'New Listing',
      searchName: 'South Jersey rentals',
      sourceMessageId: 'seed-message',
      sourceThreadId: 'seed-thread',
      rawPayloadJson: { seed: true },
    },
    update: {},
  });

  await prisma.listingPipeline.upsert({
    where: { listingId: listing.id },
    create: {
      listingId: listing.id,
      status: 'REVIEW',
      manualNotes: 'Seed listing for local UI verification.',
    },
    update: {},
  });

  const analysis = calculateListingAnalysis({
    listing: {
      price: listing.price,
      state: listing.state,
      hoaMonthly: listing.hoaMonthly,
    },
    assumptions,
    rent: {
      hudFmrSelected: 2200,
      hudMetro: 'Philadelphia-Camden-Wilmington',
    },
  });

  await prisma.listingAnalysis.create({
    data: {
      listingId: listing.id,
      assumptionSetId: assumptions.id,
      rentUsed: analysis.rentUsed,
      rentSource: analysis.rentSource,
      hudFmrSelected: 2200,
      hudMetro: 'Philadelphia-Camden-Wilmington',
      pAndI: analysis.pAndI,
      propertyTaxMonthly: analysis.propertyTaxMonthly,
      insuranceMonthly: analysis.insuranceMonthly,
      totalExpensesMonthly: analysis.totalExpensesMonthly,
      monthlyCf: analysis.monthlyCf,
      annualCf: analysis.annualCf,
      afterTaxCf: analysis.afterTaxCf,
      noi: analysis.noi,
      capRate: analysis.capRate,
      cashOnCash: analysis.cashOnCash,
      cashRequired: analysis.cashRequired,
      equity5yr: analysis.equity5yr,
      tag: analysis.tag,
      criteriaPass: analysis.tag !== 'PASS',
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
