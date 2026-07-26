import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Some sandboxed dev environments pre-install Chromium at a fixed path
// instead of the per-version browser cache; use it when present.
const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(preinstalledChromium)
  ? preinstalledChromium
  : undefined;

// SMOKE_URL switches the suite to run the @smoke tests against a deployed
// site (no local server). Without it, the full suite runs against a local
// production build.
const smokeUrl = process.env.SMOKE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  grep: smokeUrl ? /@smoke/ : undefined,
  use: {
    baseURL: smokeUrl ?? "http://localhost:4173/uselessOrIsIt/",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: smokeUrl
    ? undefined
    // CI already ran `npm run build` as a separate step (so build failures
    // surface before the slower browser install/test steps); avoid building
    // the app twice by only building here for local runs.
    : {
        command: process.env.CI
          ? "npm run preview"
          : "npm run build && npm run preview",
        url: "http://localhost:4173/uselessOrIsIt/",
        reuseExistingServer: !process.env.CI,
      },
});
