#!/usr/bin/env bash
# install-scan.sh — pre-install package vulnerability scanner.
#
# Invoked by wrapper-shell.sh wrapper functions on every package install.
# Queries OSV.dev for known vulnerabilities and cross-references CISA KEV.
# Advisory by default (never blocks). Set INSTALL_SCAN_MODE=enforcing to block.
#
# Standards: JMA AI Security Tech Std §6.1 (IDE/Developer AI Security) · §8.1 (active-exploit signal)

set -u

VERSION="1.0.0"

MANAGER="${1:-}"
shift || true
ARGS="$*"

# --- Bypass mechanisms -----------------------------------------------------
# INSTALL_SCAN_DISABLE=1   → wrapper skips everything (set in shell or .env)
# INSTALL_SCAN_BYPASS=1    → one-shot bypass for a single command
# INSTALL_SCAN_MODE        → advisory (default) | enforcing
if [[ "${INSTALL_SCAN_DISABLE:-}" == "1" || "${INSTALL_SCAN_BYPASS:-}" == "1" ]]; then
  exit 0
fi

MODE="${INSTALL_SCAN_MODE:-advisory}"

# --- Cache + log paths -----------------------------------------------------
CACHE_DIR="${INSTALL_SCAN_CACHE_DIR:-${HOME}/.cache/install-scan}"
LOG_DIR="${INSTALL_SCAN_LOG_DIR:-${HOME}/.cache/install-scan/logs}"
KEV_CACHE="${CACHE_DIR}/cisa-kev.json"
OSV_CACHE_DIR="${CACHE_DIR}/osv"
KEV_TTL_SECONDS=21600   # 6 hours
OSV_TTL_SECONDS=86400   # 24 hours
mkdir -p "$CACHE_DIR" "$LOG_DIR" "$OSV_CACHE_DIR" 2>/dev/null

# --- Source slopsquat heuristic --------------------------------------------
_SLOPSQUAT_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)/lib/slopsquat.sh"
[[ -f "$_SLOPSQUAT_LIB" ]] && source "$_SLOPSQUAT_LIB"

# --- Logging helpers -------------------------------------------------------
_log_info()  { printf '\033[36m[install-scan]\033[0m %s\n' "$*" >&2; }
_log_warn()  { printf '\033[33m[install-scan]\033[0m %s\n' "$*" >&2; }
_log_alert() { printf '\033[31m[install-scan]\033[0m %s\n' "$*" >&2; }
_log_ok()    { printf '\033[32m[install-scan]\033[0m %s\n' "$*" >&2; }
_log_dim()   { printf '\033[2m[install-scan] %s\033[0m\n' "$*" >&2; }

_have() { command -v "$1" >/dev/null 2>&1; }

# --- First-run intro -------------------------------------------------------
FIRST_RUN_MARKER="${CACHE_DIR}/.first-run-shown"
if [[ ! -f "$FIRST_RUN_MARKER" ]]; then
  _log_info "👋 install-scan v${VERSION} — pre-install vulnerability scanner."
  _log_info "    Scans every package install against OSV.dev + CISA KEV before it runs."
  _log_info "    Advisory by default (won't block). Set INSTALL_SCAN_MODE=enforcing to block on KEV hits."
  _log_info "    To skip a single command: INSTALL_SCAN_BYPASS=1 <command>"
  _log_info "    To disable in this shell: export INSTALL_SCAN_DISABLE=1"
  _log_info "    Audit log: ${LOG_DIR}/audit-\$(date +%%Y-%%m-%%d).jsonl"
  touch "$FIRST_RUN_MARKER" 2>/dev/null
fi

