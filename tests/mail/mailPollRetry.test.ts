import { describe, expect, it, vi } from 'vitest';
import { processMessage } from '../../src/worker/mail-poll';

vi.mock('../../src/lib/parsers/zillow', () => ({
  parseZillowMessage: () => ({ payloads: [] }),
}));

const message = {
  providerMsgId: '123:42',
  fromAddress: 'instant-updates@mail.zillow.com',
  subject: 'Listing update',
  receivedAt: new Date('2026-10-03T12:00:00Z'),
  textBody: '',
  htmlBody: '',
  snippet: '',
  labels: [],
  raw: {},
};

describe('mail poll retry', () => {
  it('retries marking an already ingested message after a transient IMAP error', async () => {
    const markProcessed = vi.fn().mockRejectedValueOnce(new Error('IMAP unavailable')).mockResolvedValueOnce(undefined);
    const prisma = {
      mailMessage: {
        findUnique: vi.fn().mockResolvedValue({ id: 'row-1', status: 'ingested' }),
        update: vi.fn(),
      },
    };
    const args = [prisma, { markProcessed }, { id: 'account-1' }, { kind: 'password' }, {}, message] as unknown as Parameters<typeof processMessage>;

    await expect(processMessage(...args)).rejects.toThrow('IMAP unavailable');
    await processMessage(...args);

    expect(markProcessed).toHaveBeenCalledTimes(2);
    expect(prisma.mailMessage.update).not.toHaveBeenCalled();
  });

  it('retries a previous ingest error instead of silently skipping it', async () => {
    const markProcessed = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      mailMessage: {
        findUnique: vi.fn().mockResolvedValue({ id: 'row-2', status: 'error' }),
        update,
      },
    };
    const args = [prisma, { markProcessed }, { id: 'account-1' }, { kind: 'password' }, {}, message] as unknown as Parameters<typeof processMessage>;

    await processMessage(...args);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }));
    expect(markProcessed).toHaveBeenCalledOnce();
  });
});
