import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { chooseAssumptionProfile } from '@/lib/assumptionProfiles';
import { calculateListingAnalysis } from '@/lib/analysis';
import { defaultAssumptions } from '@/lib/defaultAssumptions';
import { rowsToCsv } from '@/lib/csv';
import { buildListingWhere, normalizeListingFilters, type RawListingFilters } from '@/lib/listingFilters';
import { prisma } from '@/lib/prisma';

const HEADERS = [
  'Full address',
  'ZIP',
  'Date added (UTC)',
  'Status',
  'Price',
  'State',
  'City',
  'Beds',
  'Baths',
  'Sq ft',
  'HOA monthly',
  'Monthly cash flow',
  'Cap rate',
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
  };

  const filters = normalizeListingFilters(raw);
  const where = buildListingWhere(filters) as Prisma.ListingWhereInput;

  const [listings, assumptions] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        pipeline: true,
        analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
      },
      orderBy: { ingestedAt: 'desc' },
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

  const rows: Array<Array<string | number | null | undefined>> = [Array.from(HEADERS)];

  for (const listing of listings) {
    const snapshot = listing.analysis[0];
    const rowAnalysis = profile
      ? calculateListingAnalysis({
          listing: { price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly },
          assumptions: profile,
          rent: { hudFmrSelected: snapshot?.hudFmrSelected ?? 0, hudMetro: snapshot?.hudMetro ?? '' },
        })
      : null;

    const status = listing.pipeline?.status ?? 'NEW';
    rows.push([
      listing.address,
      listing.zip,
      listing.ingestedAt.toISOString(),
      status,
      listing.price,
      listing.state,
      listing.city,
      listing.beds,
      listing.baths,
      listing.sqft,
      listing.hoaMonthly,
      rowAnalysis ? rowAnalysis.monthlyCf : '',
      rowAnalysis ? rowAnalysis.capRate : '',
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
