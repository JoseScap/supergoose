import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const API_KEY_PREFIX = 'sgk';
const API_KEY_VERSION = 'live';
const API_KEY_SEPARATOR = '.';
const KEY_PREFIX_BYTES = 4;
const KEY_SECRET_BYTES = 24;
const KEY_SALT_BYTES = 16;
const KEY_DERIVED_BYTES = 32;
const KEY_ITERATIONS = 210000;
const KEY_DIGEST = 'sha256';

export interface GeneratedApiKeyMaterial {
  key: string;
  keyPrefix: string;
  keyHash: string;
  keySalt: string;
}

export interface ParsedApiKey {
  keyPrefix: string;
  keySecret: string;
}

/**
 * Converts raw bytes into a URL-safe base64 string.
 */
function toBase64Url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

/**
 * Derives a stable hash for an API key using PBKDF2.
 */
function deriveKeyHash(key: string, salt: string): string {
  return pbkdf2Sync(key, salt, KEY_ITERATIONS, KEY_DERIVED_BYTES, KEY_DIGEST).toString('base64url');
}

/**
 * Generates a new API key, salt and hash bundle for storage.
 */
export function generateApiKeyMaterial(): GeneratedApiKeyMaterial {
  const keyPrefix = toBase64Url(randomBytes(KEY_PREFIX_BYTES));
  const keySecret = toBase64Url(randomBytes(KEY_SECRET_BYTES));
  const keySalt = toBase64Url(randomBytes(KEY_SALT_BYTES));
  const key = [API_KEY_PREFIX, API_KEY_VERSION, keyPrefix, keySecret].join(API_KEY_SEPARATOR);
  const keyHash = deriveKeyHash(key, keySalt);

  return {
    key,
    keyPrefix,
    keyHash,
    keySalt
  };
}

/**
 * Parses an API key string into its visible prefix and secret portion.
 */
export function parseApiKey(apiKey: string): ParsedApiKey | null {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(API_KEY_SEPARATOR);

  if (parts.length !== 4) {
    return null;
  }

  const [prefix, version, keyPrefix, keySecret] = parts;

  if (prefix !== API_KEY_PREFIX || version !== API_KEY_VERSION || !keyPrefix || !keySecret) {
    return null;
  }

  return {
    keyPrefix,
    keySecret
  };
}

/**
 * Verifies that a candidate API key matches the stored salted hash.
 */
export function verifyApiKey(apiKey: string, keySalt: string, keyHash: string): boolean {
  const computedHash = deriveKeyHash(apiKey, keySalt);
  const expected = Buffer.from(keyHash, 'base64url');
  const actual = Buffer.from(computedHash, 'base64url');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
