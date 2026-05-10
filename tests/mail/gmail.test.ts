import { describe, it, expect } from 'vitest';
import { GmailProvider } from '../../src/lib/mail/providers/gmail';
import type { MailAuthTokens } from '../../src/lib/mail/provider';

type MockResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

function makeFetcher(routes: Array<{ match: (url: string, init?: RequestInit) => boolean; respond: MockResponse | ((url: string, init?: RequestInit) => MockResponse) }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match(url, init)) {
        const r = typeof route.respond === 'function' ? route.respond(url, init) : route.respond;
        return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
          status: r.status,
        });
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

const CONFIG = { clientId: 'test-client', clientSecret: 'test-secret' };

const TOKENS: MailAuthTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 60_000,
};

describe('GmailProvider.beginAuth', () => {
  it('produces a valid Google OAuth URL with required params', () => {
    const provider = new GmailProvider(CONFIG);
    const url = provider.beginAuth({ redirectUri: 'http://localhost:3000/cb', state: 'xyz' });
    const parsed = new URL(url);
    expect(parsed.host).toBe('accounts.google.com');
    expect(parsed.searchParams.get('client_id')).toBe('test-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/cb');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('state')).toBe('xyz');
    expect(parsed.searchParams.get('scope')).toContain('gmail.modify');
  });
});

