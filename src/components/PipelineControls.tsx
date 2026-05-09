'use client';

import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { useState, useTransition } from 'react';

const statuses = ['NEW', 'REVIEW', 'KEEP', 'DECLINED', 'OFFER', 'UNDER_CONTRACT', 'CLOSED'];

export function PipelineControls({
  listingId,
  status,
  manualDecision,
  manualNotes,
}: {
  listingId: string;
  status: string;
  manualDecision: string;
  manualNotes: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ status, manualDecision, manualNotes });

  async function save() {
    await fetch(`/api/listings/${listingId}/pipeline`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      <label className="notes-field">
        <span>Status</span>
        <select
          className="field"
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value })}
        >
          {statuses.map((item) => (
            <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label className="notes-field">
        <span>Decision</span>
        <input
          className="field"
          value={form.manualDecision}
          onChange={(event) => setForm({ ...form, manualDecision: event.target.value })}
          placeholder="Keep, pass, call agent..."
        />
      </label>
      <label className="notes-field">
        <span>Notes</span>
        <textarea
          className="field"
          value={form.manualNotes}
          onChange={(event) => setForm({ ...form, manualNotes: event.target.value })}
          placeholder="Repair concerns, rent assumptions, next steps"
        />
      </label>
      <button className="button primary" type="button" onClick={save} disabled={isPending}>
        <Save size={16} />
        {isPending ? 'Saving' : 'Save'}
      </button>
    </div>
  );
}
