import { ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import { DealWhatIfLab } from '@/components/DealWhatIfLab';
import { MarketContextPanel, type MarketContextDto } from '@/components/MarketContextPanel';
import { PipelineControls } from '@/components/PipelineControls';
import { calculateListingAnalysis, toAnalysisAssumptions } from '@/lib/analysis';
import { defaultAssumptions } from '@/lib/defaultAssumptions';
import { compactDate, currency, percent } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function defaultMarketDto(listingId: string): MarketContextDto {
  return {
    listingId,
    rentCompSummary: '',
    neighborhoodTags: '',
    floodZoneNote: '',
    schoolTierNote: '',
    rentControlNote: '',
    hoaSpecialAssessmentNote: '',
    macroStressNotes: '',
    propertyTaxMonthlyOverride: null,
    insuranceMonthlyOverride: null,
    userNotes: '',
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      pipeline: true,
      analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
      priceHistory: { orderBy: { observedAt: 'asc' } },
      marketContext: true,
    },
  });

  if (!listing) notFound();
  const analysis = listing.analysis[0];

  const assumptionRow =
    (await prisma.assumptionSet.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: 'desc' } })) ??
    (await prisma.assumptionSet.findFirst({ orderBy: { createdAt: 'asc' } }));

  const initialAssumptions = assumptionRow
    ? toAnalysisAssumptions(assumptionRow)
    : toAnalysisAssumptions({
        downPaymentPct: defaultAssumptions.downPaymentPct,
        interestRate: defaultAssumptions.interestRate,
        loanTermYears: defaultAssumptions.loanTermYears,
        vacancyPct: defaultAssumptions.vacancyPct,
        maintenancePct: defaultAssumptions.maintenancePct,
        propertyMgmtPct: defaultAssumptions.propertyMgmtPct,
        insuranceRate: defaultAssumptions.insuranceRate,
        closingCostPct: defaultAssumptions.closingCostPct,
        rentMultiplier: defaultAssumptions.rentMultiplier,
        appreciationRate: defaultAssumptions.appreciationRate,
      });

  const savedLive =
    analysis && assumptionRow
      ? calculateListingAnalysis({
          listing: { price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly },
          assumptions: toAnalysisAssumptions(assumptionRow),
          rent: {
            hudFmrSelected: analysis.hudFmrSelected,
            hudMetro: analysis.hudMetro,
            rentcastEst: analysis.rentcastEst,
          },
        })
      : analysis && !assumptionRow
        ? calculateListingAnalysis({
            listing: { price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly },
            assumptions: initialAssumptions,
            rent: {
              hudFmrSelected: analysis.hudFmrSelected,
              hudMetro: analysis.hudMetro,
              rentcastEst: analysis.rentcastEst,
            },
          })
        : null;

  const marketDto: MarketContextDto = listing.marketContext
    ? {
        listingId: id,
        rentCompSummary: listing.marketContext.rentCompSummary,
        neighborhoodTags: listing.marketContext.neighborhoodTags,
        floodZoneNote: listing.marketContext.floodZoneNote,
        schoolTierNote: listing.marketContext.schoolTierNote,
        rentControlNote: listing.marketContext.rentControlNote,
        hoaSpecialAssessmentNote: listing.marketContext.hoaSpecialAssessmentNote,
        macroStressNotes: listing.marketContext.macroStressNotes,
        propertyTaxMonthlyOverride: listing.marketContext.propertyTaxMonthlyOverride,
        insuranceMonthlyOverride: listing.marketContext.insuranceMonthlyOverride,
        userNotes: listing.marketContext.userNotes,
      }
    : defaultMarketDto(id);

  const compStrip = analysis
    ? {
        rentZestimateMonthly: listing.rentZestimateMonthly,
        daysOnZillow: listing.daysOnZillow,
        sqft: listing.sqft,
        rentcastLow: analysis.rentcastLow,
        rentcastHigh: analysis.rentcastHigh,
        rentcastEst: analysis.rentcastEst,
        hudFmrSelected: analysis.hudFmrSelected,
        hudMetro: analysis.hudMetro,
        censusMedianHouseholdIncome: listing.censusMedianHouseholdIncome,
        neighborhoodContextScore: listing.neighborhoodContextScore,
      }
    : null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">{listing.notificationType}</div>
          <h1>{listing.address}</h1>
          <div className="muted">{listing.city}, {listing.state} {listing.zip}</div>
        </div>
        <a className="button primary" href={listing.listingUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          Open Zillow
        </a>
      </div>

      <section className="grid-2">
        <div className="stack">
          <div className="card">
            <h2>Property</h2>
            <div className="detail-list" style={{ marginTop: 16 }}>
              <div><span>Price</span><strong>{currency(listing.price)}</strong></div>
              <div><span>Price cut</span><strong>{currency(listing.priceCut)}</strong></div>
              <div><span>Beds / baths</span><strong>{listing.beds} / {listing.baths}</strong></div>
              <div><span>Square feet</span><strong>{listing.sqft.toLocaleString()}</strong></div>
              <div><span>HOA</span><strong>{currency(listing.hoaMonthly)}/mo</strong></div>
              <div><span>Year built</span><strong>{listing.yearBuilt || 'Unknown'}</strong></div>
              <div><span>Search</span><strong>{listing.searchName || 'Unknown'}</strong></div>
              <div><span>Ingested</span><strong>{compactDate(listing.ingestedAt)}</strong></div>
            </div>
          </div>

          <div className="card">
            <h2>Analysis</h2>
            {analysis ? (
              <div className="detail-list" style={{ marginTop: 16 }}>
                <div><span>Rent used</span><strong>{currency(analysis.rentUsed)}</strong></div>
                <div><span>Rent source</span><strong>{analysis.rentSource}</strong></div>
                <div><span>Monthly CF</span><strong>{currency(analysis.monthlyCf)}</strong></div>
                <div><span>Annual CF</span><strong>{currency(analysis.annualCf)}</strong></div>
                <div><span>Cap rate</span><strong>{percent(analysis.capRate)}</strong></div>
                <div><span>Cash on cash</span><strong>{percent(analysis.cashOnCash)}</strong></div>
                <div><span>Cash required</span><strong>{currency(analysis.cashRequired)}</strong></div>
                <div><span>Tag</span><strong>{analysis.tag}</strong></div>
              </div>
            ) : (
              <p className="muted">No analysis snapshot has been computed yet.</p>
            )}
          </div>

          <MarketContextPanel listingId={listing.id} initial={marketDto} compStrip={compStrip} />

          {analysis ? (
            <DealWhatIfLab
              listingId={listing.id}
              listing={{ price: listing.price, state: listing.state, hoaMonthly: listing.hoaMonthly }}
              rentInputs={{
                hudFmrSelected: analysis.hudFmrSelected,
                hudMetro: analysis.hudMetro,
                rentcastEst: analysis.rentcastEst,
              }}
              initialAssumptions={initialAssumptions}
              savedSnapshot={
                savedLive
                  ? {
                      monthlyCf: analysis.monthlyCf,
                      cashOnCash: analysis.cashOnCash,
                      capRate: analysis.capRate,
                      cashRequired: analysis.cashRequired,
                      rentUsed: analysis.rentUsed,
                      dscr: savedLive.dscr,
                    }
                  : null
              }
              marketTaxIns={{
                propertyTaxMonthlyOverride: marketDto.propertyTaxMonthlyOverride,
                insuranceMonthlyOverride: marketDto.insuranceMonthlyOverride,
              }}
            />
          ) : null}

          <div className="card">
            <h2>Price History</h2>
            {listing.priceHistory.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>No price observations recorded yet.</p>
            ) : (
              <div className="stack" style={{ marginTop: 16 }}>
                {listing.priceHistory.map((point, idx) => {
                  const prev = idx > 0 ? listing.priceHistory[idx - 1].price : null;
                  const delta = prev !== null ? point.price - prev : 0;
                  const deltaLabel = prev === null ? 'Initial' : delta === 0 ? 'No change' : (delta > 0 ? `+${currency(delta)}` : currency(delta));
                  return (
                    <div key={point.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <strong>{currency(point.price)}</strong>
                        <div className="muted">{compactDate(point.observedAt)} · {point.source}</div>
                      </div>
                      <strong className={delta < 0 ? 'tag good' : delta > 0 ? 'tag bad' : ''}>{deltaLabel}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Timeline</h2>
            <div className="stack" style={{ marginTop: 16 }}>
              {listing.events.map((event) => {
                const payload = (event.eventPayloadJson ?? {}) as Record<string, unknown>;
                let detail: string | null = null;
                if (event.eventType === 'PRICE_CHANGE' && typeof payload.fromPrice === 'number' && typeof payload.toPrice === 'number') {
                  detail = `${currency(payload.fromPrice as number)} → ${currency(payload.toPrice as number)}`;
                } else if (event.eventType === 'PRICE_INITIAL' && typeof payload.price === 'number') {
                  detail = currency(payload.price as number);
                } else if (event.eventType === 'PIPELINE_UPDATED' && typeof payload.status === 'string') {
                  detail = (payload.status as string).replaceAll('_', ' ');
                } else if (event.eventType === 'INGESTED_FROM_ZILLOW_EMAIL' && typeof payload.notificationType === 'string') {
                  detail = payload.notificationType as string;
                } else if (event.eventType === 'WHAT_IF_SNAPSHOT') {
                  const outs = payload.outputs as Record<string, unknown> | undefined;
                  const mcf = typeof outs?.monthlyCf === 'number' ? outs.monthlyCf : null;
                  detail = mcf != null ? `Lab snapshot · CF ${currency(mcf)}` : 'What-if lab snapshot';
                }
                return (
                  <div key={event.id}>
                    <strong>{event.eventType.replaceAll('_', ' ')}</strong>
                    {detail ? <div>{detail}</div> : null}
                    <div className="muted">{compactDate(event.createdAt)}</div>
                  </div>
                );
              })}
              {listing.events.length === 0 ? <p className="muted">No timeline events yet.</p> : null}
            </div>
          </div>
        </div>

        <aside className="card">
          <h2>Pipeline</h2>
          <div style={{ marginTop: 16 }}>
            <PipelineControls
              listingId={listing.id}
              status={listing.pipeline?.status || 'NEW'}
              manualDecision={listing.pipeline?.manualDecision || ''}
              manualNotes={listing.pipeline?.manualNotes || ''}
            />
          </div>
        </aside>
      </section>
    </div>
  );
}
