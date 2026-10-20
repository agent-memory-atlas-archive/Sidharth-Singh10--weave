import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  async rewrites() {
    // Same-origin gateway to the Rust API: the browser only talks to :3000,
    // so SameSite cookies work in dev and CORS stays locked down.
    const api = process.env.WEAVE_API_URL ?? "http://localhost:3001";
    const commonGround = process.env.COMMON_GROUND_URL ?? "http://127.0.0.1:8787";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/auth/:path*", destination: `${api}/auth/:path*` },
      // Same-origin path to the Common Ground journal and SSE stream.
      { source: "/common-ground/:path*", destination: `${commonGround}/:path*` },
    ];
  },
};

export default nextConfig;
