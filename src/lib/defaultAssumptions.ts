export const defaultAssumptions = {
  name: 'Default underwriting',
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
  maxHoa: 300,
  minPrice: 50000,
  minBeds: 2,
  minBaths: 1,
  minSqft: 800,
};

export type EditableAssumptions = typeof defaultAssumptions & {
  id?: string;
  isDefault?: boolean;
};
