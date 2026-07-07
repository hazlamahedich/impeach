/**
 * Graph contract types — AGE named-graph identity (PC-1e, STR-5).
 *
 * `GraphName` is the branded nominal type for an Apache AGE named graph. The
 * sole sanctioned Cypher entry point — `packages/graph/src/cypher.ts → cypher()`
 * — accepts a `GraphName` as its first argument so a plain string cannot be
 * transposed into the graph-name slot (DoD-1). `IIP_GRAPH` is the well-known
 * constant for the platform's primary named graph (created by
 * `infra/sql/age/migrations/0001-iip-graph.sql`).
 *
 * @rules PC-1e, STR-5, DoD-1
 * @adr ADR-0015, ADR-0002
 */
import { z } from 'zod';

/**
 * GraphName — branded identifier for an AGE named graph.
 *
 * AGE graph names are simple identifiers (letters, digits, underscore; must
 * start with a letter or underscore). The brand prevents a plain string from
 * being passed where a validated graph name is expected (DoD-1), and keeps the
 * graph name distinct from other string identifiers (`PartitionKey`, `Kid`,
 * etc.).
 *
 * @rules PC-1e, DoD-1
 */
export const GraphName = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'must be a valid AGE graph identifier')
  .brand('GraphName');
export type GraphName = z.infer<typeof GraphName>;

/**
 * IIP_GRAPH — the platform's primary named graph.
 *
 * Created by `infra/sql/age/migrations/0001-iip-graph.sql` and referenced
 * throughout the architecture (`architecture.md` §AGE). Published here as a
 * constant so every caller uses the same validated identifier without
 * re-parsing a string literal at each call site.
 *
 * @rules PC-1e, STR-5
 * @adr ADR-0002
 */
export const IIP_GRAPH: GraphName = GraphName.parse('iip_graph');
