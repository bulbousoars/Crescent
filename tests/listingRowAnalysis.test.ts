import { describe, expect, it } from 'vitest';
import { computeListingRowAnalysis, formatListingUnderwritingDisplay } from '@/lib/listingRowAnalysis';
import { defaultAssumptions } from '@/lib/defaultAssumptions';

const assumptions = {
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
};

describe('computeListingRowAnalysis', () => {
  it('uses conservative rent and applies market tax/insurance overrides', () => {
    const result = computeListingRowAnalysis(
      { price: 200_000, state: 'PA', hoaMonthly: 50 },
      { hudFmrSelected: 1800, hudMetro: 'Metro', rentcastEst: 1900 },
      assumptions,
      { propertyTaxMonthlyOverride: 400, insuranceMonthlyOverride: 120 },
    );
    expect(result).not.toBeNull();
    expect(result!.rentUsed).toBe(1800);
    expect(result!.propertyTaxMonthly).toBe(400);
    expect(result!.insuranceMonthly).toBe(120);
  });
});

describe('formatListingUnderwritingDisplay', () => {
  it('formats all underwriting columns for the listing data table', () => {
    const result = computeListingRowAnalysis(
      { price: 200_000, state: 'PA', hoaMonthly: 0 },
      { hudFmrSelected: 1650, hudMetro: 'M', rentcastEst: 1700 },
      assumptions,
    );
    const display = formatListingUnderwritingDisplay(result, {
      hudFmrSelected: 1650,
      hudMetro: 'M',
      rentcastEst: 1700,
    });
    expect(display).not.toBeNull();
    expect(display!.rentUsed).toMatch(/\$/);
    expect(display!.monthlyCf).toMatch(/\$/);
    expect(display!.capRate).toMatch(/%/);
    expect(display!.tag).toBeTruthy();
  });
});
