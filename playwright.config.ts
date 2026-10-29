import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the mock Api host (tests/mock-api). CI builds the app first; locally run `pnpm build` once.
 * PW_CHROMIUM lets a sandbox use a preinstalled browser instead of `playwright install`.
 */
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://localhost:3001", locale: "fa-IR", timezoneId: "Asia/Tehran", trace: "retain-on-failure", launchOptions },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions } },
  ],
  webServer: [
    { command: "node tests/mock-api/server.mjs", port: 5080, reuseExistingServer: !process.env.CI },
    {
      command: "pnpm start",
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: { PISHKHAN_API_URL: "http://localhost:5080", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
