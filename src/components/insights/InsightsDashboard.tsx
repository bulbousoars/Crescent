'use client';

import type { InsightsPayload } from '@/lib/insights/payload';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function capColor(cap: number) {
  if (cap >= 0.08) return 'var(--good, #2d8a4e)';
  if (cap >= 0.05) return 'var(--warn, #b8860b)';
  return 'var(--bad, #a33)';
}

export function InsightsDashboard({ data }: { data: InsightsPayload }) {
  const avgStress = data.stressGrid.length
    ? {
        base: data.stressGrid.reduce((s, r) => s + r.baselineCf, 0) / data.stressGrid.length,
        rate: data.stressGrid.reduce((s, r) => s + r.ratePlus100Cf, 0) / data.stressGrid.length,
        rent: data.stressGrid.reduce((s, r) => s + r.rentMinus5Cf, 0) / data.stressGrid.length,
      }
    : { base: 0, rate: 0, rent: 0 };

  const stressBars = [
    { name: 'Baseline', cf: Math.round(avgStress.base) },
    { name: '+1% rate', cf: Math.round(avgStress.rate) },
    { name: '−5% rent', cf: Math.round(avgStress.rent) },
  ];

  const labScatter = data.assumptionLab.rows.map((r) => ({
    name: r.address.slice(0, 28),
    capA: r.capA * 100,
    capB: r.capB * 100,
  }));

  const rentBars = data.rentConviction.slice(0, 24).map((r) => ({
    ...r,
    rentZ: r.rentZestimate ?? 0,
  }));

  const qrPoints = data.qualityRisk.filter((d) => d.income != null && d.contextScore != null);

  return (
    <div className="insights">
      <nav className="insights-toc" aria-label="Dashboard sections">
        <a href="#rent-conviction">Rent</a>
        <a href="#funnel">Funnel</a>
        <a href="#capital">Capital</a>
        <a href="#market-heat">Markets</a>
        <a href="#price-path">Prices</a>
        <a href="#stress">Stress</a>
        <a href="#quality">Context</a>
        <a href="#assumption-lab">Lab</a>
        <a href="#alerts">Alerts</a>
      </nav>
      <p className="subhead insights-meta">
        Generated {new Date(data.generatedAt).toLocaleString()} · underwriting profile <strong>{data.assumptionProfile.name}</strong> (IR{' '}
        {pct(data.assumptionProfile.interestRate)}, vacancy {pct(data.assumptionProfile.vacancyPct)})
      </p>

      <section className="insights-section" id="rent-conviction">
        <h2>1 · Rent conviction vs ask</h2>
        <p className="muted">
          Compare list price to Zillow rent Zestimate, HUD FMR, Rentcast, and the <strong>underwriting rent</strong> actually used (conservative min of HUD &amp; Rentcast when both exist).
        </p>
        <div className="insights-chart">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rentBars}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="address" tickFormatter={(v) => String(v).slice(0, 14)} interval={0} angle={-28} textAnchor="end" height={70} />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="price" name="List price" fill="#6b8cae" />
              <Bar dataKey="hud" name="HUD FMR" fill="#8f7ab8" />
              <Bar dataKey="rentcast" name="Rentcast" fill="#c4896b" />
              <Bar dataKey="rentZ" name="Rent Zest." fill="#5a9e8f" />
              <Bar dataKey="rentUsed" name="Rent used" fill="#d4a84b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="insights-section" id="funnel">
        <h2>2 · Upside funnel (pipeline)</h2>
        <p className="muted">Count and median cap rate by pipeline status — where deals concentrate and how quality shifts by stage.</p>
        <div className="insights-chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.funnel}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="status" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Listings" fill="#6b8cae" />
              <Bar yAxisId="right" dataKey="medianCapPct" name="Median cap %" fill="#c4896b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="insights-section" id="capital">
        <h2>2b · Capital in play by stage</h2>
        <p className="muted">
          Sum of <strong>list prices</strong> in each pipeline bucket — a buy-side view of exposure (not agent lead value).
        </p>
        <div className="insights-table-wrap">
          <table className="insights-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Listings</th>
                <th>Total list price</th>
                <th>Avg price</th>
                <th>Median cap %</th>
              </tr>
            </thead>
            <tbody>
              {data.funnel.map((r) => (
                <tr key={r.status}>
                  <td>{r.status.replaceAll('_', ' ')}</td>
                  <td>{r.count}</td>
                  <td>${r.totalListPrice.toLocaleString()}</td>
                  <td>${r.avgPrice.toLocaleString()}</td>
                  <td>{r.medianCapPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="insights-section" id="market-heat">
        <h2>3 · Market heat (city)</h2>
        <p className="muted">Top markets by listing count with median price and median stored cap rate.</p>
        <div className="insights-chart">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.marketHeat}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" interval={0} angle={-22} textAnchor="end" height={64} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Count" fill="#6b8cae" />
              <Bar yAxisId="left" dataKey="medianPrice" name="Med. price" fill="#8f7ab8" />
              <Bar yAxisId="right" dataKey="medianCapPct" name="Med. cap %" fill="#5a9e8f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="insights-section" id="price-path">
        <h2>4 · Price trajectory</h2>
        <p className="muted">Recent price history points for listings with multiple observations (up to 5 properties).</p>
        {data.priceTrajectory.slice(0, 5).map((tr) => (
          <div key={tr.listingId} className="insights-subchart">
            <h3>{tr.address}</h3>
            <div className="insights-chart">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tr.points}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString()} />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(v) => `$${Number(v).toLocaleString()}`}
                    labelFormatter={(l) => new Date(String(l)).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="price" stroke="#6b8cae" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
        {data.priceTrajectory.length === 0 ? <p className="muted">No multi-point price history yet.</p> : null}
      </section>

      <section className="insights-section" id="stress">
        <h2>5 · Stress grid</h2>
        <p className="muted">
          Average monthly CF across {data.stressGrid.length} listings with stored rent: baseline vs +100bp interest vs −5% rent (underwriting rent override).
        </p>
        <div className="insights-chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stressBars}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              <Bar dataKey="cf" name="Avg monthly CF" fill="#8f7ab8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="insights-table-wrap">
          <table className="insights-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Baseline CF</th>
                <th>+1% rate</th>
                <th>−5% rent</th>
              </tr>
            </thead>
            <tbody>
              {data.stressGrid.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td>{r.address}</td>
                  <td>${r.baselineCf.toLocaleString()}</td>
                  <td>${r.ratePlus100Cf.toLocaleString()}</td>
                  <td>${r.rentMinus5Cf.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="insights-section" id="quality">
        <h2>6 · Quality / context (income proxy)</h2>
        <p className="muted">
          <strong>Not FBI crime data.</strong> ACS median household income (when configured) and a coarse &quot;context&quot; score derived from income bands — plotted vs stored cap rate.
        </p>
        <div className="insights-chart">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" dataKey="income" name="Median HH income" tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
              <YAxis type="number" dataKey="contextScore" name="Context score" domain={[0, 100]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(v, name) => (String(name).toLowerCase().includes('cap') ? pct(Number(v)) : v)}
              />
              <Scatter name="Listings" data={qrPoints} fill="#6b8cae">
                {qrPoints.map((entry) => (
                  <Cell key={entry.id} fill={capColor(entry.capRate)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {qrPoints.length === 0 ? (
          <p className="muted">Enrich listings (HUD + Rentcast + optional Census API key) to populate income and context scores.</p>
        ) : null}
      </section>

      <section className="insights-section" id="assumption-lab">
        <h2>7 · Assumption lab</h2>
        <p className="muted">
          Cap rate under <strong>{data.assumptionLab.a.name}</strong> vs <strong>{data.assumptionLab.b.name}</strong> (same rent inputs per listing).
        </p>
        <div className="insights-chart">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" dataKey="capA" name={`${data.assumptionLab.a.name} cap %`} />
              <YAxis type="number" dataKey="capB" name={`${data.assumptionLab.b.name} cap %`} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
              <Scatter data={labScatter} fill="#6b8cae" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="insights-section" id="alerts">
        <h2>8 · Alert hygiene</h2>
        <p className="muted">Notification mix, top saved searches, duplicate full addresses, and listings not refreshed in 45+ days.</p>
        <div className="insights-grid-2">
          <div>
            <h3>By notification type</h3>
            <div className="insights-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.alertHygiene.byNotification.slice(0, 12)} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tickFormatter={(v) => String(v).slice(0, 18)} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8f7ab8" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3>Top saved searches</h3>
            <ul className="insights-list">
              {data.alertHygiene.topSearches.map((s) => (
                <li key={s.name}>
                  <span>{s.name}</span> <span className="muted">{s.count}</span>
                </li>
              ))}
            </ul>
            <h3>Duplicate full addresses</h3>
            {data.alertHygiene.duplicateAddresses.length === 0 ? (
              <p className="muted">None detected.</p>
            ) : (
              <ul className="insights-list">
                {data.alertHygiene.duplicateAddresses.map((z) => (
                  <li key={z.address}>
                    <span>{z.address}</span> <span className="muted">×{z.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="insights-stale">
              Stale listings (no refresh in 45d): <strong>{data.alertHygiene.staleListings}</strong>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
