/**
 * Keyless Census geocoder — resolves county FIPS for HUD FMR county rows.
 */
export type CountyMatch = { stateFips: string; countyFips: string; countyName: string };

export async function fetchCountyFromCensusGeocoder(
  city: string,
  state: string,
  zip: string,
): Promise<CountyMatch | null> {
  const z = String(zip || '').match(/\d{5}/)?.[0];
  if (!z || state.length !== 2) return null;
  const line = encodeURIComponent(`${city}, ${state} ${z}`);
  const url =
    `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?` +
    `address=${line}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: {
        addressMatches?: Array<{
          geographies?: { Counties?: Array<{ GEOID: string; NAME: string; STATE: string; COUNTY: string }> };
        }>;
      };
    };
    const match = json.result?.addressMatches?.[0];
    const county = match?.geographies?.Counties?.[0];
    if (!county?.STATE || !county?.COUNTY) return null;
    const stateFips = String(county.STATE).padStart(2, '0');
    const countyFips = String(county.COUNTY).padStart(3, '0');
    return { stateFips, countyFips, countyName: county.NAME || '' };
  } catch {
    return null;
  }
}
