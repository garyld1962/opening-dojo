#!/usr/bin/env bash
# Safe append to today's journal file with flock (or mkdir fallback).
# Reads content from stdin and appends to $CLAUDE_PROJECT_DIR/.claude/journal/YYYY-MM-DD.md.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"
mkdir -p .claude/journal
target=".claude/journal/$(date +%F).md"

if command -v flock >/dev/null 2>&1; then
  {
    flock -x 9
    cat >> "$target"
  } 9>> "$target"
else
  # mkdir-based portable fallback (for macOS without util-linux flock)
  lock=".claude/journal/.lock.$(date +%F)"
  trap 'rmdir "$lock" 2>/dev/null || true' EXIT
  while ! mkdir "$lock" 2>/dev/null; do sleep 0.05; done
  cat >> "$target"
fi
