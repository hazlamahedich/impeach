import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * `drizzle-kit generate` + `drizzle-kit migrate` are the only sanctioned
 * migration commands. `push` is dev-only and MUST NOT run in CI
 * (non-deterministic).
 *
 * @rules STR-12
 * @adr ADR-002
 */
export default defineConfig({
  schema: './src/schema/**/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  strict: true,
});
