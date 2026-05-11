import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const cookieJar = new Map<string, string>();
const headerJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined) }),
  headers: async () => ({ get: (n: string) => headerJar.get(n.toLowerCase()) ?? null }),
}));

import { isAdminAuthorized } from '../src/lib/admin-auth';

describe('isAdminAuthorized', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    cookieJar.clear();
    headerJar.clear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true when no admin token is configured (open mode)', async () => {
    process.env.ADMIN_API_TOKEN = '';
    process.env.INGESTION_API_TOKEN = '';
    expect(await isAdminAuthorized()).toBe(true);
  });

  it('returns true when the crescent_admin cookie matches the configured token', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    cookieJar.set('crescent_admin', 'secret-token');
    expect(await isAdminAuthorized()).toBe(true);
  });

  it('returns false when the cookie is missing and no forward-auth header is configured', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    process.env.ADMIN_FORWARD_AUTH_HEADER = '';
    expect(await isAdminAuthorized()).toBe(false);
  });

  it('accepts a configured forward-auth header with any non-empty value when no allowlist is set', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    process.env.ADMIN_FORWARD_AUTH_HEADER = 'x-authentik-email';
    process.env.ADMIN_FORWARD_AUTH_ALLOWLIST = '';
    headerJar.set('x-authentik-email', 'someone@example.com');
    expect(await isAdminAuthorized()).toBe(true);
  });

  it('accepts a forward-auth header value present in the allowlist', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    process.env.ADMIN_FORWARD_AUTH_HEADER = 'x-authentik-email';
    process.env.ADMIN_FORWARD_AUTH_ALLOWLIST = 'alice@example.com,bob@example.com';
    headerJar.set('x-authentik-email', 'Bob@Example.com');
    expect(await isAdminAuthorized()).toBe(true);
  });

  it('rejects a forward-auth header value not in the allowlist', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    process.env.ADMIN_FORWARD_AUTH_HEADER = 'x-authentik-email';
    process.env.ADMIN_FORWARD_AUTH_ALLOWLIST = 'alice@example.com';
    headerJar.set('x-authentik-email', 'mallory@example.com');
    expect(await isAdminAuthorized()).toBe(false);
  });

  it('rejects an empty forward-auth header value even when allowlist is empty', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    process.env.ADMIN_FORWARD_AUTH_HEADER = 'x-authentik-email';
    process.env.ADMIN_FORWARD_AUTH_ALLOWLIST = '';
    headerJar.set('x-authentik-email', '');
    expect(await isAdminAuthorized()).toBe(false);
  });

  it('ignores the forward-auth header when ADMIN_FORWARD_AUTH_HEADER is not set', async () => {
    process.env.ADMIN_API_TOKEN = 'secret-token';
    process.env.ADMIN_FORWARD_AUTH_HEADER = '';
    headerJar.set('x-authentik-email', 'someone@example.com');
    expect(await isAdminAuthorized()).toBe(false);
  });
});
