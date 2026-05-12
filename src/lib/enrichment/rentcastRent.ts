export type RentcastRentResult = { rent: number; low: number; high: number };

function mapPropertyType(raw: string): string {
  const t = String(raw || '').toLowerCase();
  if (t.includes('condo')) return 'Condo';
  if (t.includes('town')) return 'Townhouse';
  if (t.includes('multi') || t.includes('apartment')) return 'Multi-Family';
  if (t.includes('manufactured') || t.includes('mobile')) return 'Manufactured';
  return 'Single Family';
}

export async function fetchRentcastLongTermRent(params: {
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  propertyType: string;
}): Promise<RentcastRentResult | null> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) return null;
  const addr = `${params.address}, ${params.city}, ${params.state}, ${params.zip}`.replace(/\s+/g, ' ').trim();
  const qs = new URLSearchParams({
    address: addr,
    bedrooms: String(Math.max(0, Math.min(8, Math.floor(params.bedrooms)))),
    propertyType: mapPropertyType(params.propertyType),
  });
  const url = `https://api.rentcast.io/v1/avm/rent/long-term?${qs.toString()}`;
  try {
    const res = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { rent?: number; rentRangeLow?: number; rentRangeHigh?: number };
    const rent = Math.round(Number(json.rent) || 0);
    if (!rent) return null;
    const low = Math.round(Number(json.rentRangeLow) || rent);
    const high = Math.round(Number(json.rentRangeHigh) || rent);
    return { rent, low, high };
  } catch {
    return null;
  }
}
