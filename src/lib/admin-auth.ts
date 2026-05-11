import { cookies, headers } from 'next/headers';

const COOKIE = 'crescent_admin';

export function adminToken(): string {
  return process.env.ADMIN_API_TOKEN || process.env.INGESTION_API_TOKEN || '';
}

function forwardAuthConfig() {
  const header = (process.env.ADMIN_FORWARD_AUTH_HEADER || '').toLowerCase().trim();
  if (!header) return null;
  const allowList = (process.env.ADMIN_FORWARD_AUTH_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { header, allowList };
}

export async function isAdminAuthorized(): Promise<boolean> {
  const token = adminToken();
  if (!token) return true;

  const jar = await cookies();
  if (jar.get(COOKIE)?.value === token) return true;

  const fwd = forwardAuthConfig();
  if (fwd) {
    const hdrs = await headers();
    const value = (hdrs.get(fwd.header) || '').trim().toLowerCase();
    if (value && (fwd.allowList.length === 0 || fwd.allowList.includes(value))) {
      return true;
    }
  }
  return false;
}

export async function setAdminCookie(value: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export const ADMIN_COOKIE = COOKIE;
