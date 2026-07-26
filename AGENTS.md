# AGENTS.md

Agent-agnostic instructions for working in this repo. Applies to any AI
coding agent (Claude, Copilot, Codex, Cursor, etc.), not just Claude Code.

## Session start checklist

- If today is on or before **2026-08-16**: read
  `.agents/skills/phone-workflow/SKILL.md` first and follow it for the rest
  of the session — Hannes is phone-only until then. After that date, skip
  this line (and feel free to delete it and the skill file).

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

## Repo-specific notes

See `docs/ENGINEERING.md` for stack, commands, workflow, TDD convention, and
architecture. Skills live in `.agents/skills/`.
