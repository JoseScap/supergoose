import assert from 'node:assert/strict';
import test from 'node:test';
import { generateApiKeyMaterial, parseApiKey, verifyApiKey } from '../src/api-keys';

test('generateApiKeyMaterial returns a parseable key and verifiable hash', () => {
  const material = generateApiKeyMaterial();
  const parsed = parseApiKey(material.key);

  assert.ok(parsed);
  assert.equal(parsed?.keyPrefix, material.keyPrefix);
  assert.equal(verifyApiKey(material.key, material.keySalt, material.keyHash), true);
});

test('verifyApiKey rejects a different key', () => {
  const material = generateApiKeyMaterial();

  assert.equal(verifyApiKey(`${material.key}x`, material.keySalt, material.keyHash), false);
});
