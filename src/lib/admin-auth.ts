import { cookies } from 'next/headers';

const COOKIE = 'crescent_admin';

export function adminToken(): string {
  return process.env.ADMIN_API_TOKEN || process.env.INGESTION_API_TOKEN || '';
}

export async function isAdminAuthorized(): Promise<boolean> {
  const token = adminToken();
  if (!token) return true;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token;
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
