import { describe, expect, it } from 'vitest';
import { buildListingWhere, normalizeListingFilters } from '@/lib/listingFilters';

describe('listing filters', () => {
  it('normalizes address, location, price, bed, bath, and sqft filters', () => {
    const filters = normalizeListingFilters({
      listingId: 'listing-1',
      state: ' tx ',
      city: ' San Antonio ',
      minPrice: '150000',
      maxPrice: '300000',
      minBeds: '3',
      minBaths: '2',
      minSqft: '1200',
      status: 'KEEP',
    });

    expect(filters).toEqual({
      listingId: 'listing-1',
      state: 'TX',
      city: 'San Antonio',
      minPrice: 150000,
      maxPrice: 300000,
      minBeds: 3,
      minBaths: 2,
      minSqft: 1200,
      status: 'KEEP',
    });
  });

  it('builds a Prisma-compatible where object for active filters', () => {
    const where = buildListingWhere({
      state: 'TX',
      city: 'San Antonio',
      minPrice: 150000,
      maxPrice: 300000,
      minBeds: 3,
      minBaths: 2,
      minSqft: 1200,
      status: 'REVIEW',
    });

    expect(where).toEqual({
      state: 'TX',
      city: { contains: 'San Antonio', mode: 'insensitive' },
      price: { gte: 150000, lte: 300000 },
      beds: { gte: 3 },
      baths: { gte: 2 },
      sqft: { gte: 1200 },
      pipeline: { status: 'REVIEW' },
    });
  });
});
