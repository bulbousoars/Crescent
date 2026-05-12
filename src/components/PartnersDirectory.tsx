'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Partner = {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  linkedListingId: string | null;
  linkedListing: { id: string; address: string } | null;
};

type ListingOpt = { id: string; address: string };

export function PartnersDirectory() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [listings, setListings] = useState<ListingOpt[]>([]);
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    role: '',
    company: '',
    email: '',
    phone: '',
    notes: '',
    linkedListingId: '' as string,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = roleFilter.trim() ? `?role=${encodeURIComponent(roleFilter.trim())}` : '';
    const [pr, ls] = await Promise.all([
      fetch(`/api/partners${q}`).then((r) => r.json()),
      fetch('/api/listings').then((r) => r.json()),
    ]);
    setPartners(pr.partners ?? []);
    setListings((ls.listings ?? []).map((l: { id: string; address: string }) => ({ id: l.id, address: l.address })));
    setLoading(false);
  }, [roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(f) ||
        p.email.toLowerCase().includes(f) ||
        p.phone.includes(f) ||
        p.role.toLowerCase().includes(f) ||
        p.notes.toLowerCase().includes(f),
    );
  }, [partners, filter]);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        linkedListingId: form.linkedListingId || null,
      }),
    });
    if (!res.ok) return;
    setForm({ name: '', role: '', company: '', email: '', phone: '', notes: '', linkedListingId: '' });
    await load();
  }

  async function deletePartner(id: string) {
    if (!confirm('Delete this contact?')) return;
    await fetch(`/api/partners/${id}`, { method: 'DELETE' });
    await load();
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  async function deleteAll() {
    if (!confirm('Delete ALL partner contacts? This cannot be undone.')) return;
    const token = prompt('Type DELETE_ALL_PARTNERS to confirm:');
    if (token !== 'DELETE_ALL_PARTNERS') return;
    const res = await fetch('/api/partners/delete-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE_ALL_PARTNERS' }),
    });
    if (res.ok) await load();
  }

  function startEdit(p: Partner) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      role: p.role,
      company: p.company,
      email: p.email,
      phone: p.phone,
      notes: p.notes,
      linkedListingId: p.linkedListingId ?? '',
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !form.name.trim()) return;
    const res = await fetch(`/api/partners/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        linkedListingId: form.linkedListingId || null,
      }),
    });
    if (!res.ok) return;
    setEditingId(null);
    setForm({ name: '', role: '', company: '', email: '', phone: '', notes: '', linkedListingId: '' });
    await load();
  }

  if (loading) return <p className="muted">Loading contacts…</p>;

  return (
    <div className="stack">
      <div className="partners-toolbar">
        <input
          className="field"
          style={{ maxWidth: 280 }}
          placeholder="Search name, email, phone, notes…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <input
          className="field"
          style={{ maxWidth: 160 }}
          placeholder="Role contains…"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        />
        <button type="button" className="button" onClick={() => void load()}>
          Apply role filter
        </button>
        <a className="button" href="/api/partners/export">
          Export CSV
        </a>
        <button type="button" className="button ghost" onClick={deleteAll}>
          Delete all
        </button>
      </div>

      <div className="card">
        <h2>{editingId ? 'Edit contact' : 'Add contact'}</h2>
        <form className="stack" style={{ marginTop: 12 }} onSubmit={editingId ? saveEdit : createPartner}>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </label>
          <div className="deal-lab-grid-2">
            <label className="field">
              <span>Role tags (e.g. lender, PM)</span>
              <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
            </label>
            <label className="field">
              <span>Company</span>
              <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </label>
          </div>
          <div className="deal-lab-grid-2">
            <label className="field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span>Link to listing (optional)</span>
            <select
              className="field"
              value={form.linkedListingId}
              onChange={(e) => setForm((f) => ({ ...f, linkedListingId: e.target.value }))}
            >
              <option value="">— None —</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.address.slice(0, 80)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea className="field" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="deal-lab-actions">
            <button type="submit" className="button primary">
              {editingId ? 'Save changes' : 'Add contact'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: '', role: '', company: '', email: '', phone: '', notes: '', linkedListingId: '' });
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="card partners-table-wrap">
        <h2>Your directory ({filtered.length})</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Nothing is pre-seeded — your Rolodex only. PII stays in your deployment; export or delete-all for portability.
        </p>
        <table style={{ marginTop: 16, minWidth: 720 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Contact</th>
              <th>Linked deal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  {p.company ? <div className="muted">{p.company}</div> : null}
                </td>
                <td>{p.role || '—'}</td>
                <td>
                  {p.email ? (
                    <button type="button" className="button ghost" style={{ marginRight: 6 }} onClick={() => copy(p.email)}>
                      Copy email
                    </button>
                  ) : null}
                  {p.phone ? (
                    <button type="button" className="button ghost" onClick={() => copy(p.phone)}>
                      Copy phone
                    </button>
                  ) : null}
                  {p.notes ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{p.notes}</div> : null}
                </td>
                <td>
                  {p.linkedListing ? (
                    <Link href={`/listings/${p.linkedListing.id}`}>
                      {p.linkedListing.address.length > 40
                        ? `${p.linkedListing.address.slice(0, 40)}…`
                        : p.linkedListing.address}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <button type="button" className="button ghost" onClick={() => startEdit(p)}>
                    Edit
                  </button>{' '}
                  <button type="button" className="button ghost" onClick={() => void deletePartner(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>No contacts yet.</p> : null}
      </div>
    </div>
  );
}
