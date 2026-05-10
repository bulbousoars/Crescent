import { describe, it, expect } from 'vitest';
import { encryptJson, decryptJson, generateKey } from '../../src/lib/mail/crypto';

const KEY = 'kQF5VhxN9pX2BqZTjLm0wqCdEf3hI4kLpRsTuVwXyZ0=';

describe('mail/crypto', () => {
  it('round-trips a JSON payload', () => {
    const plaintext = { access_token: 'abc', refresh_token: 'xyz', expires_at: 123 };
    const ciphertext = encryptJson(plaintext, KEY);
    expect(ciphertext).toBeInstanceOf(Buffer);
    expect(ciphertext.length).toBeGreaterThan(0);
    const decrypted = decryptJson(ciphertext, KEY);
    expect(decrypted).toEqual(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random nonce)', () => {
    const plaintext = { token: 'same' };
    const a = encryptJson(plaintext, KEY);
    const b = encryptJson(plaintext, KEY);
    expect(Buffer.compare(a, b)).not.toBe(0);
    expect(decryptJson(a, KEY)).toEqual(decryptJson(b, KEY));
  });

  it('rejects tampered ciphertext', () => {
    const plaintext = { token: 'secret' };
    const ciphertext = encryptJson(plaintext, KEY);
    const tampered = Buffer.from(ciphertext);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decryptJson(tampered, KEY)).toThrow();
  });

  it('rejects wrong key', () => {
    const plaintext = { token: 'secret' };
    const ciphertext = encryptJson(plaintext, KEY);
    const otherKey = generateKey();
    expect(() => decryptJson(ciphertext, otherKey)).toThrow();
  });

  it('rejects malformed envelope', () => {
    expect(() => decryptJson(Buffer.from([0x99, 0x01, 0x02]), KEY)).toThrow();
    expect(() => decryptJson(Buffer.alloc(0), KEY)).toThrow();
  });

  it('generateKey returns a 32-byte base64 key', () => {
    const key = generateKey();
    const decoded = Buffer.from(key, 'base64');
    expect(decoded.length).toBe(32);
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => encryptJson({ a: 1 }, 'short')).toThrow();
    expect(() => encryptJson({ a: 1 }, Buffer.alloc(16).toString('base64'))).toThrow();
  });
});
