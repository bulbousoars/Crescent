'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ExternalLink, Pencil, Save, X } from 'lucide-react';
import type { ListingUnderwritingDisplay } from '@/lib/listingRowAnalysis';

type ListingRow = {
  id: string;
  address: string;
  zip: string;
  state: string;
  city: string;
  status: string;
  listingUrl: string;
  price: number;
  previousListPrice: number | null;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: string;
  lotSize: string;
  hoaMonthly: number;
  propertyType: string;
  mlsNumber: string;
  daysOnZillow: number | null;
  rentZestimateMonthly: number | null;
  estimatedPaymentMonthly: number | null;
  estimatedPAndIMonthly: number | null;
  estimatedPropertyTaxMonthly: number | null;
  estimatedInsuranceMonthly: number | null;
};

type Props = {
  listing: ListingRow;
  underwriting: ListingUnderwritingDisplay | null;
  ingestedAtDisplay: string;
  detailHref: string;
};

const EDITABLE_FIELDS = ['price', 'beds', 'baths', 'sqft', 'hoaMonthly'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function dashCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return currency(n);
}

function dashText(s: string | null | undefined) {
  const t = String(s ?? '').trim();
  return t ? t : '—';
}

function dashInt(n: number | null | undefined) {
  if (n == null) return '—';
  return String(n);
}

function tagClass(tag: string) {
  if (tag === 'CASH FLOW') return 'tag good';
  if (tag === 'EQUITY PLAY') return 'tag warn';
  return 'tag bad';
}

function ZillowEmailCells({ listing }: { listing: ListingRow }) {
  return (
    <>
      <td>{dashCurrency(listing.previousListPrice)}</td>
      <td>{listing.state}</td>
      <td>{listing.city}</td>
      <td>{listing.beds}</td>
      <td>{listing.baths}</td>
      <td>{listing.sqft.toLocaleString()}</td>
      <td>{dashText(listing.yearBuilt)}</td>
      <td>{dashText(listing.lotSize)}</td>
      <td>{currency(listing.hoaMonthly)}</td>
      <td>{dashText(listing.propertyType)}</td>
      <td>{dashText(listing.mlsNumber)}</td>
      <td>{dashInt(listing.daysOnZillow)}</td>
      <td>{dashCurrency(listing.rentZestimateMonthly)}</td>
      <td>{dashCurrency(listing.estimatedPaymentMonthly)}</td>
      <td>{dashCurrency(listing.estimatedPAndIMonthly)}</td>
      <td>{dashCurrency(listing.estimatedPropertyTaxMonthly)}</td>
      <td>{dashCurrency(listing.estimatedInsuranceMonthly)}</td>
    </>
  );
}

function UnderwritingCells({ underwriting }: { underwriting: ListingUnderwritingDisplay | null }) {
  if (!underwriting) {
    return (
      <>
        {Array.from({ length: 16 }, (_, i) => (
          <td key={i}>Pending</td>
        ))}
      </>
    );
  }
  return (
    <>
      <td title={underwriting.rentTitle}>{underwriting.rentUsed}</td>
      <td>{underwriting.hudFmr}</td>
      <td>{underwriting.rentcast}</td>
      <td>{underwriting.pAndI}</td>
      <td>{underwriting.propertyTaxMonthly}</td>
      <td>{underwriting.insuranceMonthly}</td>
      <td>{underwriting.totalExpensesMonthly}</td>
      <td>{underwriting.monthlyCf}</td>
      <td>{underwriting.capRate}</td>
      <td>{underwriting.cashOnCash}</td>
      <td>{underwriting.noi}</td>
      <td>{underwriting.downPayment}</td>
      <td>{underwriting.cashRequired}</td>
      <td>{underwriting.equity5yr}</td>
      <td>{underwriting.dscr}</td>
      <td>
        <span className={tagClass(underwriting.tag)}>{underwriting.tag}</span>
      </td>
    </>
  );
}

