/**
 * Eval bridge — subprocess stdout/kill resilience (EXPANSION).
 *
 * Expands Story 1.5 coverage: multi-chunk stdout reassembly, multi-line
 * last-line semantics, SIGKILL escalation after grace, and stderr surfacing
 * in error messages. Uses the same mocked-subprocess harness as bridge.test.ts.
 *
 * @rules SC-1, AC-6, AC-8, AC-9
 * @adr ADR-014
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

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

const { runPythonEval } = await import('./bridge.js');
const { EVAL_SCHEMA_VERSION } = await import('@iip/contracts');

function emitStdout(line: string): void {
  mockChild.stdout.emit('data', Buffer.from(line + '\n', 'utf8'));
}

function emitStdoutRaw(piece: string): void {
  mockChild.stdout.emit('data', Buffer.from(piece, 'utf8'));
}

function emitStderr(line: string): void {
  mockChild.stderr.emit('data', Buffer.from(line, 'utf8'));
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

function validResultJson(suite = 'unit'): string {
  return JSON.stringify({
    schemaVersion: '1.0.0',
    suite,
    metrics: [{ fixture_id: 'f1', metric: 'echo', score: 0.5 }],
  });
}

describe('runPythonEval — stdout resilience (AC-8, ADR-014)', () => {
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

  it('[P1] reassembles JSON delivered across multiple stdout data chunks', async () => {
    // GIVEN the Python subprocess emits a valid JSON result split across 3 chunks
    const json = validResultJson('chunked');
    const mid = Math.floor(json.length / 2);
    const pieces = [json.slice(0, mid), json.slice(mid, mid + 10), json.slice(mid + 10)];

    const promise = runPythonEval(validInput());

    // WHEN the chunks arrive as separate 'data' events before close
    for (const piece of pieces) emitStdoutRaw(piece);
    closeChild(0);

    // THEN the bridge accumulates and resolves with the parsed result
    await expect(promise).resolves.toMatchObject({ suite: 'chunked' });
  });

  it('[P1] extracts the LAST line when Python logs intermediate lines before the result JSON', async () => {
    // GIVEN stdout carries a log line then the JSON result on a later line
    const promise = runPythonEval(validInput());

    // WHEN the bridge processes (stdout.trim().split("\\n").pop() takes the last line)
    emitStdout('INFO: starting eval');
    emitStdout(validResultJson('logged'));
    closeChild(0);

    // THEN it resolves with the JSON result (not rejected as malformed)
    await expect(promise).resolves.toMatchObject({ suite: 'logged' });
  });

  it('[P1] rejects with MALFORMED_OUTPUT when the last line is a non-JSON log line (pop takes last)', async () => {
    // GIVEN valid JSON on line 1 followed by a trailing non-JSON log line
    const promise = runPythonEval(validInput());

    // WHEN processed — the last line is the log, not the JSON
    emitStdout(validResultJson());
    emitStdout('WARNING: done');
    closeChild(0);

    // THEN the bridge rejects (last-line semantics, not first-line)
    await expect(promise).rejects.toMatchObject({ kind: 'MALFORMED_OUTPUT' });
  });

  it('[P1] includes stderr in the MALFORMED_OUTPUT error message for debuggability', async () => {
    // GIVEN the subprocess exits 0 with empty stdout but writes a traceback to stderr
    const promise = runPythonEval(validInput());

    // WHEN the bridge builds the error envelope
    emitStderr('Traceback (most recent call last): python boom');
    closeChild(0);

    // THEN the MALFORMED_OUTPUT message surfaces the stderr text (eval debuggability)
    const err = await promise.catch((e) => e);
    expect(err.kind).toBe('MALFORMED_OUTPUT');
    expect(String(err.message)).toContain('python boom');
  });
});

describe('runPythonEval — SIGKILL escalation after grace (AC-8)', () => {
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

  it('[P1] escalates to SIGKILL after the grace period on timeout', async () => {
    // GIVEN a timeout fires (short deadline + short grace) and the child ignores SIGTERM
    vi.useFakeTimers();
    const killMock = mockChild.kill as ReturnType<typeof vi.fn>;
    const promise = runPythonEval(validInput(), { timeoutMs: 100, graceMs: 50 });

    // WHEN the deadline elapses
    vi.advanceTimersByTime(100);

    // THEN the bridge rejects with SUBPROCESS_TIMEOUT and sends SIGTERM immediately
    await expect(promise).rejects.toMatchObject({ kind: 'SUBPROCESS_TIMEOUT', code: 'TIMEOUT' });
    expect(killMock).toHaveBeenCalledWith('SIGTERM');

    // AND WHEN the grace period then elapses
    vi.advanceTimersByTime(50);

    // THEN SIGKILL is sent (escalation, AC-8)
    expect(killMock).toHaveBeenCalledWith('SIGKILL');
  });
});
