import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { Mail, LogOut, KeyRound, ShieldCheck } from 'lucide-react';
import { adminToken, ADMIN_COOKIE, isAdminAuthorized } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type AuthState =
  | { kind: 'open' }
  | { kind: 'cookie' }
  | { kind: 'forward-auth'; header: string; value: string }
  | { kind: 'unauthorized' };

async function getAuthState(): Promise<AuthState> {
  const token = adminToken();
  if (!token) return { kind: 'open' };

  const jar = await cookies();
  if (jar.get(ADMIN_COOKIE)?.value === token) return { kind: 'cookie' };

  const headerName = (process.env.ADMIN_FORWARD_AUTH_HEADER || '').toLowerCase().trim();
  if (headerName) {
    const hdrs = await headers();
    const value = (hdrs.get(headerName) || '').trim();
    if (value && (await isAdminAuthorized())) {
      return { kind: 'forward-auth', header: headerName, value };
    }
  }
  return { kind: 'unauthorized' };
}

export default async function SettingsPage() {
  const state = await getAuthState();

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Settings</h1>
          <p className="subhead">Sign-in status and pointers to administrative tools.</p>
        </div>
      </div>

      <section style={{ display: 'grid', gap: '1.5rem', maxWidth: '40rem' }}>
        <article style={cardStyle}>
          <header style={cardHeadStyle}>
            <ShieldCheck size={18} />
            <h2 style={cardTitleStyle}>Authentication</h2>
          </header>
          <AuthStateBlock state={state} />
        </article>

        <article style={cardStyle}>
          <header style={cardHeadStyle}>
            <Mail size={18} />
            <h2 style={cardTitleStyle}>Mail accounts</h2>
          </header>
          <p style={{ margin: '0 0 0.75rem' }}>
            Connect and manage the mailboxes Crescent polls for Zillow alerts.
          </p>
          <Link href="/admin/mail">Open mail accounts &rarr;</Link>
        </article>
      </section>
    </div>
  );
}

function AuthStateBlock({ state }: { state: AuthState }) {
  if (state.kind === 'open') {
    return (
      <p style={{ margin: 0 }}>
        No <code>ADMIN_API_TOKEN</code> configured &mdash; admin actions are open. Set the
        environment variable to require sign-in.
      </p>
    );
  }
  if (state.kind === 'cookie') {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={{ margin: 0 }}>Signed in with the configured admin token.</p>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <LogOut size={16} /> Sign out
          </button>
        </form>
      </div>
    );
  }
  if (state.kind === 'forward-auth') {
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}>
          Signed in via upstream forward-auth as <code>{state.value}</code>.
        </p>
        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>
          Header: <code>{state.header}</code>. Sign out through your identity provider.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={{ margin: 0 }}>
        Not signed in. Paste the <code>ADMIN_API_TOKEN</code> configured on the server to enable
        admin actions on this device.
      </p>
      <form
        method="GET"
        action="/api/admin/login"
        style={{ display: 'grid', gap: '0.5rem', maxWidth: '20rem' }}
      >
        <input type="hidden" name="next" value="/settings" />
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <KeyRound size={14} /> Admin token
          </span>
          <input type="password" name="token" autoComplete="off" required autoFocus />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border, rgba(255,255,255,0.08))',
  borderRadius: '0.75rem',
  padding: '1.25rem',
  background: 'var(--card-bg, rgba(255,255,255,0.02))',
  display: 'grid',
  gap: '0.75rem',
};

const cardHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  fontWeight: 600,
};
