import { AssumptionsForm } from '@/components/AssumptionsForm';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AssumptionsPage() {
  const assumptions = await prisma.assumptionSet.findMany({
    orderBy: { createdAt: 'asc' },
  }).catch(() => null);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Underwriting</div>
          <h1>Assumptions</h1>
        </div>
      </div>
      <section className="card">
        <AssumptionsForm profiles={(assumptions ?? []).map((profile) => ({
          id: profile.id,
          name: profile.name,
          isDefault: profile.isDefault,
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
          maxHoa: profile.maxHoa,
          minPrice: profile.minPrice,
          minBeds: profile.minBeds,
          minBaths: profile.minBaths,
          minSqft: profile.minSqft,
        }))} />
      </section>
    </div>
  );
}
