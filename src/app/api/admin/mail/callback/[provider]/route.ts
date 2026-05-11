import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthorized } from '@/lib/admin-auth';
import { getProvider } from '@/lib/mail/registry';
import { encryptJson, loadEncryptionKey } from '@/lib/mail/crypto';
import { prisma } from '@/lib/prisma';
import type { MailProviderId } from '@/lib/mail/provider';
import { publicUrl } from '@/lib/forwarded-url';
import { mergeMailRules, type MailRulesJson } from '@/lib/mail/legacyRules';

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

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(publicUrl(request, `/admin/mail?error=${encodeURIComponent(error)}`));
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
  const defaultRules: MailRulesJson = {
    fromAllowlist: ['instant-updates@mail.zillow.com', 'my-saved-home@mail.zillow.com'],
    processedLabel: 'Real-Estate',
  };
  const existing = await prisma.mailAccount.findUnique({
    where: { provider_email: { provider: providerId, email: identity.email } },
    select: { rules: true },
  });
  const rulesToWrite = mergeMailRules(existing?.rules, defaultRules);

  await prisma.mailAccount.upsert({
    where: { provider_email: { provider: providerId, email: identity.email } },
    create: {
      provider: providerId,
      email: identity.email,
      displayName: identity.displayName || '',
      enabled: true,
      encryptedTokens: encrypted,
      cursor: '',
      rules: rulesToWrite,
      lastError: '',
      consecutiveErrors: 0,
    },
    update: {
      displayName: identity.displayName || '',
      enabled: true,
      encryptedTokens: encrypted,
      rules: rulesToWrite,
      lastError: '',
      consecutiveErrors: 0,
    },
  });

  const response = NextResponse.redirect(publicUrl(request, '/admin/mail?connected=1'));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
