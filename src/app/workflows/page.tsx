import { prisma } from '@/lib/prisma';
import { compactDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WorkflowsPage() {
  const runs = await prisma.workflowRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
  }).catch(() => []);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Ingestion Logs</div>
          <h1>Run history</h1>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Started</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.type.replaceAll('_', ' ')}</td>
                <td><span className="status">{run.status}</span></td>
                <td>{compactDate(run.startedAt)}</td>
                <td>{run.completedAt ? compactDate(run.completedAt) : <span className="muted">Pending</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 ? <div className="empty">No workflow runs have been recorded yet.</div> : null}
      </div>
    </div>
  );
}
