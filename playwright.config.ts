import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "qa",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
    trace: "off",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: "npm run start",
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: true,
  },
});
