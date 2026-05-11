import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { Mail, LogOut, KeyRound, ShieldCheck, ExternalLink } from 'lucide-react';
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
  const idpLogoutUrl = process.env.IDP_LOGOUT_URL || 'https://auth.dugganco.com/flows/-/default/invalidation/';

  return (
    <div className="workspace">
      <div className="page-head workspace-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Settings</h1>
          <p className="subhead">Sign-in status and pointers to administrative tools.</p>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <article className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
            <ShieldCheck size={18} /> Authentication
          </h3>
          <AuthStateBlock state={state} idpLogoutUrl={idpLogoutUrl} />
        </article>

        <article className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
            <Mail size={18} /> Mail accounts
          </h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Connect and manage the mailboxes Crescent polls for Zillow alerts.
          </p>
          <Link href="/admin/mail" className="button primary">
            Open mail accounts
          </Link>
        </article>
      </div>
    </div>
  );
}

function AuthStateBlock({ state, idpLogoutUrl }: { state: AuthState; idpLogoutUrl: string }) {
  if (state.kind === 'open') {
    return (
      <p style={{ margin: 0 }}>
        No <code>ADMIN_API_TOKEN</code> configured — admin actions are open. Set the environment
        variable to require sign-in.
      </p>
    );
  }
  if (state.kind === 'cookie') {
    return (
      <div className="admin-form">
        <p style={{ margin: 0 }}>
          <span className="tag good" style={{ marginRight: 8 }}>signed in</span>
          via the admin token cookie on this device.
        </p>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" className="button">
            <LogOut size={14} /> Sign out
          </button>
        </form>
      </div>
    );
  }
  if (state.kind === 'forward-auth') {
    return (
      <div className="admin-form">
        <p style={{ margin: 0 }}>
          <span className="tag good" style={{ marginRight: 8 }}>signed in</span>
          via your identity provider as <code>{state.value}</code>.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Header: <code>{state.header}</code>. Crescent has no separate session of its own here —
          signing out ends your session at the IdP, which will also drop your access to other
          forward-auth-protected services.
        </p>
        <a className="button" href={idpLogoutUrl} target="_blank" rel="noreferrer">
          <LogOut size={14} /> Sign out via identity provider
          <ExternalLink size={11} style={{ marginLeft: 2 }} />
        </a>
      </div>
    );
  }
  return (
    <div className="admin-form">
      <p style={{ margin: 0 }}>
        Not signed in. Paste the <code>ADMIN_API_TOKEN</code> configured on the server to enable
        admin actions on this device.
      </p>
      <form method="GET" action="/api/admin/login" className="admin-form">
        <input type="hidden" name="next" value="/settings" />
        <label className="admin-field">
          <span>
            <KeyRound size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Admin token
          </span>
          <input className="field" type="password" name="token" autoComplete="off" required autoFocus />
        </label>
        <button type="submit" className="button primary">Sign in</button>
      </form>
    </div>
  );
}
