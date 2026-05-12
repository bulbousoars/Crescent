import { describe, it, expect } from 'vitest';
import { ImapProvider } from '../../src/lib/mail/providers/imap';
import type { MailPasswordCredentials } from '../../src/lib/mail/provider';

const CREDS: MailPasswordCredentials = {
  kind: 'password',
  user: 'me@example.com',
  password: 'app-password-123',
  host: 'imap.example.com',
  port: 993,
  secure: true,
};

class MockImapFlow {
  public calls: string[] = [];
  public connectRejects: Error | null = null;
  public searchUids: number[] = [];
  public fetchedMessages: Map<number, FetchedMessage> = new Map();
  public uidValidity = 12345;
  public capabilities = new Map<string, unknown>();
  /** If set to N (1-based), the Nth `messageFlagsAdd` call returns false. */
  public messageFlagsAddFailAttempt: number | null = null;
  private messageFlagsAddCallCount = 0;
  public flagsAdded: Array<{ uid: number; keywords: string[]; options?: Record<string, unknown> }> = [];
  public flagsRemoved: Array<{ uid: number; keywords: string[]; options?: Record<string, unknown> }> = [];

  async connect() {
    this.calls.push('connect');
    if (this.connectRejects) throw this.connectRejects;
  }
  async mailboxOpen() {
    this.calls.push('mailboxOpen');
    return { uidValidity: BigInt(this.uidValidity) };
  }
  async search() {
    this.calls.push('search');
    return this.searchUids;
  }
  async fetchOne(uid: number) {
    this.calls.push(`fetchOne:${uid}`);
    return this.fetchedMessages.get(uid);
  }
  async messageFlagsAdd(range: unknown, keywords: string[], options?: Record<string, unknown>) {
    const uid = typeof range === 'number' ? range : 0;
    const opt = options ? JSON.stringify(options) : '';
    this.messageFlagsAddCallCount += 1;
    this.calls.push(`flag:${uid}:${keywords.join(',')}:${opt}`);
    this.flagsAdded.push({ uid, keywords, options });
    if (
      this.messageFlagsAddFailAttempt !== null &&
      this.messageFlagsAddFailAttempt === this.messageFlagsAddCallCount
    ) {
      return false;
    }
    return true;
  }
  async messageFlagsRemove(range: unknown, keywords: string[], options?: Record<string, unknown>) {
    const uid = typeof range === 'number' ? range : 0;
    this.calls.push(`flag-remove:${uid}:${keywords.join(',')}`);
    this.flagsRemoved.push({ uid, keywords, options });
    return true;
  }
  async logout() {
    this.calls.push('logout');
  }
  async close() {
    this.calls.push('close');
  }
}

interface FetchedMessage {
  uid: number;
  envelope: {
    subject: string;
    from: { address: string; name?: string }[];
    sender?: { address: string }[];
  };
  internalDate: Date;
  source: Buffer;
  flags: Set<string>;
}

function buildMessage(uid: number, subject: string, from: string, body: string): FetchedMessage {
  const raw = `Subject: ${subject}\r\nFrom: ${from}\r\nContent-Type: text/plain\r\n\r\n${body}`;
  return {
    uid,
    envelope: { subject, from: [{ address: from }] },
    internalDate: new Date('2026-05-09T10:00:00Z'),
    source: Buffer.from(raw, 'utf8'),
    flags: new Set(['\\Seen']),
  };
}

describe('ImapProvider.testCredentials', () => {
  it('connects and returns identity', async () => {
    const mock = new MockImapFlow();
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    const identity = await provider.testCredentials(CREDS);
    expect(identity.email).toBe('me@example.com');
    expect(mock.calls).toEqual(['connect', 'mailboxOpen', 'logout']);
  });

  it('throws on connect failure', async () => {
    const mock = new MockImapFlow();
    mock.connectRejects = new Error('AUTHENTICATIONFAILED');
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    await expect(provider.testCredentials(CREDS)).rejects.toThrow(/AUTHENTICATIONFAILED/);
  });
});

