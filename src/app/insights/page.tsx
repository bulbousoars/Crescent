import { buildInsightsPayload } from '@/lib/insights/payload';
import { InsightsDashboard } from '@/components/insights/InsightsDashboard';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const data = await buildInsightsPayload();

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Investment insights</div>
          <h1>Acquisition dashboards</h1>
          <p className="subhead">
            Eight views on ingested inventory: rent conviction, pipeline funnel, geography, price paths, stress tests, neighborhood
            context (income proxy), assumption comparison, and alert hygiene. Data reflects the latest saved analyses where available.
          </p>
        </div>
      </div>
      <InsightsDashboard data={data} />
    </div>
  );
}
