# Engineering

## Stack

Vite + TypeScript (no framework), [Biome](https://biomejs.dev) for lint + format, [Playwright](https://playwright.dev) for e2e tests, [bun](https://bun.sh) as package manager and script runner, GitHub Actions for CI/CD to GitHub Pages.

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server with hot reload |
| `bun run check` | Everything CI runs: lint, typecheck, build, e2e tests |
| `bun run lint:fix` | Auto-fix formatting and lint issues |
| `bun run test` | Playwright e2e tests against a production build |
| `bun run ci:trends` | Fetch `main` CI run history and write a zoomable HTML trend report to `.ci-trends/` (see `scripts/ci-trends.mjs --help`) |

## Workflow

All work happens through PRs — designed to be driveable entirely from a phone:

1. Branch, commit, push.
2. The **check** job (lint, typecheck, build, e2e) must go green on the PR.
3. Merge to `main` → auto-deploy to GitHub Pages → a **smoke** job re-runs the `@smoke` tests against the live site, so a broken deployment turns the pipeline red.

Dependabot opens grouped hourly update PRs that auto-merge once the pipeline passes.

A `changes` job at the start of the pipeline diffs the PR/push against its
base and skips `check`, `test`, `preview`, and `deploy` entirely when every
changed file is `**/*.md`, `docs/**`, or `.agents/**` — docs-only changes
merge straight through without a build or test run.

### TDD convention

Development is strict red/green/refactor with one commit per state:

- `red: <behavior>` — a failing e2e test describing the behavior
- `green: <what made it pass>` — the minimal implementation
- `refactor: <cleanup>` — behavior unchanged, tests stay green

`red` commits are individually CI-red by design; only the PR head must be green.

## Architecture

- `src/machine.ts` — framework-free state core that emits events (`switched-on`, `switched-off` with who did it). Future features subscribe here without touching the core.
- `src/ui.ts` — renders the DOM and syncs it to machine state via `data-state` / `aria-checked`.
- `src/easter-eggs.ts` — the list of hidden easter eggs, and the toast that reveals one when it's unlocked.
- `src/main.ts` — wiring only.

The switch is a real `role="switch"` button, so tests assert on semantics (`aria-checked`), not CSS internals.
