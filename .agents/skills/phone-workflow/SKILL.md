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

## Workflow: discuss → build → preview or ship

1. **Discuss first.** Before touching code, talk through the intended
   behavior in conversation.

2. **One-click go-ahead.** Once the behavior's agreed, offer a one-tap
   decision via `AskUserQuestion`:
   - "Build it (recommended)" — start building
   - "Keep discussing" — refine the ask further

3. **Build.** On "Build it": feature branch (create one if needed, never
   commit straight to `main`), follow the TDD convention from
   `docs/ENGINEERING.md` (red/green/refactor commits for behavior
   changes), push, open a PR (check for a PR template first).

4. **One-click result.** Once the PR's up and checks are passing, offer
   a one-tap decision:
   - "Live preview" — via the `pr-live-demo` skill: wait for the PR's
     `preview` job, publish its artifact as a live Claude Artifact, and
     send the link. The user taps the actual running change on their
     phone, not a screenshot.
   - "Ship it" — merge to `main` (once CI is green). Merging auto-
     deploys to GitHub Pages — this is the standing authorization for
     the merge and the deploy it triggers, no separate confirmation
     needed. Watch the post-merge **smoke** job (re-runs `@smoke`
     against the live site); treat a red smoke job like a CI failure:
     diagnose and fix. Reply with just the PR/merge link, one line.

   These aren't mutually exclusive — the user can preview, keep
   iterating, preview again, and ship whenever ready. If a preview
   doesn't land, keep pushing fixes to the same PR/branch and repeat the
   publish step to refresh the link — same PR, same artifact, new run,
   not a new PR.

If CI or the smoke job fails at any point, diagnose and re-push
automatically. Only send a message if genuinely blocked on a decision
only the user can make.
