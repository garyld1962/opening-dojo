---
name: configure
description: "Use when a skill's pre-flight says config is missing, or with no arg to see what needs configuring. Interviews the user and writes the config file."
model: haiku
---

# /configure — Skill Config Setup

**Purpose:** Read a blank config template shipped with a skill, interview the user to fill in the required fields, and write the completed config file to its destination. This is the interactive alternative to hand-editing template files.

## When to Use

- A skill's pre-flight check reports missing or incomplete config
- First-time setup of a skill in a new repo
- You want to audit which skills are configured in the current workspace

## When NOT to Use

- You know the config fields and prefer to hand-edit the template directly
- Configuring the runtime CLI itself (hooks, permissions, settings.json for Claude Code; config.toml/hooks.json for Kimi or Codex) — use the platform's own config skill (`update-config` for Claude Code)

## Arguments

- (no argument) — list all registered targets, show which have config vs which are unconfigured
- `<target>` — fill in config for a specific target (e.g., `env`, `ship`, `code-investigate`, `copilot-env`)
- `--dry-run` — show what would be written without writing
- `--recheck` — re-read existing config and re-prompt only for fields that are missing or still contain placeholders

## Workflow

### Step 0: Load the Registry

Read `configure/registry.md` (co-located with this skill) to get the target→template→destination mapping.

If no argument was provided, list all registered targets:

```
Available configure targets:

  env              ~/.claude/env.config.md                    [not configured]
	  ship             <project>/.claude/ship.config.md           [not configured]
  code-investigate ~/.claude/code-investigate.config.md       [configured]
  copilot-env      $HOME/.copilot/env.config.md               [not configured]
```

For each target, check whether the destination file exists and contains no `<FILL IN>` placeholders. Show `[configured]` or `[not configured]`.

Then ask: "Which target would you like to configure?"

### Step 1: Read the Template

Look up the target in the registry. Read the template file from its `template` path.

If the template file does not exist, halt:
> "Template not found at `<path>`. This target may not have been ported yet."

If `--recheck` was passed and the destination file already exists, read the destination file instead of the blank template. The interview will only cover fields that still contain placeholders.

### Step 2: Extract Fields

Scan the template for:
- **Required fields:** lines containing `<FILL IN>` or `<FILL IN: hint>`
- **Required sections:** section headers (## or ###) that contain only placeholder content
- **Optional fields:** lines containing `<OPTIONAL>` or commented-out examples

Build a list of questions to ask. Each question corresponds to one required field or section.

### Step 3: Interview the User

For each required field, ask **one question at a time**:

1. Show the field name and any hint from the placeholder (e.g., `<FILL IN: e.g., docs/runs/>`)
2. If auto-detection can provide a sensible default, offer it as the default:
   - **OS detection:** `uname -s` for shell family
   - **Git remote:** `git remote get-url origin` for repo name
   - **Package manager:** presence of `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb`
   - **Project root:** `git rev-parse --show-toplevel`
   - **Existing CLAUDE.md sections:** scan for ship/build/test commands already defined
3. Offer the default with a confirm prompt: `"Process docs root [docs/process/]: "`
4. Accept the user's answer or confirmation

For sections that require multi-line content, explain what's needed and accept the user's input.

Skip fields that already have non-placeholder values (in `--recheck` mode).

### Step 4: Write the Config

Replace all `<FILL IN>` placeholders with the user's answers. Replace `<FILL IN: hint>` placeholders similarly.

Resolve `{project}` in destination paths to the current project root (`git rev-parse --show-toplevel`).

If `--dry-run` was passed:
> Show the completed config content and the destination path. Do not write.
> Ask: "Write this file? (y/n)"

Otherwise, write the file to the destination. Create parent directories if needed.

### Step 5: Confirm

Report what was written:
> "Wrote `<destination>` with <N> fields configured."
> "You can re-run `/configure <target> --recheck` any time to update."

If other registered targets are still unconfigured, mention them:
> "Still unconfigured: ship. Run `/configure <target>` when ready."

## Placeholder Conventions

Templates use these markers (detected by pre-flight checks in other skills):

| Marker | Meaning | Configure behavior |
|---|---|---|
| `<FILL IN>` | Required, no default possible | Must ask user |
| `<FILL IN: example>` | Required, with hint | Ask user, show hint as default |
| `<OPTIONAL>` | Not required | Skip unless user volunteers |
| `# TODO: ...` | Guidance comment | Remove after filling |

## Auto-detection Sources

When pre-populating defaults, use these non-destructive signals:

| Signal | Detection | Used for |
|---|---|---|
| OS family | `uname -s` | Shell family suggestions in env config |
| Shell | `$SHELL` or `$PSVersionTable` | Default shell in env config |
| Git remote | `git remote get-url origin` | Repo name in reports |
| Package manager | Lock file presence | Build/test command hints |
| Project root | `git rev-parse --show-toplevel` | Resolving `{project}` paths |
| CLAUDE.md | Read existing sections | Pre-populate ship/build/test if already defined |

Never run destructive commands during detection.

## CRITICAL: Do Not Guess

- Do NOT write a config file without asking the user for every required field.
- Do NOT assume a default if auto-detection fails — ask the user instead.
- Do NOT overwrite an existing config file without confirming with the user.
- Do NOT hardcode any environmental specifics (shell names, hostnames, project names) in this skill. All environment data comes from the user's answers or auto-detection.
- Do NOT proceed past a failed template read — halt and explain.
