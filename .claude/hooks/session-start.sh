#!/bin/bash
set -euo pipefail

SKILL_FILE="$CLAUDE_PROJECT_DIR/.agents/skills/phone-workflow/SKILL.md"

if [ ! -f "$SKILL_FILE" ]; then
  exit 0
fi

CONTEXT=$(cat "$SKILL_FILE")

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'
