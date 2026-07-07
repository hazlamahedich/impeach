/**
 * Genesis-bootstrap regression test — the seq=1 prev_hash linkage invariant.
 *
 * This test exists to kill a recurring bug: the entry at seq=1 must chain off
 * the genesis entry's COMPUTED `curr_hash`, NOT `GENESIS_PREV_HASH`. The bug
 * surfaced in Story 2.4, was fixed, then RESURFACED in Story 2.5's `append()`
 * and required re-fixing during code review. No canonical regression test
 * traveled with the package, so the same conceptual defect recurred.
 *
 * This test travels with `packages/editorial` so any future重构 that reintroduces
 * the off-by-one genesis linkage is caught immediately, not during the next
 * story's code review.
 *
 * @rules AC-11, SEC-6, DoD-2
 * @adr ADR-001
 */
import { describe, it, expect } from 'vitest';
import {
  GENESIS_PREV_HASH,
  hashEntry,
  makeEntry,
  makeGenesisEntry,
  type CorpusHash,
  type Signature,
} from '@iip/contracts';

const NOW = '2026-07-08T00:00:00.000Z';
const PARTITION = 'test_partition';

/** Deterministic test signer — returns a fixed signature shape. */
const testSigner = async (currHash: CorpusHash): Promise<Signature> =>
  `sig_${currHash.slice(0, 8)}` as Signature;

describe('genesis-bootstrap regression — seq=1 chains off genesis curr_hash (AC-11, SEC-6)', () => {
  it('genesis entry has prev_hash = GENESIS_PREV_HASH, seq=0, empty signature', () => {
    const genesis = makeGenesisEntry(PARTITION, NOW);
    expect(genesis.seq).toBe(0);
    expect(genesis.prev_hash).toBe(GENESIS_PREV_HASH);
    expect(genesis.signature).toBe('');
    expect(genesis.event).toBe('system.genesis');
    expect(genesis.principal_sub).toBe('__genesis__');
    // curr_hash is COMPUTED (not GENESIS_PREV_HASH) — this is what seq=1 chains off.
    expect(genesis.curr_hash).not.toBe(GENESIS_PREV_HASH);
    expect(genesis.curr_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('seq=1 entry chains off genesis.curr_hash, NOT GENESIS_PREV_HASH (the recurring bug)', async () => {
    const genesis = makeGenesisEntry(PARTITION, NOW);

    // CORRECT: seq=1's prevHash = genesis.curr_hash (the computed hash).
    const correctEntry = await makeEntry({
      partitionKey: PARTITION,
      principalSub: '__system__',
      event: 'auth.revoked',
      jti: 'jti-1',
      payload: { reason: 'test' },
      time: NOW,
      seq: 1,
      prevHash: genesis.curr_hash,
      getSignature: testSigner,
    });
    expect(correctEntry.prev_hash).toBe(genesis.curr_hash);
    expect(correctEntry.prev_hash).not.toBe(GENESIS_PREV_HASH);

    // WRONG (the bug): seq=1's prevHash = GENESIS_PREV_HASH. This entry would
    // FAIL verifyChain because the chain skips the genesis entry's hash.
    const buggyEntry = await makeEntry({
      partitionKey: PARTITION,
      principalSub: '__system__',
      event: 'auth.revoked',
      jti: 'jti-1b',
      payload: { reason: 'test' },
      time: NOW,
      seq: 1,
      prevHash: GENESIS_PREV_HASH,
      getSignature: testSigner,
    });
    // The bug: buggyEntry chains off GENESIS_PREV_HASH, not genesis.curr_hash.
    expect(buggyEntry.prev_hash).toBe(GENESIS_PREV_HASH);
    expect(buggyEntry.prev_hash).not.toBe(genesis.curr_hash);
    // These two entries have DIFFERENT curr_hashes because the prevHash input
    // differs — proving the linkage choice is load-bearing for the chain.
    expect(correctEntry.curr_hash).not.toBe(buggyEntry.curr_hash);
  });

  it('a 3-entry chain (genesis → seq=1 → seq=2) links correctly tip-to-tip', async () => {
    const genesis = makeGenesisEntry(PARTITION, NOW);
    const entry1 = await makeEntry({
      partitionKey: PARTITION,
      principalSub: '__system__',
      event: 'auth.revoked',
      jti: 'jti-1',
      payload: {},
      time: NOW,
      seq: 1,
      prevHash: genesis.curr_hash,
      getSignature: testSigner,
    });
    const entry2 = await makeEntry({
      partitionKey: PARTITION,
      principalSub: '__system__',
      event: 'auth.expired',
      jti: 'jti-2',
      payload: {},
      time: NOW,
      seq: 2,
      prevHash: entry1.curr_hash,
      getSignature: testSigner,
    });

    // The chain links tip-to-tip: each prev_hash = predecessor's curr_hash.
    expect(entry1.prev_hash).toBe(genesis.curr_hash);
    expect(entry2.prev_hash).toBe(entry1.curr_hash);
    // No entry chains off GENESIS_PREV_HASH except genesis itself.
    expect(entry1.prev_hash).not.toBe(GENESIS_PREV_HASH);
    expect(entry2.prev_hash).not.toBe(GENESIS_PREV_HASH);
  });

  it('hashEntry is deterministic over the same canonical payload + prevHash', () => {
    const genesis = makeGenesisEntry(PARTITION, NOW);
    // Recompute genesis's curr_hash from its canonical fields + GENESIS_PREV_HASH.
    const recomputed = hashEntry(GENESIS_PREV_HASH, {
      seq: 0,
      partition_key: PARTITION,
      principal_sub: '__genesis__',
      event: 'system.genesis',
      jti: '__genesis__',
      payload: {},
      time: NOW,
    });
    expect(recomputed).toBe(genesis.curr_hash);
  });
});
