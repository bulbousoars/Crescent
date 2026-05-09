export type RawListingFilters = {
  listingId?: string;
  status?: string;
  state?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  minBeds?: string;
  minBaths?: string;
  minSqft?: string;
};

export type ListingFilters = {
  listingId?: string;
  status?: string;
  state?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
};

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberFilter(value?: string) {
  const cleaned = clean(value);
  if (!cleaned) return undefined;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : undefined;
}

export function normalizeListingFilters(raw: RawListingFilters): ListingFilters {
  return {
    listingId: clean(raw.listingId),
    status: clean(raw.status),
    state: clean(raw.state)?.toUpperCase(),
    city: clean(raw.city),
    minPrice: numberFilter(raw.minPrice),
    maxPrice: numberFilter(raw.maxPrice),
    minBeds: numberFilter(raw.minBeds),
    minBaths: numberFilter(raw.minBaths),
    minSqft: numberFilter(raw.minSqft),
  };
}

export function buildListingWhere(filters: ListingFilters) {
  const price: { gte?: number; lte?: number } = {};
  if (filters.minPrice !== undefined) price.gte = filters.minPrice;
  if (filters.maxPrice !== undefined) price.lte = filters.maxPrice;

  return {
    ...(filters.listingId ? { id: filters.listingId } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
    ...(Object.keys(price).length > 0 ? { price } : {}),
    ...(filters.minBeds !== undefined ? { beds: { gte: filters.minBeds } } : {}),
    ...(filters.minBaths !== undefined ? { baths: { gte: filters.minBaths } } : {}),
    ...(filters.minSqft !== undefined ? { sqft: { gte: filters.minSqft } } : {}),
    ...(filters.status ? { pipeline: { status: filters.status } } : {}),
  };
}
