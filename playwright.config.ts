import { existsSync } from "node:fs";

import { defineConfig } from "@playwright/test";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};
const baseURL = "http://127.0.0.1:3200";
const apiBaseURL = "http://127.0.0.1:4100/api/v1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  webServer: [
    {
      command: "API_PORT=4100 AI_PROVIDER=mock_success pnpm run dev:api",
      url: `${apiBaseURL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `PORT=3200 NEXT_PUBLIC_API_BASE_URL=${apiBaseURL} pnpm run dev:web`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL,
    extraHTTPHeaders: {
      "x-six-e2e-api-base-url": apiBaseURL,
    },
    launchOptions,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-360", use: { viewport: { width: 360, height: 800 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 } } },
  ],
});
