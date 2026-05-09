import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { buildListingWhere, normalizeListingFilters } from '@/lib/listingFilters';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filters = normalizeListingFilters({
    listingId: searchParams.get('listingId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    state: searchParams.get('state') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    minPrice: searchParams.get('minPrice') ?? undefined,
    maxPrice: searchParams.get('maxPrice') ?? undefined,
    minBeds: searchParams.get('minBeds') ?? undefined,
    minBaths: searchParams.get('minBaths') ?? undefined,
    minSqft: searchParams.get('minSqft') ?? undefined,
  });

  const listings = await prisma.listing.findMany({
    where: buildListingWhere(filters) as Prisma.ListingWhereInput,
    include: {
      pipeline: true,
      analysis: {
        orderBy: { computedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { ingestedAt: 'desc' },
    take: 250,
  });

  return NextResponse.json({ listings });
}
