---
name: code-investigate
description: "Search one or more repos for a code pattern or behavior and produce a versioned Markdown investigation report. Supports literal, regex, and semantic (behavioral) search across multi-repo scope."
model: opus
---

# /code-investigate — Cross-Repo Code Investigation

**Purpose:** Search code for a requested pattern or behavior across one or more repositories and produce a structured, versioned Markdown report. Unlike the Explore subagent (single-scope, no report), this skill produces a durable investigation artifact with structured matches and confidence scores.

## When to Use

- You need a durable, versioned investigation report — not an ephemeral search
- Scope spans multiple repositories
- Findings will be cited in a ticket, PR, or postmortem

## When NOT to Use

- Single-repo, throwaway search — use the Explore subagent or Grep directly
- You already know the file and just need to read it — use Read
- You are debugging an active bug — use `/triage`

## Soft Pre-flight Config Check

This skill has a config file for defaults, but can run without it if arguments are provided.

Check `~/.claude/code-investigate.config.md`:
- If it exists, load `report_root` and `default_repo_roots` as defaults.
- If it does NOT exist, check whether the user provided scope and output args. If yes, continue. If no:
  > "No default config found. Provide search scope as an argument, or run `/configure code-investigate` to set defaults."

## Arguments

- `<description>` — what to find (exact pattern, API name, regex, or natural-language behavior like "send email" or "reads files")
- `--repo <path>` — search a single repo (default: current repo)
- `--repos <path1,path2,...>` — search an explicit list of repos
- `--folder <path>` — search all repos in a directory
- `--output <path>` — report output directory (default from config: `docs/code-investigations/`)
- `--include-code` — include matching code lines in the report
- `--include-summary` — include a short behavior summary per match
- `--confidence <0.50-1.00>` — minimum confidence threshold (default: 0.70)

## Workflow

### Step 1: Clarify Scope

Determine scope mode:
- **repo** — one repository (default: current)
- **repos** — explicit list
- **folder** — directory containing repositories

If unclear from arguments, ask once.

If not specified and not clear from context, ask:
1. "Include matching code lines in the report?"
2. "Add a short summary of what the code does at each match?"

### Step 2: Build Search Plan

Convert the request into a search plan:

- **Exact anchors** — symbols, class names, method names, string literals, config keys
- **Framework cues** — common APIs and idioms for the behavior
- **Structure clues** — filenames, folder names, namespaces, service names
- **Behavioral cues** — patterns that imply the behavior even without keyword matches

For multi-repo scope, dispatch parallel searches using the Agent tool with one agent per repo.

### Step 3: Search

For each repo in scope, search using a layered approach:
1. Grep/Glob for exact anchors
2. Read files matching framework/structure cues
3. Scan for behavioral matches in promising files
4. Rate each match with a confidence score

### Match Schema

Each match is a structured object:

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo` | string | yes | Repository name |
| `project` | string | yes | Nearest project identifier (package.json name, .csproj, folder) |
| `file` | string | yes | Repo-relative file path |
| `lineRange` | string | yes | e.g., `42-58` |
| `matchType` | string | yes | `literal`, `regex`, `symbol`, `framework`, `semantic` |
| `confidence` | number | yes | `0.50` to `1.00` |
| `whyMatch` | string | yes | Why this code satisfies the request |
| `codeLines` | string | no | Only when `--include-code` |
| `summary` | string | no | Only when `--include-summary` |

### Step 4: Write Report

Write a versioned Markdown report:

**Default path:** `<report_root>/<YYYY-MM-DD>--<HHMMSS>--<scope>--<slug>.md`

**Report structure:**

```markdown
# Code Investigation Report

- **Date:** YYYY-MM-DD HH:MM
- **Scope mode:** repo | repos | folder
- **Scope:** <human-readable scope>
- **Request:** <search request summary>
- **Repos searched:** <count>
- **Matches found:** <count>
- **Confidence threshold:** <threshold>
- **Include code lines:** yes | no
- **Include summaries:** yes | no

## Matches by Repository

### <repo-name>

#### <project-name>

| File | Lines | Type | Confidence | Why |
|---|---|---|---|---|
| path/to/file.ts | 42-58 | semantic | 0.85 | Calls sendEmail() with SMTP config |

<optional code block>
<optional summary>

## Summary

- Total matches: <N>
- High confidence (>=0.90): <N>
- Medium confidence (0.70-0.89): <N>
- Repos with matches: <list>
- Repos with no matches: <list>
```

Update `<report_root>/index.md` and `<report_root>/latest.md` if they exist.

### Step 5: Report

> "Investigation report written to `<path>`. Found <N> matches across <M> repos."

## CRITICAL: Do Not Guess

- Do NOT fabricate matches. Every match must reference real code.
- Do NOT inflate confidence scores. If unsure, rate lower.
- Do NOT modify any source code. This skill is read-only.
- Do NOT skip repos in scope without reporting them as "no matches."
- Do NOT assume repo structure. Detect it.
