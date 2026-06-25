import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Minimal shape the bridge uses from a child's stdin stream. */
interface MockWritable extends EventEmitter {
  write: (data: string) => boolean;
  end: () => void;
}

function createMockWritable(): MockWritable {
  const emitter = new EventEmitter() as MockWritable;
  emitter.write = vi.fn(() => true);
  emitter.end = vi.fn(() => undefined);
  return emitter;
}

// Mock spawn so unit tests don't require uv/python to be installed.
const mockStdin = createMockWritable();

const mockChild = new EventEmitter() as EventEmitter & {
  stdin: MockWritable;
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: (signal?: NodeJS.Signals) => boolean;
};
mockChild.stdin = mockStdin;
mockChild.stdout = new EventEmitter();
mockChild.stderr = new EventEmitter();
mockChild.kill = vi.fn(() => true);

const spawnMock = vi.fn((_cmd: string, _args: string[]) => mockChild);

vi.mock('node:child_process', () => ({
  spawn: (cmd: string, args: string[]) => spawnMock(cmd, args),
}));

// Import AFTER mocks are registered.
const { runPythonEval, EVAL_BRIDGE_TIMEOUT_MS } = await import('./bridge.js');
const { EVAL_SCHEMA_VERSION } = await import('@iip/contracts');

function emitStdout(line: string): void {
  mockChild.stdout.emit('data', Buffer.from(line + '\n', 'utf8'));
}

function closeChild(exitCode: number | null = 0): void {
  mockChild.emit('close', exitCode);
}

function validInput() {
  return {
    schemaVersion: EVAL_SCHEMA_VERSION,
    suite: 'unit',
    fixtures: [{ id: 'f1', payload: 0.5 }],
  };
}

describe('runPythonEval (Story 1.5 bridge)', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    mockChild.removeAllListeners();
    mockChild.stdout.removeAllListeners();
    mockChild.stderr.removeAllListeners();
    (mockChild.kill as ReturnType<typeof vi.fn>).mockClear();
    (mockStdin.write as ReturnType<typeof vi.fn>).mockClear();
    (mockStdin.end as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('happy path (AC #6, #7)', () => {
    it('spawns the subprocess and writes JSON to stdin', async () => {
      const promise = runPythonEval(validInput());
      expect(spawnMock).toHaveBeenCalledOnce();
      expect(mockStdin.write).toHaveBeenCalledOnce();
      const written = (mockStdin.write as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const parsed = JSON.parse(written as string);
      expect(parsed.schemaVersion).toBe('1.0.0');

      emitStdout(JSON.stringify({
        schemaVersion: '1.0.0',
        suite: 'unit',
        metrics: [{ fixture_id: 'f1', metric: 'echo', score: 0.5 }],
      }));
      closeChild(0);

      await expect(promise).resolves.toMatchObject({ suite: 'unit' });
    });
  });

  describe('Python error envelope (AC #8)', () => {
    it('rejects with PYTHON_ERROR when stdout carries {error:true}', async () => {
      const promise = runPythonEval(validInput());
      emitStdout(JSON.stringify({ error: true, code: 'VALIDATION_ERROR', message: 'bad' }));
      closeChild(0);
      await expect(promise).rejects.toMatchObject({
        kind: 'PYTHON_ERROR',
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects with SCHEMA_VERSION_MISMATCH envelope code', async () => {
      const promise = runPythonEval(validInput());
      emitStdout(JSON.stringify({
        error: true,
        code: 'SCHEMA_VERSION_MISMATCH',
        message: 'version drift',
      }));
      closeChild(0);
      await expect(promise).rejects.toMatchObject({ code: 'SCHEMA_VERSION_MISMATCH' });
    });
  });

  describe('malformed output (AC #8)', () => {
    it('rejects with MALFORMED_OUTPUT on non-JSON stdout', async () => {
      const promise = runPythonEval(validInput());
      emitStdout('not json');
      closeChild(1);
      await expect(promise).rejects.toMatchObject({ kind: 'MALFORMED_OUTPUT' });
    });

    it('rejects with MALFORMED_OUTPUT on empty stdout', async () => {
      const promise = runPythonEval(validInput());
      closeChild(0);
      await expect(promise).rejects.toMatchObject({ kind: 'MALFORMED_OUTPUT', code: 'EMPTY_OUTPUT' });
    });
  });

  describe('schema parse failure (AC #7)', () => {
    it('rejects with SCHEMA_PARSE when result fails Zod', async () => {
      const promise = runPythonEval(validInput());
      emitStdout(JSON.stringify({
        schemaVersion: '1.0.0',
        suite: 'unit',
        metrics: [{ fixture_id: 'f1', metric: 'echo', score: 99 }],
      }));
      closeChild(0);
      await expect(promise).rejects.toMatchObject({ kind: 'SCHEMA_PARSE' });
    });
  });

  describe('timeout (AC #8)', () => {
    it('rejects with SUBPROCESS_TIMEOUT and kills the child', async () => {
      vi.useFakeTimers();
      const promise = runPythonEval(validInput(), { timeoutMs: 100, graceMs: 50 });
      vi.advanceTimersByTime(100);
      await expect(promise).rejects.toMatchObject({
        kind: 'SUBPROCESS_TIMEOUT',
        code: 'TIMEOUT',
      });
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('spawn failure', () => {
    it('rejects with SUBPROCESS_SPAWN on child error event', async () => {
      const promise = runPythonEval(validInput());
      mockChild.emit('error', Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      await expect(promise).rejects.toMatchObject({
        kind: 'SUBPROCESS_SPAWN',
        code: 'SPAWN_FAILED',
      });
    });
  });

  describe('command override (IIP_EVAL_PYTHON_CMD)', () => {
    it('honours IIP_EVAL_PYTHON_CMD when set', async () => {
      const tmpBin = mkdtempSync(join(tmpdir(), 'iip-bridge-'));
      const stub = join(tmpBin, 'stub.py');
      writeFileSync(stub, [
        '#!/usr/bin/env python3',
        'import sys, json',
        'json.loads(sys.stdin.readline())',
        'print(json.dumps({"schemaVersion":"1.0.0","suite":"override","metrics":[]}))',
        'sys.exit(0)',
      ].join('\n'));
      vi.resetModules();
      vi.doMock('node:child_process', () => ({ spawn: vi.fn(() => mockChild) }));
      try {
        const result = runPythonEval(validInput(), {});
        emitStdout(JSON.stringify({
          schemaVersion: '1.0.0',
          suite: 'override',
          metrics: [],
        }));
        closeChild(0);
        await expect(result).resolves.toMatchObject({ suite: 'override' });
      } finally {
        rmSync(tmpBin, { recursive: true, force: true });
        vi.doUnmock('node:child_process');
      }
    });
  });

  describe('exported constants', () => {
    it('exposes the 30s timeout constant (AC #8)', () => {
      expect(EVAL_BRIDGE_TIMEOUT_MS).toBe(30_000);
    });
  });
});
