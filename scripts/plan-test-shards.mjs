import { readFile, writeFile } from "node:fs/promises";

// Reads the full current test list (from `playwright test --list
// --reporter=json`) plus historical per-test durations (from
// merge-playwright-timings.mjs) and greedily bin-packs tests into N shards
// of roughly equal total duration (longest-processing-time-first).
//
// Tests with no historical duration (new, or no cache available yet) fall
// back to the average of known durations, so a brand-new slow test doesn't
// get treated as free.
function collectCurrentSpecs(suite, out) {
  for (const spec of suite.specs ?? []) {
    out.push({ id: spec.id, file: spec.file, line: spec.line });
  }
  for (const child of suite.suites ?? []) {
    collectCurrentSpecs(child, out);
  }
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

async function main() {
  const [currentListPath, timingsPath, shardCountArg, outputFile] =
    process.argv.slice(2);
  const shardCount = Number(shardCountArg);
  if (!currentListPath || !shardCountArg || !outputFile) {
    console.error(
      "usage: plan-test-shards.mjs <list-report.json> <timings.json|-> <shard-count> <output-file>",
    );
    process.exit(1);
  }

  const listReport = await readJsonIfExists(currentListPath);
  const timings = (await readJsonIfExists(timingsPath)) ?? {};

  if (!listReport || Object.keys(timings).length === 0) {
    // No historical data (or nothing to list) to plan with — signal the
    // caller to fall back to plain count-based --shard.
    await writeFile(outputFile, "[]");
    console.log("No timing data available; wrote empty plan.");
    return;
  }

  const specs = [];
  for (const suite of listReport.suites ?? []) {
    collectCurrentSpecs(suite, specs);
  }

  const knownDurations = Object.values(timings).map((t) => t.durationMs);
  const averageDuration =
    knownDurations.reduce((sum, d) => sum + d, 0) / knownDurations.length;

  // spec.file is relative to Playwright's testDir (./e2e), but the CLI
  // needs a path relative to the repo root.
  const weighted = specs
    .map((spec) => ({
      ref: `e2e/${spec.file}:${spec.line}`,
      durationMs: timings[spec.id]?.durationMs ?? averageDuration,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const shards = Array.from({ length: shardCount }, () => ({
    tests: [],
    totalMs: 0,
  }));
  for (const test of weighted) {
    const lightest = shards.reduce((min, shard) =>
      shard.totalMs < min.totalMs ? shard : min,
    );
    lightest.tests.push(test.ref);
    lightest.totalMs += test.durationMs;
  }

  await writeFile(
    outputFile,
    JSON.stringify(
      shards.map((s) => s.tests),
      null,
      2,
    ),
  );
  console.log(
    `Planned ${specs.length} tests across ${shardCount} shards: ${shards.map((s) => `${Math.round(s.totalMs / 1000)}s`).join(", ")}`,
  );
}

main();
