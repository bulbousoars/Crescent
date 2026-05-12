import type { Prisma } from '@prisma/client';
import { calculateListingAnalysis } from '@/lib/analysis';
import type { AnalysisInput } from '@/lib/analysis';

type AssumptionsInput = AnalysisInput['assumptions'];

export const LISTING_SORT_COLUMNS = [
  'address',
  'ingestedAt',
  'status',
  'price',
  'previousListPrice',
  'state',
  'city',
  'beds',
  'baths',
  'sqft',
  'yearBuilt',
  'lotSize',
  'hoaMonthly',
  'propertyType',
  'mlsNumber',
  'daysOnZillow',
  'rentZestimateMonthly',
  'estimatedPaymentMonthly',
  'estimatedPAndIMonthly',
  'estimatedPropertyTaxMonthly',
  'estimatedInsuranceMonthly',
  'monthlyCf',
  'capRate',
  'listingUrl',
] as const;

export type ListingSortColumn = (typeof LISTING_SORT_COLUMNS)[number];

const COLUMN_SET = new Set<string>(LISTING_SORT_COLUMNS);

export function isListingSortColumn(value: string): value is ListingSortColumn {
  return COLUMN_SET.has(value);
}

export function normalizeListingSort(raw: { sort?: string; sortDir?: string }): {
  column: ListingSortColumn | null;
  dir: 'asc' | 'desc';
} {
  const dir = raw.sortDir === 'desc' ? 'desc' : 'asc';
  const s = raw.sort?.trim();
  const column = s && isListingSortColumn(s) ? s : null;
  return { column, dir };
}

export function isComputedSortColumn(column: ListingSortColumn | null): column is 'monthlyCf' | 'capRate' {
  return column === 'monthlyCf' || column === 'capRate';
}

/** DB-only order; computed columns fall back until in-memory sort is applied. */
export function buildListingOrderBy(
  column: ListingSortColumn | null,
  dir: 'asc' | 'desc',
): Prisma.ListingOrderByWithRelationInput[] {
  if (!column || isComputedSortColumn(column)) {
    return [{ ingestedAt: 'desc' }, { id: 'asc' }];
  }
  const tie = { id: 'asc' as const };
  switch (column) {
    case 'status':
      return [{ pipeline: { status: dir } }, tie];
    case 'address':
    case 'ingestedAt':
    case 'price':
    case 'previousListPrice':
    case 'state':
    case 'city':
    case 'beds':
    case 'baths':
    case 'sqft':
    case 'yearBuilt':
    case 'lotSize':
    case 'hoaMonthly':
    case 'propertyType':
    case 'mlsNumber':
    case 'daysOnZillow':
    case 'rentZestimateMonthly':
    case 'estimatedPaymentMonthly':
    case 'estimatedPAndIMonthly':
    case 'estimatedPropertyTaxMonthly':
    case 'estimatedInsuranceMonthly':
    case 'listingUrl':
      return [{ [column]: dir }, tie];
    default:
      return [{ ingestedAt: 'desc' }, tie];
  }
}

function compareNullableNumbers(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp = a - b;
  return dir === 'asc' ? cmp : -cmp;
}

type ListingRowForComputedSort = {
  id: string;
  price: number;
  state: string;
  hoaMonthly: number;
  analysis: { hudFmrSelected: number; hudMetro: string; rentcastEst: number }[];
};

export function sortListingsByComputedColumn<T extends ListingRowForComputedSort>(
  listings: T[],
  column: 'monthlyCf' | 'capRate',
  dir: 'asc' | 'desc',
  profile: AssumptionsInput | null,
): T[] {
  if (!profile) return [...listings];

  const decorated = listings.map((l) => {
    const snapshot = l.analysis[0];
    const rowAnalysis = calculateListingAnalysis({
      listing: { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly },
      assumptions: profile,
      rent: {
        hudFmrSelected: snapshot?.hudFmrSelected ?? 0,
        hudMetro: snapshot?.hudMetro ?? '',
        rentcastEst: snapshot?.rentcastEst ?? 0,
      },
    });
    return {
      row: l,
      monthlyCf: rowAnalysis.monthlyCf,
      capRate: rowAnalysis.capRate,
    };
  });

  decorated.sort((a, b) => {
    if (column === 'monthlyCf') {
      return compareNullableNumbers(a.monthlyCf, b.monthlyCf, dir);
    }
    return compareNullableNumbers(a.capRate, b.capRate, dir);
  });

  return decorated.map((d) => d.row);
}

export function serializeListingDataQuery(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.trim()) q.set(k, v);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === 'string' && v.trim()) q.set(k, v);
    else q.delete(k);
  }
  return q.toString();
}

export function dataListingHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
): string {
  const qs = serializeListingDataQuery(params, updates);
  return qs ? `/data?${qs}` : '/data';
}

export function hrefForSortedColumn(
  params: Record<string, string | undefined>,
  column: ListingSortColumn,
): string {
  if (params.sort === column) {
    const cur = params.sortDir === 'desc' ? 'desc' : 'asc';
    return dataListingHref(params, { sort: column, sortDir: cur === 'asc' ? 'desc' : 'asc' });
  }
  return dataListingHref(params, { sort: column, sortDir: 'asc' });
}
