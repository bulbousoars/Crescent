export type AnalysisAssumptions = {
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

export type AnalysisInput = {
  listing: {
    price: number;
    state: string;
    hoaMonthly: number;
  };
  assumptions: AnalysisAssumptions;
  rent: {
    hudFmrSelected: number;
    hudMetro: string;
  };
};

export type AnalysisResult = {
  rentUsed: number;
  rentSource: string;
  propertyTaxRate: number;
  stateTaxRate: number;
  pAndI: number;
  propertyTaxMonthly: number;
  insuranceMonthly: number;
  totalExpensesMonthly: number;
  monthlyCf: number;
  annualCf: number;
  afterTaxCf: number;
  noi: number;
  capRate: number;
  cashOnCash: number;
  cashRequired: number;
  equity5yr: number;
  tag: 'CASH FLOW' | 'EQUITY PLAY' | 'PASS';
};

const noIncomeTaxStates = new Set(['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']);
const propertyTaxRates: Record<string, number> = {
  AZ: 0.0062,
  CO: 0.0055,
  FL: 0.0089,
  NJ: 0.0223,
  NV: 0.0061,
  PA: 0.0135,
  TN: 0.0067,
  TX: 0.016,
  WA: 0.0093,
};

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export function calculateListingAnalysis(input: AnalysisInput): AnalysisResult {
  const { listing, assumptions, rent } = input;
  const price = listing.price || 0;
  const rentUsed = rent.hudFmrSelected > 0
    ? rent.hudFmrSelected
    : round(price * assumptions.rentMultiplier);
  const rentSource = rent.hudFmrSelected > 0
    ? `HUD FMR (${rent.hudMetro || 'selected zip'})`
    : 'Price multiplier (0.7%)';

  const propertyTaxRate = propertyTaxRates[listing.state] ?? 0.012;
  const stateTaxRate = noIncomeTaxStates.has(listing.state) ? 0 : 0.05;
  const loanAmount = price * (1 - assumptions.downPaymentPct);
  const monthlyRate = assumptions.interestRate / 12;
  const payments = assumptions.loanTermYears * 12;
  const pAndI = payments > 0 && monthlyRate > 0
    ? loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -payments))
    : 0;

  const propertyTaxMonthly = price * propertyTaxRate / 12;
  const insuranceMonthly = price * assumptions.insuranceRate / 12;
  const vacancyMonthly = rentUsed * assumptions.vacancyPct;
  const maintenanceMonthly = rentUsed * assumptions.maintenancePct;
  const propertyMgmtMonthly = rentUsed * assumptions.propertyMgmtPct;
  const totalExpensesMonthly = pAndI +
    propertyTaxMonthly +
    insuranceMonthly +
    (listing.hoaMonthly || 0) +
    vacancyMonthly +
    maintenanceMonthly +
    propertyMgmtMonthly;
  const monthlyCf = rentUsed - totalExpensesMonthly;
  const annualCf = monthlyCf * 12;
  const noi = (rentUsed * (1 - assumptions.vacancyPct) -
    propertyTaxMonthly -
    insuranceMonthly -
    (listing.hoaMonthly || 0) -
    maintenanceMonthly) * 12;
  const cashRequired = price * assumptions.downPaymentPct + price * assumptions.closingCostPct;
  const capRate = price > 0 ? noi / price : 0;
  const cashOnCash = cashRequired > 0 ? annualCf / cashRequired : 0;
  const afterTaxCf = monthlyCf * (1 - stateTaxRate);
  const projectedValue5yr = price * Math.pow(1 + assumptions.appreciationRate, 5);
  const balance5yr = monthlyRate > 0
    ? loanAmount * Math.pow(1 + monthlyRate, 60) - pAndI * (Math.pow(1 + monthlyRate, 60) - 1) / monthlyRate
    : loanAmount;
  const equity5yr = projectedValue5yr - balance5yr;
  const tag = monthlyCf >= 100 ? 'CASH FLOW' : equity5yr / Math.max(cashRequired, 1) > 1 ? 'EQUITY PLAY' : 'PASS';

  return {
    rentUsed: round(rentUsed),
    rentSource,
    propertyTaxRate,
    stateTaxRate,
    pAndI: round(pAndI),
    propertyTaxMonthly: round(propertyTaxMonthly),
    insuranceMonthly: round(insuranceMonthly),
    totalExpensesMonthly: round(totalExpensesMonthly),
    monthlyCf: round(monthlyCf),
    annualCf: round(annualCf),
    afterTaxCf: round(afterTaxCf),
    noi: round(noi),
    capRate,
    cashOnCash,
    cashRequired: round(cashRequired),
    equity5yr: round(equity5yr),
    tag,
  };
}
