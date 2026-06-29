/**
 * signJwt unit tests (SEC-1).
 *
 * @rules SEC-1
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPair } from 'jose';
import { signJwt } from './index.js';

describe('signJwt', () => {
  it('issues a valid JWT with required claims', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const token = await signJwt(
      { kid: 'k1', privateKey: pair.privateKey },
      { sub: 'op', iss: 'i', scope: ['read', 'write'], expSeconds: 3600 },
    );
    expect(token.split('.')).toHaveLength(3);
  });

  it('generates unique jti per call', async () => {
    const pair = await generateKeyPair('Ed25519', { extractable: true });
    const token1 = await signJwt(
      { kid: 'k1', privateKey: pair.privateKey },
      { sub: 'op', iss: 'i', scope: ['read'], expSeconds: 3600 },
    );
    const token2 = await signJwt(
      { kid: 'k1', privateKey: pair.privateKey },
      { sub: 'op', iss: 'i', scope: ['read'], expSeconds: 3600 },
    );
    expect(token1).not.toBe(token2);
  });
});
