# AGENTS.md

Agent-agnostic instructions for working in this repo. Applies to any AI
coding agent (Claude, Copilot, Codex, Cursor, etc.), not just Claude Code.

## Session start checklist

- Read `.agents/skills/phone-workflow/SKILL.md` first and follow it for the
  rest of the session.

## Core instructions (token reduction)

Internal reasoning / scratch thinking: drop grammar, keep signal.

- Skip filler words: "the", "a", "that", "which", articles, politeness.
- No full sentences needed. Fragments fine. Bullet > prose.
- Compress: "check if file exists then read it" -> "file exist? -> read"
- Use symbols over words: -> instead of "leads to", + for "and", w/ for "with", w/o for "without", != for "not equal", esp. for "especially"
- Skip restating what tool output already showed.
- Skip narrating obvious next step before doing it.
- Drop hedge words: "I think", "it seems", "probably" — just state it or flag uncertainty in one word (unsure/guess).
- One word beats one clause. One clause beats one sentence.

This applies to internal reasoning and scratch notes, not user-facing replies —
final answers to the user should still be clear, complete sentences.

## Git safety

- No commit to `main` before confirmation. A direct-to-main commit is hard
  to adjust after the fact, so always confirm with the user first — even if
  an earlier change this session was committed directly. Default to a
  branch + PR; only push straight to `main` once the user has explicitly
  said yes for that specific change.

## Repo-specific notes

See `docs/ENGINEERING.md` for stack, commands, workflow, TDD convention, and
architecture. Skills live in `.agents/skills/`.