# --- Audit logger ----------------------------------------------------------
# Append a JSONL line for every package scanned. Used for local forensics and
# (optionally) shipped to Sentinel/Defender via Filebeat/Fluent Bit.
_audit() {
  local ecosystem="$1" name="$2" version="$3" verdict="$4" vulns="$5" kev_hits="$6"
  local log_file="${LOG_DIR}/audit-$(date +%Y-%m-%d).jsonl"
  local ts user host
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  user="${USER:-unknown}"
  host=$(hostname 2>/dev/null || echo unknown)
  # Detect parent process — best-effort signal of which AI tool invoked us
  local invoker="manual"
  if _have ps; then
    local parent_chain
    parent_chain=$(ps -o command= -p $PPID 2>/dev/null | tr -d '\n')
    case "$parent_chain" in
      *claude*)   invoker="claude-code" ;;
      *copilot*|*gh-copilot*) invoker="github-copilot" ;;
      *cursor*)   invoker="cursor" ;;
      *codex*)    invoker="codex" ;;
      *gemini*)   invoker="gemini-cli" ;;
      *aider*)    invoker="aider" ;;
      *cline*)    invoker="cline" ;;
    esac
  fi
  printf '{"ts":"%s","tool":"install-scan","tool_version":"%s","user":"%s","host":"%s","invoker":"%s","manager":"%s","ecosystem":"%s","name":"%s","version":"%s","verdict":"%s","vulns":%s,"kev_hits":%s,"mode":"%s"}\n' \
    "$ts" "$VERSION" "$user" "$host" "$invoker" "$MANAGER" "$ecosystem" "$name" "$version" "$verdict" "$vulns" "$kev_hits" "$MODE" >> "$log_file" 2>/dev/null
}

# --- Refresh CISA KEV catalog if stale -------------------------------------
_refresh_kev() {
  local now mtime
  now=$(date +%s)
  if [[ -f "$KEV_CACHE" ]]; then
    mtime=$(stat -f%m "$KEV_CACHE" 2>/dev/null || stat -c%Y "$KEV_CACHE" 2>/dev/null || echo 0)
    (( now - mtime < KEV_TTL_SECONDS )) && return 0
  fi
  if _have curl; then
    curl -sf --max-time 10 -o "${KEV_CACHE}.tmp" \
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" \
      && mv "${KEV_CACHE}.tmp" "$KEV_CACHE" 2>/dev/null
  fi
}

_in_kev() {
  local cve="$1"
  [[ -f "$KEV_CACHE" ]] || return 1
  _have jq || return 1
  jq -e --arg cve "$cve" '.vulnerabilities[] | select(.cveID == $cve)' "$KEV_CACHE" >/dev/null 2>&1
}

