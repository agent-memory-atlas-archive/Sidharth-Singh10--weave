// Sends one graph op through the Common Ground journal to the open Weave canvas.
// Usage: DOC_ID=weave_... node scripts/cg-smoke.mjs
const base = (process.env.CG_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "")
const docId = process.env.DOC_ID
if (!docId) {
  console.error("Set DOC_ID to the id shown by the CG badge in the Weave header.")
  process.exit(1)
}

const tokenResponse = await fetch(`${base}/api/capabilities/cap_graph/token`)
if (!tokenResponse.ok) {
  console.error(`token request failed: ${tokenResponse.status}`)
  process.exit(1)
}
const { token } = await tokenResponse.json()
const now = Date.now()
const envelope = {
  v: 1,
  doc_id: docId,
  turn_id: `turn_smoke_${now}`,
  seq: 1,
  actor: { kind: "agent", id: "weave-agent" },
  capability: "cap_graph",
  type: "graph.node.create",
  target: { kind: "graph.node" },
  payload: {
    op: {
      op: "node.create",
      id: `node-smoke-${now}`,
      label: "Common Ground",
      kind: "concept",
    },
  },
  rationale: "smoke test from scripts/cg-smoke.mjs",
  idempotency_key: `smoke:${now}`,
  created_at: new Date(now).toISOString(),
}

const response = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/ops`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-cg-capability": token,
  },
  body: JSON.stringify({ ops: [envelope] }),
})
console.log(response.status, await response.text())
