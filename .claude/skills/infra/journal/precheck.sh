#!/usr/bin/env bash
# Precheck: should we bother running journal capture on SessionEnd?
#
# Exit 0 (meaningful) when:
#   - there are uncommitted tracked changes, OR
#   - today's journal contains any line beyond '## Session start' markers
#     (commit bullets, prior structured session blocks, manual entries).
# Exit 2 (skip) otherwise. Exit code 2 is what Claude Code's hook chain
# treats as "block subsequent hooks in this block" — any other non-zero
# exit is a non-blocking error and later hooks still run.
# See https://code.claude.com/docs/en/hooks.md (Exit Code Semantics).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

journal_dir=".claude/journal"
today_file="$journal_dir/$(date +%F).md"

# Any uncommitted changes (tracked or new untracked non-ignored)?
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  exit 0
fi

# Any content in today's journal beyond session-start markers and blanks?
      # Matches commit bullets (from PostToolUse), prior session-journal
# entries, or any manual addition.
if [[ -f "$today_file" ]]; then
  if grep -qvE '^(## Session start|[[:space:]]*$)' "$today_file" 2>/dev/null; then
    exit 0
  fi
fi

# Nothing tracked-changed, nothing logged beyond start traces — skip.
exit 2