describe('ImapProvider.listNew', () => {
  it('returns messages with parsed plain body and updates cursor', async () => {
    const mock = new MockImapFlow();
    mock.searchUids = [10, 11];
    mock.fetchedMessages.set(10, buildMessage(10, 'New listing 1', 'instant-updates@mail.zillow.com', 'body 10'));
    mock.fetchedMessages.set(11, buildMessage(11, 'New listing 2', 'instant-updates@mail.zillow.com', 'body 11'));
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });

    const result = await provider.listNew({
      tokens: CREDS,
      cursor: '',
      rules: { fromAllowlist: ['instant-updates@mail.zillow.com'], processedLabel: 'Crescent-Processed' },
    });

    expect(result.messages.length).toBe(2);
    expect(result.messages[0].providerMsgId).toBe(`${mock.uidValidity}:10`);
    expect(result.messages[0].subject).toBe('New listing 1');
    expect(result.messages[0].fromAddress).toBe('instant-updates@mail.zillow.com');
    expect(result.messages[0].textBody).toBe('body 10');
    expect(result.nextCursor).toBe(`uid:${mock.uidValidity}:11`);
  });

  it('skips UIDs at or below cursor on same UIDVALIDITY', async () => {
    const mock = new MockImapFlow();
    mock.searchUids = [5];
    mock.fetchedMessages.set(5, buildMessage(5, 'Old', 'x@y.com', ''));
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    const result = await provider.listNew({
      tokens: CREDS,
      cursor: `uid:${mock.uidValidity}:5`,
      rules: { fromAllowlist: ['x@y.com'] },
    });
    expect(result.messages.length).toBe(0);
    expect(result.nextCursor).toBe(`uid:${mock.uidValidity}:5`);
  });

  it('resets cursor when UIDVALIDITY changes', async () => {
    const mock = new MockImapFlow();
    mock.uidValidity = 999;
    mock.searchUids = [1];
    mock.fetchedMessages.set(1, buildMessage(1, 'New', 'x@y.com', 'body'));
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    const result = await provider.listNew({
      tokens: CREDS,
      cursor: 'uid:111:50',
      rules: { fromAllowlist: ['x@y.com'] },
    });
    expect(result.messages.length).toBe(1);
    expect(result.nextCursor).toBe('uid:999:1');
  });

  it('rejects OAuth tokens', async () => {
    const provider = new ImapProvider();
    await expect(
      provider.listNew({
        tokens: { accessToken: 'a', expiresAt: 0 },
        cursor: '',
        rules: {},
      }),
    ).rejects.toThrow(/expected password credentials/);
  });
});

describe('ImapProvider.markProcessed', () => {
  it('marks message as seen and adds the configured keyword', async () => {
    const mock = new MockImapFlow();
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    await provider.markProcessed({
      tokens: CREDS,
      providerMsgId: '12345:42',
      rules: { processedLabel: 'Crescent-Processed' },
    });
    expect(mock.flagsAdded).toEqual([
      { uid: 42, keywords: ['\\Seen'], options: { uid: true } },
      { uid: 42, keywords: ['Crescent-Processed'], options: { uid: true } },
    ]);
    expect(mock.calls.filter((c) => c.startsWith('flag:'))).toEqual([
      'flag:42:\\Seen:{"uid":true}',
      'flag:42:Crescent-Processed:{"uid":true}',
    ]);
    expect(mock.flagsRemoved).toEqual([]);
    expect(mock.calls).not.toContain('flag-remove:42:\\Inbox');
    expect(mock.calls).toContain('logout');
  });

  it('throws when generic IMAP cannot mark read (first STORE returns false)', async () => {
    const mock = new MockImapFlow();
    mock.messageFlagsAddFailAttempt = 1;
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    await expect(
      provider.markProcessed({
        tokens: CREDS,
        providerMsgId: '12345:42',
        rules: { processedLabel: 'Crescent-Processed' },
      }),
    ).rejects.toThrow(/failed to mark message as read/);
    expect(mock.calls).not.toContain('logout');
  });

  it('throws when generic IMAP read succeeds but keyword STORE returns false', async () => {
    const mock = new MockImapFlow();
    mock.messageFlagsAddFailAttempt = 2;
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    await expect(
      provider.markProcessed({
        tokens: CREDS,
        providerMsgId: '12345:42',
        rules: { processedLabel: 'Crescent-Processed' },
      }),
    ).rejects.toThrow(/failed to apply keyword/);
    expect(mock.calls).not.toContain('logout');
  });

  it('uses Gmail extensions in order: \\Seen, label (X-GM-LABELS), remove Inbox twice', async () => {
    const mock = new MockImapFlow();
    mock.capabilities.set('X-GM-EXT-1', true);
    const provider = new ImapProvider({
      imapClientFactory: () => mock as unknown as import('imapflow').ImapFlow,
    });
    await provider.markProcessed({
      tokens: { ...CREDS, host: 'imap.gmail.com' },
      providerMsgId: '12345:42',
      rules: { processedLabel: 'Real-Estate' },
    });
    expect(mock.flagsAdded).toEqual([
      { uid: 42, keywords: ['\\Seen'], options: { uid: true } },
      { uid: 42, keywords: ['Real-Estate'], options: { uid: true, useLabels: true } },
    ]);
    expect(mock.flagsRemoved).toEqual([
      { uid: 42, keywords: ['\\Inbox'], options: { uid: true, useLabels: true } },
      { uid: 42, keywords: ['\\Inbox'], options: { uid: true, useLabels: true } },
    ]);
    expect(mock.calls.filter((c) => c.startsWith('flag:'))).toEqual([
      'flag:42:\\Seen:{"uid":true}',
      'flag:42:Real-Estate:{"uid":true,"useLabels":true}',
    ]);
    expect(mock.calls.filter((c) => c === 'flag-remove:42:\\Inbox')).toHaveLength(2);
    expect(mock.calls).toContain('logout');
  });
});
