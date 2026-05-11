import { describe, it, expect } from 'vitest';
import { publicUrl } from '../src/lib/forwarded-url';

function fakeRequest(opts: {
  url: string;
  host?: string;
  xForwardedHost?: string;
  xForwardedProto?: string;
}) {
  const h = new Headers();
  if (opts.host) h.set('host', opts.host);
  if (opts.xForwardedHost) h.set('x-forwarded-host', opts.xForwardedHost);
  if (opts.xForwardedProto) h.set('x-forwarded-proto', opts.xForwardedProto);
  return { url: opts.url, headers: h } as unknown as Parameters<typeof publicUrl>[0];
}

describe('publicUrl', () => {
  it('uses x-forwarded-host and x-forwarded-proto when both are present', () => {
    const req = fakeRequest({
      url: 'http://localhost:3000/api/admin/mail/connect/imap',
      host: 'localhost:3000',
      xForwardedHost: 'realestate.dugganco.com',
      xForwardedProto: 'https',
    });
    expect(publicUrl(req, '/admin/mail?connected=1').toString()).toBe(
      'https://realestate.dugganco.com/admin/mail?connected=1',
    );
  });

  it('falls back to the Host header when only Host is set', () => {
    const req = fakeRequest({
      url: 'http://localhost:3000/anything',
      host: 'realestate.dugganco.com',
    });
    // Without x-forwarded-proto, falls back to the request.url scheme (http)
    expect(publicUrl(req, '/admin/mail').toString()).toBe('http://realestate.dugganco.com/admin/mail');
  });

  it('honors x-forwarded-proto even when host header is the local bind', () => {
    const req = fakeRequest({
      url: 'http://localhost:3000/anything',
      host: 'localhost:3000',
      xForwardedHost: 'realestate.dugganco.com',
      xForwardedProto: 'https',
    });
    expect(publicUrl(req, '/').protocol).toBe('https:');
  });

  it('falls back to request.url base when no host headers are set', () => {
    const req = fakeRequest({ url: 'http://localhost:3000/anything' });
    expect(publicUrl(req, '/admin/mail').toString()).toBe('http://localhost:3000/admin/mail');
  });

  it('preserves query strings in the path argument', () => {
    const req = fakeRequest({
      url: 'http://localhost:3000/api',
      xForwardedHost: 'realestate.dugganco.com',
      xForwardedProto: 'https',
    });
    expect(publicUrl(req, '/admin/mail?error=foo%20bar').toString()).toBe(
      'https://realestate.dugganco.com/admin/mail?error=foo%20bar',
    );
  });
});
