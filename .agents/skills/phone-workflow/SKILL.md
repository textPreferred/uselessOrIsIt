---
name: phone-workflow
description: Default operating mode for this repository — assume the user is working from a phone. Read at the start of every session and apply for the rest of it. Triggers whenever extending the app (feature, tweak, easter egg, visual change).
---

# Working from a phone

Assume the user is on a phone. Typing is expensive, screen space is
small, and PR review happens from the GitHub mobile app. Adjust
interaction accordingly.

Apply the workflow below silently — don't announce "I'm in phone mode,"
just behave accordingly.

## Workflow: discuss → build → preview → user ships

1. **Discuss first.** Before touching code, talk through the intended
   behavior in conversation.

2. **Restate, then offer the go-ahead.** Before the `AskUserQuestion`
   prompt, send a short standalone message restating the behavior as
   understood — even when the user's own ask was already detailed. A
   misunderstanding needs to surface before code exists, not after;
   folding the restatement into the same question as "Build it" doesn't
   count; it has to be readable and confirmable on its own. Then offer
   the one-tap decision via `AskUserQuestion`:
   - "Build it (recommended)" — start building
   - "Keep discussing" — refine the ask further

3. **Build, verifying only the fast stuff locally.** On "Build it":
   feature branch (create one if needed, never commit straight to
   `main`), follow the TDD convention from `docs/ENGINEERING.md`
   (red/green/refactor commits for behavior changes). Before each
   commit, run locally only: lint, format, typecheck, build, and — for
   the behavior just added — that one new test by itself (e.g.
   Playwright's `--grep`), not the full suite. Skip a full local `npm
   run check` / `npm test` pass entirely; the PR's CI pipeline is the
   source of truth for overall green, and it's free where local runs
   cost the user tokens. Push, then immediately open a PR (check for a
   PR template first) — automatically, no confirmation prompt, as soon
   as the first implementation is pushed.

4. **Auto-preview, then hand off.** Once the PR's checks (on GitHub, not
   a local rerun) are passing, don't wait to be asked — immediately run
   the `pr-live-demo` skill: wait for the PR's `preview` job, publish its
   artifact as a live Claude Artifact, and send the link. The user should
   be tapping the actual running change on their phone, not a
   screenshot, before deciding anything.

   Merging is the user's call and their action, not this workflow's.
   The user checks the pipelines and merges the PR themselves — don't
   merge, don't offer a merge option, and don't watch the post-merge
   **smoke** job. Send the preview link and stop there.

   If the user keeps iterating on the same PR/branch after the preview
   went out, each push still warrants re-running the publish step to
   refresh the link (same PR, same artifact, new run, not a new PR).

If CI fails at any point before merge, diagnose and re-push
automatically. Only send a message if genuinely blocked on a decision
only the user can make.
