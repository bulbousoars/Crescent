/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { decryptJson, encryptJson, loadEncryptionKey } from '../lib/mail/crypto';
import { getProvider } from '../lib/mail/registry';
import { parseZillowMessage } from '../lib/parsers/zillow';
import { ingestZillowEmail } from '../lib/ingestion';
import type { MailAuthTokens, MailProviderId, RawMessage, MailRules } from '../lib/mail/provider';

const POLL_INTERVAL_MS = Number(process.env.MAIL_POLL_INTERVAL_MS || 60_000);
const MAX_BACKOFF_MS = 15 * 60 * 1000;

interface MailAccountRow {
  id: string;
  provider: string;
  email: string;
  displayName: string;
  enabled: boolean;
  encryptedTokens: Buffer;
  cursor: string;
  rules: unknown;
  pollIntervalSec: number;
  lastSyncAt: Date | null;
  consecutiveErrors: number;
}

function backoffMs(consecutiveErrors: number): number {
  if (consecutiveErrors <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(consecutiveErrors, 10));
}

function dueForSync(account: MailAccountRow): boolean {
  if (!account.enabled) return false;
  const intervalMs = (account.pollIntervalSec || 120) * 1000;
  const backoff = backoffMs(account.consecutiveErrors);
  const wait = Math.max(intervalMs, backoff);
  if (!account.lastSyncAt) return true;
  return Date.now() - account.lastSyncAt.getTime() >= wait;
}

function rulesFromAccount(account: MailAccountRow): MailRules {
  if (account.rules && typeof account.rules === 'object') return account.rules as MailRules;
  return {
    fromAllowlist: ['instant-updates@mail.zillow.com', 'my-saved-home@mail.zillow.com'],
    processedLabel: 'Crescent/Processed',
  };
}

async function processAccount(prisma: PrismaClient, account: MailAccountRow, key: Buffer): Promise<void> {
  const provider = getProvider(account.provider as MailProviderId);
  const rules = rulesFromAccount(account);
  const tokens = decryptJson<MailAuthTokens>(account.encryptedTokens, key);

  const result = await provider.listNew({ tokens, rules, cursor: account.cursor });
  const finalTokens = result.refreshedTokens || tokens;

  for (const message of result.messages) {
    await processMessage(prisma, provider, account, finalTokens, rules, message);
  }

  const updateData: Record<string, unknown> = {
    cursor: result.nextCursor,
    lastSyncAt: new Date(),
    lastError: '',
    consecutiveErrors: 0,
  };
  if (result.refreshedTokens) {
    updateData.encryptedTokens = new Uint8Array(encryptJson(result.refreshedTokens, key));
  }
  await prisma.mailAccount.update({ where: { id: account.id }, data: updateData });
}

async function processMessage(
  prisma: PrismaClient,
  provider: ReturnType<typeof getProvider>,
  account: MailAccountRow,
  tokens: MailAuthTokens,
  rules: MailRules,
  message: RawMessage,
): Promise<void> {
  const existing = await prisma.mailMessage.findUnique({
    where: { accountId_providerMsgId: { accountId: account.id, providerMsgId: message.providerMsgId } },
  });
  if (existing && existing.status !== 'pending') return;

  const baseRow = existing
    ? existing
    : await prisma.mailMessage.create({
        data: {
          accountId: account.id,
          providerMsgId: message.providerMsgId,
          threadId: message.threadId || '',
          fromAddress: message.fromAddress || '',
          subject: message.subject || '',
          receivedAt: message.receivedAt,
          status: 'pending',
        },
      });

  const parsed = parseZillowMessage(message);
  if (!parsed) {
    await prisma.mailMessage.update({
      where: { id: baseRow.id },
      data: { status: 'skipped', errorReason: 'classifier rejected', processedAt: new Date() },
    });
    await provider.markProcessed({ tokens, providerMsgId: message.providerMsgId, rules });
    return;
  }
  if (parsed.payloads.length === 0) {
    await prisma.mailMessage.update({
      where: { id: baseRow.id },
      data: { status: 'skipped', errorReason: 'no listings extracted', processedAt: new Date() },
    });
    await provider.markProcessed({ tokens, providerMsgId: message.providerMsgId, rules });
    return;
  }

  let firstListingId: string | null = null;
  try {
    for (const payload of parsed.payloads) {
      const ingest = await ingestZillowEmail(prisma, payload);
      if (!firstListingId && ingest && typeof ingest === 'object' && 'listingId' in ingest) {
        firstListingId = String(ingest.listingId);
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'ingest failed';
    await prisma.mailMessage.update({
      where: { id: baseRow.id },
      data: { status: 'error', errorReason: reason, processedAt: new Date() },
    });
    throw error;
  }

  await prisma.mailMessage.update({
    where: { id: baseRow.id },
    data: { status: 'ingested', listingId: firstListingId, errorReason: '', processedAt: new Date() },
  });
  await provider.markProcessed({ tokens, providerMsgId: message.providerMsgId, rules });
}

async function tick(prisma: PrismaClient, key: Buffer): Promise<void> {
  const accounts = (await prisma.mailAccount.findMany({
    where: { enabled: true },
    orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } },
  })) as unknown as MailAccountRow[];

  for (const account of accounts) {
    if (!dueForSync(account)) continue;
    try {
      await processAccount(prisma, account, key);
      console.log(`[mail-poll] synced ${account.provider}:${account.email}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'sync failed';
      await prisma.mailAccount.update({
        where: { id: account.id },
        data: {
          lastError: reason.slice(0, 500),
          consecutiveErrors: { increment: 1 },
          lastSyncAt: new Date(),
        },
      });
      console.error(`[mail-poll] error on ${account.email}:`, reason);
    }
  }
}

export async function runOnce(prisma: PrismaClient = new PrismaClient()): Promise<void> {
  const key = loadEncryptionKey();
  await tick(prisma, key);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const key = loadEncryptionKey();
  console.log(`[mail-poll] starting, interval=${POLL_INTERVAL_MS}ms`);
  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log('[mail-poll] shutting down');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      await tick(prisma, key);
    } catch (e) {
      console.error('[mail-poll] tick error:', e);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[mail-poll] fatal:', e);
    process.exit(1);
  });
}
