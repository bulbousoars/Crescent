import type { RawMessage } from '../mail/provider';
import type { ZillowIngestionPayload } from '../ingestion';

const ALLOWED_SENDER = /(?:instant-updates|my-saved-home)@mail\.zillow\.com/i;
const ZILLOW_DOMAIN = /@(?:mail\.)?zillow\.com/i;

const NOTIFICATION_PATTERNS = [
  { type: 'Price Cut', pattern: /price cut|reduced by|cut\s+\$/i, eventClass: 'primary' },
  { type: 'New Listing', pattern: /new listing/i, eventClass: 'primary' },
  { type: 'Search Results', pattern: /latest results for your search|\b\d+\s+results?\s+for\b/i, eventClass: 'primary' },
  { type: 'Open House', pattern: /open house|has an open house scheduled|\bopen:\b/i, eventClass: 'secondary' },
  { type: 'Coming Soon', pattern: /coming soon/i, eventClass: 'secondary' },
] as const;

const FOOTER_MARKERS = [
  'Our recommendations for you',
  'Check out these similar homes nearby',
  'See all saved homes',
  'Never miss your Zillow alerts',
  'Improve your recommendations',
  'Privacy policy',
  'Zillow, Inc.',
];

function clean(text: string): string {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(address: string): string {
  return clean(address).replace(/^(?:[\d,]+\s*(?:sq\s*ft|sqft)\s+)/i, '').trim();
}

function splitAtMarker(text: string, markers: string[]): string {
  const source = String(text || '');
  let end = source.length;
  const lower = source.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1 && idx < end) end = idx;
  }
  return source.slice(0, end).trim();
}

function extractPrimarySection(text: string): string {
  return splitAtMarker(text, FOOTER_MARKERS);
}

function splitAddress(address: string): { city: string; state: string; zip: string } {
  if (!address) return { city: '', state: '', zip: '' };
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return { city: '', state: '', zip: '' };
  const city = parts[parts.length - 2] || '';
  const stZip = (parts[parts.length - 1] || '').split(/\s+/);
  return { city, state: stZip[0] || '', zip: stZip[1] || '' };
}

function parseDollarAmount(match: RegExpMatchArray | null): number {
  if (!match) return 0;
  const amount = parseFloat(String(match[1] || '0').replace(/,/g, ''));
  const suffix = String(match[2] || '').toUpperCase();
  if (Number.isNaN(amount)) return 0;
  if (suffix === 'K') return Math.round(amount * 1000);
  if (suffix === 'M') return Math.round(amount * 1_000_000);
  return Math.round(amount);
}

function parseMonthlyDollar(match: RegExpMatchArray | null): number | null {
  const n = parseDollarAmount(match);
  return n > 0 ? n : null;
}

function extractRentZestimateMonthly(text: string): number | null {
  const patterns = [
    /\brent\s*zestimate[®]?\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*(?:\/\s*mo|per\s+month)?\b/i,
    /\bzestimate\s*rent\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*(?:\/\s*mo)?\b/i,
  ];
  for (const re of patterns) {
    const v = parseMonthlyDollar(text.match(re));
    if (v) return v;
  }
  return null;
}

function extractEstimatedPaymentMonthly(text: string): number | null {
  const patterns = [
    /\best\.?\s*payment\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*\/\s*mo\b/i,
    /\bestimated\s+payment\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*(?:\/\s*mo|per\s+month)?\b/i,
    /\bmonthly\s+payment\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\b/i,
  ];
  for (const re of patterns) {
    const v = parseMonthlyDollar(text.match(re));
    if (v) return v;
  }
  return null;
}

function extractEstimatedPAndIMonthly(text: string): number | null {
  const patterns = [
    /(?:principal\s*[&+]\s*interest|principal\s+and\s+interest|p\s*&\s*i)\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*(?:\/\s*mo)?\b/i,
  ];
  for (const re of patterns) {
    const v = parseMonthlyDollar(text.match(re));
    if (v) return v;
  }
  return null;
}

function extractEstimatedPropertyTaxMonthly(text: string): number | null {
  const patterns = [
    /\bproperty\s+tax(?:es)?\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*(?:\/\s*mo|per\s+month)?\b/i,
    /\btaxes?\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*\/\s*mo\b/i,
  ];
  for (const re of patterns) {
    const v = parseMonthlyDollar(text.match(re));
    if (v) return v;
  }
  return null;
}

