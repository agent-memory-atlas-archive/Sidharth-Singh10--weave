"use client";

import { useGraphStore } from "@/lib/store";
import { TOPIC_COLORS } from "@/lib/graph-projection";
import type { SourceRef } from "@/lib/graph-types";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceRow({ source }: { source: SourceRef }) {
  if (!source.note) {
    return <p className="text-xs text-faint">Manually created</p>;
  }
  return (
    <div>
      <p className="text-xs leading-relaxed text-muted">“{source.note}”</p>
      <p className="mt-0.5 text-[11px] text-faint">{formatTime(source.createdAt)}</p>
    </div>
  );
}

/** Side panel showing provenance (originating notes) for the focused node. */
export function SourceInspector() {
  const selectedNodeId = useGraphStore((s) => s.viewConfig.selectedNodeId);
  const node = useGraphStore((s) =>
    s.knowledgeNodes.find((n) => n.id === s.viewConfig.selectedNodeId)
  );
  const source = useGraphStore((s) =>
    s.viewConfig.selectedNodeId
      ? s.nodeSources[s.viewConfig.selectedNodeId]
      : undefined
  );
  const selectNode = useGraphStore((s) => s.selectNode);

  if (!selectedNodeId || !node) return null;

  return (
    <div className="pointer-events-auto absolute right-3 top-14 z-10 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{node.label}</p>
          <p className="text-[11px] text-faint">{node.kind}</p>
        </div>
        <button
          onClick={() => selectNode(undefined)}
          className="shrink-0 text-faint transition-colors hover:text-foreground"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Source
        </p>
        {source ? (
          <SourceRow source={source} />
        ) : (
          <p className="text-xs text-faint">No source recorded.</p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: TOPIC_COLORS[node.kind] ?? "#a1a1aa" }}
        />
        <span className="text-[11px] text-faint">Topic view tint</span>
      </div>
    </div>
  );
}