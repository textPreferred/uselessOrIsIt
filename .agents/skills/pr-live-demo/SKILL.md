---
name: pr-live-demo
description: Turn a PR's preview build (from the `preview` job in .github/workflows/ci.yml) into a live, clickable demo published as a Claude Artifact. Use when the user asks to "try out", "demo", or "run" a PR's changes, or asks for a live/interactive preview instead of a screenshot.
---

# PR live demo

`.github/workflows/ci.yml`'s `preview` job builds each PR into a single
self-contained `index.html` (Google Fonts stripped, JS/CSS inlined via
`vite-plugin-singlefile`, gated behind `PREVIEW_BUILD=1` in
`vite.config.ts` so the real GitHub Pages build is untouched) and
uploads it as a `pr-preview-<PR number>` zip artifact. Turning that into
something the user can click and interact with, rather than just a
screenshot, takes four steps:

1. **Locate the artifact.** `actions_list` (`list_workflow_run_artifacts`)
   on the PR's latest `ci.yml` run to get the artifact ID.
2. **Download it.** `actions_get` (`download_workflow_run_artifact`)
   returns a short-lived signed URL on
   `productionresultssa0.blob.core.windows.net` (GitHub's artifact
   storage, not `github.com`). `curl` it directly. This host needed an
   explicit network-policy allowlist entry in this environment before it
   worked — if it 403s, that's the proxy blocking the destination (see
   `/root/.ccr/README.md`), not an auth problem; tell the user rather
   than trying to route around it.
3. **Unzip and strip the document scaffold.** One file falls out,
   already offline-capable — no separate `/assets/*.js` or `*.css` to
   splice together. It still has a full `<!doctype html><html><head>...
   <body>...</html>` wrapper, which the Artifact tool doesn't want (it
   wraps its own skeleton and rejects `<html>`/`<head>`/`<body>` tags in
   the file). Pull the `<title>`, the inlined `<style>`, and the body
   content out into a bare content file.
4. **Publish.** Optionally prepend a small fixed-position badge noting
   which PR/build this is, then hand the file to the `Artifact` tool.
   Load the `artifact-design` skill first per its own requirement, but
   keep the app's existing design untouched — the badge is the only new
   design surface.

## Why not just fetch the npm package / raw registry route

This repo's `preview` job used to publish to GitHub's npm registry
(`npm.pkg.github.com`) instead of a zip artifact. Don't reach for that
path from a Claude Code sandbox: this environment's `GITHUB_TOKEN` is a
placeholder that only gets swapped for real credentials when talking to
`api.github.com` — `npm.pkg.github.com` isn't covered by that swap, so
`npm publish`/`npm pack` against it 401s from here even though it works
fine from inside the actual GitHub Actions runner (which gets a real,
correctly-scoped token). The zip artifact has no such gap: it downloads
with a plain signed URL, no registry auth needed.

## If the network policy blocks the artifact host

Before this was allowlisted, the only fallback was rebuilding the exact
commit locally (same repo, same source) and running `npm pack` — this
produces a byte-for-byte equivalent of what CI built, just without
proving the actual CI artifact downloads. Prefer the real download when
the host is reachable; fall back to a local rebuild only if it isn't,
and say so explicitly rather than presenting a rebuild as "the CI
artifact."
