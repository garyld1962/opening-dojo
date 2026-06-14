#!/usr/bin/env bash
# Append a structured session-end entry to today's journal on SessionEnd.
# Two modes:
#   JOURNAL_LLM_URL set → local LLM composes an intelligent session summary
#   absent/failed      → mechanical commit log + status
#
# Always appends via append.sh (flock-safe). Never overwrites existing content.
#
# Env:
#   JOURNAL_LLM_URL   — OpenAI-compatible base URL (e.g., http://localhost:11434)
#   JOURNAL_LLM_MODEL — model name (default: qwen3:8b)
#   CLAUDE_PROJECT_DIR — set by Claude Code
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"
mkdir -p .claude/journal


project=$(basename "$CLAUDE_PROJECT_DIR")
branch=$(git branch --show-current 2>/dev/null || echo "no-branch")
timestamp=$(date -u +%Y-%m-%dT%H:%MZ)
today=$(date +%F)
today_file=".claude/journal/$today.md"

# Find commits since the session-start marker in today's journal
session_start_time=""
if [[ -f "$today_file" ]]; then
  # Extract the last "## Session start" timestamp
  session_start_time=$(grep -oP '## Session start \K[^ ]+' "$today_file" 2>/dev/null | tail -1 || true)
fi

if [[ -n "$session_start_time" ]]; then
  session_commits=$(git log --oneline --since="$session_start_time" 2>/dev/null || echo "")
else
  # Fallback: commits in the last 2 hours
  session_commits=$(git log --oneline --since="2 hours ago" 2>/dev/null || echo "")
fi

uncommitted=$(git diff --stat 2>/dev/null | tail -1 || echo "")

append_mechanical() {
  cat << EOF | bash "$CLAUDE_PROJECT_DIR/.claude/journal/append.sh"

## Session end $timestamp — $project [$branch]

**Commits this session:**
$(if [[ -n "$session_commits" ]]; then echo "$session_commits" | sed 's/^/- /'; else echo "- (none)"; fi)

**Uncommitted at close:**
- ${uncommitted:-clean}
EOF
}

append_llm() {
  local url="${JOURNAL_LLM_URL}/v1/chat/completions"
  local model="${JOURNAL_LLM_MODEL:-llama3.1:8b}"

  # Read today's existing journal for context
  local existing_journal=""
  [[ -f "$today_file" ]] && existing_journal=$(cat "$today_file")

  local prompt="You are appending a session-end entry to a developer's daily journal. CRITICAL: ONLY use facts from the context below. Never invent commit SHAs, decisions, file names, or events that are not in the context. If a section would be empty, omit it. No markdown fences around the output. Keep each section to 10 bullets max.

## Session end $timestamp — $project [$branch]

**What shipped:**
(commits, PRs merged, files created — list specifics)

**Decisions:**
(choices made, alternatives rejected — one-sentence reason each)

**Surprises:**
(bugs found, assumptions proven wrong — omit if none)

**Blockers:**
(unresolved issues, waiting on humans — omit if none)

**Next:**
(specific next action for tomorrow)

---
Context:
Branch: $branch

Commits this session:
${session_commits:-none}

Uncommitted at close:
${uncommitted:-clean}

Today's journal so far:
${existing_journal:-empty}"

  local payload
  payload=$(jq -n --arg model "$model" --arg prompt "$prompt" '{
    model: $model,
    messages: [{"role": "user", "content": $prompt}],
    max_tokens: 400,
    temperature: 0.3
  }')

  local response
  response=$(curl -s --max-time 10 "$url" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null) || return 1

  local content
  content=$(echo "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null) || return 1

  if [[ -z "$content" ]]; then
    return 1
  fi

  echo "$content" | bash "$CLAUDE_PROJECT_DIR/.claude/journal/append.sh"
}

# Always write mechanical first (instant, guaranteed on disk).
# Then attempt LLM upgrade if configured — appends a richer entry if it succeeds.
append_mechanical

if [[ -n "${JOURNAL_LLM_URL:-}" ]]; then
  append_llm || true  # failure is fine — mechanical is already on disk
fi
