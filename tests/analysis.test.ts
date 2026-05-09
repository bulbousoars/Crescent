import { describe, expect, it } from 'vitest';
import { calculateListingAnalysis } from '@/lib/analysis';

describe('calculateListingAnalysis', () => {
  it('uses HUD FMR rent when available and computes cash flow metrics', () => {
    const result = calculateListingAnalysis({
      listing: {
        price: 180000,
        state: 'NJ',
        hoaMonthly: 75,
      },
      assumptions: {
        downPaymentPct: 0.2,
        interestRate: 0.07,
        loanTermYears: 30,
        vacancyPct: 0.08,
        maintenancePct: 0.08,
        propertyMgmtPct: 0.1,
        insuranceRate: 0.006,
        closingCostPct: 0.03,
        rentMultiplier: 0.007,
        appreciationRate: 0.03,
      },
      rent: {
        hudFmrSelected: 2200,
        hudMetro: 'Philadelphia-Camden-Wilmington',
      },
    });

    expect(result.rentUsed).toBe(2200);
    expect(result.rentSource).toBe('HUD FMR (Philadelphia-Camden-Wilmington)');
    expect(result.monthlyCf).toBeGreaterThan(0);
    expect(result.cashRequired).toBe(41400);
    expect(result.tag).toBe('CASH FLOW');
  });

  it('falls back to a price multiplier when HUD FMR is unavailable', () => {
    const result = calculateListingAnalysis({
      listing: {
        price: 100000,
        state: 'TX',
        hoaMonthly: 0,
      },
      assumptions: {
        downPaymentPct: 0.2,
        interestRate: 0.07,
        loanTermYears: 30,
        vacancyPct: 0.08,
        maintenancePct: 0.08,
        propertyMgmtPct: 0.1,
        insuranceRate: 0.006,
        closingCostPct: 0.03,
        rentMultiplier: 0.007,
        appreciationRate: 0.03,
      },
      rent: {
        hudFmrSelected: 0,
        hudMetro: '',
      },
    });

    expect(result.rentUsed).toBe(700);
    expect(result.rentSource).toBe('Price multiplier (0.7%)');
  });
});
