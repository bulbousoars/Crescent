import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  const callbackBase = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/admin/mail/callback/gmail';

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Mail accounts</h1>
          <p className="subhead">
            Mailboxes Crescent polls for listing emails. Tokens / passwords are encrypted at rest with{' '}
            <code>MAIL_ENCRYPTION_KEY</code>.
          </p>
        </div>
        <span className="muted">{accounts.length} connected</span>
      </div>

      {params.connected ? <p className="muted">Account connected.</p> : null}
      {params.error ? <p className="muted">Error: {params.error}</p> : null}

      <div className="table-wrap data-table">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Email</th>
              <th>Status</th>
              <th>Last sync</th>
              <th>Messages seen</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No accounts connected yet.
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.provider}</td>
                  <td>{account.email}</td>
                  <td>{account.enabled ? 'enabled' : 'disabled'}</td>
                  <td>{formatDate(account.lastSyncAt)}</td>
                  <td>{account._count.messages}</td>
                  <td>{account.lastError || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: '2rem' }}>Connect a new account</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
        <section>
          <h3>IMAP (recommended)</h3>
          <p className="muted">
            Works for Gmail, Outlook, Fastmail — anything with IMAP. For Gmail: enable 2FA, generate an{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              App Password
            </a>
            , and paste it as the password.
          </p>
          <form
            method="POST"
            action="/api/admin/mail/connect/imap"
            style={{ display: 'grid', gap: '0.5rem', maxWidth: '24rem' }}
          >
            <label>
              Email
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>
            <label>
              IMAP host
              <input name="host" required defaultValue="imap.gmail.com" />
            </label>
            <label>
              Port
              <input name="port" type="number" required defaultValue={993} />
            </label>
            <label>
              IMAP user
              <input name="user" required placeholder="you@example.com" />
            </label>
            <label>
              Password / App Password
              <input name="password" type="password" required autoComplete="off" />
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input name="secure" type="checkbox" defaultChecked /> Use TLS (secure)
            </label>
            <label>
              From allowlist (comma or whitespace separated)
              <input
                name="fromAllowlist"
                defaultValue="instant-updates@mail.zillow.com, my-saved-home@mail.zillow.com"
              />
            </label>
            <button type="submit">Connect IMAP</button>
          </form>
        </section>

        <section>
          <h3>Gmail (OAuth, advanced)</h3>
          <p className="muted">
            Sysadmin must own a Google Cloud OAuth client and register this redirect URI:{' '}
            <code>{callbackBase}</code>
          </p>
          <p>
            <Link href="/api/admin/mail/connect/gmail">→ Connect via Gmail OAuth</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
