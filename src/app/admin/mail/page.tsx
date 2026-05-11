import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle, Mail, KeyRound, ExternalLink } from 'lucide-react';
import { isAdminAuthorized } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null | undefined): string {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

export default async function MailAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  if (!(await isAdminAuthorized())) {
    redirect('/admin/login');
  }

  const accounts = await prisma.mailAccount.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { messages: true } } },
  });
  const params = await searchParams;
  const callbackBase =
    (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/admin/mail/callback/gmail';

  return (
    <div className="workspace">
      <Link href="/settings" className="breadcrumb">
        <ArrowLeft size={14} /> Settings
      </Link>

      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Mail accounts</h1>
          <p className="subhead">
            Mailboxes Crescent polls for listing emails. Tokens and passwords are encrypted at rest with{' '}
            <code>MAIL_ENCRYPTION_KEY</code>.
          </p>
        </div>
        <span className="status">{accounts.length} connected</span>
      </div>

      <div className="admin-content">
      {params.connected ? (
        <div className="banner success">
          <CheckCircle2 size={16} />
          <span>Account connected. The worker will pick it up on the next poll.</span>
        </div>
      ) : null}
      {params.error ? (
        <div className="banner error">
          <AlertCircle size={16} />
          <span>{params.error}</span>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="table-wrap data-table">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last sync</th>
                <th>Messages</th>
                <th>Last error</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 18 }}>
                    No accounts connected yet. Use the form below to add one.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.provider}</td>
                    <td>{account.email}</td>
                    <td>
                      <span className={`tag ${account.enabled ? 'good' : 'warn'}`}>
                        {account.enabled ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                    <td>{formatDate(account.lastSyncAt)}</td>
                    <td>{account._count.messages}</td>
                    <td className="muted">{account.lastError || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 style={{ marginTop: 28 }}>Connect a new account</h2>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <section className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}>
            <Mail size={18} /> IMAP <span className="status" style={{ marginLeft: 6 }}>recommended</span>
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Works for Gmail, Outlook, Fastmail — anything with IMAP. For Gmail, enable 2-Step
            Verification then generate an{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              App Password <ExternalLink size={12} style={{ verticalAlign: 'baseline' }} />
            </a>
            . Be sure IMAP is enabled at Gmail Settings → Forwarding and POP/IMAP.
          </p>

          <form method="POST" action="/api/admin/mail/connect/imap" className="admin-form">
            <label className="admin-field">
              <span>Email</span>
              <input className="field" name="email" type="email" required placeholder="you@example.com" />
            </label>

            <div className="field-row">
              <label className="admin-field">
                <span>IMAP host</span>
                <input className="field" name="host" required defaultValue="imap.gmail.com" />
              </label>
              <label className="admin-field">
                <span>Port</span>
                <input className="field" name="port" type="number" required defaultValue={993} />
              </label>
            </div>

            <label className="admin-field">
              <span>IMAP user</span>
              <input className="field" name="user" required placeholder="usually your full email" />
            </label>

            <label className="admin-field">
              <span>
                <KeyRound size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Password / App Password
              </span>
              <input className="field" name="password" type="password" required autoComplete="off" />
            </label>

            <label className="checkbox-row">
              <input name="secure" type="checkbox" defaultChecked />
              <span>Use TLS (secure)</span>
            </label>

            <label className="admin-field">
              <span>From allowlist</span>
              <textarea
                className="field"
                name="fromAllowlist"
                rows={4}
                defaultValue={'instant-updates@mail.zillow.com\nmy-saved-home@mail.zillow.com'}
              />
              <span className="help">One email address per line. Only messages from these senders are polled.</span>
            </label>

            <label className="admin-field">
              <span>Processed label</span>
              <input className="field" name="processedLabel" defaultValue="Real-Estate" />
              <span className="help">Applied after ingest; Gmail IMAP also removes processed mail from Inbox.</span>
            </label>

            <button type="submit" className="button primary" style={{ marginTop: 4 }}>
              Connect IMAP
            </button>
          </form>
        </section>

        <section className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}>
            Gmail OAuth <span className="status" style={{ marginLeft: 6 }}>advanced</span>
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Requires owning a Google Cloud OAuth client with this redirect URI registered:
          </p>
          <p>
            <code style={{ wordBreak: 'break-all' }}>{callbackBase}</code>
          </p>
          <Link href="/api/admin/mail/connect/gmail" className="button">
            Connect via Gmail OAuth
          </Link>
        </section>
      </div>
      </div>
    </div>
  );
}
