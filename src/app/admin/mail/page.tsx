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

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Mail accounts</h1>
          <p className="subhead">
            Mailboxes Crescent polls for listing emails. OAuth tokens are encrypted at rest with{' '}
            <code>MAIL_ENCRYPTION_KEY</code>.
          </p>
        </div>
        <span className="muted">{accounts.length} connected</span>
      </div>

      {params.connected ? <p className="muted">Account connected.</p> : null}
      {params.error ? <p className="muted">OAuth error: {params.error}</p> : null}

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
                  No accounts connected yet. Use the link below to connect one.
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

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/api/admin/mail/connect/gmail">→ Connect a Gmail account</Link>
      </p>
      <p className="muted">
        Set <code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> in env, with redirect URI{' '}
        <code>{(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/admin/mail/callback/gmail'}</code>.
      </p>
    </div>
  );
}
