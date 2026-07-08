/**
 * Cypher seam unit tests (PC-1e).
 *
 * @rules PC-1e, NFR-S-2, STR-5
 * @adr ADR-0015, ADR-0002
 */
import { describe, it, expect } from 'vitest';
import { cypher, type CypherExecutor } from './cypher.js';
import { GraphName } from '@iip/contracts';

/** Stub executor that captures the SQL + values for assertions and returns canned rows. */
function makeExecutor(rows: Record<string, unknown>[] = [{ result: 'ok' }]): {
  executor: CypherExecutor;
  calls: Array<{ text: string; values: readonly unknown[] | undefined }>;
} {
  const calls: Array<{ text: string; values: readonly unknown[] | undefined }> = [];
  return {
    executor: {
      async query(text: string, values?: readonly unknown[]) {
        calls.push({ text, values });
        return { rows };
      },
    },
    calls,
  };
}

describe('[P0] cypher seam — PC-1e parameterized entry point', () => {
  it('parameterizes the graph name as a bind param ($1), never interpolates it', async () => {
    const { executor, calls } = makeExecutor();
    const graph = GraphName.parse('iip_graph');

    await cypher(graph, 'RETURN 1', {}, executor, (r) => r['result']);

    expect(calls).toHaveLength(1);
    const { text, values } = calls[0]!;
    // The graph name MUST NOT appear interpolated in the SQL string itself.
    // It should appear only in the values array as the first bind param.
    expect(text).toContain('ag_catalog.cypher($1');
    expect(text).not.toMatch(/cypher\('iip_graph'/);
    expect(text).not.toMatch(/cypher\(iip_graph/);
    // First bind value is the graph name.
    expect(values?.[0]).toBe('iip_graph');
  });

  it('JSON-serializes params as $2::jsonb (the third ag_catalog.cypher arg)', async () => {
    const { executor, calls } = makeExecutor();
    const graph = GraphName.parse('iip_graph');

    await cypher(
      graph,
      'MATCH (n) WHERE n.id = $id RETURN n',
      { id: 'abc-123', tier: 2 },
      executor,
      (r) => r['result'],
    );

    const { text, values } = calls[0]!;
    expect(text).toContain('$2::jsonb');
    expect(values?.[1]).toBe(JSON.stringify({ id: 'abc-123', tier: 2 }));
  });

  it('wraps the query body in $$ ... $$ dollar-quoting', async () => {
    const { executor, calls } = makeExecutor();
    const graph = GraphName.parse('iip_graph');

    await cypher(graph, 'MATCH (n) RETURN count(n)', {}, executor, (r) => r['result']);

    const { text } = calls[0]!;
    expect(text).toContain('$$ MATCH (n) RETURN count(n) $$');
  });

  it('applies the caller-supplied row mapper to each returned row', async () => {
    const rows = [{ result: 'a' }, { result: 'b' }, { result: 'c' }];
    const { executor } = makeExecutor(rows);
    const graph = GraphName.parse('iip_graph');

    const mapped = await cypher(
      graph,
      'RETURN 1',
      {},
      executor,
      (r) => r['result'] as string,
    );

    expect(mapped).toEqual(['a', 'b', 'c']);
  });

  it('uses the custom columns clause when provided', async () => {
    const { executor, calls } = makeExecutor();
    const graph = GraphName.parse('iip_graph');

    await cypher(
      graph,
      'MATCH (n) RETURN n.id, n.label',
      {},
      executor,
      (r) => r,
      '(id agtype, label agtype)',
    );

    const { text } = calls[0]!;
    expect(text).toContain('AS (id agtype, label agtype)');
    expect(text).not.toContain('AS (result agtype)');
  });

  it('[negative] throws on empty query (fail-closed)', async () => {
    const { executor } = makeExecutor();
    const graph = GraphName.parse('iip_graph');

    await expect(
      cypher(graph, '', {}, executor, (r) => r),
    ).rejects.toThrow(/non-empty string/);
  });

  it('[negative] throws when params is not an object', async () => {
    const { executor } = makeExecutor();
    const graph = GraphName.parse('iip_graph');

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cypher(graph, 'RETURN 1', 'not-an-object' as any, executor, (r) => r),
    ).rejects.toThrow(/params must be an object/);
  });

  it('returns an empty array when the executor yields no rows', async () => {
    const { executor } = makeExecutor([]);
    const graph = GraphName.parse('iip_graph');

    const mapped = await cypher(graph, 'RETURN 1', {}, executor, (r) => r);
    expect(mapped).toEqual([]);
  });

  it('does NOT JS-interpolate params into the SQL body (the PC-1e footgun)', async () => {
    const { executor, calls } = makeExecutor();
    const graph = GraphName.parse('iip_graph');
    const evil = "'; DROP TABLE users; --";

    await cypher(graph, 'CREATE (n {name: $name})', { name: evil }, executor, (r) => r);

    const { text } = calls[0]!;
    // The injection payload MUST NOT appear anywhere in the SQL text.
    expect(text).not.toContain(evil);
    expect(text).not.toContain('DROP TABLE');
    // It should be safely JSON-serialized in the values array instead.
    expect(calls[0]!.values?.[1]).toBe(JSON.stringify({ name: evil }));
  });
});
