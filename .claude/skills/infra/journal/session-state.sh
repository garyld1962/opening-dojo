#!/usr/bin/env bash
# Generate .claude/SESSION.md on SessionEnd.
# Two modes:
#   JOURNAL_LLM_URL set → local LLM composes an intelligent resume context
#   absent/failed      → mechanical git-state dump
#
# Env:
#   JOURNAL_LLM_URL   — OpenAI-compatible base URL (e.g., http://localhost:11434)
#   JOURNAL_LLM_MODEL — model name (default: qwen3:8b)
#   CLAUDE_PROJECT_DIR — set by Claude Code
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"
mkdir -p .claude


project=$(basename "$CLAUDE_PROJECT_DIR")
branch=$(git branch --show-current 2>/dev/null || echo "no-branch")
timestamp=$(date -u +%Y-%m-%dT%H:%MZ)
recent_commits=$(git log --oneline -10 2>/dev/null || echo "no commits")
uncommitted=$(git status --short 2>/dev/null || echo "clean")
prev_session=$(cat .claude/SESSION.md 2>/dev/null || echo "(none)")

write_mechanical() {
  cat > .claude/SESSION.md << EOF
# Session — $project [$branch]
_last updated $timestamp (mechanical)_

## Last commits
$(echo "$recent_commits" | head -5 | sed 's/^/- /')

## Uncommitted changes
$(if [[ -n "$uncommitted" ]]; then echo "$uncommitted" | head -5 | sed 's/^/- /'; else echo "- (clean)"; fi)

## Next
- Review uncommitted changes or continue from last commit

## Pointers
- Add a manual journal note mid-session for richer resume context
EOF
}

write_llm() {
  local url="${JOURNAL_LLM_URL}/v1/chat/completions"
  local model="${JOURNAL_LLM_MODEL:-llama3.1:8b}"

  local prompt="You are writing a session resume file for a developer returning tomorrow. CRITICAL: ONLY use facts from the context below. Never invent PR numbers, branch names, URLs, or file paths that are not in the context. If you don't know something, omit it. Under 30 lines total. No markdown fences around the output — output the raw markdown directly. Use this structure:

# Session — $project [$branch]
_last updated ${timestamp}_

## In flight
(PRs, branches, unfinished edits — be specific)

## Next concrete action
(the ONE thing to do when resuming)

## Blockers
(anything waiting on humans or external systems — omit section if none)

## Pointers
(paths, PR links, docs worth reading first)

---
Context:
Branch: $branch
Recent commits:
$recent_commits

Uncommitted changes:
${uncommitted:-clean}

Previous SESSION.MD:
$prev_session"

  local payload
  payload=$(jq -n --arg model "$model" --arg prompt "$prompt" '{
    model: $model,
    messages: [{"role": "user", "content": $prompt}],
    max_tokens: 300,
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

  echo "$content" > .claude/SESSION.md
}

# Always write mechanical first (instant, guaranteed on disk).
# Then attempt LLM upgrade if configured — overwrites if it succeeds in time.
write_mechanical

if [[ -n "${JOURNAL_LLM_URL:-}" ]]; then
  write_llm || true  # failure is fine — mechanical is already on disk
fi
