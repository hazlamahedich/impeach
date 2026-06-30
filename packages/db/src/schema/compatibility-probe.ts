import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Branded/nominal ID for the compatibility probe table. Prevents transposition
 * bugs where a different UUID string is passed where a probe ID is expected.
 */
type CompatibilityProbeId = string & { readonly __brand: 'CompatibilityProbeId' };

/**
 * Minimal relational schema for the Story 1.2 compatibility proof.
 *
 * Real domain tables (corpus, claims, editorial log, etc.) are owned by later
 * stories. Drizzle requires at least one table definition or the schema import
 * is dead code — this table proves the relational layer is wired.
 *
 * @rules AC-1
 * @adr ADR-002
 */
export const compatibilityProbe = pgTable('compatibility_probe', {
  id: uuid('id')
    .$type<CompatibilityProbeId>()
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
});
