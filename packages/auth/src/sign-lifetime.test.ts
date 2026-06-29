/**
 * signJwt lifetime validation (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair } from 'jose';
import { signJwt } from './index.js';

describe('signJwt lifetime validation', () => {
  it('rejects non-positive lifetimes', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    await expect(signJwt({ kid: 'k1', privateKey: pair.privateKey }, {
      sub: 'op', iss: 'i', scope: ['read'], expSeconds: 0,
    })).rejects.toThrow(/lifetime/);
    await expect(signJwt({ kid: 'k1', privateKey: pair.privateKey }, {
      sub: 'op', iss: 'i', scope: ['read'], expSeconds: -1,
    })).rejects.toThrow(/lifetime/);
  });
});
