# Engineering

## Stack

Vite + TypeScript (no framework), [Biome](https://biomejs.dev) for lint + format, [Playwright](https://playwright.dev) for e2e tests, GitHub Actions for CI/CD to GitHub Pages.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Everything CI runs: lint, typecheck, build, e2e tests |
| `npm run lint:fix` | Auto-fix formatting and lint issues |
| `npm test` | Playwright e2e tests against a production build |

## Workflow

All work happens through PRs — designed to be driveable entirely from a phone:

1. Branch, commit, push.
2. The **check** job (lint, typecheck, build, e2e) must go green on the PR.
3. Merge to `main` → auto-deploy to GitHub Pages → a **smoke** job re-runs the `@smoke` tests against the live site, so a broken deployment turns the pipeline red.

Dependabot opens grouped hourly update PRs that auto-merge once the pipeline passes.

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
