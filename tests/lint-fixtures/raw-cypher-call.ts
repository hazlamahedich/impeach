// LINT FIXTURE (PC-1e) — intentionally illegal. Do not import or build.
//
// Represents a file at packages/rag/src/illegal.ts that invokes raw
// ag_catalog.cypher(), which violates PC-1e: AGE Cypher must go through the
// sole seam packages/graph/src/cypher.ts → cypher(). This fixture exercises
// BOTH hazard surfaces:
//   1. The JS-call form (ag_catalog.cypher(...)).
//   2. The string-template form (the real injection vector — an `$id`
//      interpolated into `$$ ... $$` is string-substituted, not bound).
//
// This file is excluded from lint (eslint `ignores`), build, and typecheck.
// It is consumed only by tests/lint/import-boundaries.test.ts, which feeds its
// source to ESLint via lintText() with a virtual filePath under packages/rag/.

// Surface 1: JS-call form.
export const jsCall = ag_catalog.cypher('iip_graph', 'MATCH (n) RETURN n');

// Surface 2: string-template form (tagged template literal).
const sql = `SELECT * FROM ag_catalog.cypher('iip_graph', $$ MATCH (n) WHERE n.id = $id RETURN n $$) AS (n agtype)`;

// Surface 3: string-literal form (client.query with an embedded cypher call).
const queryText = "SELECT * FROM ag_catalog.cypher('iip_graph', $$ RETURN 1 $$) AS (a agtype)";

export { sql, queryText };
