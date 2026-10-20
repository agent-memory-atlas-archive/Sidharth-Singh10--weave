"use client";

import { useSyncExternalStore } from "react";
import { getCommonGroundDocId } from "@/lib/common-ground";

const subscribe = () => () => {};

/** Shows the adapter's document id; an agent targets this id with graph envelopes. */
export function CommonGroundBadge() {
  const docId = useSyncExternalStore(subscribe, getCommonGroundDocId, () => "");
  if (!docId) return null;
  return (
    <span
      title={`Common Ground document: ${docId}`}
      className="pointer-events-auto rounded-full border border-line bg-background/60 px-2 py-0.5 font-mono text-[10px] text-faint"
    >
      CG {docId.slice(-8)}
    </span>
  );
}
