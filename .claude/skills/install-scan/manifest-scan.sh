#!/usr/bin/env bash
# manifest-scan.sh — Claude Code PostToolUse hook for Write/Edit on package manifests.
#
# Closes the AI-specific gap: when the LLM edits requirements.txt / package.json
# directly instead of running `pip install`, the shell wrapper sees nothing.
# This hook runs on every Write/Edit and scans new packages declared.
#
# Configure in .claude/settings.json:
#
#   {
#     "hooks": {
#       "PostToolUse": [
#         {
#           "matcher": "Write|Edit|MultiEdit",
#           "hooks": [
#             { "type": "command", "command": "bash $HOME/.local/share/install-scan/hooks/claude-code/manifest-scan.sh" }
#           ]
#         }
#       ]
#     }
#   }
#
# Reads $TOOL_INPUT (JSON) from stdin and emits scan results to stderr.

set -u

# Resolve scanner location relative to this hook
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER="$(cd "$HOOK_DIR/../../bin" 2>/dev/null && pwd)/install-scan.sh"
[[ -x "$SCANNER" ]] || exit 0

# Read the tool input JSON from stdin (Claude Code hook protocol)
TOOL_INPUT=$(cat 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

[[ -z "$FILE_PATH" ]] && exit 0
[[ ! -f "$FILE_PATH" ]] && exit 0

BASENAME=$(basename "$FILE_PATH")
NEW_PACKAGES=()
ECOSYSTEM=""

case "$BASENAME" in
  package.json)
    ECOSYSTEM="npm"
    # Extract dependencies + devDependencies
    while IFS= read -r line; do
      NEW_PACKAGES+=("$line")
    done < <(jq -r '
      (.dependencies // {}) + (.devDependencies // {}) | to_entries[] |
      "\(.key)@\(.value | sub("^[^0-9]+"; ""))"
    ' "$FILE_PATH" 2>/dev/null)
    ;;
  requirements.txt|requirements-*.txt|requirements/*.txt)
    ECOSYSTEM="PyPI"
    while IFS= read -r line; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      [[ "$line" =~ ^- ]] && continue
      NEW_PACKAGES+=("$line")
    done < "$FILE_PATH"
    ;;
  pyproject.toml)
    ECOSYSTEM="PyPI"
    # Best-effort: extract [tool.poetry.dependencies] and [project.dependencies]
    while IFS= read -r line; do
      NEW_PACKAGES+=("$line")
    done < <(python3 -c "
import sys
try:
    import tomllib
except ImportError:
    try: import tomli as tomllib
    except: sys.exit()
try:
    with open('$FILE_PATH','rb') as f: d = tomllib.load(f)
except: sys.exit()
deps = []
poetry_deps = d.get('tool',{}).get('poetry',{}).get('dependencies',{})
for k,v in poetry_deps.items():
    if k.lower() == 'python': continue
    ver = v if isinstance(v,str) else (v.get('version','') if isinstance(v,dict) else '')
    deps.append(f'{k}=={ver}'.rstrip('=='))
proj_deps = d.get('project',{}).get('dependencies',[])
for dep in proj_deps:
    deps.append(dep)
for d in deps: print(d)
" 2>/dev/null)
    ;;
  Gemfile)
    ECOSYSTEM="RubyGems"
    while IFS= read -r line; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*gem[[:space:]]+[\"\']([^\"\']+) ]] && NEW_PACKAGES+=("${BASH_REMATCH[1]}")
    done < "$FILE_PATH"
    ;;
  Cargo.toml)
    ECOSYSTEM="crates.io"
    while IFS= read -r line; do
      NEW_PACKAGES+=("$line")
    done < <(python3 -c "
try: import tomllib
except: import tomli as tomllib
import sys
try:
    with open('$FILE_PATH','rb') as f: d = tomllib.load(f)
    for k in (d.get('dependencies',{}) or {}): print(k)
    for k in (d.get('dev-dependencies',{}) or {}): print(k)
except: pass
" 2>/dev/null)
    ;;
  *.csproj)
    ECOSYSTEM="NuGet"
    while IFS= read -r line; do
      if [[ "$line" =~ PackageReference[[:space:]]+Include=\"([^\"]+)\".*Version=\"([^\"]+)\" ]]; then
        NEW_PACKAGES+=("${BASH_REMATCH[1]}@${BASH_REMATCH[2]}")
      fi
    done < "$FILE_PATH"
    ;;
  *) exit 0 ;;
esac

[[ ${#NEW_PACKAGES[@]} -eq 0 ]] && exit 0

# Diff against git HEAD (if available) to scan only NEW additions
if command -v git >/dev/null 2>&1 && git -C "$(dirname "$FILE_PATH")" rev-parse --git-dir >/dev/null 2>&1; then
  OLD_CONTENT=$(git -C "$(dirname "$FILE_PATH")" show "HEAD:./$BASENAME" 2>/dev/null || echo "")
  if [[ -n "$OLD_CONTENT" ]]; then
    NEW_PACKAGES_FILTERED=()
    for pkg in "${NEW_PACKAGES[@]}"; do
      pkg_name="${pkg%%[@=]*}"
      if ! grep -qF "$pkg_name" <<< "$OLD_CONTENT"; then
        NEW_PACKAGES_FILTERED+=("$pkg")
      fi
    done
    [[ ${#NEW_PACKAGES_FILTERED[@]} -eq 0 ]] && exit 0
    NEW_PACKAGES=("${NEW_PACKAGES_FILTERED[@]}")
  fi
fi

printf '\033[36m[install-scan/manifest]\033[0m AI edited %s — scanning %d new package(s)\n' "$BASENAME" "${#NEW_PACKAGES[@]}" >&2

# Pick a manager that matches the ecosystem so install-scan.sh picks the right parser
case "$ECOSYSTEM" in
  npm)        bash "$SCANNER" npm install "${NEW_PACKAGES[@]}" ;;
  PyPI)       bash "$SCANNER" pip install "${NEW_PACKAGES[@]}" ;;
  RubyGems)   bash "$SCANNER" gem install "${NEW_PACKAGES[@]}" ;;
  crates.io)  bash "$SCANNER" cargo install "${NEW_PACKAGES[@]}" ;;
  NuGet)
    for pkg in "${NEW_PACKAGES[@]}"; do
      name="${pkg%%@*}"; version="${pkg##*@}"
      bash "$SCANNER" dotnet add package "$name" --version "$version"
    done
    ;;
esac

exit 0
