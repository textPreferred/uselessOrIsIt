import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// major.minor is bumped by hand in package.json — a minor per shipped
// feature, a major only for a big, possibly disruptive change in game
// experience. The patch is never bumped by hand: it's every commit on
// main, so it climbs on its own with each build.
export function appVersion() {
  const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const { version } = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const [major, minor] = version.split(".");
  let patch = "0";
  try {
    patch = execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    // no git history available — leave patch at 0 rather than fail the build
  }
  return `v${major}.${minor}.${patch} (${berlinBuildTimestamp()})`;
}

// MMDDHHmm in Europe/Berlin, so the build time is legible without a year
// blowing up the version string's length.
function berlinBuildTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("month")}${get("day")}${get("hour")}${get("minute")}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(appVersion());
}
