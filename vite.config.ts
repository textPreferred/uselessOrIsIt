import { execSync } from "node:child_process";
import { defineConfig } from "vite";

function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// Served from https://textpreferred.github.io/uselessOrIsIt/
export default defineConfig({
  base: "/uselessOrIsIt/",
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
});
