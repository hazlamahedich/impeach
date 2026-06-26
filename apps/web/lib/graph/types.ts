/**
 * Shared graph model types — STR-9.
 *
 * One shell, three renderers (Cytoscape default / React Flow curated /
 * Sigma large-scale) all consume the same node/edge/selection shapes so the
 * tier-router can swap renderers without data translation. The URL-addressable
 * renderer selection lives in `lib/state/url-keys.ts` (`?renderer=`).
 *
 * @rules STR-9
 */

/** A node in the knowledge graph (entity or claim). */
export interface GraphNode {
  /** Stable identifier (UUID or derived hash). */
  id: string;
  /** Display label. */
  label: string;
  /** Entity or claim kind. */
  kind: 'entity' | 'claim';
  /** Trust tier colour token. */
  tier: 'verified' | 'contradicted' | 'caution' | 'insufficient' | 'disputed' | 'retracted';
}

/** A directed relationship between two graph nodes. */
export interface GraphEdge {
  id: string;
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Relationship verb (e.g. "alleges", "refutes", "supports"). */
  verb: string;
}

/** Selection state shared across the graph explorer shell. */
export interface SelectionState {
  selectedNodeId: string | null;
  activeNodeId: string | null;
}
