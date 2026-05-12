import type { PrismaClient } from '@prisma/client';
import { calculateListingAnalysis } from '../analysis';
import { fetchMedianHouseholdIncomeForZip } from './censusAcsIncome';
import { fetchCountyFromCensusGeocoder } from './censusGeocoder';
import { fetchHudCountyFmr } from './hudFmr';
import { incomeToNeighborhoodContextScore } from './neighborhoodContext';
import { fetchRentcastLongTermRent } from './rentcastRent';

export async function enrichListingById(prisma: PrismaClient, listingId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return { ok: false, error: 'listing not found' };

    const assumptions =
      (await prisma.assumptionSet.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: 'desc' } })) ??
      (await prisma.assumptionSet.findFirst({ orderBy: { createdAt: 'asc' } }));
    if (!assumptions) return { ok: false, error: 'no assumption set' };

    const countyMatch = await fetchCountyFromCensusGeocoder(listing.city, listing.state, listing.zip);

    const [hud, rentcast, income] = await Promise.all([
      fetchHudCountyFmr({ state: listing.state, countyMatch, bedrooms: Math.floor(listing.beds) }),
      fetchRentcastLongTermRent({
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        bedrooms: listing.beds,
        propertyType: listing.propertyType,
      }),
      fetchMedianHouseholdIncomeForZip(listing.zip),
    ]);

    const hudAmt = hud?.amount ?? 0;
    const hudMetro = hud?.label ?? '';
    const rcEst = rentcast?.rent ?? 0;
    const contextScore = incomeToNeighborhoodContextScore(income);

    const computed = calculateListingAnalysis({
      listing: { price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly },
      assumptions,
      rent: {
        hudFmrSelected: hudAmt,
        hudMetro,
        rentcastEst: rcEst,
      },
    });

    await prisma.$transaction([
      prisma.listing.update({
        where: { id: listingId },
        data: {
          censusMedianHouseholdIncome: income,
          neighborhoodContextScore: contextScore,
          enrichmentFetchedAt: new Date(),
        },
      }),
      prisma.listingAnalysis.create({
        data: {
          listingId,
          assumptionSetId: assumptions.id,
          rentUsed: computed.rentUsed,
          rentSource: computed.rentSource,
          hudFmrSelected: hudAmt,
          hudMetro,
          zillowZestimate: listing.rentZestimateMonthly ?? 0,
          rentcastEst: rentcast?.rent ?? 0,
          rentcastLow: rentcast?.low ?? 0,
          rentcastHigh: rentcast?.high ?? 0,
          pAndI: computed.pAndI,
          propertyTaxMonthly: computed.propertyTaxMonthly,
          insuranceMonthly: computed.insuranceMonthly,
          totalExpensesMonthly: computed.totalExpensesMonthly,
          monthlyCf: computed.monthlyCf,
          annualCf: computed.annualCf,
          afterTaxCf: computed.afterTaxCf,
          noi: computed.noi,
          capRate: computed.capRate,
          cashOnCash: computed.cashOnCash,
          cashRequired: computed.cashRequired,
          equity5yr: computed.equity5yr,
          tag: computed.tag,
          criteriaPass: computed.tag === 'CASH FLOW',
          criteriaFailReasons: '',
        },
      }),
    ]);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'enrichment failed' };
  }
}
