#!/usr/bin/env bash
# pattern-scan.sh — companion to install-scan / scan-now / sbom-now.
#
# Scans source files for LLM-flavored security smells using Semgrep + a
# curated ruleset (llm-patterns.semgrep.yml).
#
# Usage:
#   .claude/install-scan/pattern-scan.sh dir <path>
#   .claude/install-scan/pattern-scan.sh file <path>
#   .claude/install-scan/pattern-scan.sh staged          # scan files staged for git commit
#   .claude/install-scan/pattern-scan.sh --extras        # ALSO run upstream packs
#                                                          (p/security-audit, p/owasp-top-ten)
#
# Why this exists:
# Generic SAST tools (CodeQL, Bandit, ESLint) catch the underlying security
# issue, but several patterns are disproportionately common in LLM-generated
# code because LLMs were trained on tutorial / Stack Overflow code from
# 2018-2020. This ruleset focuses on those LLM-flavored smells.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULESET="$SCRIPT_DIR/llm-patterns.semgrep.yml"
EXTRAS=""

# Flag parsing
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --extras) EXTRAS="--config p/security-audit --config p/owasp-top-ten" ; shift ;;
    *)        ARGS+=("$1") ; shift ;;
  esac
done
set -- "${ARGS[@]}"

if [ $# -lt 1 ]; then
  cat <<EOF
Usage:
  $0 dir <path>
  $0 file <path>
  $0 staged
  $0 [--extras] dir|file|staged ...

--extras adds upstream rule packs (p/security-audit, p/owasp-top-ten).
Without it, only the curated LLM-pattern rules run. Faster, fewer false positives.

Examples:
  $0 dir ./src
  $0 file ./api/handler.ts
  $0 staged
  $0 --extras dir ./
EOF
  exit 1
fi

if ! command -v semgrep >/dev/null 2>&1; then
  cat <<EOF
semgrep not installed. Install:
  macOS:    brew install semgrep
  Linux:    pip3 install semgrep
  Or use Docker: docker run --rm -v "\$PWD:/src" returntocorp/semgrep
EOF
  exit 1
fi

if [ ! -f "$RULESET" ]; then
  echo "ruleset not found: $RULESET"
  echo "Expected llm-patterns.semgrep.yml alongside this script."
  exit 1
fi

MODE="$1"; shift
TARGET="${1:-./}"

case "$MODE" in
  dir|file)
    [ ! -e "$TARGET" ] && { echo "not found: $TARGET"; exit 1; }
    echo "──── 🔍 pattern-scan: LLM-flavored code smells ────"
    echo "Target: $TARGET"
    echo "Rules: llm-patterns.semgrep.yml${EXTRAS:+ + extras}"
    echo ""
    semgrep scan \
      --config "$RULESET" $EXTRAS \
      --no-git-ignore=false \
      --quiet \
      --metrics=off \
      "$TARGET"
    ;;

  staged)
    if ! git diff --cached --name-only --diff-filter=ACM >/dev/null 2>&1; then
      echo "Not in a git repo, or no staged files."
      exit 1
    fi
    FILES=$(git diff --cached --name-only --diff-filter=ACM)
    [ -z "$FILES" ] && { echo "No staged files."; exit 0; }
    echo "──── 🔍 pattern-scan: staged files ────"
    echo "$FILES" | sed 's/^/  /'
    echo ""
    echo "$FILES" | xargs semgrep scan \
      --config "$RULESET" $EXTRAS \
      --no-git-ignore=false \
      --quiet \
      --metrics=off
    ;;

  *)
    echo "Unknown mode: $MODE (use dir, file, or staged)"
    exit 1
    ;;
esac
