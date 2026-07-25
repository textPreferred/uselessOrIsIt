import { defineConfig, devices } from "@playwright/test";

// SMOKE_URL switches the suite to run the @smoke tests against a deployed
// site (no local server). Without it, the full suite runs against a local
// production build.
const smokeUrl = process.env.SMOKE_URL;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  grep: smokeUrl ? /@smoke/ : undefined,
  use: {
    baseURL: smokeUrl ?? "http://localhost:4173/uselessOrIsIt/",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: smokeUrl
    ? undefined
    : {
        command: "npm run build && npm run preview",
        url: "http://localhost:4173/uselessOrIsIt/",
        reuseExistingServer: !process.env.CI,
      },
});
