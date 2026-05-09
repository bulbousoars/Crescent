import type { ZillowIngestionPayload } from './ingestion';

export type ZillowSheetRow = Record<string, unknown>;

export type ZillowSheetMapResult =
  | { ok: true; rowNumber: number; payload: ZillowIngestionPayload }
  | { ok: false; rowNumber: number; reason: string };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function firstText(row: ZillowSheetRow, ...keys: string[]) {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return '';
}

function parseNumber(value: unknown) {
  const raw = text(value);
  if (!raw) return 0;
  const negative = /^\(.+\)$/.test(raw) || raw.startsWith('-');
  const cleaned = raw.replace(/[,$%\s()]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => text(value) !== '') ?? '';
}

function parseIntField(value: unknown) {
  return Math.round(parseNumber(value));
}

function parseNonnegativeInt(value: unknown) {
  return Math.max(0, parseIntField(value));
}

function parseNonnegativeNumber(value: unknown) {
  return Math.max(0, parseNumber(value));
}

function parseRatio(value: unknown) {
  const raw = text(value);
  if (!raw) return 0;
  const parsed = parseNumber(raw);
  return raw.includes('%') ? parsed / 100 : parsed;
}

function normalizeState(value: unknown) {
  return text(value).toUpperCase().slice(0, 2);
}

function normalizeZip(value: unknown) {
  const raw = text(value);
  const zip = raw.match(/\d{5}/)?.[0] ?? raw;
  return zip;
}

function missing(reason: string, rowNumber: number): ZillowSheetMapResult {
  return { ok: false, rowNumber, reason };
}

export function mapZillowSheetRow(row: ZillowSheetRow, rowNumber: number): ZillowSheetMapResult {
  const listingUrl = firstText(row, 'ListingUrl', 'Listing URL', 'Url');
  if (!listingUrl) return missing('Missing ListingUrl', rowNumber);

  const address = firstText(row, 'Address');
  if (!address) return missing('Missing Address', rowNumber);

  const city = firstText(row, 'City');
  if (!city) return missing('Missing City', rowNumber);

  const state = normalizeState(firstText(row, 'State'));
  if (state.length !== 2) return missing('Missing State', rowNumber);

  const zip = normalizeZip(firstText(row, 'Zip', 'ZipCode', 'Zip Code'));

  const price = parseNonnegativeInt(row.Price);
  if (price <= 0) return missing('Missing Price', rowNumber);

  const zpid = firstText(row, 'Zpid', 'ZPID');
  const listingId = firstText(row, 'ListingId', 'Listing ID') || zpid || listingUrl;
  const beds = firstText(row, 'Beds');
  const baths = firstText(row, 'Baths');
  const sqft = firstText(row, 'Sqft');
  const hoaMonthly = firstText(row, 'HOA_Monthly');
  const yearBuilt = firstText(row, 'YearBuilt', 'Year Built');
  const lotSize = firstText(row, 'LotSize', 'Lot Size');

  const payload: ZillowIngestionPayload = {
    zpid,
    listingId,
    listingUrl,
    address,
    city,
    state,
    zip,
    price,
    priceCut: parseNonnegativeInt(row.PriceCut),
    ...(beds ? { beds: parseNonnegativeNumber(beds) } : {}),
    ...(baths ? { baths: parseNonnegativeNumber(baths) } : {}),
    ...(sqft ? { sqft: parseNonnegativeInt(sqft) } : {}),
    ...(hoaMonthly ? {
      hoa: parseNonnegativeInt(hoaMonthly),
      hoaMonthly: parseNonnegativeInt(hoaMonthly),
    } : {}),
    ...(yearBuilt ? { yearBuilt } : {}),
    ...(lotSize ? { lotSize } : {}),
    notificationType: firstText(row, 'NotificationType', 'Notification Type') || 'Backfill',
    searchName: firstText(row, 'SearchName', 'Search Name'),
    gmailMessageId: '',
    gmailThreadId: '',
    hud_fmr_selected: parseNonnegativeInt(row.HUD_FMR_Selected),
    hud_metro: firstText(row, 'HUD_Metro'),
    zillow_rent_zestimate: parseNonnegativeInt(row.Zillow_Zestimate),
    rentcast_est: parseNonnegativeInt(row.Rentcast_Est),
    rentcast_low: parseNonnegativeInt(row.Rentcast_Low),
    rentcast_high: parseNonnegativeInt(row.Rentcast_High),
    rent: parseNonnegativeInt(firstValue(row.RentUsed, row.Effective_Rent)),
    rentSource: firstText(row, 'RentSourceUsed', 'Rent_Source'),
    pAndI: parseNonnegativeInt(firstValue(row.PAndI, row.Monthly_P_I)),
    taxMo: parseNonnegativeInt(firstValue(row.PropTax_Mo, row.Monthly_Tax)),
    insMo: parseNonnegativeInt(firstValue(row.Insurance_Mo, row.Monthly_Insurance)),
    totalExp: parseNonnegativeInt(firstValue(row.TotalExpenses_Mo, row.Total_Monthly_Expense)),
    monthlyCF: parseIntField(row.MonthlyCF ?? row.Monthly_Cash_Flow),
    annualCF: parseIntField(row.AnnualCF ?? row.Annual_Cash_Flow),
    afterTaxCF: parseIntField(row.AfterTaxCF),
    noi: parseIntField(row.NOI),
    capRate: parseRatio(row.CapRate ?? row.Cap_Rate),
    coc: parseRatio(row.CashOnCash ?? row.Cash_on_Cash),
    cashReq: parseNonnegativeInt(row.CashRequired ?? row.Cash_Required),
    equity5: parseIntField(row.Equity_5yr),
    tag: firstText(row, 'Tag'),
    meetsSpecs: firstText(row, 'MeetsSpecs'),
    criteriaFailReasons: firstText(row, 'CriteriaFailReasons'),
    rawPayload: {
      source: 'google_sheets_backfill',
      sheetRowNumber: rowNumber,
      row,
    },
  };

  return { ok: true, rowNumber, payload };
}

export function rowsToObjects(headers: string[], rows: unknown[][]) {
  return rows.map((row) => {
    const out: ZillowSheetRow = {};
    headers.forEach((header, index) => {
      out[header] = row[index] ?? '';
    });
    return out;
  });
}
