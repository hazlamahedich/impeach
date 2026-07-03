/**
 * Pydantic codegen — generates Pydantic V2 models from the Zod eval
 * schemas (SC-1, ADR-014).
 *
 * Pipeline: Zod schema → JSON Schema (zod-to-json-schema) → Pydantic V2
 * (datamodel-code-generator). The generated models are committed to
 * `tools/eval/src/eval/models.py`; a CI drift check asserts the
 * committed file matches a fresh generation.
 *
 * Run via:  pnpm exec tsx packages/contracts/scripts/gen-pydantic.ts
 *
 * @rules SC-1, AC-1, AC-2
 * @adr ADR-014
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { EvalInput, EvalResult } from '../src/eval.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const TOOLS_EVAL = join(PROJECT_ROOT, 'tools', 'eval');
const OUTPUT_PATH = join(TOOLS_EVAL, 'src', 'eval', 'models.py');

const HEADER = `# GENERATED CODE — DO NOT EDIT BY HAND.
# Produced by \`packages/contracts/scripts/gen-pydantic.ts\` (SC-1, ADR-014).
# Regenerate with: pnpm exec tsx packages/contracts/scripts/gen-pydantic.ts
# Drift is caught in CI by re-running the script and diffing against this file.
`;

/**
 * Build a single JSON-Schema document whose \`$defs\` contain every named
 * eval schema. \`datamodel-code-generator\` emits one Pydantic class per
 * \`$defs\` entry.
 */
function buildJsonSchema(): Record<string, unknown> {
  const defs: Record<string, unknown> = {};
  for (const [name, schema] of [
    ['EvalInput', EvalInput],
    ['EvalResult', EvalResult],
  ] as const) {
    const doc = zodToJsonSchema(schema, name);
    const docDefs = (doc as { definitions?: Record<string, unknown> }).definitions;
    if (docDefs && docDefs[name]) {
      defs[name] = docDefs[name];
    }
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'IIP_EVAL_SEAM',
    $defs: defs,
  };
}

/**
 * Invoke \`datamodel-code-generator\` inside the \`tools/eval\` uv project so
 * the exact pinned version (from \`uv.lock\`) is used. Exits non-zero on
 * failure (AC #2).
 */
function runCodegen(inputPath: string, outputPath: string): void {
  const result = spawnSync(
    'uv',
    [
      'run',
      '--project', TOOLS_EVAL,
      'datamodel-codegen',
      '--input', inputPath,
      '--input-file-type', 'jsonschema',
      '--output', outputPath,
      '--output-model-type', 'pydantic_v2.BaseModel',
      '--field-constraints',
      '--use-union-operator',
      '--strict-types', 'str', 'int', 'float', 'bool',
      // Deterministic output: --disable-timestamp omits the generation
      // timestamp from the header comment. Without this the CI drift check is
      // non-deterministic — re-running the generator always produces a diff
      // (the current time), masking real schema drift.
      '--disable-timestamp',
    ],
    { stdio: 'pipe', encoding: 'utf-8' },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stderr.write(result.stdout ?? '');
    process.exit(1);
  }
}

/**
 * Run ruff check + format on the generated file so imports and style stay
 * clean (unused imports removed, consistent formatting). Uses the same
 * pinned ruff from \`tools/eval\`'s uv project.
 */
function lintWithRuff(filePath: string): void {
  // `check --fix` auto-removes unused imports; `format` normalises style.
  const checkResult = spawnSync(
    'uv',
    ['run', '--project', TOOLS_EVAL, 'ruff', 'check', '--fix', '--quiet', filePath],
    { stdio: 'pipe', encoding: 'utf-8' },
  );
  if (checkResult.status !== 0) {
    process.stderr.write(`ruff check failed:\n${checkResult.stderr ?? ''}${checkResult.stdout ?? ''}\n`);
    process.exit(1);
  }
  const formatResult = spawnSync(
    'uv',
    ['run', '--project', TOOLS_EVAL, 'ruff', 'format', '--quiet', filePath],
    { stdio: 'pipe', encoding: 'utf-8' },
  );
  if (formatResult.status !== 0) {
    process.stderr.write(`ruff format failed:\n${formatResult.stderr ?? ''}${formatResult.stdout ?? ''}\n`);
    process.exit(1);
  }
}

export function generatePydantic(): string {
  const schema = buildJsonSchema();
  const tmpDir = mkdtempSync(join(tmpdir(), 'iip-pydantic-'));
  const schemaPath = join(tmpDir, 'eval-schema.json');
  const rawOutPath = join(tmpDir, 'models_raw.py');

  try {
    writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
    runCodegen(schemaPath, rawOutPath);
    const generated = readFileSync(rawOutPath, 'utf-8');
    // Strip the synthetic root RootModel class (an artefact of the wrapper
    // document title); only the named $defs models are meaningful.
    const cleaned = generated.replace(/\n*class\s+\w+\(RootModel\[.*?\]\):\n(?:.*\n)*?\n\n/, '\n');
    const outPath = join(tmpDir, 'models.py');
    writeFileSync(outPath, cleaned.trimStart(), 'utf-8');
    lintWithRuff(outPath);
    return HEADER + readFileSync(outPath, 'utf-8').trimStart();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main(): void {
  const output = generatePydantic();
  writeFileSync(OUTPUT_PATH, output, 'utf-8');
  process.stdout.write(`✓ Generated Pydantic models → ${OUTPUT_PATH}\n`);
}

// Run when invoked directly, not when imported.
const invokedDirectly = resolve(process.argv[1] ?? '') ===
  resolve(import.meta.dirname, 'gen-pydantic.ts');
if (invokedDirectly) {
  main();
}
