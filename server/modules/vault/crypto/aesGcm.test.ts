import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { decryptAESGCM, encryptAESGCM } from './aesGcm.js';

test('encryptAESGCM/decryptAESGCM roundtrip works with same key and aad', () => {
  const key = randomBytes(32);
  const plaintext = Buffer.from('vault-secret-payload', 'utf8');
  const aad = Buffer.from('vault:v1|workspace:ws-1|item:item-1', 'utf8');

  const encrypted = encryptAESGCM({
    key,
    plaintext,
    aad,
  });

  const decrypted = decryptAESGCM({
    key,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    aad,
  });

  assert.deepEqual(decrypted, plaintext);
});

test('decryptAESGCM fails with different aad', () => {
  const key = randomBytes(32);
  const plaintext = Buffer.from('vault-secret-payload', 'utf8');
  const aad = Buffer.from('vault:v1|workspace:ws-1|item:item-1', 'utf8');
  const differentAad = Buffer.from('vault:v1|workspace:ws-1|item:item-2', 'utf8');

  const encrypted = encryptAESGCM({
    key,
    plaintext,
    aad,
  });

  assert.throws(() =>
    decryptAESGCM({
      key,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      aad: differentAad,
    }));
});

test('decryptAESGCM fails with different key', () => {
  const key = randomBytes(32);
  const differentKey = randomBytes(32);
  const plaintext = Buffer.from('vault-secret-payload', 'utf8');
  const aad = Buffer.from('vault:v1|workspace:ws-1|item:item-1', 'utf8');

  const encrypted = encryptAESGCM({
    key,
    plaintext,
    aad,
  });

  assert.throws(() =>
    decryptAESGCM({
      key: differentKey,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      aad,
    }));
});

