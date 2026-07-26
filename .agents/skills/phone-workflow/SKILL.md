---
name: phone-workflow
description: Temporary (through 2026-08-16) operating mode for when Hannes is working from a phone only. Read at the start of every session in this window and apply for the rest of it. Adjusts three things — one-tap ship-it defaults, inline screenshots for visual/design requests instead of artifacts, and Artifact-view HTML/JS prototypes for interaction/demo requests. Also triggers mid-session on requests mentioning design, look, shape, style, color (visual) or prototype, demo, try it, interactive (interaction).
---

# Working from a phone (temporary, through 2026-08-16)

Hannes is phone-only for about three weeks. Typing is expensive, screen
space is small, and PR review happens from the GitHub mobile app. Adjust
interaction accordingly. **Expiry: 2026-08-16** — after that date this
skill no longer applies; skip it, and feel free to delete this file and
its reference in `AGENTS.md`.

Apply the three rules below silently — don't announce "I'm in phone
mode," just behave accordingly. If a request matches more than one
trigger, satisfy all of the matching ones.

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
   Don't commit straight to `main` for this flow — the phone owner
   reviews from a PR in the GitHub mobile app.
2. Follow the repo's TDD convention (`docs/ENGINEERING.md`): red/green/
   refactor commits for behavior changes. Don't retrofit history that's
   already there — just keep following it from here on.
3. Push the branch and open a PR (check for a PR template first).
4. Once CI is green, merge it — "ship it" is the standing authorization
   for the merge, no separate confirmation needed.
5. Reply with just the PR/merge link, one line.

If CI fails, diagnose and re-push automatically, same as normal PR
babysitting. Only send a message if genuinely blocked on a decision only
Hannes can make.

## 2. Visual/design requests → inline pictures, not artifacts

Trigger words: "design", "look(s)", "shape", "style", "color", or
similar visual asks.

Don't build an HTML mockup in the Artifact view for these — on a phone
that's an extra tap into a side panel, away from the chat. Instead:

- Implement (or mock) the change for real in the app.
- Run it (see the `run` skill) and take a screenshot.
- Send the screenshot(s) with `SendUserFile` (`display: 'render'`) so
  they show inline in the chat, not as a side-panel link.
- Comparing options → send multiple screenshots in one message rather
  than one artifact with several frames.

## 3. Interaction/prototype requests → Artifact view

Trigger words: "prototype", "demo", "try it", "play with",
"interactive".

These need actual interaction, which a screenshot can't give — use the
`Artifact` tool to publish a self-contained HTML/JS prototype so Hannes
can tap around on the phone screen. This is the one case in this skill
where the artifact view is the right call, not the exception.
