import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { chooseAssumptionProfile } from '@/lib/assumptionProfiles';
import { defaultAssumptions } from '@/lib/defaultAssumptions';
import { rowsToCsv } from '@/lib/csv';
import { buildListingWhere, normalizeListingFilters, type RawListingFilters } from '@/lib/listingFilters';
import {
  buildListingOrderBy,
  isComputedSortColumn,
  normalizeListingSort,
  sortListingsByComputedColumn,
} from '@/lib/listingSort';
import { computeListingRowAnalysis } from '@/lib/listingRowAnalysis';
import { prisma } from '@/lib/prisma';

const HEADERS = [
  'Full address',
  'ZIP',
  'Date added (UTC)',
  'Status',
  'Price',
  'Previous list price',
  'State',
  'City',
  'Beds',
  'Baths',
  'Sq ft',
  'Year built',
  'Lot size',
  'HOA monthly',
  'Property type',
  'MLS',
  'Days on Zillow',
  'Rent Zestimate (mo)',
  'Est. payment (mo)',
  'Est. P&I (mo)',
  'Est. property tax (mo)',
  'Est. insurance (mo)',
  'UW rent used',
  'HUD FMR',
  'Rentcast est.',
  'UW P&I (mo)',
  'UW property tax (mo)',
  'UW insurance (mo)',
  'UW total expenses (mo)',
  'Monthly cash flow',
  'Cap rate',
  'Cash-on-cash',
  'NOI',
  'Down payment',
  'Cash required',
  '5-year equity',
  'DSCR',
  'Tag',
  'Zillow URL',
  'Listing id',
] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw: RawListingFilters & { assumptionId?: string } = {
    listingId: searchParams.get('listingId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    state: searchParams.get('state') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    minPrice: searchParams.get('minPrice') ?? undefined,
    maxPrice: searchParams.get('maxPrice') ?? undefined,
    minBeds: searchParams.get('minBeds') ?? undefined,
    minBaths: searchParams.get('minBaths') ?? undefined,
    minSqft: searchParams.get('minSqft') ?? undefined,
    assumptionId: searchParams.get('assumptionId') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    sortDir: searchParams.get('sortDir') ?? undefined,
  };

  const filters = normalizeListingFilters(raw);
  const where = buildListingWhere(filters) as Prisma.ListingWhereInput;
  const sortState = normalizeListingSort(raw);
  const orderBy = buildListingOrderBy(sortState.column, sortState.dir) as Prisma.ListingOrderByWithRelationInput[];

  const [listingsRaw, assumptions] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        pipeline: true,
        marketContext: true,
        analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
      },
      orderBy,
      take: 10_000,
    }),
    prisma.assumptionSet.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ]);

  const fallbackProfile = {
    id: 'default',
    isDefault: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...defaultAssumptions,
  };
  const profile = chooseAssumptionProfile(
    assumptions.length > 0 ? assumptions : [fallbackProfile],
    raw.assumptionId,
  );

  let listings = listingsRaw;
  if (profile && sortState.column && isComputedSortColumn(sortState.column)) {
    listings = sortListingsByComputedColumn(listings, sortState.column, sortState.dir, profile);
  }

  const rows: Array<Array<string | number | null | undefined>> = [Array.from(HEADERS)];

  for (const listing of listings) {
    const snapshot = listing.analysis[0];
    const rowAnalysis = profile
      ? computeListingRowAnalysis(
          { price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly },
          snapshot,
          profile,
          listing.marketContext,
        )
      : null;

    const status = listing.pipeline?.status ?? 'NEW';
    rows.push([
      listing.address,
      listing.zip,
      listing.ingestedAt.toISOString(),
      status,
      listing.price,
      listing.previousListPrice ?? '',
      listing.state,
      listing.city,
      listing.beds,
      listing.baths,
      listing.sqft,
      listing.yearBuilt,
      listing.lotSize,
      listing.hoaMonthly,
      listing.propertyType,
      listing.mlsNumber,
      listing.daysOnZillow ?? '',
      listing.rentZestimateMonthly ?? '',
      listing.estimatedPaymentMonthly ?? '',
      listing.estimatedPAndIMonthly ?? '',
      listing.estimatedPropertyTaxMonthly ?? '',
      listing.estimatedInsuranceMonthly ?? '',
      rowAnalysis?.rentUsed ?? '',
      snapshot?.hudFmrSelected ?? '',
      snapshot?.rentcastEst ?? '',
      rowAnalysis?.pAndI ?? '',
      rowAnalysis?.propertyTaxMonthly ?? '',
      rowAnalysis?.insuranceMonthly ?? '',
      rowAnalysis?.totalExpensesMonthly ?? '',
      rowAnalysis?.monthlyCf ?? '',
      rowAnalysis?.capRate ?? '',
      rowAnalysis?.cashOnCash ?? '',
      rowAnalysis?.noi ?? '',
      rowAnalysis?.downPayment ?? '',
      rowAnalysis?.cashRequired ?? '',
      rowAnalysis?.equity5yr ?? '',
      rowAnalysis?.dscr ?? '',
      rowAnalysis?.tag ?? '',
      listing.listingUrl,
      listing.id,
    ]);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const body = `\uFEFF${rowsToCsv(rows)}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="crescent-listings-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
