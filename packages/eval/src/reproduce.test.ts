// Story 1.11 — Task 4: Gate Decision & Reproduce Primitives (SC-7, AC-F1-10)
// @rules SC-7, AC-F1-10

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  recordGateDecision,
  reproduceRun,
  DECISION_SCHEMA_VERSION,
  type GateDecisionInput,
  type GateDecision,
} from './reproduce.js';

const VALID_INPUT: GateDecisionInput = {
  corpusHash: 'sha256:' + 'a'.repeat(64),
  commit: '737eb1ecb9526bd361bd373d8e7dcc21881de48b',
  modelDigest: 'sha256:' + 'b'.repeat(64),
  harnessSha: 'sha256:' + 'c'.repeat(64),
  decision: 'pass',
  metrics: { echo: 1.0 },
};

describe('Story 1.11 — Task 4: recordGateDecision() + reproduceRun() (SC-7)', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'iip-reproduce-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  describe('recordGateDecision', () => {
    it('writes decision.json under the composite-hash directory', async () => {
      const gatesDir = join(workDir, 'gates');
      const result = await recordGateDecision(VALID_INPUT, { gatesDir });
      expect(result.runId).toMatch(/^sha256:[0-9a-f]{64}$/);
      const raw = await readFile(result.decisionPath, 'utf8');
      const parsed: GateDecision = JSON.parse(raw);
      expect(parsed.schemaVersion).toBe(DECISION_SCHEMA_VERSION);
      expect(parsed.corpusHash).toBe(VALID_INPUT.corpusHash);
      expect(parsed.commit).toBe(VALID_INPUT.commit);
      expect(parsed.decision).toBe('pass');
      expect(parsed.metrics).toEqual({ echo: 1.0 });
      expect(typeof parsed.timestamp).toBe('string');
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('decision.json contains all required fields', async () => {
      const gatesDir = join(workDir, 'gates');
      const result = await recordGateDecision(VALID_INPUT, { gatesDir });
      const parsed: GateDecision = JSON.parse(
        await readFile(result.decisionPath, 'utf8'),
      );
      // Required fields per AC-F1-10 output contract.
      expect(parsed).toHaveProperty('schemaVersion');
      expect(parsed).toHaveProperty('corpusHash');
      expect(parsed).toHaveProperty('commit');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('decision');
      expect(parsed).toHaveProperty('metrics');
    });

    it('decision is "pass" or "fail"', async () => {
      const gatesDir = join(workDir, 'gates');
      const passResult = await recordGateDecision(VALID_INPUT, { gatesDir });
      const passParsed: GateDecision = JSON.parse(
        await readFile(passResult.decisionPath, 'utf8'),
      );
      expect(passParsed.decision).toBe('pass');

      const failInput: GateDecisionInput = { ...VALID_INPUT, decision: 'fail' };
      const failResult = await recordGateDecision(failInput, { gatesDir });
      const failParsed: GateDecision = JSON.parse(
        await readFile(failResult.decisionPath, 'utf8'),
      );
      expect(failParsed.decision).toBe('fail');
    });

  it('metrics is a non-empty object of finite numbers', async () => {
    const gatesDir = join(workDir, 'gates');
    const result = await recordGateDecision(VALID_INPUT, { gatesDir });
    const parsed: GateDecision = JSON.parse(
      await readFile(result.decisionPath, 'utf8'),
    );
    expect(parsed.metrics).toBeTypeOf('object');
    expect(parsed.metrics).not.toBeNull();
    expect(Object.keys(parsed.metrics ?? {}).length).toBeGreaterThan(0);
    for (const v of Object.values(parsed.metrics)) {
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('rejects non-finite metric values', async () => {
    const gatesDir = join(workDir, 'gates');
    const badInput: GateDecisionInput = {
      ...VALID_INPUT,
      metrics: { echo: Infinity },
    };
    await expect(recordGateDecision(badInput, { gatesDir })).rejects.toThrow(
      'metrics must contain only finite numbers',
    );
  });

  it('reproduce rejects stale schemaVersion', async () => {
    const gatesDir = join(workDir, 'gates');
    const runId = 'sha256:' + 'e'.repeat(64);
    const dir = join(gatesDir, runId);
    await mkdir(dir, { recursive: true });
    const stale = {
      schemaVersion: '0.0.0',
      corpusHash: VALID_INPUT.corpusHash,
      commit: VALID_INPUT.commit,
      timestamp: '2026-06-26T19:25:22.000Z',
      decision: 'pass',
      metrics: { echo: 1.0 },
    };
    await writeFile(join(dir, 'decision.json'), JSON.stringify(stale));
    const result = await reproduceRun(runId, { gatesDir }).catch((e: unknown) => e);
    expect(result).toMatchObject({
      kind: 'CORRUPT_DECISION',
      runId,
    });
  });

    it('runId is deterministic from the composite key (corpusHash, commit, modelDigest, harnessSha)', async () => {
      const gatesDir = join(workDir, 'gates');
      const a = await recordGateDecision(VALID_INPUT, { gatesDir });
      const b = await recordGateDecision(
        { ...VALID_INPUT, decision: 'fail' },
        { gatesDir },
      );
      // decision is NOT part of the composite key — same inputs (except
      // decision) must hash to the same runId, and the second write
      // supersedes the first (append-only by hash, last-writer for replay).
      expect(a.runId).toBe(b.runId);
    });

    it('different model digest → different runId', async () => {
      const gatesDir = join(workDir, 'gates');
      const a = await recordGateDecision(VALID_INPUT, { gatesDir });
      const b = await recordGateDecision(
        { ...VALID_INPUT, modelDigest: 'sha256:' + 'd'.repeat(64) },
        { gatesDir },
      );
      expect(a.runId).not.toBe(b.runId);
    });
  });

  describe('reproduceRun', () => {
    it('re-emits the recorded decision.json for a known runId', async () => {
      const gatesDir = join(workDir, 'gates');
      const recorded = await recordGateDecision(VALID_INPUT, { gatesDir });
      const reproduced = await reproduceRun(recorded.runId, { gatesDir });
      expect(reproduced.corpusHash).toBe(VALID_INPUT.corpusHash);
      expect(reproduced.commit).toBe(VALID_INPUT.commit);
      expect(reproduced.decision).toBe('pass');
    });

    it('reproduce with unknown runId → UnknownRunError', async () => {
      const gatesDir = join(workDir, 'gates');
      const unknown = 'sha256:' + '0'.repeat(64);
      const result = await reproduceRun(unknown, { gatesDir }).catch(
        (e: unknown) => e,
      );
      expect(result).toMatchObject({
        name: 'ReproduceError',
        kind: 'UNKNOWN_RUN',
        runId: unknown,
      });
    });

    it('reproduce rejects malformed runId', async () => {
      const gatesDir = join(workDir, 'gates');
      const result = await reproduceRun('not-a-hash', { gatesDir }).catch(
        (e: unknown) => e,
      );
      expect(result).toMatchObject({
        name: 'ReproduceError',
        kind: 'MALFORMED_RUN_ID',
      });
    });
  });

  describe('append-only / supersede semantics (SC-7)', () => {
    it('re-recording under the same runId supersedes (last writer wins)', async () => {
      const gatesDir = join(workDir, 'gates');
      const first = await recordGateDecision(VALID_INPUT, { gatesDir });
      // Re-record with different decision/metrics.
      const second = await recordGateDecision(
        { ...VALID_INPUT, decision: 'fail', metrics: { echo: 0.4 } },
        { gatesDir },
      );
      expect(first.runId).toBe(second.runId);
      const reproduced = await reproduceRun(first.runId, { gatesDir });
      expect(reproduced.decision).toBe('fail');
      expect(reproduced.metrics).toEqual({ echo: 0.4 });
    });
  });
});
