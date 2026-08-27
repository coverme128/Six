import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@six/shared", "@six/ui"],
  outputFileTracingRoot: rootDir,
  experimental: {
    externalDir: true
  }
};

export default nextConfig;
