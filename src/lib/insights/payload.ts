import type { PipelineStatus } from '@prisma/client';
import { calculateListingAnalysis } from '@/lib/analysis';
import { defaultAssumptions } from '@/lib/defaultAssumptions';
import { prisma } from '@/lib/prisma';

const MAX_LISTINGS = 4000;

export type InsightsPayload = {
  generatedAt: string;
  assumptionProfile: {
    id: string;
    name: string;
    downPaymentPct: number;
    interestRate: number;
    loanTermYears: number;
    vacancyPct: number;
    maintenancePct: number;
    propertyMgmtPct: number;
    insuranceRate: number;
    closingCostPct: number;
    rentMultiplier: number;
    appreciationRate: number;
  };
  rentConviction: Array<{
    id: string;
    address: string;
    price: number;
    rentZestimate: number | null;
    hud: number;
    rentcast: number;
    rentUsed: number;
    rentSource: string;
    capRate: number;
    monthlyCf: number;
  }>;
  funnel: Array<{
    status: PipelineStatus;
    count: number;
    avgPrice: number;
    medianCap: number;
    medianCapPct: number;
  }>;
  marketHeat: Array<{
    key: string;
    label: string;
    city: string;
    state: string;
    count: number;
    medianPrice: number;
    medianCap: number;
    medianCapPct: number;
  }>;
  priceTrajectory: Array<{
    listingId: string;
    address: string;
    points: Array<{ t: string; price: number }>;
  }>;
  stressGrid: Array<{
    id: string;
    address: string;
    baselineCf: number;
    ratePlus100Cf: number;
    rentMinus5Cf: number;
  }>;
  qualityRisk: Array<{
    id: string;
    address: string;
    income: number | null;
    contextScore: number | null;
    capRate: number;
  }>;
  assumptionLab: {
    a: { id: string; name: string };
    b: { id: string; name: string };
    rows: Array<{ id: string; address: string; capA: number; capB: number }>;
  };
  alertHygiene: {
    byNotification: Array<{ name: string; count: number }>;
    topSearches: Array<{ name: string; count: number }>;
    duplicateAddresses: Array<{ address: string; count: number }>;
    staleListings: number;
  };
};

