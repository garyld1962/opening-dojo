#!/usr/bin/env bash
# SBOM (Software Bill of Materials) generator — companion to install-scan/scan-now.
#
# Wraps `syft` to generate CycloneDX or SPDX SBOMs from source dirs or container
# images. SBOMs are a standardized, machine-readable inventory of every
# component / version / license / dependency. Required by US EO 14028 for
# federal contractors; coming under the EU Cyber Resilience Act.
#
# Why generate SBOMs at install time?
#   - Re-scan stored SBOMs against future CVEs without rebuilding
#   - Diff across builds to catch unexpected dep additions
#   - Feed downstream tools: Dependency-Track, Snyk, Grype, etc.
#
# Usage:
#   .claude/install-scan/sbom-now.sh dir <path> [output.json]
#   .claude/install-scan/sbom-now.sh image <imagename:tag> [output.json]
#
# Format defaults to CycloneDX JSON. Override with SBOM_FORMAT env:
#   SBOM_FORMAT=spdx-json ./sbom-now.sh dir ./
#   SBOM_FORMAT=cyclonedx-xml ./sbom-now.sh image alpine:latest

set -e

if ! command -v syft >/dev/null 2>&1; then
  echo "syft not installed."
  echo "  macOS:  brew install syft"
  echo "  Linux:  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh"
  echo "  Docker: docker run --rm anchore/syft <target>"
  exit 1
fi

if [ $# -lt 2 ]; then
  cat <<EOF
Usage:
  $0 dir <path> [output.json]
  $0 image <imagename:tag> [output.json]

Output defaults to ./sbom-<name>.cdx.json (or whatever path you supply).
Format: SBOM_FORMAT env var (default: cyclonedx-json)
  Options: cyclonedx-json, cyclonedx-xml, spdx-json, spdx-tag-value, syft-json

Examples:
  $0 dir ./
  $0 dir /Users/silencer/BetterOff/topology-assessor topo-sbom.cdx.json
  $0 image alpine:latest
  SBOM_FORMAT=spdx-json $0 image myregistry.azurecr.io/myapp:v1
EOF
  exit 1
fi

MODE="$1"
TARGET="$2"
OUTPUT="$3"
FORMAT="${SBOM_FORMAT:-cyclonedx-json}"

# Default output filename if not provided
if [ -z "$OUTPUT" ]; then
  base=$(basename "$TARGET" | tr ':/' '-')
  ext="cdx.json"
  case "$FORMAT" in
    spdx-json)        ext="spdx.json" ;;
    spdx-tag-value)   ext="spdx" ;;
    cyclonedx-xml)    ext="cdx.xml" ;;
    syft-json)        ext="syft.json" ;;
  esac
  OUTPUT="./sbom-${base}.${ext}"
fi

case "$MODE" in
  dir)
    echo "──── 📦 syft — directory: $TARGET ────"
    syft "$TARGET" -o "$FORMAT=$OUTPUT" 2>&1
    ;;
  image)
    echo "──── 📦 syft — container image: $TARGET ────"
    syft "$TARGET" -o "$FORMAT=$OUTPUT" 2>&1
    ;;
  *)
    echo "Unknown mode: $MODE (use 'dir' or 'image')"
    exit 1
    ;;
esac

if [ -f "$OUTPUT" ]; then
  COUNT=$(jq '(.components // [.] // []) | length' "$OUTPUT" 2>/dev/null || echo "?")
  SIZE=$(wc -c < "$OUTPUT" | tr -d ' ')
  echo ""
  echo "✓ SBOM written to: $OUTPUT"
  echo "  Format: $FORMAT"
  echo "  Components: $COUNT"
  echo "  Size: $SIZE bytes"
  echo ""
  echo "Re-scan anytime against current vuln DBs:"
  echo "  grype sbom:$OUTPUT"
  echo "  osv-scanner scan source --sbom=$OUTPUT"
fi
