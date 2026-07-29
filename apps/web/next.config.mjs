import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig = {
  transpilePackages: ["@six/shared", "@six/ui"],
  outputFileTracingRoot: rootDir,
  experimental: {
    externalDir: true
  }
};

export default nextConfig;
