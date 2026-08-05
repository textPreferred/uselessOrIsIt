# AGENTS.md

Agent-agnostic instructions for working in this repo. Applies to any AI
coding agent (Claude, Copilot, Codex, Cursor, etc.), not just Claude Code.

## Session start checklist

- Read `.agents/skills/phone-workflow/SKILL.md` first and follow it for the
  rest of the session.

## Core instructions (token reduction): Caveman communication

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:

    Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
    Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
    Pattern: [thing] [action] [reason]. [next step].
    Not: "Sure! I'd be happy to help you with that."
    Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.

## Git safety

- No direct commit/push to `main` before confirmation. A direct-to-main
  commit is hard to adjust after the fact, so always confirm with the user
  first — even if an earlier change this session was committed directly.
  Default to a branch + PR; only push straight to `main` once the user has
  explicitly said yes for that specific change.
- Merging is the user's own action, not this agent's — see
  `.agents/skills/phone-workflow/SKILL.md` step 4. The agent opens and
  pushes to PRs but never merges them; the user checks pipelines and
  merges themselves.

## Repo-specific notes

See `docs/ENGINEERING.md` for stack, commands, workflow, TDD convention, and
architecture. Skills live in `.agents/skills/`.
