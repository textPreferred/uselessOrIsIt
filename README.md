# Useless Machine

A web replica of the classic [useless machine](https://en.wikipedia.org/wiki/Useless_machine): flip the switch on, and an arm comes out of the box to flip it back off. That's it. That's the app.

Live at **https://textpreferred.github.io/uselessOrIsIt/** (deployed automatically from `main`).

## Stack

Vite + TypeScript (no framework), [Biome](https://biomejs.dev) for lint + format, [Playwright](https://playwright.dev) for e2e tests, GitHub Actions for CI/CD to GitHub Pages.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Everything CI runs: lint, typecheck, build, e2e tests |
| `npm run lint:fix` | Auto-fix formatting and lint issues |
| `npm test` | Playwright e2e tests against a production build |

See [docs/ENGINEERING.md](docs/ENGINEERING.md) for the PR workflow, TDD convention, and architecture notes.