describe('GmailProvider.completeAuth', () => {
  it('exchanges code, fetches identity, returns tokens', async () => {
    const { fetcher } = makeFetcher([
      {
        match: (u) => u.startsWith('https://oauth2.googleapis.com/token'),
        respond: { ok: true, status: 200, body: { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'Bearer', scope: 'gmail.modify' } },
      },
      {
        match: (u) => u.startsWith('https://openidconnect.googleapis.com/v1/userinfo'),
        respond: { ok: true, status: 200, body: { email: 'me@example.com', name: 'Me Test' } },
      },
    ]);
    const provider = new GmailProvider({ ...CONFIG, fetcher });
    const result = await provider.completeAuth({ code: 'C', redirectUri: 'http://localhost:3000/cb' });
    expect(result.identity).toEqual({ email: 'me@example.com', displayName: 'Me Test' });
    expect(result.tokens.accessToken).toBe('a');
    expect(result.tokens.refreshToken).toBe('r');
    expect(result.tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('throws if Gmail does not return refresh_token', async () => {
    const { fetcher } = makeFetcher([
      {
        match: (u) => u.startsWith('https://oauth2.googleapis.com/token'),
        respond: { ok: true, status: 200, body: { access_token: 'a', expires_in: 3600 } },
      },
    ]);
    const provider = new GmailProvider({ ...CONFIG, fetcher });
    await expect(provider.completeAuth({ code: 'C', redirectUri: 'x' })).rejects.toThrow(/refresh_token/);
  });
});

describe('GmailProvider.refreshTokens', () => {
  it('rotates the access token but keeps refresh', async () => {
    const { fetcher } = makeFetcher([
      {
        match: (u) => u.startsWith('https://oauth2.googleapis.com/token'),
        respond: { ok: true, status: 200, body: { access_token: 'a2', expires_in: 3600 } },
      },
    ]);
    const provider = new GmailProvider({ ...CONFIG, fetcher });
    const refreshed = await provider.refreshTokens(TOKENS);
    expect(refreshed.accessToken).toBe('a2');
    expect(refreshed.refreshToken).toBe('refresh-1');
    expect(refreshed.expiresAt).toBeGreaterThan(Date.now());
  });

  it('throws when no refresh_token is available', async () => {
    const provider = new GmailProvider(CONFIG);
    await expect(provider.refreshTokens({ accessToken: 'a', expiresAt: 0 })).rejects.toThrow(/no refresh_token/);
  });
});

describe('GmailProvider.listNew', () => {
  it('queries with from:allowlist and -label:processed and parses payloads', async () => {
    const messageBody = Buffer.from('Hello plain body').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const { fetcher, calls } = makeFetcher([
      {
        match: (u) => u.includes('/messages?q='),
        respond: { ok: true, status: 200, body: { messages: [{ id: 'm1', threadId: 't1' }] } },
      },
      {
        match: (u) => u.includes('/messages/m1'),
        respond: {
          ok: true,
          status: 200,
          body: {
            id: 'm1',
            threadId: 't1',
            labelIds: ['INBOX'],
            snippet: 'Hello',
            internalDate: String(Date.now()),
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'Subject', value: 'New listing in Camden' },
                { name: 'From', value: 'instant-updates@mail.zillow.com' },
              ],
              body: { data: messageBody },
            },
          },
        },
      },
    ]);
    const provider = new GmailProvider({ ...CONFIG, fetcher });
    const result = await provider.listNew({
      tokens: TOKENS,
      cursor: '',
      rules: { fromAllowlist: ['instant-updates@mail.zillow.com'], processedLabel: 'Crescent/Processed' },
    });
    expect(result.messages.length).toBe(1);
    const m = result.messages[0];
    expect(m.providerMsgId).toBe('m1');
    expect(m.fromAddress).toBe('instant-updates@mail.zillow.com');
    expect(m.subject).toBe('New listing in Camden');
    expect(m.textBody).toBe('Hello plain body');
    expect(m.labels).toEqual(['INBOX']);
    expect(result.nextCursor).toBe('last:m1');
    const listUrl = calls[0].url;
    expect(decodeURIComponent(listUrl)).toContain('from:instant-updates@mail.zillow.com');
    expect(decodeURIComponent(listUrl)).toContain('-label:Crescent/Processed');
  });

  it('refreshes tokens automatically when expired', async () => {
    let exchanges = 0;
    const expiredTokens: MailAuthTokens = { accessToken: 'old', refreshToken: 'r', expiresAt: Date.now() - 1000 };
    const { fetcher } = makeFetcher([
      {
        match: (u) => u.startsWith('https://oauth2.googleapis.com/token'),
        respond: () => {
          exchanges += 1;
          return { ok: true, status: 200, body: { access_token: 'fresh', expires_in: 3600 } };
        },
      },
      {
        match: (u) => u.includes('/messages?q='),
        respond: { ok: true, status: 200, body: { messages: [] } },
      },
    ]);
    const provider = new GmailProvider({ ...CONFIG, fetcher });
    const result = await provider.listNew({
      tokens: expiredTokens,
      cursor: '',
      rules: { fromAllowlist: ['x@y.com'] },
    });
    expect(exchanges).toBe(1);
    expect(result.refreshedTokens?.accessToken).toBe('fresh');
  });
});

describe('GmailProvider.markProcessed', () => {
  it('looks up label, creates if missing, then modifies the message', async () => {
    const calls: string[] = [];
    const { fetcher } = makeFetcher([
      {
        match: (u, init) => u.endsWith('/labels') && (!init?.method || init.method === 'GET'),
        respond: () => {
          calls.push('list-labels');
          return { ok: true, status: 200, body: { labels: [{ id: 'INBOX', name: 'INBOX' }] } };
        },
      },
      {
        match: (u, init) => u.endsWith('/labels') && init?.method === 'POST',
        respond: () => {
          calls.push('create-label');
          return { ok: true, status: 200, body: { id: 'Label_42', name: 'Crescent/Processed' } };
        },
      },
      {
        match: (u) => u.endsWith('/m1/modify'),
        respond: () => {
          calls.push('modify-m1');
          return { ok: true, status: 200, body: {} };
        },
      },
    ]);
    const provider = new GmailProvider({ ...CONFIG, fetcher });
    await provider.markProcessed({
      tokens: TOKENS,
      providerMsgId: 'm1',
      rules: { processedLabel: 'Crescent/Processed' },
    });
    expect(calls).toEqual(['list-labels', 'create-label', 'modify-m1']);
  });
});