export function EditableListingRow({ listing, underwriting, ingestedAtDisplay, detailHref }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<EditableField, string>>({
    price: String(listing.price),
    beds: String(listing.beds),
    baths: String(listing.baths),
    sqft: String(listing.sqft),
    hoaMonthly: String(listing.hoaMonthly),
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [, startTransition] = useTransition();

  function startEdit() {
    setDraft({
      price: String(listing.price),
      beds: String(listing.beds),
      baths: String(listing.baths),
      sqft: String(listing.sqft),
      hoaMonthly: String(listing.hoaMonthly),
    });
    setStatus('idle');
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setStatus('idle');
  }

  async function save() {
    const updates: Partial<Record<EditableField, number>> = {};
    for (const field of EDITABLE_FIELDS) {
      const raw = draft[field].trim();
      if (raw === '') continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        setStatus('error');
        return;
      }
      const isInt = field !== 'beds' && field !== 'baths';
      const value = isInt ? Math.round(num) : num;
      if (value !== listing[field]) updates[field] = value;
    }
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    setStatus('saving');
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('idle');
      setEditing(false);
      startTransition(() => router.refresh());
    } catch {
      setStatus('error');
    }
  }

  function setField(field: EditableField, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  const addressCell = (
    <td>
      <Link href={detailHref}>
        <strong>{listing.address}</strong>
      </Link>
      <div className="muted">{listing.zip}</div>
    </td>
  );

  const zillowCell = (
    <td>
      <a className="zillow-link zillow-link--cell" href={listing.listingUrl} target="_blank" rel="noreferrer">
        Open <ExternalLink size={12} />
      </a>
    </td>
  );

  const emailMetricsView = <ZillowEmailCells listing={listing} />;

  const emailMetricsEdit = (
    <>
      <td>{dashCurrency(listing.previousListPrice)}</td>
      <td>{listing.state}</td>
      <td>{listing.city}</td>
      <td>
        <input className="editable-input" type="number" min={0} step="0.5" value={draft.beds} onChange={(e) => setField('beds', e.target.value)} />
      </td>
      <td>
        <input className="editable-input" type="number" min={0} step="0.5" value={draft.baths} onChange={(e) => setField('baths', e.target.value)} />
      </td>
      <td>
        <input className="editable-input" type="number" min={0} step="1" value={draft.sqft} onChange={(e) => setField('sqft', e.target.value)} />
      </td>
      <td>{dashText(listing.yearBuilt)}</td>
      <td>{dashText(listing.lotSize)}</td>
      <td>
        <input className="editable-input" type="number" min={0} step="1" value={draft.hoaMonthly} onChange={(e) => setField('hoaMonthly', e.target.value)} />
      </td>
      <td>{dashText(listing.propertyType)}</td>
      <td>{dashText(listing.mlsNumber)}</td>
      <td>{dashInt(listing.daysOnZillow)}</td>
      <td>{dashCurrency(listing.rentZestimateMonthly)}</td>
      <td>{dashCurrency(listing.estimatedPaymentMonthly)}</td>
      <td>{dashCurrency(listing.estimatedPAndIMonthly)}</td>
      <td>{dashCurrency(listing.estimatedPropertyTaxMonthly)}</td>
      <td>{dashCurrency(listing.estimatedInsuranceMonthly)}</td>
    </>
  );

  if (editing) {
    return (
      <tr className="row-editing">
        {addressCell}
        <td>{ingestedAtDisplay}</td>
        <td>
          <span className="status">{listing.status.replaceAll('_', ' ')}</span>
        </td>
        <td>
          <input className="editable-input" type="number" min={0} step="100" value={draft.price} onChange={(e) => setField('price', e.target.value)} />
        </td>
        {emailMetricsEdit}
        <UnderwritingCells underwriting={underwriting} />
        {zillowCell}
        <td>
          <div className="row-actions">
            <button type="button" className="icon-btn good" onClick={save} disabled={status === 'saving'} title="Save changes">
              <Save size={14} />
            </button>
            <button type="button" className="icon-btn" onClick={cancel} disabled={status === 'saving'} title="Cancel">
              <X size={14} />
            </button>
            {status === 'error' ? <span className="edit-flag bad">!</span> : null}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      {addressCell}
      <td>{ingestedAtDisplay}</td>
      <td>
        <span className="status">{listing.status.replaceAll('_', ' ')}</span>
      </td>
      <td>{currency(listing.price)}</td>
      {emailMetricsView}
      <UnderwritingCells underwriting={underwriting} />
      {zillowCell}
      <td>
        <div className="row-actions">
          <button type="button" className="icon-btn" onClick={startEdit} title="Edit values">
            <Pencil size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
