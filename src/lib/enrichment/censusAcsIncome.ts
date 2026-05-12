/**
 * ACS median household income (B19013_001E) for ZCTA. Optional CENSUS_API_KEY.
 */
export async function fetchMedianHouseholdIncomeForZip(zip: string): Promise<number | null> {
  const z = String(zip || '').match(/\d{5}/)?.[0];
  if (!z) return null;
  const key = process.env.CENSUS_API_KEY?.trim();
  const base =
    `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,NAME&for=zip%20code%20tabulation%20area:${z}`;
  const url = key ? `${base}&key=${encodeURIComponent(key)}` : base;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as [string[], ...string[][]];
    if (!Array.isArray(data) || data.length < 2) return null;
    const row = data[1];
    const raw = row?.[0];
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  } catch {
    return null;
  }
}
