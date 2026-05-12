import type { CountyMatch } from './censusGeocoder';

type HudCountyRow = Record<string, string | number | undefined> & {
  code?: string;
  name?: string;
  Efficiency?: string | number;
  'One-Bedroom'?: string | number;
  'Two-Bedroom'?: string | number;
  'Three-Bedroom'?: string | number;
  'Four-Bedroom'?: string | number;
};

function parseMoney(v: string | number | undefined): number {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function columnForBeds(beds: number): keyof HudCountyRow {
  if (beds <= 0) return 'Efficiency';
  if (beds <= 1) return 'One-Bedroom';
  if (beds <= 2) return 'Two-Bedroom';
  if (beds <= 3) return 'Three-Bedroom';
  return 'Four-Bedroom';
}

function countyGeoid(match: CountyMatch): string {
  return `${match.stateFips}${match.countyFips}`;
}

function pickCountyRow(counties: HudCountyRow[], match: CountyMatch): HudCountyRow | null {
  const geoid = countyGeoid(match);
  const byCode = counties.find((c) => String(c.code || '') === geoid);
  if (byCode) return byCode;
  const target = match.countyName.replace(/\s+county$/i, '').trim().toLowerCase();
  return (
    counties.find((c) => String(c.name || '').toLowerCase().includes(target)) ||
    counties.find((c) => target && String(c.name || '').toLowerCase().startsWith(target)) ||
    null
  );
}

/**
 * County-level HUD FMR for the listing's county (via Census geocoder).
 * Requires HUD_API_TOKEN (Bearer) from https://www.huduser.gov/hudapi/public/login
 */
export async function fetchHudCountyFmr(params: {
  state: string;
  countyMatch: CountyMatch | null;
  bedrooms: number;
}): Promise<{ amount: number; label: string } | null> {
  const token = process.env.HUD_API_TOKEN?.trim();
  if (!token || !params.countyMatch) return null;
  const year = process.env.HUD_FMR_YEAR?.trim() || '2025';
  const state = params.state.toUpperCase().slice(0, 2);
  const url = `https://www.huduser.gov/hudapi/public/fmr/statedata/${state}?year=${encodeURIComponent(year)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { counties?: HudCountyRow[] } };
    const counties = json.data?.counties;
    if (!Array.isArray(counties) || counties.length === 0) return null;
    const row = pickCountyRow(counties, params.countyMatch);
    if (!row) return null;
    const col = columnForBeds(params.bedrooms);
    const amount = parseMoney(row[col] as string | number | undefined);
    if (!amount) return null;
    const label = `${String(row.name || params.countyMatch.countyName || 'County')} (${state}, HUD FMR ${year})`;
    return { amount, label };
  } catch {
    return null;
  }
}
