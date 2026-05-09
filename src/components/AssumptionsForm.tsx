'use client';

import { useRouter } from 'next/navigation';
import { CopyPlus, Save } from 'lucide-react';
import { useState, useTransition } from 'react';
import { defaultAssumptions, type EditableAssumptions } from '@/lib/defaultAssumptions';

type NumericAssumptionKey = Exclude<keyof typeof defaultAssumptions, 'name'>;

const fields: Array<[NumericAssumptionKey, string, number]> = [
  ['downPaymentPct', 'Down payment', 0.01],
  ['interestRate', 'Interest rate', 0.001],
  ['loanTermYears', 'Loan term', 1],
  ['vacancyPct', 'Vacancy', 0.01],
  ['maintenancePct', 'Maintenance', 0.01],
  ['propertyMgmtPct', 'Property management', 0.01],
  ['insuranceRate', 'Insurance rate', 0.001],
  ['closingCostPct', 'Closing costs', 0.01],
  ['rentMultiplier', 'Rent multiplier', 0.001],
  ['appreciationRate', 'Appreciation', 0.01],
  ['maxHoa', 'Max HOA', 1],
  ['minPrice', 'Min price', 1000],
  ['minBeds', 'Min beds', 0.5],
  ['minBaths', 'Min baths', 0.5],
  ['minSqft', 'Min sqft', 50],
];

export function AssumptionsForm({ profiles }: { profiles: EditableAssumptions[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialProfiles = profiles.length > 0 ? profiles : [{ ...defaultAssumptions, isDefault: true }];
  const firstProfile = initialProfiles.find((profile) => profile.isDefault) ?? initialProfiles[0];
  const [selectedId, setSelectedId] = useState(firstProfile.id ?? 'new');
  const [form, setForm] = useState<EditableAssumptions>(firstProfile);

  function selectProfile(id: string) {
    const selected = initialProfiles.find((profile) => (profile.id ?? 'new') === id);
    if (!selected) return;
    setSelectedId(id);
    setForm(selected);
  }

  function newProfile() {
    setSelectedId('new');
    setForm({ ...defaultAssumptions, name: 'New assumptions profile', isDefault: false });
  }

  async function save() {
    const method = form.id ? 'PUT' : 'POST';
    await fetch('/api/assumptions', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      <div className="toolbar split-toolbar">
        <label className="control">
          <span>Profile</span>
          <select className="field" value={selectedId} onChange={(event) => selectProfile(event.target.value)}>
            {initialProfiles.map((profile) => (
              <option key={profile.id ?? 'new'} value={profile.id ?? 'new'}>
                {profile.name}{profile.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="button" onClick={newProfile}>
          <CopyPlus size={16} />
          New profile
        </button>
      </div>
      <div className="form-grid compact">
        <label>
          <span>Name</span>
          <input
            className="field"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={Boolean(form.isDefault)}
            onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
          />
          <span>Default profile</span>
        </label>
      </div>
      <div className="form-grid">
        {fields.map(([key, label, step]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              className="field"
              type="number"
              step={step}
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>
      <button className="button primary" type="button" onClick={save} disabled={isPending}>
        <Save size={16} />
        {isPending ? 'Saving' : 'Save assumptions'}
      </button>
    </div>
  );
}
