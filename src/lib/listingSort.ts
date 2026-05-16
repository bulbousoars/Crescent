import type { Prisma } from '@prisma/client';
import type { AnalysisInput } from '@/lib/analysis';
import { computeListingRowAnalysis } from '@/lib/listingRowAnalysis';

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
  'rentUsed',
  'hudFmrSelected',
  'rentcastEst',
  'uwPAndI',
  'uwPropertyTax',
  'uwInsurance',
  'totalExpensesMonthly',
  'monthlyCf',
  'capRate',
  'cashOnCash',
  'noi',
  'cashRequired',
  'equity5yr',
  'dscr',
  'tag',
  'listingUrl',
] as const;

export type ListingSortColumn = (typeof LISTING_SORT_COLUMNS)[number];

const COLUMN_SET = new Set<string>(LISTING_SORT_COLUMNS);

export const COMPUTED_SORT_COLUMNS = [
  'rentUsed',
  'uwPAndI',
  'uwPropertyTax',
  'uwInsurance',
  'totalExpensesMonthly',
  'monthlyCf',
  'capRate',
  'cashOnCash',
  'noi',
  'cashRequired',
  'equity5yr',
  'dscr',
  'tag',
] as const;

export type ComputedSortColumn = (typeof COMPUTED_SORT_COLUMNS)[number];

const SNAPSHOT_SORT_COLUMNS = ['hudFmrSelected', 'rentcastEst'] as const;
type SnapshotSortColumn = (typeof SNAPSHOT_SORT_COLUMNS)[number];

export type InMemorySortColumn = ComputedSortColumn | SnapshotSortColumn;

const IN_MEMORY_SORT_SET = new Set<string>([...COMPUTED_SORT_COLUMNS, ...SNAPSHOT_SORT_COLUMNS]);

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

export function isComputedSortColumn(column: ListingSortColumn | null): column is InMemorySortColumn {
  return column != null && IN_MEMORY_SORT_SET.has(column);
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

function compareStrings(a: string, b: string, dir: 'asc' | 'desc'): number {
  const cmp = a.localeCompare(b);
  return dir === 'asc' ? cmp : -cmp;
}

type ListingRowForComputedSort = {
  id: string;
  price: number;
  state: string;
  hoaMonthly: number;
  analysis: { hudFmrSelected: number; hudMetro: string; rentcastEst: number }[];
  marketContext?: {
    propertyTaxMonthlyOverride: number | null;
    insuranceMonthlyOverride: number | null;
  } | null;
};

function sortKeyForComputedColumn(
  column: ComputedSortColumn,
  rowAnalysis: NonNullable<ReturnType<typeof computeListingRowAnalysis>>,
): number | string {
  switch (column) {
    case 'rentUsed':
      return rowAnalysis.rentUsed;
    case 'uwPAndI':
      return rowAnalysis.pAndI;
    case 'uwPropertyTax':
      return rowAnalysis.propertyTaxMonthly;
    case 'uwInsurance':
      return rowAnalysis.insuranceMonthly;
    case 'totalExpensesMonthly':
      return rowAnalysis.totalExpensesMonthly;
    case 'monthlyCf':
      return rowAnalysis.monthlyCf;
    case 'capRate':
      return rowAnalysis.capRate;
    case 'cashOnCash':
      return rowAnalysis.cashOnCash;
    case 'noi':
      return rowAnalysis.noi;
    case 'cashRequired':
      return rowAnalysis.cashRequired;
    case 'equity5yr':
      return rowAnalysis.equity5yr;
    case 'dscr':
      return rowAnalysis.dscr ?? -1;
    case 'tag':
      return rowAnalysis.tag;
    default:
      return 0;
  }
}

function snapshotSortValue(column: SnapshotSortColumn, snapshot: ListingRowForComputedSort['analysis'][0]) {
  if (!snapshot) return null;
  return column === 'hudFmrSelected' ? snapshot.hudFmrSelected : snapshot.rentcastEst;
}

export function sortListingsByComputedColumn<T extends ListingRowForComputedSort>(
  listings: T[],
  column: InMemorySortColumn,
  dir: 'asc' | 'desc',
  profile: AssumptionsInput | null,
): T[] {
  if (column === 'hudFmrSelected' || column === 'rentcastEst') {
    const decorated = listings.map((l) => ({
      row: l,
      key: snapshotSortValue(column, l.analysis[0]),
    }));
    decorated.sort((a, b) => compareNullableNumbers(a.key, b.key, dir));
    return decorated.map((d) => d.row);
  }

  if (!profile) return [...listings];

  const decorated = listings.map((l) => {
    const snapshot = l.analysis[0];
    const rowAnalysis = computeListingRowAnalysis(
      { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly },
      snapshot,
      profile,
      l.marketContext,
    );
    return {
      row: l,
      key: rowAnalysis ? sortKeyForComputedColumn(column, rowAnalysis) : null,
    };
  });

  decorated.sort((a, b) => {
    if (column === 'tag') {
      return compareStrings(String(a.key ?? ''), String(b.key ?? ''), dir);
    }
    return compareNullableNumbers(
      typeof a.key === 'number' ? a.key : null,
      typeof b.key === 'number' ? b.key : null,
      dir,
    );
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
