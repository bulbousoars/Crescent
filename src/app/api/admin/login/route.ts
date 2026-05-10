import { NextRequest, NextResponse } from 'next/server';
import { adminToken, ADMIN_COOKIE } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const expected = adminToken();
  const url = new URL(request.url);
  const supplied = url.searchParams.get('token') || '';
  const next = url.searchParams.get('next') || '/admin/mail';
  if (!expected) return NextResponse.redirect(new URL(next, request.url));
  if (supplied !== expected) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 });
  }
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
