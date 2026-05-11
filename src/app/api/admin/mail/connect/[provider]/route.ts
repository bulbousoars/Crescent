import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { isAdminAuthorized } from '@/lib/admin-auth';
import { getProvider } from '@/lib/mail/registry';
import type { MailProviderId } from '@/lib/mail/provider';
import { publicUrl } from '@/lib/forwarded-url';

const STATE_COOKIE = 'crescent_oauth_state';

function callbackUrl(request: NextRequest, providerId: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/admin/mail/callback/${providerId}`;
  }
  return publicUrl(request, `/api/admin/mail/callback/${providerId}`).toString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { provider: providerId } = await params;
  if (providerId !== 'gmail') {
    return NextResponse.json({ ok: false, error: `provider ${providerId} not supported yet` }, { status: 400 });
  }

  let provider;
  try {
    provider = getProvider(providerId as MailProviderId);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
  if (!provider.beginAuth) {
    return NextResponse.json({ ok: false, error: `provider ${providerId} does not support OAuth begin` }, { status: 400 });
  }

  const state = randomBytes(16).toString('hex');
  const redirectUri = callbackUrl(request, providerId);
  const authUrl = provider.beginAuth({ redirectUri, state });
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
