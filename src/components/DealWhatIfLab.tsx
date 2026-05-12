'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calculateListingAnalysis,
  type AnalysisAssumptions,
} from '@/lib/analysis';
import { currency, percent } from '@/lib/format';

type RentInputs = {
  hudFmrSelected: number;
  hudMetro: string;
  rentcastEst: number;
};

export type DealWhatIfLabProps = {
  listingId: string;
  listing: { price: number; state: string; hoaMonthly: number };
  rentInputs: RentInputs;
  initialAssumptions: AnalysisAssumptions;
  /** Latest saved analysis outputs for side-by-side (optional). */
  savedSnapshot?: {
    monthlyCf: number;
    cashOnCash: number;
    capRate: number;
    cashRequired: number;
    rentUsed: number;
    dscr: number | null;
  } | null;
  /** Optional starting tax/ins overrides from market context (user can toggle). */
  marketTaxIns?: {
    propertyTaxMonthlyOverride: number | null;
    insuranceMonthlyOverride: number | null;
  } | null;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function DealWhatIfLab({
  listingId,
  listing,
  rentInputs,
  initialAssumptions,
  savedSnapshot,
  marketTaxIns,
}: DealWhatIfLabProps) {
  const [price, setPrice] = useState(listing.price);
  const [hoaMonthly, setHoaMonthly] = useState(listing.hoaMonthly);
  const [rentMode, setRentMode] = useState<'resolved' | 'manual'>('resolved');
  const [rentManual, setRentManual] = useState(savedSnapshot?.rentUsed ?? 0);
  const [assumptions, setAssumptions] = useState<AnalysisAssumptions>({ ...initialAssumptions });
  const [useTaxInsOverrides, setUseTaxInsOverrides] = useState(
    Boolean(
      marketTaxIns?.propertyTaxMonthlyOverride != null || marketTaxIns?.insuranceMonthlyOverride != null,
    ),
  );
  const [taxOverride, setTaxOverride] = useState(
    marketTaxIns?.propertyTaxMonthlyOverride != null ? String(marketTaxIns.propertyTaxMonthlyOverride) : '',
  );
  const [insOverride, setInsOverride] = useState(
    marketTaxIns?.insuranceMonthlyOverride != null ? String(marketTaxIns.insuranceMonthlyOverride) : '',
  );
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const listingInput = useMemo(() => {
    const taxNum = taxOverride.trim() === '' ? null : Number(taxOverride);
    const insNum = insOverride.trim() === '' ? null : Number(insOverride);
    const base = {
      price,
      state: listing.state,
      hoaMonthly,
      ...(rentMode === 'manual' && rentManual > 0 ? { underwritingRentMonthly: Math.round(rentManual) } : {}),
      ...(useTaxInsOverrides && taxNum != null && Number.isFinite(taxNum) && taxNum >= 0
        ? { propertyTaxMonthlyOverride: Math.round(taxNum) }
        : {}),
      ...(useTaxInsOverrides && insNum != null && Number.isFinite(insNum) && insNum >= 0
        ? { insuranceMonthlyOverride: Math.round(insNum) }
        : {}),
    };
    return base;
  }, [price, listing.state, hoaMonthly, rentMode, rentManual, useTaxInsOverrides, taxOverride, insOverride]);

  const result = useMemo(
    () =>
      calculateListingAnalysis({
        listing: listingInput,
        assumptions,
        rent: rentInputs,
      }),
    [listingInput, assumptions, rentInputs],
  );

  const resetToListing = useCallback(() => {
    setPrice(listing.price);
    setHoaMonthly(listing.hoaMonthly);
    setRentMode('resolved');
    setRentManual(savedSnapshot?.rentUsed ?? 0);
    setAssumptions({ ...initialAssumptions });
    setUseTaxInsOverrides(
      Boolean(
        marketTaxIns?.propertyTaxMonthlyOverride != null || marketTaxIns?.insuranceMonthlyOverride != null,
      ),
    );
    setTaxOverride(
      marketTaxIns?.propertyTaxMonthlyOverride != null ? String(marketTaxIns.propertyTaxMonthlyOverride) : '',
    );
    setInsOverride(
      marketTaxIns?.insuranceMonthlyOverride != null ? String(marketTaxIns.insuranceMonthlyOverride) : '',
    );
    setSaveMsg(null);
  }, [listing, initialAssumptions, savedSnapshot?.rentUsed, marketTaxIns]);

  async function saveSnapshot() {
    setSaveMsg(null);
    const inputs = {
      price,
      hoaMonthly,
      rentMode,
      rentManual,
      assumptions,
      useTaxInsOverrides,
      taxOverride: taxOverride.trim() === '' ? null : Number(taxOverride),
      insOverride: insOverride.trim() === '' ? null : Number(insOverride),
    };
    const outputs = { ...result };
    const res = await fetch(`/api/listings/${listingId}/scenario-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs, outputs }),
    });
    if (!res.ok) {
      setSaveMsg('Could not save snapshot.');
      return;
    }
    setSaveMsg('Saved to timeline. Reload page to see it.');
  }

  return (
    <div className="card deal-lab">
      <h2>What-if lab</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        Ephemeral tweaks — nothing here updates saved underwriting until you use{' '}
        <strong>Save snapshot</strong> (timeline only).
      </p>

      <div className="deal-lab-grid" style={{ marginTop: 16 }}>
        <div className="stack">
          <label className="field">
            <span>Purchase price</span>
            <input
              type="number"
              value={price}
              min={0}
              step={1000}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </label>
          <label className="field">
            <span>HOA / mo</span>
            <input
              type="number"
              value={hoaMonthly}
              min={0}
              step={10}
              onChange={(e) => setHoaMonthly(Number(e.target.value) || 0)}
            />
          </label>
          <div className="deal-lab-presets">
            <button type="button" className="button ghost" onClick={() => setPrice((p) => Math.max(0, p - 10_000))}>
              −$10k price
            </button>
            <button type="button" className="button ghost" onClick={() => setAssumptions((a) => ({ ...a, downPaymentPct: 0.25 }))}>
              25% down
            </button>
            <button type="button" className="button ghost" onClick={() => setAssumptions((a) => ({ ...a, downPaymentPct: 0.2 }))}>
              20% down
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => setAssumptions((a) => ({ ...a, interestRate: clamp(a.interestRate + 0.005, 0.01, 0.18) }))}
            >
              +0.5% rate
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                if (rentMode === 'manual' && rentManual > 0) {
                  setRentManual(Math.round(rentManual * 0.95));
                } else if (result.rentUsed > 0) {
                  setRentMode('manual');
                  setRentManual(Math.round(result.rentUsed * 0.95));
                }
              }}
            >
              −5% rent
            </button>
          </div>
        </div>

        <div className="stack">
          <fieldset className="deal-lab-fieldset">
            <legend>Rent basis</legend>
            <label className="inline">
              <input
                type="radio"
                name="rentMode"
                checked={rentMode === 'resolved'}
                onChange={() => setRentMode('resolved')}
              />
              Use HUD / Rentcast resolution (same as ingest)
            </label>
            <label className="inline">
              <input
                type="radio"
                name="rentMode"
                checked={rentMode === 'manual'}
                onChange={() => setRentMode('manual')}
              />
              Manual monthly rent
            </label>
            {rentMode === 'manual' ? (
              <label className="field" style={{ marginTop: 8 }}>
                <span>Rent $ / mo</span>
                <input
                  type="number"
                  min={0}
                  value={rentManual || ''}
                  onChange={(e) => setRentManual(Number(e.target.value) || 0)}
                />
              </label>
            ) : null}
          </fieldset>

          <label className="field">
            <span>Down payment {percent(assumptions.downPaymentPct)}</span>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={Math.round(assumptions.downPaymentPct * 100)}
              onChange={(e) =>
                setAssumptions((a) => ({ ...a, downPaymentPct: Number(e.target.value) / 100 }))
              }
            />
          </label>
          <label className="field">
            <span>Interest rate {percent(assumptions.interestRate)}</span>
            <input
              type="range"
              min={300}
              max={1400}
              step={25}
              value={Math.round(assumptions.interestRate * 10000)}
              onChange={(e) =>
                setAssumptions((a) => ({ ...a, interestRate: Number(e.target.value) / 10000 }))
              }
            />
          </label>
          <label className="field">
            <span>Vacancy {percent(assumptions.vacancyPct)}</span>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={Math.round(assumptions.vacancyPct * 100)}
              onChange={(e) =>
                setAssumptions((a) => ({ ...a, vacancyPct: Number(e.target.value) / 100 }))
              }
            />
          </label>
        </div>

        <div className="stack">
          <label className="inline">
            <input
              type="checkbox"
              checked={useTaxInsOverrides}
              onChange={(e) => setUseTaxInsOverrides(e.target.checked)}
            />
            Override property tax &amp; insurance (mo)
          </label>
          {useTaxInsOverrides ? (
            <div className="deal-lab-grid-2">
              <label className="field">
                <span>Tax $ / mo</span>
                <input
                  type="number"
                  min={0}
                  value={taxOverride}
                  placeholder="e.g. 350"
                  onChange={(e) => setTaxOverride(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Insurance $ / mo</span>
                <input
                  type="number"
                  min={0}
                  value={insOverride}
                  placeholder="e.g. 120"
                  onChange={(e) => setInsOverride(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div className="detail-list" style={{ marginTop: 12 }}>
            <div><span>Rent used</span><strong>{currency(result.rentUsed)}</strong></div>
            <div><span>Source</span><strong style={{ fontSize: 12 }}>{result.rentSource}</strong></div>
            <div><span>Cash to close</span><strong>{currency(result.cashRequired)}</strong></div>
            <div><span>Monthly CF</span><strong>{currency(result.monthlyCf)}</strong></div>
            <div><span>Cash-on-cash</span><strong>{percent(result.cashOnCash)}</strong></div>
            <div><span>Cap rate</span><strong>{percent(result.capRate)}</strong></div>
            <div>
              <span>DSCR (NOI / P&amp;I)</span>
              <strong>{result.dscr != null ? `${result.dscr.toFixed(2)}×` : '—'}</strong>
            </div>
            <div><span>Tag</span><strong>{result.tag}</strong></div>
          </div>

          {savedSnapshot ? (
            <div style={{ marginTop: 12 }} className="panel-soft">
              <div className="eyebrow">Saved analysis (DB)</div>
              <div className="detail-list" style={{ marginTop: 8 }}>
                <div><span>Monthly CF</span><strong>{currency(savedSnapshot.monthlyCf)}</strong></div>
                <div><span>CoC</span><strong>{percent(savedSnapshot.cashOnCash)}</strong></div>
                <div><span>Cap</span><strong>{percent(savedSnapshot.capRate)}</strong></div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="deal-lab-actions">
        <button type="button" className="button ghost" onClick={resetToListing}>
          Reset to listing
        </button>
        <button type="button" className="button primary" onClick={saveSnapshot}>
          Save snapshot to timeline
        </button>
      </div>
      {saveMsg ? <p className="muted" style={{ marginTop: 8 }}>{saveMsg}</p> : null}
    </div>
  );
}