# --- OSV query with offline cache fallback ---------------------------------
_query_osv() {
  local ecosystem="$1" name="$2" version="$3"
  local cache_key cache_file resp count
  cache_key=$(printf '%s_%s_%s' "$ecosystem" "$name" "${version:-NOVER}" | tr '/@' '__')
  cache_file="${OSV_CACHE_DIR}/${cache_key}.json"

  _have curl || { _log_warn "curl missing — skipping scan"; _audit "$ecosystem" "$name" "$version" "TOOL_MISSING" "[]" "[]"; return; }
  _have jq   || { _log_warn "jq missing — skipping scan";   _audit "$ecosystem" "$name" "$version" "TOOL_MISSING" "[]" "[]"; return; }

  # Try fresh OSV query
  local body
  if [[ -n "$version" ]]; then
    body=$(printf '{"package":{"ecosystem":"%s","name":"%s"},"version":"%s"}' "$ecosystem" "$name" "$version")
  else
    body=$(printf '{"package":{"ecosystem":"%s","name":"%s"}}' "$ecosystem" "$name")
  fi
  resp=$(curl -sf --max-time 8 -X POST -H "Content-Type: application/json" -d "$body" "https://api.osv.dev/v1/query" 2>/dev/null)
  if [[ -n "$resp" ]]; then
    echo "$resp" > "$cache_file" 2>/dev/null
  elif [[ -f "$cache_file" ]]; then
    # Offline fallback — use cached response if recent enough
    local now mtime
    now=$(date +%s)
    mtime=$(stat -f%m "$cache_file" 2>/dev/null || stat -c%Y "$cache_file" 2>/dev/null || echo 0)
    if (( now - mtime < OSV_TTL_SECONDS )); then
      resp=$(cat "$cache_file")
      _log_dim "  (offline: using cached OSV result)"
    fi
  fi

  if [[ -z "$resp" ]]; then
    _log_warn "  ⚠ $ecosystem/$name${version:+@$version}: scan unavailable (network + no cache)"
    _audit "$ecosystem" "$name" "$version" "SCAN_UNAVAILABLE" "[]" "[]"
    return
  fi

  count=$(echo "$resp" | jq -r '.vulns | length // 0')

  # Slopsquat / typosquat heuristic — runs BEFORE the clean-exit check so even
  # packages with no known CVEs get flagged when they look suspicious.
  if declare -f slopsquat_check >/dev/null 2>&1; then
    slopsquat_check "$ecosystem" "$name"
    if (( ${SLOPSQUAT_SCORE:-0} >= 50 )); then
      _log_alert "  🚨 SLOPSQUAT/TYPOSQUAT RISK ($SLOPSQUAT_SCORE/100): ${SLOPSQUAT_REASONS}"
      if [[ "$MODE" == "enforcing" ]]; then
        _audit "$ecosystem" "$name" "$version" "SLOPSQUAT_BLOCKED" "[]" "[]"
        _log_alert "  ⛔ BLOCKED in enforcing mode — slopsquat score $SLOPSQUAT_SCORE"
        exit 1
      fi
    elif (( ${SLOPSQUAT_SCORE:-0} >= 25 )); then
      _log_warn "  ⚠ slopsquat score $SLOPSQUAT_SCORE/100: ${SLOPSQUAT_REASONS}"
    fi
  fi

  if [[ "$count" -eq 0 ]]; then
    if (( ${SLOPSQUAT_SCORE:-0} >= 50 )); then
      _log_ok "  (OSV clean but slopsquat-flagged — see above)"
      _audit "$ecosystem" "$name" "$version" "SLOPSQUAT_FLAGGED" "[]" "[]"
    else
      _log_ok "  ✓ $ecosystem/$name${version:+@$version}: no known vulns"
      _audit "$ecosystem" "$name" "$version" "CLEAN" "[]" "[]"
    fi
    return
  fi

  _log_warn "  ⚠ $ecosystem/$name${version:+@$version}: $count known vulnerabilit(y/ies)"
  echo "$resp" | jq -r '.vulns[] | "    \(.id) — \(.summary // .details // "(no summary)" | .[0:120])"' | head -5 >&2

  local vuln_ids kev_hits=()
  vuln_ids=$(echo "$resp" | jq -c '[.vulns[].id]')
  local aliases
  aliases=$(echo "$resp" | jq -r '.vulns[].aliases // [] | .[]?' 2>/dev/null | grep -E '^CVE-' | sort -u)
  for cve in $aliases; do
    if _in_kev "$cve"; then
      _log_alert "  🔥 ACTIVELY EXPLOITED (CISA KEV: $cve)"
      kev_hits+=("$cve")
    fi
  done

  local kev_json="[]"
  if (( ${#kev_hits[@]} > 0 )); then
    kev_json=$(printf '%s\n' "${kev_hits[@]}" | jq -R . | jq -s -c .)
  fi

  local verdict="VULNS_FOUND"
  (( ${#kev_hits[@]} > 0 )) && verdict="KEV_HIT"
  _audit "$ecosystem" "$name" "$version" "$verdict" "$vuln_ids" "$kev_json"

  # Enforcing mode: block on KEV hit
  if [[ "$MODE" == "enforcing" && ${#kev_hits[@]} -gt 0 ]]; then
    _log_alert "  ⛔ BLOCKED in enforcing mode — KEV hit on $name"
    exit 1
  fi
}

# --- Manager-specific arg parsers ------------------------------------------

_scan_pip() {
  local action="$1"; shift
  # pip uses `install --upgrade` / `install -U <pkg>` rather than a separate
  # `update` subcommand, so the "install" action covers both initial installs
  # and version bumps. Flags are stripped below.
  [[ "$action" == "install" ]] || return
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    [[ "$arg" == *"://"* ]] && continue   # skip git+https://, file://, etc.
    [[ "$arg" == *.whl || "$arg" == *.tar.gz ]] && continue
    local name version
    if [[ "$arg" == *"=="* ]]; then
      name="${arg%%==*}"; version="${arg##*==}"
    elif [[ "$arg" == *">="* ]]; then
      name="${arg%%>=*}"; version=""
    else
      name="$arg"; version=""
    fi
    name="${name%%[*}"   # strip extras like requests[security]
    _query_osv "PyPI" "$name" "$version"
  done
}

_scan_uv() {
  # uv pip install, uv add, uv tool install
  local action="$1"; shift
  case "$action" in
    pip)
      [[ "${1:-}" == "install" ]] || return
      shift
      _scan_pip install "$@"
      ;;
    add|tool)
      # uv pip install --upgrade is handled by _scan_pip via the pip case
      # uv tool install / uv tool upgrade — both lead to a real install
      if [[ "$action" == "tool" ]]; then
        case "${1:-}" in install|upgrade) shift ;; *) return ;; esac
      fi
      for arg in "$@"; do
        [[ "$arg" =~ ^- ]] && continue
        [[ -z "$arg" ]] && continue
        local name version
        if [[ "$arg" == *"=="* ]]; then
          name="${arg%%==*}"; version="${arg##*==}"
        else
          name="$arg"; version=""
        fi
        _query_osv "PyPI" "$name" "$version"
      done
      ;;
  esac
}

_scan_pipx() {
  local action="$1"; shift
  case "$action" in install|upgrade|reinstall) ;; *) return ;; esac
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    [[ "$arg" == *"://"* ]] && continue
    local name version
    if [[ "$arg" == *"=="* ]]; then
      name="${arg%%==*}"; version="${arg##*==}"
    else
      name="$arg"; version=""
    fi
    _query_osv "PyPI" "$name" "$version"
  done
}

_scan_poetry() {
  local action="$1"; shift
  case "$action" in add|update|upgrade) ;; *) return ;; esac
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    local name="${arg%%@*}"
    local version=""
    [[ "$arg" == *"@"* ]] && version="${arg##*@}"
    _query_osv "PyPI" "$name" "$version"
  done
}

_scan_conda() {
  local action="$1"; shift
  case "$action" in install|create|update|upgrade) ;; *) return ;; esac
  # Strip -n env-name and similar flags
  local skip_next=0
  for arg in "$@"; do
    [[ $skip_next -eq 1 ]] && { skip_next=0; continue; }
    case "$arg" in
      -n|-c|--name|--channel|--prefix|-p) skip_next=1; continue ;;
      -*) continue ;;
    esac
    [[ -z "$arg" ]] && continue
    local name version
    if [[ "$arg" == *"="* ]]; then
      name="${arg%%=*}"; version="${arg##*=}"
    else
      name="$arg"; version=""
    fi
    # Conda packages often map to PyPI; query both
    _query_osv "PyPI" "$name" "$version"
  done
}

