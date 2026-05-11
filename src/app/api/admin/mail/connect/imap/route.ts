import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthorized } from '@/lib/admin-auth';
import { ImapProvider } from '@/lib/mail/providers/imap';
import { encryptJson, loadEncryptionKey } from '@/lib/mail/crypto';
import { prisma } from '@/lib/prisma';
import type { MailPasswordCredentials } from '@/lib/mail/provider';
import { publicUrl } from '@/lib/forwarded-url';

const formSchema = z.object({
  email: z.string().min(3),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(993),
  user: z.string().min(1),
  password: z.string().min(1),
  secure: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'on' || v === 'true' : Boolean(v ?? true))),
  fromAllowlist: z.string().optional().default(''),
  processedLabel: z.string().optional().default('Real-Estate'),
});

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    const formData = await request.formData();
    const body: Record<string, FormDataEntryValue | undefined> = Object.fromEntries(formData.entries());
    parsed = formSchema.parse(body);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'invalid form' },
      { status: 400 },
    );
  }

  const creds: MailPasswordCredentials = {
    kind: 'password',
    user: parsed.user,
    password: parsed.password,
    host: parsed.host,
    port: parsed.port,
    secure: parsed.secure,
  };

  const provider = new ImapProvider();
  try {
    await provider.testCredentials(creds);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'IMAP login failed';
    return NextResponse.redirect(
      publicUrl(request, `/admin/mail?error=${encodeURIComponent('IMAP login: ' + reason)}`),
    );
  }

  const fromAllowlist = parsed.fromAllowlist
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const encrypted = new Uint8Array(encryptJson(creds, loadEncryptionKey()));
  await prisma.mailAccount.upsert({
    where: { provider_email: { provider: 'imap', email: parsed.email } },
    create: {
      provider: 'imap',
      email: parsed.email,
      displayName: parsed.email,
      enabled: true,
      encryptedTokens: encrypted,
      cursor: '',
      rules: {
        fromAllowlist: fromAllowlist.length
          ? fromAllowlist
          : ['instant-updates@mail.zillow.com', 'my-saved-home@mail.zillow.com'],
        processedLabel: parsed.processedLabel || 'Real-Estate',
      },
      lastError: '',
      consecutiveErrors: 0,
    },
    update: {
      displayName: parsed.email,
      enabled: true,
      encryptedTokens: encrypted,
      lastError: '',
      consecutiveErrors: 0,
      rules: {
        fromAllowlist: fromAllowlist.length
          ? fromAllowlist
          : ['instant-updates@mail.zillow.com', 'my-saved-home@mail.zillow.com'],
        processedLabel: parsed.processedLabel || 'Real-Estate',
      },
    },
  });

  return NextResponse.redirect(publicUrl(request, '/admin/mail?connected=1'));
}
