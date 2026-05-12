import type { Prisma } from '@prisma/client';
import { ArrowUpRight, BarChart3, Home, SlidersHorizontal } from 'lucide-react';
import { chooseAssumptionProfile } from '@/lib/assumptionProfiles';
import { calculateListingAnalysis } from '@/lib/analysis';
import { defaultAssumptions } from '@/lib/defaultAssumptions';
import { buildListingWhere, normalizeListingFilters, type RawListingFilters } from '@/lib/listingFilters';
import { compactDate, currency, percent } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { ListingsFilterPanel } from '@/components/ListingsFilterPanel';

export const dynamic = 'force-dynamic';

const statuses = ['NEW', 'REVIEW', 'KEEP', 'DECLINED', 'OFFER', 'UNDER_CONTRACT', 'CLOSED'];
const tabs = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'analysis', label: 'Analysis', icon: BarChart3 },
];

type SearchParams = RawListingFilters & {
  tab?: string;
  assumptionId?: string;
  focusId?: string;
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

function tagClass(tag?: string) {
  if (tag === 'CASH FLOW') return 'tag good';
  if (tag === 'EQUITY PLAY') return 'tag warn';
  return 'tag bad';
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const activeTab = tabs.some((tab) => tab.key === params.tab) ? params.tab ?? 'overview' : 'overview';
  const filters = normalizeListingFilters(params);
  const where = buildListingWhere(filters) as Prisma.ListingWhereInput;
  const focusId = typeof params.focusId === 'string' && params.focusId.trim() ? params.focusId.trim() : '';

  const [listings, focusListing, allProperties, counts, total, assumptions, stateRows, cityRows] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        pipeline: true,
        analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
      },
      orderBy: { ingestedAt: 'desc' },
      take: 300,
    }),
    focusId
      ? prisma.listing.findUnique({
          where: { id: focusId },
          include: {
            pipeline: true,
            analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
          },
        })
      : Promise.resolve(null),
    prisma.listing.findMany({
      select: { id: true, address: true, city: true, state: true, zip: true },
      orderBy: [{ address: 'asc' }],
      take: 600,
    }),
    prisma.listingPipeline.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.listing.count(),
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
  const selected =
    focusListing ??
    (filters.listingId ? listings.find((listing) => listing.id === filters.listingId) ?? listings[0] : listings[0]);
  const selectedSnapshot = selected?.analysis[0];
  const selectedAnalysis = selected && profile
    ? calculateListingAnalysis({
      listing: {
        price: selected.price,
        state: selected.state,
        hoaMonthly: selected.hoaMonthly,
      },
      assumptions: profile,
      rent: {
        hudFmrSelected: selectedSnapshot?.hudFmrSelected ?? 0,
        hudMetro: selectedSnapshot?.hudMetro ?? '',
        rentcastEst: selectedSnapshot?.rentcastEst ?? 0,
      },
    })
    : null;

  const countFor = (status: string) => counts.find((item) => item.status === status)?._count.status || 0;

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Acquisition Desk</div>
          <h1>Property Review Workspace</h1>
          <p className="subhead">Filter the intake queue, focus a property by full address, and apply underwriting profiles.</p>
        </div>
        <a className="button primary" href="/assumptions">
          <SlidersHorizontal size={16} />
          Manage profiles
        </a>
      </div>

      <section className="metrics compact-metrics">
        <div className="metric"><span>Total listings</span><strong>{total}</strong></div>
        <div className="metric"><span>New</span><strong>{countFor('NEW')}</strong></div>
        <div className="metric"><span>Review</span><strong>{countFor('REVIEW')}</strong></div>
        <div className="metric"><span>Keep</span><strong>{countFor('KEEP')}</strong></div>
      </section>

      <ListingsFilterPanel
        action="/"
        raw={params}
        filters={filters}
        statuses={statuses}
        states={stateRows.map((row) => row.state)}
        cities={cityRows.map((row) => row.city)}
        properties={allProperties}
        assumptions={assumptions}
        selectedAssumptionId={profile?.id}
        hiddenFields={{ tab: activeTab }}
      />

      <nav className="tabs" aria-label="Workspace sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <a key={tab.key} className={activeTab === tab.key ? 'active' : ''} href={withParams(params, { tab: tab.key })}>
              <Icon size={16} />
              {tab.label}
            </a>
          );
        })}
      </nav>

      {activeTab === 'overview' ? (
        <section className="workspace-grid">
          <div className="card feature-card">
            {selected ? (
              <>
                <div className="section-head">
                  <div>
                    <div className="eyebrow">{selected.notificationType}</div>
                    <h2>{selected.address}</h2>
                    <p className="muted">{selected.city}, {selected.state} {selected.zip}</p>
                  </div>
                  <a className="button" href={selected.listingUrl} target="_blank" rel="noreferrer">
                    Open in Zillow
                    <ArrowUpRight size={16} />
                  </a>
                </div>
                <div className="overview-metrics">
                  <div><span>Price</span><strong>{currency(selected.price)}</strong></div>
                  <div><span>Specs</span><strong>{selected.beds} bd / {selected.baths} ba</strong></div>
                  <div><span>Size</span><strong>{selected.sqft.toLocaleString()} sqft</strong></div>
                  <div><span>HOA</span><strong>{currency(selected.hoaMonthly)}/mo</strong></div>
                  <div><span>Date added</span><strong>{compactDate(selected.ingestedAt)}</strong></div>
                  <div><span>Monthly CF</span><strong>{selectedAnalysis ? currency(selectedAnalysis.monthlyCf) : 'Pending'}</strong></div>
                  <div><span>Cap rate</span><strong>{selectedAnalysis ? percent(selectedAnalysis.capRate) : 'Pending'}</strong></div>
                  <div><span>Cash on cash</span><strong>{selectedAnalysis ? percent(selectedAnalysis.cashOnCash) : 'Pending'}</strong></div>
                  <div><span>Tag</span>{selectedAnalysis ? <strong className={tagClass(selectedAnalysis.tag)}>{selectedAnalysis.tag}</strong> : <strong>Pending</strong>}</div>
                </div>
              </>
            ) : (
              <div className="empty">No listings match the current filters.</div>
            )}
          </div>

          <aside className="card focus-list">
            <div className="section-head">
              <h2>Filtered Queue</h2>
              <span className="muted">{listings.length} shown</span>
            </div>
            <div className="queue-list">
              {listings.slice(0, 12).map((listing) => (
                <a
                  key={listing.id}
                  className={selected?.id === listing.id ? 'queue-item active' : 'queue-item'}
                  href={withParams(params, { focusId: listing.id, listingId: undefined, tab: 'overview' })}
                >
                  <strong>{listing.address}</strong>
                  <span>{listing.city}, {listing.state} · {currency(listing.price)}</span>
                  <span className="muted">Added {compactDate(listing.ingestedAt)}</span>
                </a>
              ))}
            </div>
          </aside>
        </section>
      ) : null}

      {activeTab === 'analysis' ? (
        <section className="workspace-grid">
          <div className="card">
            <div className="section-head">
              <div>
                <h2>Profile Analysis</h2>
                <p className="muted">Current profile: {profile?.name ?? 'Default underwriting'}</p>
              </div>
            </div>
            {selected && selectedAnalysis ? (
              <div className="detail-list roomy">
                <div><span>Rent used</span><strong>{currency(selectedAnalysis.rentUsed)}</strong></div>
                <div><span>Rent source</span><strong>{selectedAnalysis.rentSource}</strong></div>
                <div><span>P&I</span><strong>{currency(selectedAnalysis.pAndI)}</strong></div>
                <div><span>Total expenses</span><strong>{currency(selectedAnalysis.totalExpensesMonthly)}/mo</strong></div>
                <div><span>Annual cash flow</span><strong>{currency(selectedAnalysis.annualCf)}</strong></div>
                <div><span>After-tax CF</span><strong>{currency(selectedAnalysis.afterTaxCf)}</strong></div>
                <div><span>NOI</span><strong>{currency(selectedAnalysis.noi)}</strong></div>
                <div><span>Cash required</span><strong>{currency(selectedAnalysis.cashRequired)}</strong></div>
                <div><span>5-year equity</span><strong>{currency(selectedAnalysis.equity5yr)}</strong></div>
                <div><span>Criteria tag</span><strong>{selectedAnalysis.tag}</strong></div>
              </div>
            ) : (
              <div className="empty">Select a property to see profile-driven underwriting.</div>
            )}
          </div>
          <aside className="card">
            <h2>Profile Inputs</h2>
            {profile ? (
              <div className="detail-list single roomy">
                <div><span>Down payment</span><strong>{percent(profile.downPaymentPct)}</strong></div>
                <div><span>Interest rate</span><strong>{percent(profile.interestRate)}</strong></div>
                <div><span>Loan term</span><strong>{profile.loanTermYears} years</strong></div>
                <div><span>Rent multiplier</span><strong>{percent(profile.rentMultiplier)}</strong></div>
                <div><span>Vacancy</span><strong>{percent(profile.vacancyPct)}</strong></div>
                <div><span>Maintenance</span><strong>{percent(profile.maintenancePct)}</strong></div>
                <div><span>Management</span><strong>{percent(profile.propertyMgmtPct)}</strong></div>
              </div>
            ) : null}
          </aside>
        </section>
      ) : null}
    </div>
  );
}
