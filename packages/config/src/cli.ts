#!/usr/bin/env tsx
/**
 * iip-config CLI entry (D7, NFR-S-4).
 *
 * Usage:
 *   iip-config validate [--strict]
 *
 * ``validate`` checks that all required secrets/env vars are present and
 * well-formed. With ``--strict`` (or the default behaviour for a boot-time
 * CLI), exits non-zero on failure; without ``--strict`` it still exits
 * non-zero on failure (this CLI is always a hard gate — ``--strict`` is
 * accepted for ergonomic parity with ``iip-eval`` and future commands).
 *
 * Never logs secret values (NFR-S-4).
 *
 * @rules D7, NFR-S-4
 * @adr ADR-019
 */
import process from 'node:process';
import { validateConfig } from './secrets.js';

function usage(): never {
  process.stderr.write(
    'usage: iip-config validate [--strict]\n' +
      '  Validate that all required IIP secrets/env vars are present + well-formed.\n' +
      '  Exits 0 on success, 1 on failure.\n',
  );
  process.exit(2);
}

function main(argv: string[]): void {
  // argv[0] = node, argv[1] = script path, argv[2..] = user args.
  const args = argv.slice(2);
  if (args.length === 0) usage();

  const subcommand = args[0];
  if (subcommand === undefined) usage();

  if (subcommand === 'validate') {
    // --strict is accepted but this CLI is always a hard gate.
    const result = validateConfig();
    if (result.ok) {
      process.exit(0);
    }
    const { name } = result.error;
    const reason =
      result.error.kind === 'MISSING'
        ? 'missing'
        : result.error.reason;
    // Pino-shaped fatal line — never includes the secret value (NFR-S-4).
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'iip-config validate: configuration invalid',
        name,
        reason,
      }) + '\n',
    );
    process.exit(1);
  }

  if (subcommand === '-h' || subcommand === '--help' || subcommand === 'help') {
    usage();
  }

  process.stderr.write(`iip-config: unknown subcommand "${subcommand}"\n`);
  usage();
}

main(process.argv);
