#!/usr/bin/env tsx
/**
 * iip-eval CLI entry (SC-7, AC-F1-10).
 *
 * Usage:
 *   iip-eval freeze [--corpus-dir <path>] [--out-dir <path>] [--dry-run]
 *   iip-eval reproduce <run-id> [--gates-dir <path>] [--dry-run]
 *
 * ``freeze`` walks the golden corpus, hashes every file, and writes
 * ``eval/corpus/<corpusHash>/manifest.json``. With ``--dry-run`` it logs the
 * would-be output path and the computed hash WITHOUT writing the manifest.
 *
 * ``reproduce`` re-emits the recorded gate decision for ``<run-id>``. With
 * ``--dry-run`` it validates the runId shape and logs the path it would
 * read WITHOUT touching the filesystem.
 *
 * @rules SC-7, AC-F1-10
 */
import process from 'node:process';
import { freezeCorpus, DEFAULT_CORPUS_DIR, DEFAULT_OUT_DIR } from './freeze.js';
import {
  reproduceRun,
  DEFAULT_GATES_DIR,
  ReproduceError,
} from './reproduce.js';

interface ParsedArgs {
  readonly subcommand: string;
  readonly flags: Record<string, string | boolean>;
  readonly positional: readonly string[];
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [subcommand, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === undefined) continue;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { subcommand: subcommand ?? '', flags, positional };
}

function usage(): never {
  process.stderr.write(
    [
      'usage: iip-eval <subcommand> [options]',
      '',
      'subcommands:',
      '  freeze [--corpus-dir <path>] [--out-dir <path>] [--dry-run]',
      '      Hash the golden corpus and write manifest.json.',
      '  reproduce <run-id> [--gates-dir <path>] [--dry-run]',
      '      Re-emit a recorded gate decision.',
      '',
    ].join('\n'),
  );
  process.exit(2);
}

function isBool(v: string | boolean | undefined): boolean {
  return v === true;
}

async function runFreeze(args: ParsedArgs): Promise<void> {
  const corpusDir =
    typeof args.flags['corpus-dir'] === 'string'
      ? args.flags['corpus-dir']
      : DEFAULT_CORPUS_DIR;
  const outDir =
    typeof args.flags['out-dir'] === 'string'
      ? args.flags['out-dir']
      : DEFAULT_OUT_DIR;
  const dryRun = isBool(args.flags['dry-run']);

  const result = await freezeCorpus(corpusDir, {
    outDir,
    writeManifest: !dryRun,
  });

  if (dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          corpusHash: result.corpusHash,
          wouldWrite: `${outDir}/${result.corpusHash}/manifest.json`,
          fileCount: result.manifest.files.length,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }
  process.stdout.write(
    JSON.stringify(
      {
        corpusHash: result.corpusHash,
        manifestPath: result.manifestPath,
        fileCount: result.manifest.files.length,
      },
      null,
      2,
    ) + '\n',
  );
}

async function runReproduce(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  if (runId === undefined) {
    process.stderr.write('iip-eval reproduce: <run-id> is required\n');
    process.exit(2);
  }
  const gatesDir =
    typeof args.flags['gates-dir'] === 'string'
      ? args.flags['gates-dir']
      : DEFAULT_GATES_DIR;
  const dryRun = isBool(args.flags['dry-run']);

  if (dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          runId,
          wouldRead: `${gatesDir}/${runId}/decision.json`,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  try {
    const decision = await reproduceRun(runId, { gatesDir });
    process.stdout.write(JSON.stringify(decision, null, 2) + '\n');
  } catch (e: unknown) {
    if (e instanceof ReproduceError) {
      process.stderr.write(
        JSON.stringify(
          {
            level: 60,
            time: Date.now(),
            msg: 'iip-eval reproduce: failed',
            kind: e.kind,
            runId: e.runId,
            reason: e.reason,
          },
          null,
          2,
        ) + '\n',
      );
      process.exit(1);
    }
    process.stderr.write(
      `iip-eval reproduce: fatal: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) usage();
  const args = parseArgs(argv);

  switch (args.subcommand) {
    case 'freeze':
      await runFreeze(args);
      return;
    case 'reproduce':
      await runReproduce(args);
      return;
    case '-h':
    case '--help':
    case 'help':
      usage();
      return;
    default:
      process.stderr.write(`iip-eval: unknown subcommand "${args.subcommand}"\n`);
      usage();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `iip-eval: fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
