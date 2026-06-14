#!/usr/bin/env bash
# slopsquat.sh — heuristic check for AI-hallucinated / typosquat packages.
#
# Sourced by install-scan.sh. Adds a second signal beyond known-CVE matching:
# flag packages that LOOK suspicious — newly published, low downloads, or
# name resembles a popular package.
#
# Usage:  slopsquat_check <ecosystem> <name>
# Sets:   SLOPSQUAT_SCORE (0-100)
#         SLOPSQUAT_REASONS (string)

# Top-50 most-typosquatted package names per ecosystem.
# When a request comes in for a package with name within Levenshtein distance 1-2
# of one of these, we flag it as a possible typosquat / LLM hallucination.

_SLOPSQUAT_NPM_TARGETS=(lodash react express axios moment jquery vue angular typescript webpack chalk debug commander dotenv mocha chai eslint prettier next nest fastify koa @types/node body-parser cors mongoose sequelize jsonwebtoken bcrypt uuid yargs request socket.io passport jest react-dom react-router redux nodemon ts-node babel-core @babel/core graphql apollo-server stripe sharp form-data)

_SLOPSQUAT_PYPI_TARGETS=(requests numpy pandas urllib3 setuptools boto3 six certifi pyyaml click python-dateutil cryptography idna charset-normalizer typing-extensions wheel pip pytest django flask sqlalchemy fastapi pydantic httpx aiohttp tensorflow torch scikit-learn matplotlib pillow beautifulsoup4 lxml openai anthropic langchain transformers selenium pyjwt redis celery jinja2 markupsafe werkzeug starlette uvicorn gunicorn psycopg2-binary)

# Levenshtein distance via Python (simple, fast, available everywhere)
_levenshtein() {
  python3 -c "
import sys
a, b = sys.argv[1], sys.argv[2]
if a == b: print(0); sys.exit()
if not a or not b: print(max(len(a), len(b))); sys.exit()
prev = list(range(len(b)+1))
for i,ca in enumerate(a):
    curr = [i+1] + [0]*len(b)
    for j,cb in enumerate(b):
        ins = curr[j]+1; dele = prev[j+1]+1; sub = prev[j] + (ca != cb)
        curr[j+1] = min(ins, dele, sub)
    prev = curr
print(prev[-1])
" "$1" "$2" 2>/dev/null || echo 99
}

# Get package age (days since first publish) and weekly downloads
_pypi_meta() {
  local name="$1"
  local resp downloads age_days
  resp=$(curl -sf --max-time 5 "https://pypi.org/pypi/${name}/json" 2>/dev/null)
  [[ -z "$resp" ]] && { echo "0|99999"; return; }
  # First-upload date from oldest release
  age_days=$(echo "$resp" | jq -r '
    [.releases | to_entries[] | .value[]?.upload_time] | min // empty
  ' 2>/dev/null | python3 -c "
import sys, datetime
ts = sys.stdin.read().strip()
if not ts: print(99999); sys.exit()
try:
    d = datetime.datetime.fromisoformat(ts)
    print((datetime.datetime.now() - d).days)
except: print(99999)
" 2>/dev/null)
  # PyPI doesn't give download counts via JSON API; use pypistats
  downloads=$(curl -sf --max-time 5 "https://pypistats.org/api/packages/${name}/recent" 2>/dev/null \
    | jq -r '.data.last_week // 0' 2>/dev/null || echo 0)
  echo "${downloads:-0}|${age_days:-99999}"
}

_npm_meta() {
  local name="$1"
  local age_days downloads
  # Package age from registry
  age_days=$(curl -sf --max-time 5 "https://registry.npmjs.org/${name}" 2>/dev/null \
    | jq -r '.time.created // empty' 2>/dev/null \
    | python3 -c "
import sys, datetime
ts = sys.stdin.read().strip()
if not ts: print(99999); sys.exit()
try:
    d = datetime.datetime.fromisoformat(ts.replace('Z','+00:00'))
    print((datetime.datetime.now(datetime.timezone.utc) - d).days)
except: print(99999)
" 2>/dev/null)
  # Weekly downloads
  downloads=$(curl -sf --max-time 5 "https://api.npmjs.org/downloads/point/last-week/${name}" 2>/dev/null \
    | jq -r '.downloads // 0' 2>/dev/null || echo 0)
  echo "${downloads:-0}|${age_days:-99999}"
}

# Main entry: returns score 0-100 (>=50 = suspicious)
slopsquat_check() {
  local ecosystem="$1" name="$2"
  SLOPSQUAT_SCORE=0
  SLOPSQUAT_REASONS=""

  command -v python3 >/dev/null 2>&1 || return 0
  command -v jq      >/dev/null 2>&1 || return 0
  command -v curl    >/dev/null 2>&1 || return 0

  local meta downloads age_days targets=()
  case "$ecosystem" in
    PyPI) meta=$(_pypi_meta "$name");  targets=("${_SLOPSQUAT_PYPI_TARGETS[@]}") ;;
    npm)  meta=$(_npm_meta  "$name");  targets=("${_SLOPSQUAT_NPM_TARGETS[@]}")  ;;
    *) return 0 ;;
  esac

  downloads="${meta%%|*}"
  age_days="${meta##*|}"

  # Signal 1: very new package
  if [[ "$age_days" =~ ^[0-9]+$ ]]; then
    if (( age_days < 7 )); then
      SLOPSQUAT_SCORE=$((SLOPSQUAT_SCORE + 35))
      SLOPSQUAT_REASONS+="published ${age_days}d ago; "
    elif (( age_days < 30 )); then
      SLOPSQUAT_SCORE=$((SLOPSQUAT_SCORE + 20))
      SLOPSQUAT_REASONS+="published ${age_days}d ago; "
    fi
  fi

  # Signal 2: very low downloads
  if [[ "$downloads" =~ ^[0-9]+$ ]]; then
    if (( downloads < 100 )); then
      SLOPSQUAT_SCORE=$((SLOPSQUAT_SCORE + 25))
      SLOPSQUAT_REASONS+="${downloads}/week downloads; "
    elif (( downloads < 1000 )); then
      SLOPSQUAT_SCORE=$((SLOPSQUAT_SCORE + 10))
      SLOPSQUAT_REASONS+="${downloads}/week downloads; "
    fi
  fi

  # Signal 3: name resembles a popular package (typosquat / hallucination)
  local lower_name
  lower_name="$(echo "$name" | tr '[:upper:]' '[:lower:]')"
  for target in "${targets[@]}"; do
    [[ "$lower_name" == "$target" ]] && continue   # exact match = the legit pkg
    local dist
    dist=$(_levenshtein "$lower_name" "$target")
    if [[ "$dist" =~ ^[0-9]+$ ]] && (( dist <= 2 && dist > 0 )); then
      SLOPSQUAT_SCORE=$((SLOPSQUAT_SCORE + 35))
      SLOPSQUAT_REASONS+="name 1-2 chars from popular '${target}'; "
      break
    fi
  done

  return 0
}
