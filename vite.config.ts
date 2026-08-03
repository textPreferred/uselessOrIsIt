import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// major.minor is bumped by hand in package.json — a minor per shipped
// feature, a major only for a big, possibly disruptive change in game
// experience. The patch is never bumped by hand: it's every commit on
// main, so it climbs on its own with each build.
function appVersion(): string {
  const { version } = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
  ) as { version: string };
  const [major, minor] = version.split(".");
  let patch = "0";
  try {
    patch = execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    // no git history available — leave patch at 0 rather than fail the build
  }
  return `v${major}.${minor}.${patch}`;
}

// Drops the Google Fonts <link> tags so the PR preview build never makes an
// external request — it needs to work standalone, offline, embedded anywhere.
function stripGoogleFonts(): Plugin {
  return {
    name: "strip-google-fonts",
    transformIndexHtml(html) {
      return html
        .replace(/\s*<link rel="preconnect"[^>]*>/g, "")
        .replace(
          /\s*<link\s+href="https:\/\/fonts\.googleapis\.com[^>]*\/>/gs,
          "",
        )
        .replace(
          /\s*<link\s+href="https:\/\/fonts\.googleapis\.com[\s\S]*?rel="stylesheet"\s*\/?>/g,
          "",
        );
    },
  };
}

const isPreviewBuild = !!process.env.PREVIEW_BUILD;

// Served from https://textpreferred.github.io/uselessOrIsIt/
export default defineConfig({
  base: "/uselessOrIsIt/",
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  // Preview builds (see .github/workflows/ci.yml) bundle into a single,
  // offline-capable index.html so they can be handed out and run anywhere
  // without a matching /assets/ directory alongside them.
  plugins: isPreviewBuild ? [stripGoogleFonts(), viteSingleFile()] : [],
});
