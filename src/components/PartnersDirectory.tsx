'use client';

import {
  Building2,
  Check,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Save,
  Search,
  Tag,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const emptyForm = {
  name: '',
  role: '',
  company: '',
  email: '',
  phone: '',
  notes: '',
  linkedListingId: '' as string,
};

export function PartnersDirectory() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [listings, setListings] = useState<ListingOpt[]>([]);
  const [filter, setFilter] = useState('');
  const [roleDraft, setRoleDraft] = useState('');
  const [debouncedRole, setDebouncedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRole(roleDraft.trim()), 400);
    return () => clearTimeout(t);
  }, [roleDraft]);

  const load = useCallback(async () => {
    if (mounted.current) setRefreshing(true);
    else setLoading(true);
    const q = debouncedRole ? `?role=${encodeURIComponent(debouncedRole)}` : '';
    try {
      const [pr, ls] = await Promise.all([
        fetch(`/api/partners${q}`).then((r) => r.json()),
        fetch('/api/listings').then((r) => r.json()),
      ]);
      setPartners(pr.partners ?? []);
      setListings((ls.listings ?? []).map((l: { id: string; address: string }) => ({ id: l.id, address: l.address })));
    } finally {
      setLoading(false);
      setRefreshing(false);
      mounted.current = true;
    }
  }, [debouncedRole]);

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
    setForm(emptyForm);
    showToast('Contact added');
    await load();
  }

  async function deletePartner(id: string) {
    if (!confirm('Delete this contact?')) return;
    await fetch(`/api/partners/${id}`, { method: 'DELETE' });
    showToast('Contact removed');
    await load();
  }

  function copyField(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    showToast(`${label} copied`);
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
    if (res.ok) {
      showToast('All contacts deleted');
      await load();
    }
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

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
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
    cancelEdit();
    showToast('Contact updated');
    await load();
  }

  return (
    <div className="partners-page">
      {toast ? (
        <div className="partners-toast" role="status">
          <Check size={16} aria-hidden />
          {toast}
        </div>
      ) : null}

      <div className="card partners-filters">
        <div className="partners-filters-grid">
          <label className="control partners-filter-search">
            <span>
              <Search size={14} aria-hidden style={{ opacity: 0.7, verticalAlign: '-0.1em' }} /> Search
            </span>
            <input
              className="field"
              placeholder="Name, email, phone, role, notes…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="control partners-filter-role">
            <span>
              <Tag size={14} aria-hidden style={{ opacity: 0.7, verticalAlign: '-0.1em' }} /> Role filter
            </span>
            <input
              className="field"
              placeholder="e.g. lender"
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              autoComplete="off"
            />
            <span className="partners-filter-hint">Server filter · updates shortly after you stop typing</span>
          </label>
          <div className="partners-filters-actions">
            <a className="button" href="/api/partners/export">
              <Download size={16} />
              Export CSV
            </a>
            <button type="button" className="button partners-danger-outline" onClick={deleteAll}>
              <Trash2 size={16} />
              Delete all
            </button>
          </div>
        </div>
      </div>

      <div className="card partners-form-card">
        <header className="partners-form-head">
          <div>
            <h2>{editingId ? 'Edit contact' : 'New contact'}</h2>
            <p className="muted partners-form-sub">
              {editingId
                ? 'Update details below, then save. Nothing is shared outside your deployment.'
                : 'Add lenders, attorneys, PMs, contractors — your Rolodex only.'}
            </p>
          </div>
          {editingId ? (
            <button type="button" className="button ghost partners-form-cancel" onClick={cancelEdit}>
              <X size={16} />
              Cancel
            </button>
          ) : (
            <div className="partners-form-badge" aria-hidden>
              <UserPlus size={20} />
            </div>
          )}
        </header>

        <form className="partners-contact-form" onSubmit={editingId ? saveEdit : createPartner}>
          <div className="partners-form-grid">
            <label className="control partners-span-2">
              <span>Full name</span>
              <input
                className="field"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </label>

            <label className="control">
              <span>Role / tags</span>
              <input
                className="field"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Lender, PM, attorney…"
                autoComplete="organization-title"
              />
            </label>

            <label className="control">
              <span>Company</span>
              <input
                className="field"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Optional"
                autoComplete="organization"
              />
            </label>

            <label className="control">
              <span>Email</span>
              <input
                className="field"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>

            <label className="control">
              <span>Phone</span>
              <input
                className="field"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 000-0000"
                autoComplete="tel"
              />
            </label>

            <label className="control partners-span-2">
              <span>
                <Link2 size={14} aria-hidden style={{ opacity: 0.7, verticalAlign: '-0.1em' }} /> Linked listing
              </span>
              <select
                className="field"
                value={form.linkedListingId}
                onChange={(e) => setForm((f) => ({ ...f, linkedListingId: e.target.value }))}
              >
                <option value="">No listing linked</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.address.length > 96 ? `${l.address.slice(0, 96)}…` : l.address}
                  </option>
                ))}
              </select>
            </label>

            <label className="control partners-span-2 notes-field">
              <span>
                <FileText size={14} aria-hidden style={{ opacity: 0.7, verticalAlign: '-0.1em' }} /> Notes
              </span>
              <textarea
                className="field"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Rates quoted, scope of work, how you met…"
              />
            </label>
          </div>

          <div className="partners-form-actions">
            <button type="submit" className="button primary">
              {editingId ? (
                <>
                  <Save size={16} />
                  Save changes
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Add contact
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="card partners-directory-card">
        <header className="partners-directory-head">
          <div>
            <h2>Directory</h2>
            <p className="muted partners-form-sub">
              {loading ? 'Loading…' : refreshing ? 'Updating…' : `${filtered.length} contact${filtered.length === 1 ? '' : 's'} shown`}
            </p>
          </div>
          {loading || refreshing ? <Loader2 className="partners-spinner" size={22} aria-label="Loading" /> : null}
        </header>

        <div className="table-wrap partners-table-wrap">
          <table className="partners-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Role</th>
                <th>Reach</th>
                <th>Deal</th>
                <th className="partners-col-actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="partners-name-block">
                      <strong className="partners-name">{p.name}</strong>
                      {p.company ? (
                        <span className="partners-company">
                          <Building2 size={13} aria-hidden />
                          {p.company}
                        </span>
                      ) : null}
                      {p.notes ? <p className="partners-notes-preview">{p.notes}</p> : null}
                    </div>
                  </td>
                  <td>
                    {p.role ? <span className="partners-role-pill">{p.role}</span> : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="partners-reach">
                      {p.email ? (
                        <div className="partners-reach-row">
                          <Mail size={14} className="partners-reach-icon" aria-hidden />
                          <a href={`mailto:${p.email}`} className="partners-reach-link">
                            {p.email}
                          </a>
                          <button
                            type="button"
                            className="icon-button partners-icon-tap"
                            title="Copy email"
                            onClick={() => copyField(p.email, 'Email')}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      ) : null}
                      {p.phone ? (
                        <div className="partners-reach-row">
                          <Phone size={14} className="partners-reach-icon" aria-hidden />
                          <a href={`tel:${p.phone.replace(/\D/g, '')}`} className="partners-reach-link">
                            {p.phone}
                          </a>
                          <button
                            type="button"
                            className="icon-button partners-icon-tap"
                            title="Copy phone"
                            onClick={() => copyField(p.phone, 'Phone')}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      ) : null}
                      {!p.email && !p.phone ? <span className="muted">—</span> : null}
                    </div>
                  </td>
                  <td>
                    {p.linkedListing ? (
                      <Link href={`/listings/${p.linkedListing.id}`} className="partners-deal-link">
                        {p.linkedListing.address.length > 48
                          ? `${p.linkedListing.address.slice(0, 48)}…`
                          : p.linkedListing.address}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="partners-col-actions">
                    <div className="partners-row-actions">
                      <button type="button" className="icon-button" title="Edit" onClick={() => startEdit(p)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="icon-button partners-icon-danger" title="Delete" onClick={() => void deletePartner(p.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !refreshing && filtered.length === 0 ? (
          <p className="muted partners-empty">No contacts match. Try clearing search or add someone above.</p>
        ) : null}
      </div>
    </div>
  );
}
