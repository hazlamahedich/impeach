/**
 * TS→Python polyglot eval bridge (ADR-014, AC #6, #8, #9).
 *
 * Invokes the Python eval subprocess via ``node:child_process`` ``spawn``
 * — NO HTTP, NO daemon, NO process pool (ADR-014 hard constraint). One
 * stateless, isolated subprocess per ``runPythonEval()`` call.
 *
 * Wire format (JSON-lines):
 *   * Input:  one JSON object written to the subprocess stdin.
 *   * Output: one JSON object read from the subprocess stdout.
 *   * Errors: ``{ error: true, code, message }`` on stdout — raw Python
 *     tracebacks never reach stdout (stderr is for logging only).
 *
 * Timeout: 30 seconds per invocation. On expiry: ``SIGTERM`` → 5s grace →
 * ``SIGKILL`` (AC #8).
 *
 * @rules SC-1, AC-6, AC-8, AC-9
 * @adr ADR-014
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env } from 'node:process';

import type { EvalInput, EvalResult } from '@iip/contracts';
import { EvalResult as EvalResultSchema } from '@iip/contracts';

/**
 * Discriminated error union thrown by the bridge (mirrors the Python
 * error envelope + adds TS-side failure modes).
 *
 * @rules SC-1, AC-8
 */
export type EvalBridgeError =
  | { kind: 'SUBPROCESS_SPAWN'; code: string; message: string }
  | { kind: 'SUBPROCESS_TIMEOUT'; code: 'TIMEOUT'; message: string }
  | { kind: 'PYTHON_ERROR'; code: string; message: string }
  | { kind: 'MALFORMED_OUTPUT'; code: string; message: string }
  | { kind: 'SCHEMA_PARSE'; code: string; message: string };

/** 30-second deadline per eval invocation (AC #8). */
export const EVAL_BRIDGE_TIMEOUT_MS = 30_000;

/** Grace period between SIGTERM and SIGKILL on timeout (AC #8). */
export const EVAL_BRIDGE_GRACE_MS = 5_000;

/**
 * Default invocation: ``uv run --project <tools/eval> python -m eval``.
 * The tools/eval path is resolved relative to this package. Override via
 * ``IIP_EVAL_PYTHON_CMD`` (space-separated argv) for containerised runs.
 */
function resolveCommand(): { cmd: string; args: string[] } {
  const override = env['IIP_EVAL_PYTHON_CMD'];
  if (override && override.trim().length > 0) {
    const [cmd, ...args] = override.split(/\s+/);
    if (cmd === undefined) {
      throw new Error('IIP_EVAL_PYTHON_CMD resolved to an empty command');
    }
    return { cmd, args };
  }
  const toolsEvalPath = resolveToolsEvalPath();
  return {
    cmd: 'uv',
    args: [
      'run',
      '--project', toolsEvalPath,
      '--directory', toolsEvalPath,
      'python', '-m', 'eval',
    ],
  };
}

/**
 * Resolve ``tools/eval`` from this package's location
 * (``packages/eval/src`` → repo root → ``tools/eval``). Using ``new URL``
 * keeps it ESM-safe. ``fileURLToPath`` correctly decodes spaces in paths
 * (e.g. external drive names) where ``URL.pathname`` leaves ``%20``.
 */
function resolveToolsEvalPath(): string {
  const here = import.meta.url;
  // packages/eval/src/bridge.ts → three ../ up to repo root → tools/eval
  const root = new URL('../../../', here);
  return fileURLToPath(new URL('tools/eval', root));
}

/**
 * Kill the subprocess with the specified signal, waiting up to
 * ``graceMs`` before escalating to ``SIGKILL`` (AC #8).
 */
function killWithEscalation(
  child: { kill: (signal?: NodeJS.Signals) => boolean },
  graceMs: number,
): void {
  child.kill('SIGTERM');
  setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already dead — ignore */
    }
  }, graceMs).unref();
}

/**
 * Run the Python eval suite via a one-shot subprocess (AC #6, #8, #9).
 *
 * Throws a typed {@link EvalBridgeError} on any failure; never a raw
 * ``Error``. Resolves with the schema-validated {@link EvalResult}.
 *
 * @rules SC-1, AC-6, AC-8, AC-9
 * @adr ADR-014
 */
export function runPythonEval(
  spec: EvalInput,
  options: { timeoutMs?: number; graceMs?: number } = {},
): Promise<EvalResult> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? EVAL_BRIDGE_TIMEOUT_MS;
    const graceMs = options.graceMs ?? EVAL_BRIDGE_GRACE_MS;

    const { cmd, args } = resolveCommand();
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      // UV_LINK_MODE=copy avoids reflink failures on exFAT/external drives
      // (AppleDouble corruption). Harmless on Linux CI (already copy mode).
      env: { ...env, UV_LINK_MODE: 'copy' },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killWithEscalation(child, graceMs);
      reject({
        kind: 'SUBPROCESS_TIMEOUT',
        code: 'TIMEOUT',
        message: `eval subprocess exceeded ${timeoutMs}ms deadline`,
      } satisfies EvalBridgeError);
    }, timeoutMs);

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject({
        kind: 'SUBPROCESS_SPAWN',
        code: 'SPAWN_FAILED',
        message: `failed to spawn eval subprocess: ${err.message}`,
      } satisfies EvalBridgeError);
    });

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (timedOut) return; // already rejected by the timeout handler

      const line = stdout.trim().split('\n').pop();
      if (line === undefined || line === '') {
        reject({
          kind: 'MALFORMED_OUTPUT',
          code: 'EMPTY_OUTPUT',
          message: `eval subprocess produced no stdout (exit ${exitCode}); stderr: ${stderr.trim()}`,
        } satisfies EvalBridgeError);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (err) {
        reject({
          kind: 'MALFORMED_OUTPUT',
          code: 'INVALID_JSON',
          message: `eval subprocess stdout was not valid JSON: ${(err as Error).message}`,
        } satisfies EvalBridgeError);
        return;
      }

      // Python error envelope: { error: true, code, message } on stdout (AC #8).
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as { error?: unknown }).error === true
      ) {
        const envelope = parsed as { code?: string; message?: string };
        reject({
          kind: 'PYTHON_ERROR',
          code: envelope.code ?? 'UNKNOWN',
          message: envelope.message ?? 'unspecified Python error',
        } satisfies EvalBridgeError);
        return;
      }

      // Schema-validated parse (AC #7) — reject malformed results early.
      const result = EvalResultSchema.safeParse(parsed);
      if (!result.success) {
        reject({
          kind: 'SCHEMA_PARSE',
          code: 'SCHEMA_PARSE',
          message: `eval result failed Zod validation: ${result.error.message}`,
        } satisfies EvalBridgeError);
        return;
      }

      resolve(result.data);
    });

    // Write the input as one JSON line to stdin, then close it (AC #6).
    child.stdin.write(JSON.stringify(spec) + '\n');
    child.stdin.end();
  });
}
