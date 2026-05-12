/**
 * Single coarse neighborhood "context" score from median household income.
 * Higher = more economic stress in the ZCTA (not literal crime / FBI data).
 */
export function incomeToNeighborhoodContextScore(medianIncome: number | null): number | null {
  if (medianIncome == null || !Number.isFinite(medianIncome) || medianIncome <= 0) return null;
  if (medianIncome < 35_000) return 82;
  if (medianIncome < 55_000) return 64;
  if (medianIncome < 75_000) return 48;
  if (medianIncome < 100_000) return 32;
  if (medianIncome < 130_000) return 18;
  return 8;
}
