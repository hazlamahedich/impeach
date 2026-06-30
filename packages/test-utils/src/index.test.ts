/**
 * Smoke test — @iip/test-utils factories (SEC-2, Task 1.3).
 *
 * @rules SEC-2
 */
import { describe, it, expect } from 'vitest';
import {
  createKeyPair,
  createSignature,
  createContentHash,
  createPrincipal,
  createDocument,
} from './index.js';

describe('@iip/test-utils factories', () => {
  it('createPrincipal + createDocument return sensible defaults', () => {
    expect(createPrincipal().sub).toBe('operator-001');
    expect(createDocument().status).toBe('staging');
    expect(createDocument().tier).toBe(1);
  });

  it('createContentHash produces a 64-char lowercase hex', () => {
    const hash = createContentHash(Buffer.from('hello', 'utf8'), true);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('createKeyPair + createSignature roundtrip is base64', async () => {
    const key = await createKeyPair('k1');
    expect(key.publicKeyBase64).toBeTruthy();
    const hash = 'a'.repeat(64);
    const signature = await createSignature({ privateKey: key.privateKey, contentHash: hash });
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