function extractEstimatedInsuranceMonthly(text: string): number | null {
  const patterns = [
    /\b(?:home(?:owners?)?\s+insurance|homeowners?\s+insurance|insurance)\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\s*(?:\/\s*mo|per\s+month)?\b/i,
  ];
  for (const re of patterns) {
    const v = parseMonthlyDollar(text.match(re));
    if (v) return v;
  }
  return null;
}

function extractPreviousListPrice(text: string, currentPrice: number): number | null {
  const patterns = [
    /(?:\bwas\b|previously\s+listed\s+at|reduced\s+from|price\s+was|originally\s+listed\s+at)\s*[:\s]*\$([\d,.]+)\s*([KkMm])?/gi,
    /\$([\d,.]+)\s*([KkMm])?\s*(?:\bwas\b|before\s+the\s+price\s+cut)/gi,
  ];
  let best = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseDollarAmount(m);
      if (!v || v === currentPrice) continue;
      if (v > best) best = v;
    }
  }
  if (!best) return null;
  if (currentPrice > 0 && best < currentPrice * 0.5) return null;
  return best;
}

function extractPropertyType(text: string): string {
  const m = text.match(
    /\b(Single\s+family\s+residence|Single\s*[-]?\s*family|Condo(?:minium)?|Townhouse|Townhome|Multi[-\s]?family|Co[-\s]?op|Manufactured\s+home|Mobile\s+home|Apartment)\b/i,
  );
  if (!m) return '';
  return clean(m[1]).replace(/\s+/g, ' ').trim().slice(0, 80);
}