_scan_npm() {
  local action="$1"; shift
  # install/i/add covers initial installs; update/upgrade covers version bumps
  # which can themselves introduce new vulns (e.g. supply-chain compromise of
  # a maintainer account, or a fresh CVE landing in a "latest" tag).
  case "$action" in install|i|add|update|upgrade|up) ;; *) return ;; esac
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    [[ "$arg" == *"://"* || "$arg" == "."* ]] && continue
    local name version
    if [[ "$arg" == @*"@"* && "$arg" =~ ^@[^/]+/[^@]+@.+ ]]; then
      name="${arg%@*}"; version="${arg##*@}"
    elif [[ "$arg" == *"@"* && "$arg" != @* ]]; then
      name="${arg%@*}"; version="${arg##*@}"
    else
      name="$arg"; version=""
    fi
    _query_osv "npm" "$name" "$version"
  done
}

_scan_brew() {
  local action="$1"; shift
  case "$action" in install|upgrade|reinstall) ;; *) return ;; esac
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _query_osv "Homebrew" "$arg" ""
  done
}

_scan_dotnet() {
  local action="$1"; shift
  case "$action" in
    add)
      local subcmd="${1:-}"
      [[ "$subcmd" != "package" ]] && return
      shift
      local name="" version=""
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --version|-v) version="$2"; shift 2 ;;
          --source|-s)  shift 2 ;;
          --*)          shift ;;
          *)            [[ -z "$name" ]] && name="$1"; shift ;;
        esac
      done
      [[ -n "$name" ]] && _query_osv "NuGet" "$name" "$version"
      ;;
    tool)
      [[ "${1:-}" == "install" ]] || return
      shift
      for arg in "$@"; do
        [[ "$arg" =~ ^- ]] && continue
        [[ -z "$arg" ]] && continue
        _query_osv "NuGet" "$arg" ""
      done
      ;;
  esac
}

