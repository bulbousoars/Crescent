import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthorized } from '@/lib/admin-auth';
import { getProvider } from '@/lib/mail/registry';
import { encryptJson, loadEncryptionKey } from '@/lib/mail/crypto';
import { prisma } from '@/lib/prisma';
import type { MailProviderId } from '@/lib/mail/provider';

const STATE_COOKIE = 'crescent_oauth_state';

function callbackUrl(request: NextRequest, providerId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL('/', request.url).toString().replace(/\/$/, '');
  return `${base.replace(/\/$/, '')}/api/admin/mail/callback/${providerId}`;
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

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/admin/mail?error=${encodeURIComponent(error)}`, request.url));
  }
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const cookieState = request.cookies.get(STATE_COOKIE)?.value || '';
  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ ok: false, error: 'invalid state' }, { status: 400 });
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
  if (!provider.completeAuth) {
    return NextResponse.json({ ok: false, error: `provider ${providerId} does not support OAuth callback` }, { status: 400 });
  }

  const redirectUri = callbackUrl(request, providerId);
  const { identity, tokens } = await provider.completeAuth({ code, redirectUri });
  const key = loadEncryptionKey();
  const encrypted = new Uint8Array(encryptJson(tokens, key));
  const defaultRules = {
    fromAllowlist: ['instant-updates@mail.zillow.com', 'my-saved-home@mail.zillow.com'],
    processedLabel: 'Crescent/Processed',
  };
  await prisma.mailAccount.upsert({
    where: { provider_email: { provider: providerId, email: identity.email } },
    create: {
      provider: providerId,
      email: identity.email,
      displayName: identity.displayName || '',
      enabled: true,
      encryptedTokens: encrypted,
      cursor: '',
      rules: defaultRules,
      lastError: '',
      consecutiveErrors: 0,
    },
    update: {
      displayName: identity.displayName || '',
      enabled: true,
      encryptedTokens: encrypted,
      lastError: '',
      consecutiveErrors: 0,
    },
  });

  const response = NextResponse.redirect(new URL('/admin/mail?connected=1', request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
