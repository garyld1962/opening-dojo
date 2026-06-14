#!/usr/bin/env bash
# PR Guardrail Hook — PreToolUse on Bash matching gh pr create
#
# Checks for existing open PRs before allowing gh pr create.
# Returns blocking JSON if open PRs are found.
#
# Install: add to ~/.claude/settings.json under hooks.PreToolUse
# See pr-guardrail/INSTALL.md for setup instructions.

set -uo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract the bash command from the tool input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept gh pr create commands
if ! echo "$COMMAND" | grep -q "gh pr create"; then
  exit 0
fi

# Get current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# Check if current branch already has a PR
CURRENT_PR=$(gh pr view --json number,url,title 2>/dev/null || echo "")

# List all open PRs by the current user
OPEN_PRS=$(gh pr list --author @me --state open --json number,title,headRefName,url 2>/dev/null || echo "[]")
PR_COUNT=$(echo "$OPEN_PRS" | jq 'length // 0')

# If no open PRs, allow the command
if [ "$PR_COUNT" -eq 0 ] && [ -z "$CURRENT_PR" ]; then
  exit 0
fi

# Build warning message
MSG="⚠️  Open PRs detected before creating a new one:\n\n"

# List each open PR
if [ "$PR_COUNT" -gt 0 ]; then
  while IFS= read -r pr; do
    NUM=$(echo "$pr" | jq -r '.number')
    TITLE=$(echo "$pr" | jq -r '.title')
    REF=$(echo "$pr" | jq -r '.headRefName')
    MSG="${MSG}  #${NUM} ${REF} — \"${TITLE}\"\n"
  done < <(echo "$OPEN_PRS" | jq -c '.[]')
fi

MSG="${MSG}\nCurrent branch: ${BRANCH}\n"

# Check if current branch already has a PR
if [ -n "$CURRENT_PR" ]; then
  CURRENT_NUM=$(echo "$CURRENT_PR" | jq -r '.number')
  CURRENT_TITLE=$(echo "$CURRENT_PR" | jq -r '.title')
  MSG="${MSG}⚠️  Current branch ALREADY has PR #${CURRENT_NUM}: \"${CURRENT_TITLE}\"\n"
fi

MSG="${MSG}\nAsk the user how to proceed before creating a new PR:\n"
MSG="${MSG}  [1] Push to existing PR's branch instead\n"
MSG="${MSG}  [2] Stack a new branch on top of current\n"
MSG="${MSG}  [3] Close/abandon the existing PR first\n"
MSG="${MSG}  [4] Create new PR anyway (confirm override)\n"

# Output blocking JSON
printf '{"decision":"block","reason":"%s"}' "$(echo -e "$MSG" | sed 's/"/\\"/g' | tr '\n' ' ')"
