'use client';

import { useState } from 'react';
import { currency } from '@/lib/format';

export type MarketContextDto = {
  listingId: string;
  rentCompSummary: string;
  neighborhoodTags: string;
  floodZoneNote: string;
  schoolTierNote: string;
  rentControlNote: string;
  hoaSpecialAssessmentNote: string;
  macroStressNotes: string;
  propertyTaxMonthlyOverride: number | null;
  insuranceMonthlyOverride: number | null;
  userNotes: string;
};

type ListingCompStrip = {
  rentZestimateMonthly: number | null;
  daysOnZillow: number | null;
  sqft: number;
  rentcastLow: number;
  rentcastHigh: number;
  rentcastEst: number;
  hudFmrSelected: number;
  hudMetro: string;
  censusMedianHouseholdIncome: number | null;
  neighborhoodContextScore: number | null;
};

export function MarketContextPanel({
  listingId,
  initial,
  compStrip,
}: {
  listingId: string;
  initial: MarketContextDto;
  compStrip: ListingCompStrip | null;
}) {
  const [form, setForm] = useState<MarketContextDto>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch(`/api/listings/${listingId}/market-context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rentCompSummary: form.rentCompSummary,
        neighborhoodTags: form.neighborhoodTags,
        floodZoneNote: form.floodZoneNote,
        schoolTierNote: form.schoolTierNote,
        rentControlNote: form.rentControlNote,
        hoaSpecialAssessmentNote: form.hoaSpecialAssessmentNote,
        macroStressNotes: form.macroStressNotes,
        propertyTaxMonthlyOverride:
          form.propertyTaxMonthlyOverride === null || form.propertyTaxMonthlyOverride === undefined
            ? null
            : Math.max(0, Math.round(Number(form.propertyTaxMonthlyOverride))),
        insuranceMonthlyOverride:
          form.insuranceMonthlyOverride === null || form.insuranceMonthlyOverride === undefined
            ? null
            : Math.max(0, Math.round(Number(form.insuranceMonthlyOverride))),
        userNotes: form.userNotes,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setStatus('Save failed.');
      return;
    }
    const data = (await res.json()) as { context: MarketContextDto };
    setForm({
      ...data.context,
      listingId,
    });
    setStatus('Saved.');
  }

  return (
    <div className="card">
      <h2>Market context</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        Your notes and anchors for this property — not a public feed. Crime / third-party scores are intentionally omitted;
        pin what you verify yourself.
      </p>

      {compStrip ? (
        <div className="panel-soft" style={{ marginTop: 14 }}>
          <div className="eyebrow">On-file rent / sale signals (read-only)</div>
          <div className="detail-list" style={{ marginTop: 8 }}>
            <div><span>Rent Zestimate</span><strong>{compStrip.rentZestimateMonthly != null ? currency(compStrip.rentZestimateMonthly) : '—'}</strong></div>
            <div><span>Rentcast band</span><strong>{currency(compStrip.rentcastLow)} – {currency(compStrip.rentcastHigh)}</strong> (est {currency(compStrip.rentcastEst)})</div>
            <div><span>HUD FMR</span><strong>{compStrip.hudFmrSelected ? currency(compStrip.hudFmrSelected) : '—'}</strong> {compStrip.hudMetro ? `(${compStrip.hudMetro})` : ''}</div>
            <div><span>Days on Zillow</span><strong>{compStrip.daysOnZillow ?? '—'}</strong></div>
            <div><span>Sqft</span><strong>{compStrip.sqft ? compStrip.sqft.toLocaleString() : '—'}</strong></div>
            <div><span>ACS median HH income</span><strong>{compStrip.censusMedianHouseholdIncome != null ? currency(compStrip.censusMedianHouseholdIncome) : '—'}</strong></div>
            <div><span>Context score</span><strong>{compStrip.neighborhoodContextScore != null ? compStrip.neighborhoodContextScore.toFixed(0) : '—'}</strong></div>
          </div>
        </div>
      ) : null}

      <div className="stack" style={{ marginTop: 16 }}>
        <label className="field">
          <span>Rent / sale comp summary (your words)</span>
          <textarea
            className="field"
            rows={3}
            value={form.rentCompSummary}
            onChange={(e) => setForm((f) => ({ ...f, rentCompSummary: e.target.value }))}
          />
        </label>
        <label className="field">
          <span>Neighborhood tags (comma-separated)</span>
          <input
            value={form.neighborhoodTags}
            onChange={(e) => setForm((f) => ({ ...f, neighborhoodTags: e.target.value }))}
          />
        </label>
        <label className="field">
          <span>Flood / hazard notes</span>
          <textarea className="field" rows={2} value={form.floodZoneNote} onChange={(e) => setForm((f) => ({ ...f, floodZoneNote: e.target.value }))} />
        </label>
        <label className="field">
          <span>School tier (your classification)</span>
          <input value={form.schoolTierNote} onChange={(e) => setForm((f) => ({ ...f, schoolTierNote: e.target.value }))} />
        </label>
        <label className="field">
          <span>Rent control / regulatory</span>
          <textarea className="field" rows={2} value={form.rentControlNote} onChange={(e) => setForm((f) => ({ ...f, rentControlNote: e.target.value }))} />
        </label>
        <label className="field">
          <span>HOA / special assessments</span>
          <textarea className="field" rows={2} value={form.hoaSpecialAssessmentNote} onChange={(e) => setForm((f) => ({ ...f, hoaSpecialAssessmentNote: e.target.value }))} />
        </label>
        <label className="field">
          <span>Macro / stress notes (for your scenarios)</span>
          <textarea className="field" rows={2} value={form.macroStressNotes} onChange={(e) => setForm((f) => ({ ...f, macroStressNotes: e.target.value }))} />
        </label>
        <div className="deal-lab-grid-2">
          <label className="field">
            <span>Property tax override ($/mo, optional)</span>
            <input
              type="number"
              min={0}
              value={form.propertyTaxMonthlyOverride ?? ''}
              placeholder="Leave blank for model default"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  propertyTaxMonthlyOverride: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="field">
            <span>Insurance override ($/mo, optional)</span>
            <input
              type="number"
              min={0}
              value={form.insuranceMonthlyOverride ?? ''}
              placeholder="Leave blank for model default"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  insuranceMonthlyOverride: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        <label className="field">
          <span>General notes</span>
          <textarea className="field" rows={3} value={form.userNotes} onChange={(e) => setForm((f) => ({ ...f, userNotes: e.target.value }))} />
        </label>
      </div>
      <div className="deal-lab-actions">
        <button type="button" className="button primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save market context'}
        </button>
        {status ? <span className="muted">{status}</span> : null}
      </div>
    </div>
  );
}
