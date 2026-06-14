#!/usr/bin/env bash
# On-demand companion to install-scan.sh.
#
# Single packages → OSV.dev API
# Source dirs    → osv-scanner (cached DB; scans manifests/lockfiles recursively)
# Container imgs → grype (broader DB: NVD + GHSA + ecosystem)
#
# Usage:
#   .claude/install-scan/scan-now.sh pkg <ecosystem> <name>[@version]
#   .claude/install-scan/scan-now.sh dir <path>
#   .claude/install-scan/scan-now.sh image <imagename:tag>

set -e

if [ $# -lt 2 ]; then
  cat <<EOF
Usage:
  $0 pkg <ecosystem> <name>[@version]
  $0 dir <path>
  $0 image <imagename:tag>

Ecosystems: PyPI, npm, Maven, Go, NuGet, RubyGems, crates.io, Debian, Homebrew

Examples:
  $0 pkg PyPI requests@2.31.0
  $0 pkg npm lodash
  $0 dir ./
  $0 image acrname.azurecr.io/myapp:v1
EOF
  exit 1
fi

MODE="$1"; shift

case "$MODE" in
  pkg)
    ECOSYSTEM="$1"
    PKG="$2"
    [ -z "$PKG" ] && { echo "Usage: $0 pkg <ecosystem> <name>[@version]"; exit 1; }

    name=$(echo "$PKG" | sed -E 's/[<>=~!@].*//')
    ver=$(echo "$PKG" | sed -nE 's/.*[<>=~!@]+([0-9][0-9a-zA-Z.\-]*).*/\1/p')

    echo "──── 🔒 OSV.dev — $ECOSYSTEM:$PKG ────"
    if [ -n "$ver" ]; then
      QUERY="{\"package\":{\"name\":\"$name\",\"ecosystem\":\"$ECOSYSTEM\"},\"version\":\"$ver\"}"
    else
      QUERY="{\"package\":{\"name\":\"$name\",\"ecosystem\":\"$ECOSYSTEM\"}}"
    fi

    RESP=$(curl -s -m 10 -X POST "https://api.osv.dev/v1/query" \
      -H "Content-Type: application/json" -d "$QUERY")

    COUNT=$(echo "$RESP" | jq '(.vulns // []) | length')
    if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
      echo "✓ No known vulnerabilities."
    else
      echo "Found $COUNT vulnerability/ies:"
      echo ""
      echo "$RESP" | jq -r '
        (.vulns // [])[] |
        "  • \(.id) \((.database_specific.severity // "" | if . == "" then "" else "[\(.)] " end))\(.summary // .details // "" | .[0:100])"
      '
      echo ""
      echo "(Full advisory pages: https://osv.dev/list — search by ID)"
    fi
    ;;

  dir)
    TARGET="$1"
    [ -z "$TARGET" ] && { echo "Usage: $0 dir <path>"; exit 1; }
    if ! command -v osv-scanner >/dev/null 2>&1; then
      echo "osv-scanner not installed. brew install osv-scanner (macOS) or download from https://github.com/google/osv-scanner"
      exit 1
    fi
    echo "──── 🔒 osv-scanner — directory: $TARGET ────"
    osv-scanner scan source --recursive "$TARGET"
    ;;

  image)
    TARGET="$1"
    [ -z "$TARGET" ] && { echo "Usage: $0 image <imagename:tag>"; exit 1; }
    if ! command -v grype >/dev/null 2>&1; then
      echo "grype not installed. brew install grype (macOS) or download from https://github.com/anchore/grype"
      exit 1
    fi
    echo "──── 🔒 grype — container image: $TARGET ────"
    grype "$TARGET"
    ;;

  *)
    echo "Unknown mode: $MODE"
    echo "Use one of: pkg, dir, image"
    exit 1
    ;;
esac
