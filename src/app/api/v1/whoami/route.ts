import { NextRequest, NextResponse } from 'next/server';
import { requireDataApiToken } from '@/lib/dataApiAuth';

export async function GET(request: NextRequest) {
  const deny = requireDataApiToken(request);
  if (deny) return deny;
  return NextResponse.json({
    ok: true,
    mode: 'single-tenant',
    token: 'DATA_API_TOKEN',
  });
}
