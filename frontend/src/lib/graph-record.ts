import type {
  KnowledgeEdge,
  KnowledgeNode,
  ViewConfig,
  XYPosition,
} from "./graph-types";

/** Snapshot of the client-owned graph at a point in time. */
export interface GraphSnapshot {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  positions: Record<string, XYPosition>;
  viewConfig: ViewConfig;
}

type GraphOp =
  | { op: "node.create"; id: string; label: string; kind: string; position?: XYPosition }
  | { op: "node.update"; id: string; label?: string; kind?: string; position?: XYPosition }
  | { op: "node.delete"; id: string }
  | { op: "edge.create"; id: string; source: string; target: string; relation: string }
  | { op: "edge.update"; id: string; source?: string; target?: string; relation?: string }
  | { op: "edge.delete"; id: string }
  | { op: "merge"; from: string; into: string }
  | { op: "view.set"; selectedNodeId?: string; semanticZoom?: string };

interface ProtocolInverse {
  type: string;
  target: { kind: string; id?: string };
  payload: { op: GraphOp };
}

const DOC_KEY = "weave.commonGroundDocId";
const BASE = (
  process.env.NEXT_PUBLIC_COMMON_GROUND_URL ?? "/common-ground"
).replace(/\/+$/, "");
const tokens = new Map<string, string>();

function docId(): string {
  try {
    const existing = window.localStorage.getItem(DOC_KEY);
    if (existing) return existing;
    const id = `weave_${crypto.randomUUID()}`;
    window.localStorage.setItem(DOC_KEY, id);
    return id;
  } catch {
    return `weave_${crypto.randomUUID()}`;
  }
}

async function tokenFor(capId: string): Promise<string> {
  const cached = tokens.get(capId);
  if (cached) return cached;
  const response = await fetch(
    `${BASE}/api/capabilities/${encodeURIComponent(capId)}/token`,
  );
  if (!response.ok) throw new Error(`token ${capId}: HTTP ${response.status}`);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error(`token ${capId}: missing`);
  tokens.set(capId, body.token);
  return body.token;
}

/** Forward graph ops for an already-applied human change. Position-only moves are ignored. */
export function forwardOps(before: GraphSnapshot, after: GraphSnapshot): GraphOp[] {
  const ops: GraphOp[] = [];
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const beforeEdges = new Map(before.edges.map((edge) => [edge.id, edge]));
  const afterEdges = new Map(after.edges.map((edge) => [edge.id, edge]));

  for (const node of after.nodes) {
    const previous = beforeNodes.get(node.id);
    if (!previous) {
      const position = after.positions[node.id];
      ops.push({
        op: "node.create",
        id: node.id,
        label: node.label,
        kind: node.kind,
        ...(position ? { position } : {}),
      });
    } else if (previous.label !== node.label || previous.kind !== node.kind) {
      ops.push({ op: "node.update", id: node.id, label: node.label, kind: node.kind });
    }
  }
  for (const node of before.nodes) {
    if (!afterNodes.has(node.id)) ops.push({ op: "node.delete", id: node.id });
  }
  for (const edge of after.edges) {
    const previous = beforeEdges.get(edge.id);
    if (!previous) {
      ops.push({
        op: "edge.create",
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
      });
    } else if (
      previous.source !== edge.source ||
      previous.target !== edge.target ||
      previous.relation !== edge.relation
    ) {
      ops.push({
        op: "edge.update",
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
      });
    }
  }
  for (const edge of before.edges) {
    if (!afterEdges.has(edge.id)) ops.push({ op: "edge.delete", id: edge.id });
  }
  return ops;
}

