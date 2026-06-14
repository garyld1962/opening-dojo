# install-scan — Installation

> **What's new in v1.1** (re-introduces and substantially extends the original PR #17 hook): model-agnostic shell wrapper covering Claude Code, GitHub Copilot CLI, Cursor, Codex, Gemini, Aider, Cline, and manual typing — not just Claude Code. Slopsquat heuristic for LLM-hallucinated package names. JSONL audit log with AI-tool attribution. Cross-platform (PowerShell). Update/upgrade action scanning. File-edit interceptor for AI-driven manifest edits.

## What it does

Pre-install vulnerability scanner. Intercepts `pip install`, `npm install`, `brew install`, `dotnet add package`, etc. (18 commands across 9 ecosystems) and:

1. Queries [OSV.dev](https://osv.dev) for known CVEs against the package + version
2. Cross-references CISA KEV to flag actively-exploited vulnerabilities
3. Runs **slopsquat heuristic** — package age + download count + name-similarity to popular packages — to catch LLM-hallucinated package names *before* any CVE database has them
4. Logs every scan as JSONL to `~/.cache/install-scan/logs/` (optional ship to Sentinel / Defender for Cloud Apps)
5. Then runs the actual install (or blocks it, if `INSTALL_SCAN_MODE=enforcing`)

## Why this control exists

AI coding agents (Claude Code, Copilot, Cursor, Codex, Gemini) install packages on the developer's behalf. Traditional dev-tool security (EDR, SCA at PR time, container scanners) doesn't intercept the moment-of-install when an AI agent is the one running the package manager. **install-scan plugs that gap.** It also catches the unique-to-AI threat of *slopsquatting* (LLM hallucinates a package name; attacker registered the typo with malware), which no existing CVE database can warn about until after the fact.

## Coverage matrix

| Ecosystem | Detected commands |
|---|---|
| **Python** | `pip[3] install [-U]`, `uv pip/add/tool install/upgrade`, `pipx install/upgrade/reinstall`, `poetry add/update/upgrade`, `conda/mamba/micromamba install/update/upgrade` |
| **Node** | `npm install/i/add/update/upgrade`, `pnpm install/add/update`, `yarn add/upgrade` |
| **.NET** | `dotnet add package`, `dotnet tool install/upgrade` |
| **Rust** | `cargo install/add/update/upgrade <pkg>` (bare `cargo update` skipped — bulk lockfile refresh) |
| **Ruby** | `gem install/update/upgrade <pkg>` (bare `gem update` skipped) |
| **macOS** | `brew install / upgrade / reinstall` |
| **Linux** | `apt install/upgrade/full-upgrade <pkg>` (bare `apt upgrade` = bulk system refresh, skipped with note) |
| **Windows** | `choco install/upgrade`, `winget install/upgrade`, `scoop` |
| **GitHub** | `gh extension install` |

> **Why scan updates too:** A version bump can pull a freshly-published version that contains a CVE published *that morning*, a maintainer-account compromise (xz-utils style), or new transitive dependencies. install-scan treats updates the same as fresh installs.

## Prerequisites

- `jq` and `curl` (almost always already present)
- `python3` (recommended — used by slopsquat for Levenshtein distance)
- Network access to `https://api.osv.dev` and `https://www.cisa.gov`
- Optional: `osv-scanner` and `grype` for the on-demand `scan-now.sh`

## Two install models — pick one (or both)

### Option A — Model-agnostic shell wrapper (recommended)

Catches every AI tool that spawns a shell, plus manual typing. **One install covers all AI agents.**

**macOS / Linux:**
```bash
# 1. Make sure ~/.claude/skills/install-scan/ exists (via cli/skill.sh installer)
# 2. Source the wrapper from your shell rc:
echo 'source ~/.claude/skills/install-scan/wrapper-shell.sh' >> ~/.zshrc
source ~/.zshrc

# 3. Verify
install_scan_status
```

**Windows / PowerShell:**
```powershell
# Add to your $PROFILE
'. "$env:USERPROFILE\.claude\skills\install-scan\wrapper-shell.ps1"' | Add-Content $PROFILE
. $PROFILE
Get-InstallScanStatus
```

After this, every `pip install`, `npm install`, etc. — whether typed by you, Claude Code, Copilot CLI, Cursor, Codex CLI, Gemini CLI, Aider, or Cline — gets scanned before the install runs.

### Option B — Claude Code PostToolUse hook (Claude-Code-only)

Adds to `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "bash ~/.claude/skills/install-scan/claude-hook.sh" }
        ]
      },
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "bash ~/.claude/skills/install-scan/manifest-scan.sh" }
        ]
      }
    ]
  }
}
```

The first hook fires when Claude Code runs `Bash` and a command matches a package-manager install. The second hook fires when Claude **edits a manifest file directly** (package.json, requirements.txt, pyproject.toml, Cargo.toml, *.csproj, Gemfile) — closing the gap where the LLM modifies dependencies without running the package manager.

> **The two options compose.** Use both. The shell wrapper covers all AI tools and human typing; the Claude Code hooks add visible verdicts in chat and the manifest-edit interceptor.

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `INSTALL_SCAN_MODE` | `advisory` | Set to `enforcing` to block KEV hits + slopsquat finds |
| `INSTALL_SCAN_BYPASS` | unset | One-shot bypass for a single command |
| `INSTALL_SCAN_DISABLE` | unset | Disable in current shell |
| `INSTALL_SCAN_CACHE_DIR` | `~/.cache/install-scan` | Where OSV/KEV caches live |
| `INSTALL_SCAN_LOG_DIR` | `~/.cache/install-scan/logs` | Where JSONL audit log lives |

## Audit log

Every scan emits one JSONL line per package to `~/.cache/install-scan/logs/audit-YYYY-MM-DD.jsonl`:

```json
{
  "ts": "2026-05-07T01:42:14Z",
  "tool": "install-scan",
  "tool_version": "1.1.0",
  "user": "marcus",
  "host": "marcuss-mbp",
  "invoker": "claude-code",
  "manager": "npm",
  "ecosystem": "npm",
  "name": "lodash",
  "version": "",
  "verdict": "VULNS_FOUND",
  "vulns": ["GHSA-29mw-wpgm-hmr9", "..."],
  "kev_hits": [],
  "mode": "advisory"
}
```

The `invoker` field is the AI tool detected from the parent process tree — `claude-code` / `github-copilot` / `cursor` / `codex` / `gemini-cli` / `aider` / `cline` / `manual`.

The log is **local-only** by default. To ship to Sentinel / Defender for Cloud Apps, point Filebeat or Fluent Bit at `~/.cache/install-scan/logs/*.jsonl` (sample config in the project README).

## Slopsquat heuristic — what it catches that OSV/KEV miss

For each package being installed, the scanner additionally scores it 0-100 on three signals:

1. **Package age** — first publish < 30 days = +20-35 points (LLM-hallucinated names and typosquats are usually freshly registered)
2. **Weekly downloads** — < 100/week = +25 points; < 1000 = +10 points
3. **Levenshtein distance to top-50 popular packages** — 1-2 chars off = +35 points (typosquat indicator)

Score ≥50 prints a 🚨 SLOPSQUAT alert. In enforcing mode, blocks. **Verified live: catches `requessts` (typo of `requests`) which OSV's `MAL-2022-7438` confirms is real malware.** Caught by slopsquat before it ever needed a CVE.

## Companion tools (unchanged from PR #17)

- `scan-now.sh` — on-demand OSV.dev / OSV-Scanner / Grype scanner for ad-hoc package or directory checks
- `sbom-now.sh` — generates CycloneDX SBOM for the current project
- `pattern-scan.sh` — runs the LLM-pattern Semgrep ruleset against the working tree
- `llm-patterns.semgrep.yml` — 30+ Semgrep rules detecting common LLM-coding antipatterns (hardcoded secrets, weak crypto, unsafe deserialization, prompt-injection sinks)

## Uninstall

```bash
# 1. Remove the source line from your ~/.zshrc:
#    source ~/.claude/skills/install-scan/wrapper-shell.sh
# 2. (Optional) remove the cache + audit log:
rm -rf ~/.cache/install-scan
# 3. Remove the Claude Code hook entries from .claude/settings.json
```

## Standards alignment

- **JMA AI Security Tech Standard §6.1** (IDE/Developer AI Security) — the moment-of-install gap
- **JMA AI Security Tech Standard §8.1** — actively-exploited signal via CISA KEV
- **Net-new threat signal — slopsquatting** — not covered by Defender for Endpoint, GHAS, or Defender for DevOps

## Testing the install

The repo includes `tests/smoke.sh` (17 assertions) — run it after install to verify:
```bash
bash ~/.claude/skills/install-scan/tests/smoke.sh
```

Tests cover: OSV CVE detection, slopsquat heuristic, bypass/disable env vars, ignored non-install commands, dotnet parser, update/upgrade actions, audit log JSONL validity.

## Reference implementation

Full reference + interactive walkthrough at https://github.com/JM-Shared/JMA-SecArch-Enablement-Test (mirrors the same scanner; one is `~/.claude/skills/` style, the other is `~/.local/share/install-scan/` style — pick whichever fits your install convention).
