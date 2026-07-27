import { existsSync } from "node:fs";

import { defineConfig } from "@playwright/test";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launchOptions = existsSync(chromePath) ? { executablePath: chromePath } : {};
const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "PORT=3100 npm run dev",
    url: `${baseURL}/api/metadata`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  use: {
    baseURL,
    launchOptions,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-360", use: { viewport: { width: 360, height: 800 }, isMobile: true } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 }, isMobile: true } },
  ],
});
