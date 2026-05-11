import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin-auth';

function clearAndRedirect(request: NextRequest, next: string) {
  const target = new URL(next, request.url);
  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  return clearAndRedirect(request, '/settings');
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/settings';
  return clearAndRedirect(request, next);
}
