import { describe, expect, it } from 'vitest';
import {
  buildListingOrderBy,
  dataListingHref,
  hrefForSortedColumn,
  normalizeListingSort,
} from '@/lib/listingSort';

describe('normalizeListingSort', () => {
  it('defaults to no column and asc when missing', () => {
    expect(normalizeListingSort({})).toEqual({ column: null, dir: 'asc' });
  });

  it('accepts known column and desc', () => {
    expect(normalizeListingSort({ sort: 'price', sortDir: 'desc' })).toEqual({
      column: 'price',
      dir: 'desc',
    });
  });

  it('rejects unknown sort column', () => {
    expect(normalizeListingSort({ sort: 'hax', sortDir: 'desc' })).toEqual({ column: null, dir: 'desc' });
  });
});

describe('buildListingOrderBy', () => {
  it('uses ingestedAt for computed columns', () => {
    expect(buildListingOrderBy('monthlyCf', 'asc')[0]).toEqual({ ingestedAt: 'desc' });
  });

  it('orders by price', () => {
    expect(buildListingOrderBy('price', 'asc')[0]).toEqual({ price: 'asc' });
  });
});

describe('dataListingHref', () => {
  it('toggles sort on same column', () => {
    const base = { status: 'NEW', sort: 'price', sortDir: 'asc' };
    expect(hrefForSortedColumn(base, 'price')).toBe('/data?status=NEW&sort=price&sortDir=desc');
    expect(hrefForSortedColumn(base, 'city')).toBe('/data?status=NEW&sort=city&sortDir=asc');
  });

  it('builds data URL from params', () => {
    expect(dataListingHref({ state: 'NJ' }, { sort: 'price', sortDir: 'asc' })).toBe(
      '/data?state=NJ&sort=price&sortDir=asc',
    );
  });
});
