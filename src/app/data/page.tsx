import type { Prisma } from '@prisma/client';
import { chooseAssumptionProfile } from '@/lib/assumptionProfiles';
import { calculateListingAnalysis } from '@/lib/analysis';
import { defaultAssumptions } from '@/lib/defaultAssumptions';
import { buildListingWhere, normalizeListingFilters, type RawListingFilters } from '@/lib/listingFilters';
import { compactDate, currency, percent } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { ListingsFilterPanel } from '@/components/ListingsFilterPanel';
import { EditableListingRow } from '@/components/EditableListingRow';

export const dynamic = 'force-dynamic';

const statuses = ['NEW', 'REVIEW', 'KEEP', 'DECLINED', 'OFFER', 'UNDER_CONTRACT', 'CLOSED'];

type SearchParams = RawListingFilters & {
  assumptionId?: string;
};

function withParams(params: SearchParams, updates: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.trim()) query.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  const value = query.toString();
  return value ? `/?${value}` : '/';
}

function exportCsvHref(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.trim()) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `/api/data/export?${qs}` : '/api/data/export';
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = normalizeListingFilters(params);
  const where = buildListingWhere(filters) as Prisma.ListingWhereInput;

  const [listings, allProperties, assumptions, stateRows, cityRows] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        pipeline: true,
        analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
      },
      orderBy: { ingestedAt: 'desc' },
      take: 1000,
    }),
    prisma.listing.findMany({
      select: { id: true, address: true, city: true, state: true, zip: true },
      orderBy: [{ address: 'asc' }],
      take: 600,
    }),
    prisma.assumptionSet.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    prisma.listing.findMany({ select: { state: true }, distinct: ['state'], orderBy: { state: 'asc' } }),
    prisma.listing.findMany({ select: { city: true }, distinct: ['city'], orderBy: { city: 'asc' } }),
  ]);

  const fallbackProfile = {
    id: 'default',
    isDefault: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...defaultAssumptions,
  };
  const profile = chooseAssumptionProfile(
    assumptions.length > 0 ? assumptions : [fallbackProfile],
    params.assumptionId,
  );

  const csvHref = exportCsvHref(params);

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Listing Data</div>
          <h1>All Listings</h1>
          <p className="subhead">Flat table of every ingested listing. Filter, sort, and edit values in place.</p>
        </div>
        <div className="page-head-meta">
          <a className="button primary" href={csvHref} download>
            Export CSV
          </a>
          <span className="muted">{listings.length} shown</span>
        </div>
      </div>

      <ListingsFilterPanel
        action="/data"
        raw={params}
        filters={filters}
        statuses={statuses}
        states={stateRows.map((row) => row.state)}
        cities={cityRows.map((row) => row.city)}
        properties={allProperties}
        assumptions={assumptions}
        selectedAssumptionId={profile?.id}
      />

      <div className="table-wrap listings-table">
        <table>
          <thead>
            <tr>
              <th>Full address</th>
              <th>Date Added</th>
              <th>Status</th>
              <th>Price</th>
              <th>State</th>
              <th>City</th>
              <th>Beds</th>
              <th>Baths</th>
              <th>Sq ft</th>
              <th>HOA</th>
              <th>Monthly CF</th>
              <th>Cap</th>
              <th>Zillow</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const snapshot = listing.analysis[0];
              const rowAnalysis = profile
                ? calculateListingAnalysis({
                    listing: { price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly },
                    assumptions: profile,
                    rent: { hudFmrSelected: snapshot?.hudFmrSelected ?? 0, hudMetro: snapshot?.hudMetro ?? '' },
                  })
                : null;
              return (
                <EditableListingRow
                  key={listing.id}
                  listing={{
                    id: listing.id,
                    address: listing.address,
                    zip: listing.zip,
                    state: listing.state,
                    city: listing.city,
                    status: listing.pipeline?.status ?? 'NEW',
                    listingUrl: listing.listingUrl,
                    price: listing.price,
                    beds: listing.beds,
                    baths: listing.baths,
                    sqft: listing.sqft,
                    hoaMonthly: listing.hoaMonthly,
                  }}
                  monthlyCfDisplay={rowAnalysis ? currency(rowAnalysis.monthlyCf) : 'Pending'}
                  capRateDisplay={rowAnalysis ? percent(rowAnalysis.capRate) : 'Pending'}
                  ingestedAtDisplay={compactDate(listing.ingestedAt)}
                  detailHref={withParams(params, { listingId: listing.id, tab: 'overview' })}
                />
              );
            })}
          </tbody>
        </table>
        {listings.length === 0 ? <div className="empty">No listings match the current filters.</div> : null}
      </div>
    </div>
  );
}