/** Inverse ops in the order the server's reverse replay expects. */
export function inverseOf(before: GraphSnapshot, after: GraphSnapshot): GraphOp[] {
  const inverses: GraphOp[] = [];
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const beforeEdges = new Map(before.edges.map((edge) => [edge.id, edge]));
  const afterEdges = new Map(after.edges.map((edge) => [edge.id, edge]));

  for (const node of after.nodes) {
    if (!beforeNodes.has(node.id)) inverses.push({ op: "node.delete", id: node.id });
  }
  for (const edge of after.edges) {
    if (!beforeEdges.has(edge.id)) inverses.push({ op: "edge.delete", id: edge.id });
  }
  for (const edge of before.edges) {
    const next = afterEdges.get(edge.id);
    if (
      next &&
      (next.source !== edge.source || next.target !== edge.target || next.relation !== edge.relation)
    ) {
      inverses.push({
        op: "edge.update",
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
      });
    }
  }
  for (const node of before.nodes) {
    const next = afterNodes.get(node.id);
    const position = before.positions[node.id];
    if (next && (next.label !== node.label || next.kind !== node.kind)) {
      inverses.push({
        op: "node.update",
        id: node.id,
        label: node.label,
        kind: node.kind,
        ...(position ? { position } : {}),
      });
    }
  }
  for (const edge of before.edges) {
    if (!afterEdges.has(edge.id)) {
      inverses.push({
        op: "edge.create",
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
      });
    }
  }
  for (const node of before.nodes) {
    if (!afterNodes.has(node.id)) {
      const position = before.positions[node.id];
      inverses.push({
        op: "node.create",
        id: node.id,
        label: node.label,
        kind: node.kind,
        ...(position ? { position } : {}),
      });
    }
  }
  return inverses;
}

function toInverseOps(ops: GraphOp[]): ProtocolInverse[] {
  return ops.map((op) => {
    const record = op as { id?: string; into?: string };
    const kind = op.op.startsWith("node.")
      ? "graph.node"
      : op.op.startsWith("edge.")
        ? "graph.edge"
        : "graph";
    const id = record.id ?? record.into;
    return {
      type: `graph.${op.op}`,
      target: { kind, ...(id ? { id } : {}) },
      payload: { op },
    };
  });
}

function targetFor(op: GraphOp): { kind: string; id?: string } {
  const record = op as { id?: string; into?: string };
  const kind = op.op.startsWith("node.")
    ? "graph.node"
    : op.op.startsWith("edge.")
      ? "graph.edge"
      : "graph";
  const id = record.id ?? record.into;
  return { kind, ...(id ? { id } : {}) };
}

/**
 * Posts a human graph edit after the Weave store has applied it. One user action is one turn.
 * Multiple changed objects are recorded as a `graph.doc.patch` with one aggregate inverse.
 */
export async function recordHumanGraph(
  before: GraphSnapshot,
  after: GraphSnapshot,
  rationale = "human graph edit",
): Promise<void> {
  const changes = forwardOps(before, after);
  if (changes.length === 0) return;
  const id = docId();
  const token = await tokenFor("cap_human");
  const turnId = `turn_human_${crypto.randomUUID()}`;
  const single = changes.length === 1 ? changes[0]! : null;
  const type = single ? `graph.${single.op}` : "graph.doc.patch";
  const target = single ? targetFor(single) : { kind: "graph" };
  const payload = single
    ? { op: single }
    : { op: { op: "patch", changes } };
  const first = changes[0] as { id?: string; into?: string };
  const resultId = first.id ?? first.into;
  const response = await fetch(`${BASE}/api/docs/${encodeURIComponent(id)}/records`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cg-capability": token,
    },
    body: JSON.stringify({
      records: [
        {
          envelope: {
            v: 1,
            doc_id: id,
            turn_id: turnId,
            seq: 0,
            actor: { kind: "human", id: "local" },
            capability: "cap_human",
            type,
            target,
            payload,
            rationale,
            idempotency_key: `human_${crypto.randomUUID()}`,
            created_at: new Date().toISOString(),
          },
          result: { ok: true, ...(resultId ? { id: resultId } : {}) },
          inverse: toInverseOps(inverseOf(before, after)),
          snapshot: after,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`record human graph edit: HTTP ${response.status}`);
  }
}