function median(nums: number[]): number {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (a.length === 0) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mean(nums: number[]): number {
  const a = nums.filter((n) => Number.isFinite(n));
  if (!a.length) return 0;
  return a.reduce((s, n) => s + n, 0) / a.length;
}

export async function buildInsightsPayload(): Promise<InsightsPayload> {
  const assumptionsRow =
    (await prisma.assumptionSet.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: 'desc' } })) ??
    (await prisma.assumptionSet.findFirst({ orderBy: { createdAt: 'asc' } }));

  const profile = assumptionsRow ?? {
    id: 'default',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...defaultAssumptions,
  };

  const listings = await prisma.listing.findMany({
    include: {
      pipeline: true,
      analysis: { orderBy: { computedAt: 'desc' }, take: 1 },
    },
    orderBy: { ingestedAt: 'desc' },
    take: MAX_LISTINGS,
  });

  const rentConviction = listings
    .map((l) => {
      const s = l.analysis[0];
      if (!s) return null;
      const live = calculateListingAnalysis({
        listing: { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly },
        assumptions: profile,
        rent: {
          hudFmrSelected: s.hudFmrSelected,
          hudMetro: s.hudMetro,
          rentcastEst: s.rentcastEst,
        },
      });
      return {
        id: l.id,
        address: l.address,
        price: l.price,
        rentZestimate: l.rentZestimateMonthly,
        hud: s.hudFmrSelected,
        rentcast: s.rentcastEst,
        rentUsed: live.rentUsed,
        rentSource: live.rentSource,
        capRate: s.capRate,
        monthlyCf: s.monthlyCf,
      };
    })
    .filter(Boolean) as InsightsPayload['rentConviction'];

  const funnelMap = new Map<PipelineStatus, { prices: number[]; caps: number[] }>();
  for (const l of listings) {
    const st = l.pipeline?.status ?? 'NEW';
    const s = l.analysis[0];
    if (!funnelMap.has(st)) funnelMap.set(st, { prices: [], caps: [] });
    const bucket = funnelMap.get(st)!;
    bucket.prices.push(l.price);
    if (s) bucket.caps.push(s.capRate);
  }
  const funnel: InsightsPayload['funnel'] = Array.from(funnelMap.entries()).map(([status, v]) => ({
    status,
    count: v.prices.length,
    avgPrice: Math.round(mean(v.prices)),
    medianCap: median(v.caps),
    medianCapPct: median(v.caps) * 100,
  }));

  const heatMap = new Map<string, { city: string; state: string; prices: number[]; caps: number[] }>();
  for (const l of listings) {
    const key = `${l.city}|${l.state}`;
    if (!heatMap.has(key)) heatMap.set(key, { city: l.city, state: l.state, prices: [], caps: [] });
    const h = heatMap.get(key)!;
    h.prices.push(l.price);
    const s = l.analysis[0];
    if (s) h.caps.push(s.capRate);
  }
  const marketHeat: InsightsPayload['marketHeat'] = Array.from(heatMap.entries())
    .map(([key, v]) => ({
      key,
      label: `${v.city}, ${v.state}`,
      city: v.city,
      state: v.state,
      count: v.prices.length,
      medianPrice: Math.round(median(v.prices)),
      medianCap: median(v.caps),
      medianCapPct: median(v.caps) * 100,
    }))
    .filter((r) => r.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  const histories = await prisma.listingPriceHistory.findMany({
    orderBy: { observedAt: 'asc' },
    take: 8000,
    select: {
      listingId: true,
      price: true,
      observedAt: true,
      listing: { select: { address: true } },
    },
  });
  const byListing = new Map<string, { address: string; points: Array<{ t: string; price: number }> }>();
  for (const h of histories) {
    if (!byListing.has(h.listingId)) {
      byListing.set(h.listingId, { address: h.listing.address, points: [] });
    }
    byListing.get(h.listingId)!.points.push({ t: h.observedAt.toISOString(), price: h.price });
  }
  const priceTrajectory = Array.from(byListing.entries())
    .filter(([, v]) => v.points.length >= 2)
    .sort((a, b) => b[1].points.length - a[1].points.length)
    .slice(0, 20)
    .map(([listingId, v]) => ({
      listingId,
      address: v.address,
      points: v.points.slice(-12),
    }));

  const stressGrid: InsightsPayload['stressGrid'] = [];
  const stressSample = listings.filter((l) => l.analysis[0]?.rentUsed).slice(0, 48);
  for (const l of stressSample) {
    const s = l.analysis[0]!;
    const r = s.rentUsed;
    const base = calculateListingAnalysis({
      listing: { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly, underwritingRentMonthly: r },
      assumptions: profile,
      rent: { hudFmrSelected: 0, hudMetro: '' },
    });
    const rateUp = calculateListingAnalysis({
      listing: { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly, underwritingRentMonthly: r },
      assumptions: { ...profile, interestRate: profile.interestRate + 0.01 },
      rent: { hudFmrSelected: 0, hudMetro: '' },
    });
    const rentDn = calculateListingAnalysis({
      listing: {
        price: l.price,
        state: l.state,
        hoaMonthly: l.hoaMonthly,
        underwritingRentMonthly: Math.max(0, Math.round(r * 0.95)),
      },
      assumptions: profile,
      rent: { hudFmrSelected: 0, hudMetro: '' },
    });
    stressGrid.push({
      id: l.id,
      address: l.address,
      baselineCf: base.monthlyCf,
      ratePlus100Cf: rateUp.monthlyCf,
      rentMinus5Cf: rentDn.monthlyCf,
    });
  }

  const qualityRisk: InsightsPayload['qualityRisk'] = listings
    .filter((l) => l.censusMedianHouseholdIncome != null || l.neighborhoodContextScore != null)
    .map((l) => ({
      id: l.id,
      address: l.address,
      income: l.censusMedianHouseholdIncome,
      contextScore: l.neighborhoodContextScore,
      capRate: l.analysis[0]?.capRate ?? 0,
    }))
    .slice(0, 200);

  const sets = await prisma.assumptionSet.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], take: 2 });
  const labA = sets[0] ?? profile;
  const labB = sets[1] ?? { ...labA, id: `${labA.id}-alt`, name: `${labA.name} (copy)`, interestRate: Math.min(0.12, labA.interestRate + 0.005) };
  const labRows: InsightsPayload['assumptionLab']['rows'] = [];
  for (const l of listings.slice(0, 80)) {
    const s = l.analysis[0];
    if (!s) continue;
    const rentIn = {
      hudFmrSelected: s.hudFmrSelected,
      hudMetro: s.hudMetro,
      rentcastEst: s.rentcastEst,
    };
    const capA = calculateListingAnalysis({
      listing: { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly },
      assumptions: labA,
      rent: rentIn,
    }).capRate;
    const capB = calculateListingAnalysis({
      listing: { price: l.price, state: l.state, hoaMonthly: l.hoaMonthly },
      assumptions: labB,
      rent: rentIn,
    }).capRate;
    labRows.push({ id: l.id, address: l.address, capA, capB });
  }

  const notifMap = new Map<string, number>();
  const searchMap = new Map<string, number>();
  const addrInfo = new Map<string, { count: number; display: string }>();
  for (const l of listings) {
    const n = l.notificationType || 'Unknown';
    notifMap.set(n, (notifMap.get(n) ?? 0) + 1);
    const sn = (l.searchName || '').trim() || '(blank search)';
    searchMap.set(sn, (searchMap.get(sn) ?? 0) + 1);
    const k = (l.address || '').trim().toLowerCase();
    if (!k) continue;
    const prev = addrInfo.get(k);
    if (prev) addrInfo.set(k, { count: prev.count + 1, display: prev.display });
    else addrInfo.set(k, { count: 1, display: l.address });
  }
  const duplicateAddresses = Array.from(addrInfo.values())
    .filter((v) => v.count > 1)
    .map((v) => ({ address: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const staleDays = 45;
  const staleCut = Date.now() - staleDays * 86400000;
  const staleListings = listings.filter((l) => l.lastSeenAt.getTime() < staleCut).length;

  return {
    generatedAt: new Date().toISOString(),
    assumptionProfile: {
      id: profile.id,
      name: profile.name,
      downPaymentPct: profile.downPaymentPct,
      interestRate: profile.interestRate,
      loanTermYears: profile.loanTermYears,
      vacancyPct: profile.vacancyPct,
      maintenancePct: profile.maintenancePct,
      propertyMgmtPct: profile.propertyMgmtPct,
      insuranceRate: profile.insuranceRate,
      closingCostPct: profile.closingCostPct,
      rentMultiplier: profile.rentMultiplier,
      appreciationRate: profile.appreciationRate,
    },
    rentConviction,
    funnel,
    marketHeat,
    priceTrajectory,
    stressGrid,
    qualityRisk,
    assumptionLab: {
      a: { id: labA.id, name: labA.name },
      b: { id: labB.id, name: labB.name },
      rows: labRows,
    },
    alertHygiene: {
      byNotification: Array.from(notifMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      topSearches: Array.from(searchMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
      duplicateAddresses,
      staleListings,
    },
  };
}
