---
name: env-check
description: "Detect the current shell environment and choose safe command routing. Use when working across different shells, OSes, or remote hosts. Reads user-specific shell config from ~/.claude/env.config.md."
model: haiku
---

# /env-check — Shell Environment Detection

**Purpose:** Detect the current execution environment and determine how to route shell commands safely. Does NOT hardcode any specific shell, host, or OS — reads the user's shell configuration for routing rules.

## Pre-flight Required Config

Before proceeding, verify:

1. Check `~/.claude/env.config.md` exists.
   If not, halt:
   > This skill requires `~/.claude/env.config.md`.
   >
   > Set it up interactively:
   > ```
   > /configure env
   > ```
   >
   > Or copy the template and edit manually:
   > ```
   > cp claude/env-check/env.config.template.md ~/.claude/env.config.md
   > ```

2. Scan for `<FILL IN>` placeholders in required sections: `shells`, `routing_rules`.
   If found: list unfilled fields and suggest `/configure env --recheck`.

3. If healthy, proceed silently.

## Arguments

- (no argument) — detect current environment and report
- `<command-or-pattern>` — evaluate how a specific command should be routed in the current environment

## Workflow

### Step 1: Read User Config

Read `~/.claude/env.config.md`. Extract:
- **Registered shells** — which shells the user works with (e.g., bash, zsh, pwsh, fish)
- **Routing rules** — per-shell or per-host rules for how to emit commands
- **Host mappings** (optional) — which machines use which shells
- **Terminal switching rules** (optional) — when to recommend switching terminals vs wrapping

### Step 2: Detect Current Environment

Check non-destructive signals:

| Signal | How to detect |
|---|---|
| Current shell | `$SHELL`, `$PSVersionTable`, `$0`, or process name |
| OS family | `uname -s` or equivalent |
| Path style | Forward-slash vs backslash, `/home/` vs `C:\` |
| Inside remote session? | `$SSH_CONNECTION`, `$SSH_TTY` |
| Inside container/WSL? | `/proc/version`, `$WSL_DISTRO_NAME`, `/.dockerenv` |
| Project runner scripts | Scan for `Makefile`, `package.json` scripts, `pyproject.toml`, shell scripts |

### Step 3: Match Against User Config

Compare detected environment against the user's routing rules:

1. Identify which registered shell is active
2. Look up the routing rule for that shell
3. Determine if the current environment matches what the project expects

### Step 4: Report (When Needed)

If environment choice matters (ambiguous or mismatched), report:

```
Detected shell: <shell name>
OS: <os family>
Execution strategy: <direct / switch terminal / use project runner>
Reason: <brief explanation from routing rules>
```

If the environment is obvious and no routing guidance is needed, proceed silently.

### Step 5: Emit Guidance

Based on the routing match:

- **Direct execution** — emit commands in the detected shell's syntax
- **Terminal switch recommended** — tell the user which terminal to switch to and why, per their routing rules
- **Runner script available** — use the project's runner script
- **Mismatch detected** — explain the mismatch between current shell and project expectations

## When to Use Silently vs Report

- **Report** when: shell choice is ambiguous, the detected shell doesn't match project expectations, or the user explicitly invoked `/env-check`
- **Stay silent** when: another skill calls this as a sub-check and the environment is unambiguous

## CRITICAL: Do Not Guess

- Do NOT hardcode shell names (PowerShell, WSL, bash, zsh) in the detection logic. The user's `env.config.md` defines which shells they use.
- Do NOT assume a specific OS. Detect it.
- Do NOT emit commands in the wrong shell syntax.
- Do NOT recommend terminal switching unless the user's routing rules specify it.
- Do NOT invent runner scripts that don't exist in the project.
- Do NOT prefix commands with shell wrappers (e.g., `wsl`, `bash -c`) unless the user's routing rules explicitly call for it.
