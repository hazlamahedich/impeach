import { pgTable, bigint, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type { Seq, PartitionKey, PrevHash, CorpusHash, Signature } from '@iip/contracts';

/**
 * `editorial_log` — the append-only, hash-chained, Ed25519-signed audit trail
 * (SEC-6, AC-11, DoD-8).
 *
 * Every editorial action is recorded as a hash-chained entry. The table is
 * append-only: `UPDATE` and `DELETE` are revoked at the PostgreSQL level
 * (DoD-17). Each entry's `curr_hash` is `SHA-256(prev_hash || JCS(canonical_payload))`
 * (AC-1, DoD-11).
 *
 * Primary key: `(partition_key, seq)` — enforces the no-fork guarantee (AC-16).
 * Unique constraint: `(partition_key, jti)` — prevents jti replay within a
 * partition (AC-3). Index: `(partition_key, time)` for time-range queries.
 *
 * `witness_cursor` (BIGINT nullable) tracks the last sequence number published
 * to the external witness — NULL until Story 2.5 (AC-6).
 *
 * @rules SEC-6, AC-1, AC-4, AC-8, AC-11, AC-16, DoD-8, DoD-17
 * @adr ADR-0001
 * @term T-006
 */
export const editorialLog = pgTable(
  'editorial_log',
  {
    seq: bigint('seq', { mode: 'number' }).$type<Seq>().notNull(),
    partition_key: text('partition_key').$type<PartitionKey>().notNull(),
    prev_hash: text('prev_hash').$type<PrevHash>().notNull(),
    curr_hash: text('curr_hash').$type<CorpusHash>().notNull(),
    principal_sub: text('principal_sub').notNull(),
    signature: text('signature').$type<Signature>().notNull(),
    event: text('event').notNull(),
    jti: text('jti').notNull(),
    payload: jsonb('payload').notNull(),
    time: timestamp('time', { withTimezone: true, mode: 'date' }).notNull(),
    witness_cursor: bigint('witness_cursor', { mode: 'number' }),
  },
  (table) => ({
    // No-Fork Guarantee (AC-16): composite PK rejects duplicate (partition_key, seq).
    partitionSeqPk: uniqueIndex('editorial_log_partition_seq_pk').on(table.partition_key, table.seq),
    // jti replay prevention (AC-3): unique per partition.
    partitionJtiUq: uniqueIndex('editorial_log_partition_jti_uq').on(table.partition_key, table.jti),
    // Time-range query index (DoD-8).
    partitionTimeIdx: index('editorial_log_partition_time_idx').on(table.partition_key, table.time),
  }),
);
