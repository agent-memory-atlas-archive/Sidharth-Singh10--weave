import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const BASE = (process.env.COMMON_GROUND_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "");

/**
 * Same-origin proxy for the Common Ground journal. A route handler is used instead of a
 * next.config rewrite because Journal events are SSE and need to stream through unbuffered.
 */
async function proxy(
  request: NextRequest,
  context: { params: Promise<unknown> },
): Promise<Response> {
  const { path } = (await context.params) as { path: string[] };
  const target = `${BASE}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    // Node's fetch requires half-duplex for a streaming request body.
    ...(request.method === "GET" || request.method === "HEAD"
      ? {}
      : { duplex: "half" }),
    signal: request.signal,
    cache: "no-store",
  } as RequestInit & { duplex?: "half" });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
