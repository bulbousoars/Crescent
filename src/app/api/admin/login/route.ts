import { NextRequest, NextResponse } from 'next/server';
import { adminToken, ADMIN_COOKIE } from '@/lib/admin-auth';
import { publicUrl } from '@/lib/forwarded-url';

export async function GET(request: NextRequest) {
  const expected = adminToken();
  const url = new URL(request.url);
  const supplied = url.searchParams.get('token') || '';
  const next = url.searchParams.get('next') || '/admin/mail';
  if (!expected) return NextResponse.redirect(publicUrl(request, next));
  if (supplied !== expected) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 });
  }
  const response = NextResponse.redirect(publicUrl(request, next));
  response.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