_scan_cargo() {
  local action="$1"; shift
  case "$action" in install|add|update|upgrade) ;; *) return ;; esac
  # `cargo update` with no args refreshes ALL deps from Cargo.lock — too broad
  # to enumerate without parsing the lockfile, so we skip the bare form.
  local has_named=0
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] || { [[ -n "$arg" ]] && has_named=1; }
  done
  if [[ "$action" == "update" && $has_named -eq 0 ]]; then
    _log_info "  cargo update (no pkg) — bulk refresh; scan skipped (use cargo audit)"
    return
  fi
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _query_osv "crates.io" "$arg" ""
  done
}

_scan_gem() {
  local action="$1"; shift
  case "$action" in install|update|upgrade) ;; *) return ;; esac
  # `gem update` with no args refreshes all installed gems
  local has_named=0
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] || { [[ -n "$arg" ]] && has_named=1; }
  done
  if [[ "$action" == "update" && $has_named -eq 0 ]]; then
    _log_info "  gem update (no pkg) — bulk refresh; scan skipped"
    return
  fi
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _query_osv "RubyGems" "$arg" ""
  done
}

_scan_gh() {
  local sub="${1:-}"; shift || true
  [[ "$sub" == "extension" ]] || return
  local action="${1:-}"; shift || true
  [[ "$action" == "install" ]] || return
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _log_info "  → gh extension: $arg (no OSV ecosystem; manual verification advised)"
    _audit "GitHub" "$arg" "" "MANUAL_REVIEW" "[]" "[]"
  done
}

_scan_apt() {
  local action="${1:-}"; shift || true
  case "$action" in install|upgrade|full-upgrade|dist-upgrade) ;; *) return ;; esac
  local has_named=0
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] || { [[ -n "$arg" ]] && has_named=1; }
  done
  # Bare `apt upgrade` upgrades everything; can't enumerate without dpkg parse
  if [[ "$action" =~ ^(upgrade|full-upgrade|dist-upgrade)$ && $has_named -eq 0 ]]; then
    _log_info "  apt $action (no pkg) — bulk system upgrade; per-package scan skipped"
    return
  fi
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _query_osv "Debian:12" "$arg" ""
  done
}

_scan_choco() {
  local action="${1:-}"; shift || true
  case "$action" in install|upgrade) ;; *) return ;; esac
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _log_info "  → chocolatey: $arg (no OSV ecosystem; manual verification advised)"
    _audit "Chocolatey" "$arg" "" "MANUAL_REVIEW" "[]" "[]"
  done
}

_scan_winget() {
  local action="${1:-}"; shift || true
  case "$action" in install|upgrade) ;; *) return ;; esac
  for arg in "$@"; do
    [[ "$arg" =~ ^- ]] && continue
    [[ -z "$arg" ]] && continue
    _log_info "  → winget: $arg (no OSV ecosystem; manual verification advised)"
    _audit "winget" "$arg" "" "MANUAL_REVIEW" "[]" "[]"
  done
}

# --- Dispatch --------------------------------------------------------------

if [[ -z "$MANAGER" || -z "$ARGS" ]]; then
  exit 0
fi

_refresh_kev &

_log_info "scanning: $MANAGER $ARGS"

case "$MANAGER" in
  pip|pip3)         _scan_pip    "$@" ;;
  python|python3)
    if [[ "${1:-}" == "-m" && "${2:-}" == "pip" ]]; then
      shift 2
      _scan_pip "$@"
    fi
    ;;
  uv)               _scan_uv     "$@" ;;
  pipx)             _scan_pipx   "$@" ;;
  poetry)           _scan_poetry "$@" ;;
  conda|mamba|micromamba) _scan_conda "$@" ;;
  npm|pnpm|yarn)    _scan_npm    "$@" ;;
  brew)             _scan_brew   "$@" ;;
  dotnet)           _scan_dotnet "$@" ;;
  cargo)            _scan_cargo  "$@" ;;
  gem)              _scan_gem    "$@" ;;
  gh)               _scan_gh     "$@" ;;
  apt|apt-get)      _scan_apt    "$@" ;;
  choco)            _scan_choco  "$@" ;;
  winget)           _scan_winget "$@" ;;
  *)                exit 0 ;;
esac

wait 2>/dev/null
exit 0
