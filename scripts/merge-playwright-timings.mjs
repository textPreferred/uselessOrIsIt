import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Flattens a (possibly sharded) set of Playwright JSON reports into a single
// { [specId]: { title, file, line, durationMs } } map, keyed by each spec's
// stable id so results from different shards/runs merge cleanly.
function collectSpecs(suite, out) {
  for (const spec of suite.specs ?? []) {
    const result = spec.tests?.[0]?.results?.at(-1);
    if (!result) continue;
    out[spec.id] = {
      title: spec.title,
      file: spec.file,
      line: spec.line,
      durationMs: result.duration,
    };
  }
  for (const child of suite.suites ?? []) {
    collectSpecs(child, out);
  }
}

async function main() {
  const [inputDir, outputFile] = process.argv.slice(2);
  if (!inputDir || !outputFile) {
    console.error(
      "usage: merge-playwright-timings.mjs <reports-dir> <output-file>",
    );
    process.exit(1);
  }

  const entries = await readdir(inputDir, { recursive: true });
  const reportFiles = entries.filter((entry) => entry.endsWith(".json"));

  const timings = {};
  for (const file of reportFiles) {
    const report = JSON.parse(
      await readFile(path.join(inputDir, file), "utf-8"),
    );
    for (const suite of report.suites ?? []) {
      collectSpecs(suite, timings);
    }
  }

  await writeFile(outputFile, JSON.stringify(timings, null, 2));
  console.log(
    `Wrote ${Object.keys(timings).length} test timings to ${outputFile}`,
  );
}

main();
