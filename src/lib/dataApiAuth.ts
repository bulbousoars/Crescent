import { NextRequest, NextResponse } from 'next/server';

/** Bearer DATA_API_TOKEN — single-tenant automation API. */
export function requireDataApiToken(request: NextRequest): NextResponse | null {
  const expected = process.env.DATA_API_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ error: 'DATA_API_TOKEN is not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
