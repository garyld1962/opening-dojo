# wrapper-shell.sh — bash/zsh wrapper functions for install-scan.
#
# Source this from ~/.zshrc or ~/.bashrc:
#
#   source /path/to/install-scan/bin/wrapper-shell.sh
#
# Idempotent. Sources before the user's PATH-driven commands so the wrapper
# functions take precedence over the binaries.

[[ -n "${_INSTALL_SCAN_WRAPPER_LOADED:-}" ]] && return 0
_INSTALL_SCAN_WRAPPER_LOADED=1

# Resolve the scanner path relative to this wrapper file (so brew / curl-installed paths both work)
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  _INSTALL_SCAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [[ -n "${(%):-%x}" ]]; then
  _INSTALL_SCAN_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
else
  _INSTALL_SCAN_DIR="${HOME}/.local/share/install-scan/bin"
fi
_INSTALL_SCAN_SCRIPT="${_INSTALL_SCAN_DIR}/install-scan.sh"

if [[ ! -x "$_INSTALL_SCAN_SCRIPT" ]]; then
  chmod +x "$_INSTALL_SCAN_SCRIPT" 2>/dev/null
fi

_install_scan_dispatch() {
  local manager="$1"; shift
  [[ $# -eq 0 ]] && return 0
  bash "$_INSTALL_SCAN_SCRIPT" "$manager" "$@" 2>&1 || true
}

# Wrap each manager: scan first, then run the real command.
# Use `command` to bypass the function and call the actual binary.
pip()        { _install_scan_dispatch pip        "$@"; command pip        "$@"; }
pip3()       { _install_scan_dispatch pip3       "$@"; command pip3       "$@"; }
uv()         { _install_scan_dispatch uv         "$@"; command uv         "$@"; }
pipx()       { _install_scan_dispatch pipx       "$@"; command pipx       "$@"; }
poetry()     { _install_scan_dispatch poetry     "$@"; command poetry     "$@"; }
conda()      { _install_scan_dispatch conda      "$@"; command conda      "$@"; }
mamba()      { _install_scan_dispatch mamba      "$@"; command mamba      "$@"; }
micromamba() { _install_scan_dispatch micromamba "$@"; command micromamba "$@"; }
npm()        { _install_scan_dispatch npm        "$@"; command npm        "$@"; }
pnpm()       { _install_scan_dispatch pnpm       "$@"; command pnpm       "$@"; }
yarn()       { _install_scan_dispatch yarn       "$@"; command yarn       "$@"; }
brew()       { _install_scan_dispatch brew       "$@"; command brew       "$@"; }
dotnet()     { _install_scan_dispatch dotnet     "$@"; command dotnet     "$@"; }
cargo()      { _install_scan_dispatch cargo      "$@"; command cargo      "$@"; }
gem()        { _install_scan_dispatch gem        "$@"; command gem        "$@"; }
gh()         { _install_scan_dispatch gh         "$@"; command gh         "$@"; }
apt()        { _install_scan_dispatch apt        "$@"; command apt        "$@"; }
apt-get()    { _install_scan_dispatch apt-get    "$@"; command apt-get    "$@"; }

install_scan_status() {
  echo "install-scan v1.0 — shell wrappers LOADED"
  echo "  scanner:  $_INSTALL_SCAN_SCRIPT"
  echo "  cache:    ${INSTALL_SCAN_CACHE_DIR:-${HOME}/.cache/install-scan}"
  echo "  audit:    ${INSTALL_SCAN_LOG_DIR:-${HOME}/.cache/install-scan/logs}"
  echo "  mode:     ${INSTALL_SCAN_MODE:-advisory}"
  echo "  managers: pip pip3 uv pipx poetry conda mamba micromamba npm pnpm yarn brew dotnet cargo gem gh apt apt-get"
  echo ""
  echo "  bypass once:    INSTALL_SCAN_BYPASS=1 <command>"
  echo "  disable shell:  export INSTALL_SCAN_DISABLE=1"
  echo "  enforce mode:   export INSTALL_SCAN_MODE=enforcing"
  echo "  view today log: cat \"\${INSTALL_SCAN_LOG_DIR:-\${HOME}/.cache/install-scan/logs}/audit-\$(date +%Y-%m-%d).jsonl\""
}

install_scan_unload() {
  unset -f pip pip3 uv pipx poetry conda mamba micromamba npm pnpm yarn brew dotnet cargo gem gh apt apt-get
  unset -f _install_scan_dispatch install_scan_status install_scan_unload
  unset _INSTALL_SCAN_WRAPPER_LOADED _INSTALL_SCAN_DIR _INSTALL_SCAN_SCRIPT
  echo "install-scan wrappers unloaded for this shell."
}
