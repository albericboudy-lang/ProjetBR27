// Build-time encryption (Node). Mirror of the browser decryption in web/app.js.
//
// Contract (must match WebCrypto on the browser side):
//   key   = PBKDF2(SHA-256, password, salt, iterations) -> 256-bit AES-GCM key
//   blob  = iv(12 bytes) || ciphertext || authTag(16 bytes)
//
// WebCrypto's AES-GCM expects the auth tag APPENDED to the ciphertext, whereas
// Node's createCipheriv exposes it separately via getAuthTag(). We therefore
// concatenate `ciphertext || tag` so the same bytes decrypt natively in the
// browser via crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ciphertextWithTag).

import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto';

export const KDF = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 600000, // élevé (OWASP 2023 ; cf. CDC §4.2/§8) — dérivation native, déchiffrement unique par session
  saltBytes: 16,
  keyBytes: 32, // AES-256
};
export const IV_BYTES = 12; // 96-bit nonce recommandé pour AES-GCM
export const TAG_BYTES = 16;

/** Derive a raw 256-bit key buffer from a password + salt. */
export function deriveKey(password, salt, iterations = KDF.iterations) {
  return pbkdf2Sync(Buffer.from(String(password), 'utf8'), salt, iterations, KDF.keyBytes, 'sha256');
}

/**
 * Encrypt a Buffer/Uint8Array/string. Returns a Buffer: iv || ciphertext || tag.
 * A fresh random IV is used for every call (never reuse an IV with the same key).
 */
export function encrypt(key, plaintext) {
  const data = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext instanceof Uint8Array ? plaintext : String(plaintext), 'utf8');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  return Buffer.concat([iv, ct, tag]);
}

/** Encrypt a JS value as UTF-8 JSON. */
export function encryptJSON(key, value) {
  return encrypt(key, Buffer.from(JSON.stringify(value), 'utf8'));
}
