// Proves the build-time (node:crypto) encryption decrypts via WebCrypto
// (crypto.subtle) — the identical code path the browser runs. If this passes,
// the front-end will be able to decrypt what generate.mjs produces.

import { webcrypto } from 'node:crypto';
import { deriveKey, encrypt, encryptJSON, KDF, IV_BYTES } from './crypto.mjs';

const subtle = webcrypto.subtle;
let failures = 0;
const assert = (cond, msg) => { if (!cond) { failures++; console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };

// --- Browser-side derivation + decryption (copy of web/app.js logic) ---
async function browserDeriveKey(password, salt, iterations) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
}
async function browserDecrypt(key, blob) {
  const iv = blob.subarray(0, IV_BYTES);
  const body = blob.subarray(IV_BYTES); // ciphertext || tag
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, body);
  return new Uint8Array(pt);
}

const td = new TextDecoder();
const password = 'BRAINAPP27-correct-horse';
const salt = webcrypto.getRandomValues(new Uint8Array(KDF.saltBytes));

console.log('Crypto contract — node:crypto encrypt -> WebCrypto decrypt');

// 1) Same PBKDF2 output both sides (compare raw bits)
const rawNodeKey = deriveKey(password, Buffer.from(salt));
const baseKey = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const rawWebBits = new Uint8Array(await subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: KDF.iterations, hash: 'SHA-256' }, baseKey, KDF.keyBytes * 8));
assert(Buffer.compare(rawNodeKey, Buffer.from(rawWebBits)) === 0, 'PBKDF2 keys match (node vs webcrypto)');

// 2) Derive the AES-GCM key the way the browser will, decrypt a JSON payload
const key = await browserDeriveKey(password, salt, KDF.iterations);

const payload = { generatedAt: new Date(0).toISOString(), chantiers: [{ ref: 'CH-1', t: 'Accents: éàçÀÉ — “quotes”' }] };
const blob = encryptJSON(deriveKey(password, Buffer.from(salt)), payload);
const out = JSON.parse(td.decode(await browserDecrypt(key, blob)));
assert(out.chantiers[0].t === payload.chantiers[0].t, 'UTF-8 JSON round-trips (incl. accents/smart quotes)');

// 3) Binary file round-trip (simulate a PDF)
const fakePdf = webcrypto.getRandomValues(new Uint8Array(50000));
const fileBlob = encrypt(deriveKey(password, Buffer.from(salt)), Buffer.from(fakePdf));
const decoded = await browserDecrypt(key, fileBlob);
assert(decoded.length === fakePdf.length && Buffer.compare(Buffer.from(decoded), Buffer.from(fakePdf)) === 0, 'binary (PDF-like) bytes round-trip exactly');

// 4) Wrong password fails closed (GCM auth tag rejects)
let threw = false;
try {
  const wrongKey = await browserDeriveKey('wrong-password', salt, KDF.iterations);
  await browserDecrypt(wrongKey, blob);
} catch { threw = true; }
assert(threw, 'wrong password throws (auth-tag verification fails closed)');

// 5) Tamper detection (flip a byte in ciphertext)
let tamperThrew = false;
try {
  const t = Buffer.from(blob); t[IV_BYTES + 2] ^= 0xff;
  await browserDecrypt(key, t);
} catch { tamperThrew = true; }
assert(tamperThrew, 'tampered ciphertext throws (integrity protected)');

console.log(failures === 0 ? '\nALL CRYPTO TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
