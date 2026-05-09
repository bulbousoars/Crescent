import { NextRequest } from 'next/server';

export function isAuthorized(request: NextRequest) {
  const expected = process.env.INGESTION_API_TOKEN;
  if (!expected) return true;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${expected}`;
}