function extractMlsNumber(text: string): string {
  const patterns = [
    /\bMLS\s*[#:]?\s*([A-Z0-9][A-Z0-9.-]{2,24})\b/i,
    /\bMLS\s*ID\s*[:.]?\s*([A-Z0-9][A-Z0-9.-]{2,24})\b/i,
    /\bListing\s*#\s*[:.]?\s*([A-Z0-9][A-Z0-9.-]{2,24})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function extractDaysOnZillow(text: string): number | null {
  const m =
    text.match(/\b(\d{1,4})\s+days?\s+on\s+zillow\b/i) || text.match(/\bon\s+zillow\s+for\s+(\d{1,4})\s+days?\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 0 || n >= 20000) return null;
  return n;
}

function findAddressDollarAnchor(source: string, address: string): number {
  const hay = source.toLowerCase().replace(/\s+/g, ' ');
  const full = clean(address).toLowerCase().replace(/\s+/g, ' ');
  if (full.length >= 10) {
    const i = hay.indexOf(full);
    if (i !== -1) return i;
  }
  const street = clean(address).split(',')[0]?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
  if (street.length >= 8) {
    const i = hay.indexOf(street);
    if (i !== -1) return i;
  }
  const zip = (address.match(/\b(\d{5})\s*$/) || [])[1];
  if (zip && zip.length === 5) {
    const i = hay.indexOf(zip);
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Pick list price from all `$…` amounts in the email body.
 *
 * Zillow templates often include **down payment**, **est. monthly payment**, **Zestimate**, etc.
 * Taking `Math.max` alone wrongly picked e.g. $225,000 (20% down on a $1.125M home) over the
 * real list price when the larger figure sat outside the parsed window or was formatted oddly.
 * We score each candidate with local context, then prefer the best match **nearest the listing
 * address** (Zillow often puts promo “from $225k” lines above the real `$153,300` line).
 */
function extractLikelyListingPrice(text: string, address: string): number {
  const source = String(text || '');
  const re = /\$([\d,.]+)\s*([KkMm])?/g;
  type Cand = { value: number; score: number; index: number };
  const cands: Cand[] = [];

  for (const m of source.matchAll(re)) {
    const value = parseDollarAmount(m as unknown as RegExpMatchArray);
    if (!value) continue;
    const suffix = String(m[2] || '').toUpperCase();
    const idx = m.index ?? 0;
    const len = m[0].length;
    const afterShort = source.slice(idx + len, idx + len + 24).toLowerCase();
    const looksMonthly =
      /\/\s*mo\b/.test(afterShort) ||
      /\bper\s+month\b/.test(afterShort) ||
      /\bmonthly\b/.test(afterShort) ||
      /\b\/mo\b/.test(afterShort);

    if (looksMonthly) continue;
    if (value < 10_000 && suffix !== 'K' && suffix !== 'M') continue;

    const before = source.slice(Math.max(0, idx - 200), idx).toLowerCase();
    const after = source.slice(idx + len, Math.min(source.length, idx + len + 120)).toLowerCase();
    const ctx = `${before} ${after}`;

    let score = 0;

    if (
      /\b(est\.?\s*payment|estimated\s+payment|monthly\s+payment|monthly\s+mortgage|mortgage\s+payment|zestimate|rent\s*zestimate|\brent\b|\blease\b|\/mo\b)\b/i.test(
        ctx,
      )
    ) {
      score -= 160;
    }
    if (
      /\b(down\s*payment|\d{1,2}\s*%\s*down|closing\s*costs?|loan\s*amount|p&i\b|principal\s*[&+]\s*interest|pmi\b|mortgage\s+insurance|due\s+at\s+closing|cash\s+to\s+close)\b/i.test(
        ctx,
      )
    ) {
      score -= 160;
    }
    if (/\b(property\s+tax|homeowners?\s+insurance|hoa\s*(fee|dues|per|\/))\b/i.test(ctx) && value < 75_000) {
      score -= 100;
    }
    if (/\b(homes?\s+from|starting\s+at|from\s+only|pre-?qualified|pre-?approved|loan\s+options)\b/i.test(ctx)) {
      score -= 120;
    }
    if (
      /\b(previously\s+listed|originally\s+listed|listing\s+was|price\s+was|was\s+listed|reduced\s+from)\b/i.test(
        before.slice(-140),
      )
    ) {
      score -= 260;
    }

    if (
      /\b(list(?:ed)?\s+at|asking\s+price|sale\s+price|for\s+sale|home\s+price|now\s+)\b/i.test(before.slice(-120))
    ) {
      score += 75;
    }
    if (/\d(?:\.\d)?\s*(?:bd|bed|beds)\b/i.test(after.slice(0, 90))) {
      score += 50;
    }
    if (/\d[\d,]*\s*(?:sq\s*ft|sqft)\b/i.test(after.slice(0, 110))) {
      score += 40;
    }

    cands.push({ value, score, index: idx });
  }

  if (cands.length === 0) return 0;

  const anchor = findAddressDollarAnchor(source, address);
  const NEAR = 280;
  const near = anchor >= 0 ? cands.filter((c) => Math.abs(c.index - anchor) <= NEAR) : [];
  /** List price almost always appears at or after the address; promo “from $225k” sits above it. */
  const afterAddr = anchor >= 0 ? cands.filter((c) => c.index >= anchor) : [];

  let pool: typeof cands;
  if (anchor >= 0 && afterAddr.length > 0) {
    const narrowed = afterAddr.filter((c) => Math.abs(c.index - anchor) <= NEAR);
    pool = narrowed.length > 0 ? narrowed : afterAddr;
  } else if (anchor >= 0 && near.length > 0) {
    pool = near;
  } else {
    pool = cands;
  }

  const bestScore = Math.max(...pool.map((c) => c.score));
  const tier = pool.filter((c) => c.score === bestScore);
  const sorted =
    anchor >= 0
      ? [...tier].sort((a, b) => {
          const da = Math.abs(a.index - anchor);
          const db = Math.abs(b.index - anchor);
          if (da !== db) return da - db;
          return a.index - b.index;
        })
      : [...tier].sort((a, b) => a.index - b.index);
  return sorted[0].value;
}

function extractAddress(text: string): string {
  const source = clean(text);
  const patterns = [
    /(\b\d+\s+[A-Za-z0-9.#' -]+(?:Avenue|Ave|Street|St|Boulevard|Blvd|Road|Rd|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Drive|Dr|Trail|Trl|Parkway|Pkwy|Terrace|Ter)\b[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}(?:\s*\d{5})?)/i,
    /(\b\d+\s+[A-Za-z0-9.#' -]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i,
    /(\b\d+\s+[A-Za-z0-9.#' -]+,\s*[A-Za-z\s]+,\s*[A-Z]{2})/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return normalizeAddress(match[1]);
  }
  return '';
}

function decodeZillowTarget(url: string): string {
  let candidate = String(url || '');
  for (let i = 0; i < 2; i += 1) {
    const targetMatch = candidate.match(/[?&]target=([^&\s]+)/i);
    if (!targetMatch) break;
    try {
      candidate = decodeURIComponent(targetMatch[1]);
    } catch {
      break;
    }
  }
  const zpidTarget = candidate.match(/\/zpid_target\/(\d+)_zpid/i);
  if (zpidTarget) return `https://www.zillow.com/homedetails/${zpidTarget[1]}_zpid/`;
  const direct = candidate.match(/https?:\/\/(?:www\.)?zillow\.com\/homedetails\/[^\s"'<>]+/i);
  if (direct) return direct[0].split('?')[0];
  return '';
}

interface CandidateLink {
  raw: string;
  normalized: string;
  index: number;
}

function extractCandidateLinks(text: string): CandidateLink[] {
  const source = String(text || '');
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const out: CandidateLink[] = [];
  for (const match of source.matchAll(urlRegex)) {
    const raw = match[0];
    const normalized =
      decodeZillowTarget(raw) ||
      (/https?:\/\/(?:www\.)?zillow\.com\/homedetails\//i.test(raw) ? raw.split('?')[0] : '');
    if (normalized) out.push({ raw, normalized, index: match.index ?? 0 });
  }
  return out;
}

/** Prefer the homedetails link closest to the listing address — first URL in HTML is often a promo/tracking link, not the property. */
function findBestHomedetailsLink(source: string, subject: string): CandidateLink | null {
  const links = extractCandidateLinks(source).filter((l) => /\/homedetails\//i.test(l.normalized));
  if (!links.length) return null;
  const addr = extractAddress(clean(`${subject}\n${source}`));
  if (!addr) return links[links.length - 1] ?? links[0] ?? null;

  const hay = source.toLowerCase();
  const street = addr.split(',')[0]?.trim().toLowerCase() ?? '';
  const zipM = addr.match(/\b(\d{5})\b/);
  const zip = zipM?.[1] ?? '';
  let anchor = -1;
  if (street.length >= 8) anchor = hay.indexOf(street);
  if (anchor < 0 && zip) anchor = hay.indexOf(zip);
  if (anchor < 0) {
    const full = clean(addr).toLowerCase().replace(/\s+/g, ' ');
    if (full.length >= 12) anchor = hay.indexOf(full);
  }
  if (anchor < 0) return links[links.length - 1] ?? links[0] ?? null;

  let best = links[0]!;
  let bestDist = Infinity;
  for (const l of links) {
    const d = Math.abs(l.index - anchor);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return best;
}

/** Home (sale) Zestimate lines — skip rent-Zestimate matches. Used to correct a mis-parsed list price. */
function extractHomeZestimateValue(text: string): number | null {
  const t = String(text || '');
  for (const m of t.matchAll(/\bzestimate[®]?\s*[:.]?\s*\$([\d,.]+)\s*([KkMm])?\b/gi)) {
    const start = m.index ?? 0;
    const ctx = t.slice(Math.max(0, start - 48), Math.min(t.length, start + 96)).toLowerCase();
    if (/\brent\b/.test(ctx)) continue;
    const v = parseDollarAmount(m as unknown as RegExpMatchArray);
    if (v >= 40_000) return v;
  }
  return null;
}

function extractCandidateUrls(text: string): string[] {
  return Array.from(new Set(extractCandidateLinks(text).map((l) => l.normalized)));
}

interface BuildListingResult {
  listingUrl: string;
  zpid: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  priceCut: number;
  beds: number;
  baths: number;
  sqft: number;
  hoa: number;
  yearBuilt: string;
  lotSize: string;
  rentZestimateMonthly: number | null;
  estimatedPaymentMonthly: number | null;
  estimatedPAndIMonthly: number | null;
  estimatedPropertyTaxMonthly: number | null;
  estimatedInsuranceMonthly: number | null;
  previousListPrice: number | null;
  propertyType: string;
  mlsNumber: string;
  daysOnZillow: number | null;
}

function buildListing(rawChunk: string, candidateUrls: string[]): BuildListingResult | null {
  const raw = String(rawChunk || '');
  const normalized = clean(raw);
  const allUrls = [...candidateUrls, ...extractCandidateUrls(raw), ...extractCandidateUrls(normalized)].filter(Boolean);
  const listingUrl = allUrls[0] ? allUrls[0].split('?')[0] : '';
  if (!listingUrl) return null;
  let parsedHost: string;
  try {
    parsedHost = new URL(listingUrl).hostname;
  } catch {
    return null;
  }
  if (!parsedHost) return null;

  const zpidMatch = listingUrl.match(/(?:\/|_)(\d+)_zpid/i);
  const zpid = zpidMatch ? zpidMatch[1] : '';
  if (!zpid) return null;

  const address = extractAddress(raw);
  if (!address) return null;
  const { city, state, zip } = splitAddress(address);

  let price = extractLikelyListingPrice(normalized, address);
  const homeZest = extractHomeZestimateValue(normalized);
  if (homeZest && price > 0) {
    const ratio = price / homeZest;
    if (ratio < 0.15 || ratio > 6) price = homeZest;
  } else if (homeZest && (!price || price < 25_000)) {
    price = homeZest;
  }
  const priceCut = parseDollarAmount(
    normalized.match(/price cut[:\s]*\$([\d,.]+)\s*([KkMm])?/i) ||
      normalized.match(/reduced\s+by\s+\$([\d,.]+)\s*([KkMm])?/i) ||
      normalized.match(/cut\s+\$([\d,.]+)\s*([KkMm])?/i),
  );
  const bedsMatch = normalized.match(/(?:^|[^\w])(\d+(?:\.\d+)?)\s*(?:bd|bed|beds|bdr)\b/i);
  const bathsMatch = normalized.match(/(?:^|[^\w])(\d+(?:\.\d+)?)\s*(?:ba|bath|baths)\b/i);
  const sqftMatch = normalized.match(/(?:^|[^\w])([\d,]+)\s*(?:sq\s*ft|sqft)\b/i);
  const hoa = parseDollarAmount(normalized.match(/HOA[:\s]+\$([\d,.]+)\s*([KkMm])?/i));
  const ybMatch = normalized.match(/(?:built|year built)[:\s]+(\d{4})/i);
  const lotMatch = normalized.match(/([\d,.]+\s*(?:acres?|sqft|sq\s*ft))\s*lot/i);

  return {
    listingUrl,
    zpid,
    address,
    city,
    state,
    zip,
    price,
    priceCut,
    beds: bedsMatch ? parseFloat(bedsMatch[1]) : 0,
    baths: bathsMatch ? parseFloat(bathsMatch[1]) : 0,
    sqft: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ''), 10) : 0,
    hoa,
    yearBuilt: ybMatch ? ybMatch[1] : '',
    lotSize: lotMatch ? clean(lotMatch[1]) : '',
    rentZestimateMonthly: extractRentZestimateMonthly(normalized),
    estimatedPaymentMonthly: extractEstimatedPaymentMonthly(normalized),
    estimatedPAndIMonthly: extractEstimatedPAndIMonthly(normalized),
    estimatedPropertyTaxMonthly: extractEstimatedPropertyTaxMonthly(normalized),
    estimatedInsuranceMonthly: extractEstimatedInsuranceMonthly(normalized),
    previousListPrice: extractPreviousListPrice(normalized, price),
    propertyType: extractPropertyType(normalized),
    mlsNumber: extractMlsNumber(normalized),
    daysOnZillow: extractDaysOnZillow(normalized),
  };
}

function extractSummaryListings(rawText: string): BuildListingResult[] {
  const source = String(rawText || '');
  const links = extractCandidateLinks(source);
  const out: BuildListingResult[] = [];
  for (const link of links) {
    const chunk = source.slice(Math.max(0, link.index - 500), Math.min(source.length, link.index + 900));
    const parsed = buildListing(chunk, [link.normalized]);
    if (parsed) out.push(parsed);
  }
  // de-dup by zpid since digests often repeat the same listing
  const seen = new Set<string>();
  return out.filter((l) => (seen.has(l.zpid) ? false : seen.add(l.zpid)));
}

function extractPrimaryChunk(rawText: string): string {
  const source = String(rawText || '');
  const links = extractCandidateLinks(source);
  if (!links.length) return source;
  const link = links[0];
  return source.slice(Math.max(0, link.index - 600), Math.min(source.length, link.index + 400));
}

/** Wider slice around the homedetails link nearest the address (see findBestHomedetailsLink). */
function extractPrimaryChunkAnchored(primarySection: string, subject: string): string {
  const source = String(primarySection || '');
  const link = findBestHomedetailsLink(source, subject);
  if (!link) return extractPrimaryChunk(source);
  const before = 900;
  const after = 1600;
  return source.slice(Math.max(0, link.index - before), Math.min(source.length, link.index + after));
}

export interface ZillowParseClassification {
  notificationType: string;
  eventClass: 'primary' | 'secondary' | 'ignore';
  searchName: string;
}

export function classifyZillowEmail(message: RawMessage): ZillowParseClassification | null {
  const fromLower = (message.fromAddress || '').toLowerCase();
  if (!ZILLOW_DOMAIN.test(fromLower)) return null;
  if (!ALLOWED_SENDER.test(fromLower)) return null;

  const subject = clean(message.subject || '');
  const body = clean([message.textBody, message.htmlBody, message.snippet].filter(Boolean).join('\n'));

  let notificationType = 'Unknown';
  let eventClass: 'primary' | 'secondary' | 'ignore' = 'ignore';
  for (const ev of NOTIFICATION_PATTERNS) {
    if (ev.pattern.test(subject) || ev.pattern.test(body)) {
      notificationType = ev.type;
      eventClass = ev.eventClass;
      break;
    }
  }
  if (eventClass === 'ignore') return null;

  const searchMatch =
    subject.match(/Your\s+'([^']+)'\s+Search/i) ||
    subject.match(/search\s+'([^']+)'/i) ||
    body.match(/latest results for your search\s+'([^']+)'/i) ||
    subject.match(/Results?\s+for\s+'([^']+)'/i);

  const searchName = searchMatch ? clean(searchMatch[1]) : clean(subject.substring(0, 120));
  return { notificationType, eventClass, searchName };
}

export interface ParsedZillowEmail {
  classification: ZillowParseClassification;
  payloads: ZillowIngestionPayload[];
}

export function parseZillowMessage(message: RawMessage): ParsedZillowEmail | null {
  const classification = classifyZillowEmail(message);
  if (!classification) return null;

  const subject = clean(message.subject || '');
  const rawBody = [message.textBody, message.htmlBody, message.snippet].filter(Boolean).join('\n');
  const primarySection = extractPrimarySection(rawBody);
  const primaryChunk = extractPrimaryChunkAnchored(primarySection, subject);

  const buildPayload = (listing: BuildListingResult): ZillowIngestionPayload => ({
    zpid: listing.zpid,
    listingId: listing.zpid,
    listingUrl: listing.listingUrl,
    address: listing.address,
    city: listing.city,
    state: (listing.state || '').slice(0, 2),
    zip: listing.zip,
    price: listing.price,
    priceCut: listing.priceCut,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    hoa: listing.hoa,
    hoaMonthly: listing.hoa,
    yearBuilt: listing.yearBuilt,
    lotSize: listing.lotSize,
    rentZestimateMonthly: listing.rentZestimateMonthly,
    estimatedPaymentMonthly: listing.estimatedPaymentMonthly,
    estimatedPAndIMonthly: listing.estimatedPAndIMonthly,
    estimatedPropertyTaxMonthly: listing.estimatedPropertyTaxMonthly,
    estimatedInsuranceMonthly: listing.estimatedInsuranceMonthly,
    previousListPrice: listing.previousListPrice,
    propertyType: listing.propertyType,
    mlsNumber: listing.mlsNumber,
    daysOnZillow: listing.daysOnZillow,
    notificationType: classification.notificationType,
    searchName: classification.searchName,
    gmailMessageId: message.providerMsgId,
    gmailThreadId: message.threadId,
    rawPayload: {
      providerMsgId: message.providerMsgId,
      threadId: message.threadId,
      fromAddress: message.fromAddress,
      subject: message.subject,
      receivedAt: message.receivedAt.toISOString(),
      parsedAt: new Date().toISOString(),
    },
  });

  let listings: BuildListingResult[] = [];
  if (classification.notificationType === 'Search Results') {
    listings = extractSummaryListings(primarySection);
  } else {
    const single = buildListing(`${subject} ${primaryChunk}`, []);
    if (single) listings = [single];
  }

  return {
    classification,
    payloads: listings.map(buildPayload),
  };
}
