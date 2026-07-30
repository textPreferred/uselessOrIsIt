---
name: phone-workflow
description: Default operating mode for this repository — assume the user is working from a phone. Read at the start of every session and apply for the rest of it. Also triggers mid-session on visual words (design, look, shape, style, color) or interaction words (prototype, demo, try it, play with, interactive).
---

# Working from a phone

Assume the user is on a phone. Typing is expensive, screen space is
small, and PR review happens from the GitHub mobile app. Adjust
interaction accordingly.

Apply the rules below silently — don't announce "I'm in phone mode,"
just behave accordingly. If a request matches more than one trigger,
satisfy all of the matching ones.

## 1. Ship-it default

Once a change looks done (tests green, matches the ask), don't wait for a
long typed confirmation. Offer a one-tap decision — e.g. via
`AskUserQuestion` — with the shipping path as the clearly labeled
recommended option:

- "Ship it (recommended)" — run the pipeline below
- "Keep iterating" — ask what's still rough
- "Show me first" — screenshot before deciding

Ask this once per checkpoint; don't nag on every message.

"Ship it" means, without further prompting:

1. Make sure the work is on a feature branch (create one if needed).
   Don't commit straight to `main` for this flow — the user reviews
   from a PR in the GitHub mobile app.
2. Follow the repo's TDD convention (`docs/ENGINEERING.md`): red/green/
   refactor commits for behavior changes. Don't retrofit history that's
   already there — just keep following it from here on.
3. Push the branch and open a PR (check for a PR template first).
4. Once CI is green, merge it. Merging to `main` auto-deploys to GitHub
   Pages — "ship it" is the standing authorization for the merge and the
   deploy it triggers, no separate confirmation needed.
5. Watch the post-merge **smoke** job (re-runs `@smoke` against the live
   site). Treat a red smoke job like a CI failure: diagnose and fix.
6. Reply with just the PR/merge link, one line.

If CI or the smoke job fails, diagnose and re-push automatically, same as
normal PR babysitting. Only send a message if genuinely blocked on a
decision only the user can make.

## 2. Preview before building — visual or interactive requests

Trigger on visual words ("design", "look(s)", "shape", "style", "color")
or interaction words ("prototype", "demo", "try it", "play with",
"interactive"). Either way: mock it quickly and skip the TDD convention
— this is a throwaway preview, not the shipped change.

- **Visual** → mock the change (in the app or otherwise), run it (see
  the `run` skill), and screenshot it. Send via `SendUserFile`
  (`display: 'render'`) so it shows inline in chat, not a side-panel
  link. Comparing options → multiple screenshots in one message, not
  one artifact with several frames.
- **Interactive** → build a self-contained HTML/JS prototype and publish
  it with the `Artifact` tool so the user can tap around on the phone
  screen. This is the one case in this skill where the artifact view is
  the right call, not the exception.

## 3. Preview confirmed → implement for real

Once the user confirms a preview or prototype (rule 2) matches what they
want, don't ship the preview itself:

1. Implement the change properly in the codebase, this time following
   the repo's TDD convention (rule 1, step 2) — the quick mock was
   exploration, not production code.
2. Before offering the "Ship it" one-tap option, show the real, running
   result once more (a fresh screenshot or prototype) — a quick preview
   isn't guaranteed to match the TDD'd version exactly, so confirm on
   the real thing before shipping.
3. Then proceed with rule 1 as normal.
