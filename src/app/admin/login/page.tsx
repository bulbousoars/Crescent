import { redirect } from 'next/navigation';
import { isAdminAuthorized } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || '/admin/mail';

  if (await isAdminAuthorized()) {
    redirect(next);
  }

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Sign in</h1>
          <p className="subhead">
            Enter your <code>ADMIN_API_TOKEN</code> to manage mail accounts.
          </p>
        </div>
      </div>
      <form method="GET" action="/api/admin/login" style={{ maxWidth: '20rem', display: 'grid', gap: '0.75rem' }}>
        <input type="hidden" name="next" value={next} />
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Admin token
          <input type="password" name="token" autoComplete="off" required autoFocus />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
