---
name: pipeline-times
description: Show how CI on main has developed over time — run duration trend, pass/fail history, success rate. Use when the user asks about CI trends, pipeline times, build duration history, "how has CI been doing", or wants a graph/chart of workflow runs over time.
---

# Pipeline times

`scripts/ci-trends.mjs` fetches the `ci.yml` workflow run history for a
branch (default `main`) from the GitHub Actions API and turns it into a
self-contained, zoomable HTML report: run duration over time colored by
pass/fail, a stat header (total runs, success rate, avg duration,
failures), and a full table view. Zoom via drag-select, scroll wheel, or
the toolbar buttons; click/tap a point to jump straight to that run on
GitHub.

## Running it

```
bun run ci:trends
```

Or directly, with options — `bun scripts/ci-trends.mjs --help` lists them
all (`--owner`, `--repo`, `--workflow`, `--branch`, `--token`, `--limit`,
`--out`, `--json-out`). With no args it infers owner/repo from the git
`origin` remote, targets `ci.yml` on `main`, and writes
`.ci-trends/report.html` + `.ci-trends/data.json` (both gitignored —
generated data, not source).

It authenticates with `$GITHUB_TOKEN` or `$GH_TOKEN` if set (works
unauthenticated too, just rate-limited harder).

## Showing the result to the user

To surface the chart *in conversation* rather than just writing the file:

1. If a plain `fetch` to `api.github.com` isn't authorized in this
   sandbox (it wasn't when this skill was written — direct calls return
   "GitHub access is not enabled for this session"), pull the run
   history via the GitHub MCP tools instead
   (`actions_list` → `list_workflow_runs`, filtered to the target
   branch) and reshape each run's `id`, `run_number`, `conclusion`,
   `status`, `created_at`, `run_started_at`, `updated_at`, `head_sha`,
   `html_url` into the same shape `extractRun()` in the script produces.
   The MCP tool's responses are large (one page of ~30 runs already
   exceeds the tool's inline token budget) — read the saved
   tool-result file with a shell one-liner/`jq`/Python rather than
   pulling it into context, and paginate with `page`/`per_page` until
   you've covered the full run count.
2. Either way, `buildHtml(runs, meta)` is exported from
   `scripts/ci-trends.mjs` and is a pure function (no network) — import
   it and feed it the run array directly to get the same report the CLI
   writes, without needing live API access from this environment.
3. Load the `dataviz` skill before touching chart code, and
   `artifact-design` before publishing — the report already follows
   both (validated status-color palette for pass/fail, tabular-nums,
   legend, hover tooltips, table-view fallback, light/dark theming).
   Reuse its design rather than re-deriving one.
4. Publish the generated HTML with the `Artifact` tool.

## Verifying changes to the report

The chart is hand-rolled SVG + vanilla JS (no CDN deps, so it stays a
single offline-capable file) — drag-to-zoom, wheel-zoom, tooltips, and
the table view don't get exercised by `bun run lint`/`typecheck`. After
editing `scripts/ci-trends.mjs`, drive it with Playwright
(`/opt/pw-browsers/chromium`, already installed in this environment) and
screenshot the result before calling it done: render the file, drag a
zoom selection, hover a point, click "Reset zoom", expand the table, and
check the console has zero errors at each step.
