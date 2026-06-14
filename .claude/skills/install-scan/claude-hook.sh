#!/usr/bin/env bash
# claude-hook.sh — Claude Code PostToolUse hook entry point.
#
# Bridges Claude Code's hook protocol (tool_input JSON on stdin) to the
# model-agnostic install-scan.sh (which takes shell args).
#
# Configure in .claude/settings.json:
#
#   {
#     "hooks": {
#       "PostToolUse": [
#         {
#           "matcher": "Bash",
#           "hooks": [
#             { "type": "command", "command": "bash $HOME/.claude/skills/install-scan/claude-hook.sh" }
#           ]
#         }
#       ]
#     }
#   }
#
# When Claude Code runs a Bash command, this script:
#   1. Reads the tool_input JSON from stdin
#   2. Extracts the shell command Claude tried to run
#   3. Detects if it matches a package install pattern
#   4. Calls install-scan.sh with the parsed manager + args
#
# Behavior: detect + report. Never blocks (always exits 0). Standards: §6.1, §8.1.

set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER="${HOOK_DIR}/install-scan.sh"
[[ -x "$SCANNER" ]] || exit 0

# Read tool_input JSON from stdin
TOOL_INPUT=$(cat 2>/dev/null || echo '{}')
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // .tool_input.cmd // empty' 2>/dev/null)

[[ -z "$COMMAND" ]] && exit 0

# Detect manager + extract args. We match common install/update verbs across
# the package managers install-scan supports. Each branch shells out to
# install-scan.sh with the parsed manager prefix.

dispatch() {
  local manager="$1"; shift
  bash "$SCANNER" "$manager" "$@" 2>&1 || true
}

# Normalize whitespace + tokenize command
read -ra TOKENS <<< "$COMMAND"
[[ ${#TOKENS[@]} -lt 2 ]] && exit 0

CMD="${TOKENS[0]}"
ACTION="${TOKENS[1]:-}"
REST=("${TOKENS[@]:1}")

case "$CMD" in
  pip|pip3)              dispatch "$CMD" "${REST[@]}" ;;
  python|python3)
    # python3 -m pip install ...
    if [[ "${TOKENS[1]:-}" == "-m" && "${TOKENS[2]:-}" == "pip" ]]; then
      dispatch "$CMD" "${REST[@]}"
    fi
    ;;
  uv|pipx|poetry|conda|mamba|micromamba)  dispatch "$CMD" "${REST[@]}" ;;
  npm|pnpm|yarn)                          dispatch "$CMD" "${REST[@]}" ;;
  brew)                                   dispatch "$CMD" "${REST[@]}" ;;
  dotnet)                                 dispatch "$CMD" "${REST[@]}" ;;
  cargo)                                  dispatch "$CMD" "${REST[@]}" ;;
  gem)                                    dispatch "$CMD" "${REST[@]}" ;;
  gh)                                     dispatch "$CMD" "${REST[@]}" ;;
  apt|apt-get|sudo)
    # sudo apt install …
    if [[ "$CMD" == "sudo" && ( "${TOKENS[1]:-}" == "apt" || "${TOKENS[1]:-}" == "apt-get" ) ]]; then
      dispatch "${TOKENS[1]}" "${TOKENS[@]:2}"
    elif [[ "$CMD" == "apt" || "$CMD" == "apt-get" ]]; then
      dispatch "$CMD" "${REST[@]}"
    fi
    ;;
  *) exit 0 ;;
esac

exit 0
