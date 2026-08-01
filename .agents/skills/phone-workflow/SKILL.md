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

## 2. Visual-only tweaks → quick screenshot

Trigger on visual words ("design", "look(s)", "shape", "style", "color")
for changes with nothing new to interact with — pure styling/layout.
Mock the change (in the app or otherwise), run it (see the `run` skill),
and screenshot it. Send via `SendUserFile` (`display: 'render'`) so it
shows inline in chat, not a side-panel link. Comparing options →
multiple screenshots in one message, not one artifact with several
frames. Skip the TDD convention for this — it's a throwaway preview.

## 3. Feature or easter egg planned → real PR, live demo

Once a feature or easter egg has been discussed and planned in
conversation — the shape is agreed, not just "add something fun" — skip
a throwaway mockup and build it for real:

1. Implement the change on a feature branch, following the repo's TDD
   convention (`docs/ENGINEERING.md`) — this is the real code, not a
   prototype to redo later.
2. Push and open a PR (rule 1, steps 1–3).
3. Once the PR's `preview` job finishes, follow the `pr-live-demo` skill
   to publish its artifact as a live, clickable Claude Artifact and send
   that link — the user taps the actual running change on their phone,
   not a screenshot.
4. That live demo is the confirmation checkpoint. Once the user's happy
   with it, move to rule 1's "Ship it" one-tap decision to merge.

If the demo doesn't land, keep pushing fixes to the same PR branch and
repeat step 3 to refresh the link — same PR, same artifact, new run, not
a new PR.

Interaction words mid-session ("prototype", "demo", "try it", "play
with", "interactive") without a concrete feature behind them yet — ask
what they want built rather than guessing; this rule needs a real plan
to implement, not just the word "demo."
