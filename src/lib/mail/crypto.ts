import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Envelope: 1 byte version || 12 byte nonce || ciphertext || 16 byte auth tag.
// Version 1 = AES-256-GCM with 32-byte key.
const VERSION = 0x01;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function loadKey(material: string | Buffer): Buffer {
  const buf = typeof material === 'string' ? Buffer.from(material, 'base64') : material;
  if (buf.length !== KEY_LEN) {
    throw new Error(`encryption key must be ${KEY_LEN} bytes; got ${buf.length}`);
  }
  return buf;
}

export function encryptJson(value: unknown, key: string | Buffer): Buffer {
  const k = loadKey(key);
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', k, nonce);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), nonce, ct, tag]);
}

export function decryptJson<T = unknown>(envelope: Buffer, key: string | Buffer): T {
  if (envelope.length < 1 + NONCE_LEN + TAG_LEN) throw new Error('envelope too short');
  const version = envelope[0];
  if (version !== VERSION) throw new Error(`unsupported envelope version ${version}`);
  const k = loadKey(key);
  const nonce = envelope.subarray(1, 1 + NONCE_LEN);
  const tag = envelope.subarray(envelope.length - TAG_LEN);
  const ct = envelope.subarray(1 + NONCE_LEN, envelope.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', k, nonce);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

export function generateKey(): string {
  return randomBytes(KEY_LEN).toString('base64');
}

export function loadEncryptionKey(): Buffer {
  const material = process.env.MAIL_ENCRYPTION_KEY;
  if (!material) {
    throw new Error('MAIL_ENCRYPTION_KEY is not set; generate one with `openssl rand -base64 32`');
  }
  return loadKey(material);
}
