import {
  calculateListingAnalysis,
  type AnalysisAssumptions,
  type AnalysisResult,
} from './analysis';
import { currency, percent } from './format';

export type ListingAnalysisSnapshot = {
  hudFmrSelected: number;
  hudMetro: string;
  rentcastEst: number;
} | null | undefined;

export type ListingForRowAnalysis = {
  price: number;
  state: string;
  hoaMonthly: number;
};

export type MarketOverrides = {
  propertyTaxMonthlyOverride?: number | null;
  insuranceMonthlyOverride?: number | null;
};

export function computeListingRowAnalysis(
  listing: ListingForRowAnalysis,
  snapshot: ListingAnalysisSnapshot,
  assumptions: AnalysisAssumptions | null,
  market?: MarketOverrides | null,
): AnalysisResult | null {
  if (!assumptions) return null;
  return calculateListingAnalysis({
    listing: {
      price: listing.price,
      state: listing.state,
      hoaMonthly: listing.hoaMonthly,
      propertyTaxMonthlyOverride: market?.propertyTaxMonthlyOverride,
      insuranceMonthlyOverride: market?.insuranceMonthlyOverride,
    },
    assumptions,
    rent: {
      hudFmrSelected: snapshot?.hudFmrSelected ?? 0,
      hudMetro: snapshot?.hudMetro ?? '',
      rentcastEst: snapshot?.rentcastEst ?? 0,
    },
  });
}

export type ListingUnderwritingDisplay = {
  rentUsed: string;
  rentTitle: string;
  hudFmr: string;
  rentcast: string;
  pAndI: string;
  propertyTaxMonthly: string;
  insuranceMonthly: string;
  totalExpensesMonthly: string;
  monthlyCf: string;
  capRate: string;
  cashOnCash: string;
  noi: string;
  downPayment: string;
  cashRequired: string;
  equity5yr: string;
  dscr: string;
  tag: AnalysisResult['tag'];
};

export function formatListingUnderwritingDisplay(
  result: AnalysisResult | null,
  snapshot: ListingAnalysisSnapshot,
): ListingUnderwritingDisplay | null {
  if (!result) return null;
  const dash = (n: number | null | undefined) =>
    n != null && n > 0 ? currency(n) : '—';
  return {
    rentUsed: currency(result.rentUsed),
    rentTitle: result.rentSource,
    hudFmr: dash(snapshot?.hudFmrSelected),
    rentcast: dash(snapshot?.rentcastEst),
    pAndI: currency(result.pAndI),
    propertyTaxMonthly: currency(result.propertyTaxMonthly),
    insuranceMonthly: currency(result.insuranceMonthly),
    totalExpensesMonthly: currency(result.totalExpensesMonthly),
    monthlyCf: currency(result.monthlyCf),
    capRate: percent(result.capRate),
    cashOnCash: percent(result.cashOnCash),
    noi: currency(result.noi),
    downPayment: currency(result.downPayment),
    cashRequired: currency(result.cashRequired),
    equity5yr: currency(result.equity5yr),
    dscr: result.dscr != null ? `${result.dscr.toFixed(2)}×` : '—',
    tag: result.tag,
  };
}
