import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin and mongodb are Node-only; keep them out of the bundle.
  serverExternalPackages: ["firebase-admin", "mongodb"],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
