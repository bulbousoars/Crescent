import { describe, expect, it, vi } from 'vitest';
import { MicrosoftGraphProvider } from '@/lib/mail/providers/microsoft';

describe('MicrosoftGraphProvider', () => {
  it('beginAuth includes Mail.ReadWrite scope and client id', () => {
    const p = new MicrosoftGraphProvider({
      clientId: 'abc-client',
      clientSecret: 'secret',
      tenant: 'common',
    });
    const url = p.beginAuth({ redirectUri: 'https://app/cb', state: 'xyz' });
    expect(url).toContain('login.microsoftonline.com');
    expect(url).toContain('client_id=abc-client');
    expect(url).toContain(encodeURIComponent('https://graph.microsoft.com/Mail.ReadWrite'));
    expect(url).toContain('state=xyz');
  });

  it('listNew filters by from allowlist', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('/me/mailFolders/inbox/messages')) {
        return {
          ok: true,
          json: async () => ({
            value: [
              {
                id: 'm1',
                subject: 'Hi',
                from: { emailAddress: { address: 'instant-updates@mail.zillow.com' } },
                receivedDateTime: '2026-01-01T12:00:00Z',
                conversationId: 'c1',
                bodyPreview: 'preview',
              },
              {
                id: 'm2',
                subject: 'Spam',
                from: { emailAddress: { address: 'other@example.com' } },
                receivedDateTime: '2026-01-02T12:00:00Z',
                conversationId: 'c2',
                bodyPreview: 'x',
              },
            ],
          }),
        };
      }
      if (url.includes('/me/messages/m1')) {
        return {
          ok: true,
          json: async () => ({
            id: 'm1',
            subject: 'Zillow',
            from: { emailAddress: { address: 'instant-updates@mail.zillow.com' } },
            receivedDateTime: '2026-01-01T12:00:00Z',
            conversationId: 'c1',
            bodyPreview: 'p',
            body: { contentType: 'text', content: 'plain body' },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const p = new MicrosoftGraphProvider({
      clientId: 'id',
      clientSecret: 'sec',
      tenant: 'common',
      fetcher: fetcher as unknown as typeof fetch,
    });

    const result = await p.listNew({
      tokens: {
        accessToken: 'tok',
        refreshToken: 'r',
        expiresAt: Date.now() + 3600_000,
      },
      rules: { fromAllowlist: ['instant-updates@mail.zillow.com'] },
      cursor: '',
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].providerMsgId).toBe('m1');
    expect(result.messages[0].textBody).toBe('plain body');
    expect(calls.some((c) => c.includes('/me/messages/m1'))).toBe(true);
    expect(calls.some((c) => c.includes('/me/messages/m2'))).toBe(false);
  });
});
