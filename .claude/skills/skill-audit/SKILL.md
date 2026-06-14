---
name: skill-audit
description: "Use periodically or when setting up a new project to audit Claude Code skills/plugins/agents, research marketplaces, gap-analyze, and implement recommendations."
---

# /skill-audit — Skills & Plugin Ecosystem Audit

**Purpose:** Comprehensive audit of your Claude Code skill and plugin ecosystem — inventory what you have, discover what's available, identify gaps, and implement improvements. Project-agnostic.

## When to Use

- Periodically (monthly or per-wave) to catch new skills/plugins
- When setting up Claude Code for a new project
- After Anthropic releases new official plugins or skills
- When capabilities feel stale and you want to level up
- After a major workflow change (new languages, new tools, new patterns)

## When NOT to Use

- Creating a single custom skill — use `/skill-creator` instead
- Debugging a broken plugin — check `claude plugin list` and plugin docs
- Improving CLAUDE.md — use `/claude-md-improver` instead

## Usage

```
/skill-audit                        # Full audit: inventory → research → gaps → recommendations
/skill-audit --inventory            # Just list current skills and plugins (no research)
/skill-audit --research             # Just research available options (no changes)
/skill-audit --implement            # Skip recommendations, implement all findings
/skill-audit --scope plugins        # Audit plugins only
/skill-audit --scope skills         # Audit skills only
```

## Arguments

- `--inventory` — stop after Phase 1 (current state report only)
- `--research` — stop after Phase 3 (gap analysis, no changes)
- `--implement` — auto-implement all recommendations without presenting them first
- `--scope <plugins|skills>` — limit audit to one domain

## Phase 1: Inventory Current State

### 1a: Installed Plugins

```bash
claude plugin list 2>&1
```

Collect for each plugin:
- Name and marketplace source
- Version
- Enabled/disabled status
- Skills it provides (if any)

### 1b: Installed Skills

Scan for SKILL.md files in all skill directories:

```bash
# Project-level skills
find .claude/skills -name 'SKILL.md' 2>/dev/null

# Repo-level shared skills (if using a shared sync/install flow)
find ~/repos/.claude/skills -name 'SKILL.md' 2>/dev/null

# Skills repo (source of truth)
find ~/repos/skills/claude -name 'SKILL.md' 2>/dev/null
```

For each skill, read the frontmatter to extract `name` and `description`.

### 1c: Registered Marketplaces

```bash
cat ~/.claude/plugins/known_marketplaces.json 2>/dev/null
```

### 1d: Plugin-Provided Agents

Check for plugin-provided subagent types by looking at the currently loaded skill list (available in the Skill tool's metadata). Note which plugins contribute agents vs skills.

### 1e: Project Context

Read `CLAUDE.md` to understand:
- Languages and frameworks in use
- Build tools and test frameworks
- Deployment targets (K8s, cloud, local)
- Any domain-specific needs (BA, security, data, etc.)

This determines which skills/plugins are **relevant** vs noise.

### Inventory Report

```
## Current Ecosystem

**Plugins:** N installed (M enabled, K disabled)
**Skills:** N loaded (P project-specific, Q shared)
**Marketplaces:** N registered
**Agents:** N available (from plugins)

### Enabled Plugins
| Plugin | Source | Skills/Agents Provided |
|--------|--------|----------------------|
| ... | ... | ... |

### Disabled Plugins
| Plugin | Source | Reason (if known) |
|--------|--------|--------------------|
| ... | ... | ... |

### Loaded Skills
| Skill | Source | Description |
|-------|--------|-------------|
| ... | project / shared / plugin | ... |
```

If `--inventory` was passed, stop here.

## Phase 2: Research Available Options

### 2a: Official Anthropic Plugins

Check the claude-plugins-official marketplace for plugins not currently installed:

```bash
# List all available plugins from official marketplace
claude plugin marketplace list claude-plugins-official 2>&1
```

For each uninstalled plugin:
- Check relevance against project context (from Phase 1e)
- Skip language-specific plugins for languages not in the project

### 2b: Anthropic Skills Repository

Check the anthropic-agent-skills marketplace:

```bash
claude plugin marketplace list anthropic-agent-skills 2>&1
```

If the marketplace isn't registered:
```bash
claude plugin marketplace add anthropic-agent-skills https://github.com/anthropics/skills 2>&1
```

### 2c: Community Marketplaces

Check known community sources:

| Marketplace | URL | Focus |
|-------------|-----|-------|
| trailofbits | github.com/trailofbits/skills | Security analysis |
| quickstop | (community) | Meta/utility skills |

For each not-yet-registered marketplace relevant to the project:
```bash
claude plugin marketplace add <name> <url> 2>&1
```

### 2d: Skills Repo Comparison

If a skills repo exists (`~/repos/skills/`), compare the project's shared skills
to the source repo:

```bash
# Check for skills in source not present in the project
diff <(ls ~/repos/skills/claude/) <(ls .claude/skills/ | grep -v _project)
```

Also check `claude/README.md` to see whether the source catalog mentions shared
skills that are missing from the project.

### 2e: Version Freshness

For installed plugins, check if updates are available:

```bash
claude plugin update --check 2>&1
```

## Phase 3: Gap Analysis

Cross-reference the project context (Phase 1e) with available options (Phase 2) to identify:

### Relevance Scoring

For each available-but-not-installed item, score relevance:

| Signal | Score |
|--------|-------|
| Language/framework match | +3 |
| Deployment target match | +2 |
| Workflow pattern match | +2 |
| Domain overlap | +1 |
| No overlap at all | -5 (skip) |

### Gap Categories

1. **Missing capabilities** — things the project needs that no current skill/plugin covers
2. **Upgrade opportunities** — installed plugins with newer versions available
3. **Unused plugins** — enabled plugins irrelevant to the project (wasting context)
4. **Duplicate coverage** — multiple skills/plugins doing the same thing
5. **Skill staleness** — skills in source repo newer than the project's shared
   copies

> **Source-repo authors:** for description-level overlap analysis between *custom skills in this repo* and native skills (superpowers, plugins, built-ins), use `/audit-native-overlap` instead. That skill is scoped to the savviety-skills source tree and produces per-skill edit recommendations (tighten / cross-reference / integrate / hand off). `/skill-audit` is for consumer-side ecosystem questions (what's installed, what's stale).

### Gap Report

```
## Gap Analysis

### Missing Capabilities (score >= 3)
| Item | Type | Source | Relevance | Why |
|------|------|--------|-----------|-----|
| ... | plugin/skill | ... | High/Med | ... |

### Upgrade Available
| Plugin | Current | Available |
|--------|---------|-----------|
| ... | ... | ... |

### Should Disable (irrelevant)
| Plugin | Reason |
|--------|--------|
| ... | No <language> in project |

### Duplicate Coverage
| Capability | Covered By |
|------------|------------|
| ... | skill A + plugin B (recommend keeping ...) |

### Stale Shared Skills
| Skill | Project Copy | Source Version |
|-------|-----------------|----------------|
| ... | ... | ... |
```

If `--research` was passed, stop here.

## Phase 4: Recommendations

Present findings grouped by action type, ordered by impact:

```
## Recommendations

### Install (new plugins)
1. **<plugin>@<marketplace>** — <why it helps>
2. ...

### Create (new skills)
1. **/skill-name** — <gap it fills>
2. ...

### Enable (disabled plugins worth enabling)
1. **<plugin>** — <why>

### Disable (irrelevant plugins, save context)
1. **<plugin>** — <why it's not needed>

### Update (stale skills/plugins)
1. **<item>** — <current> → <available>

### Sync (skills in source not in project)
1. **<skill>** — sync shared skills into the project

Implement all? [y/N]
```

If `--implement` was passed, skip the prompt and proceed.

## Phase 5: Implementation

Execute each approved recommendation:

### Installing Plugins

```bash
# Add marketplace if needed
claude plugin marketplace add <name> <url> 2>&1

# Install plugin
claude plugin install <name>@<marketplace> 2>&1

# Enable plugin
claude plugin enable <name>@<marketplace> 2>&1
```

### Creating Skills

For each new skill to create:
1. Create directory in the skills repo: `~/repos/skills/claude/<name>/`
2. Write `SKILL.md` with frontmatter and workflow
3. Update `claude/README.md` or other catalog docs if the new skill should be discoverable there
4. Re-sync the shared Claude skills into any target projects that consume them

### Enabling/Disabling Plugins

```bash
claude plugin enable <name>@<marketplace> 2>&1
claude plugin disable <name>@<marketplace> 2>&1
```

### Updating

```bash
claude plugin update <name>@<marketplace> 2>&1
```

### Syncing Skills

Refresh the shared Claude skills using the current sync workflow for your
environment. In this source repo, the old `deploy.sh` script is archived, so do
not instruct the user to run it.

## Phase 6: Report

```
## Skill Audit Complete

### Actions Taken
| Action | Item | Result |
|--------|------|--------|
| Installed | <plugin> | OK / Error |
| Created | /skill-name | OK |
| Enabled | <plugin> | OK |
| Disabled | <plugin> | OK |
| Updated | <plugin> | OK |
| Synced | N skills | OK |

### Before → After
| Metric | Before | After |
|--------|--------|-------|
| Plugins installed | N | N |
| Plugins enabled | N | N |
| Skills loaded | N | N |
| Marketplaces | N | N |

### Next Steps
- Restart Claude Code for new plugins to take effect
- Run `/checkpoint` to verify nothing broke
- Verify new skills with a test invocation
```

## Key Rules

1. **Read-only by default.** Phases 1-4 make no changes. Only Phase 5 modifies state, and only after user approval (unless `--implement`).
2. **Context matters.** A Rust security plugin is noise in a TypeScript project. Always score relevance against the actual project.
3. **Don't be noisy.** Only recommend items with relevance score >= 3. Skip obvious mismatches silently.
4. **Preserve project skills.** Never touch `_project/` directories. Those are managed by the project, not this skill.
5. **Skills repo is source of truth.** If `~/repos/skills/` exists, create new skills there and sync them into projects. Don't create shared skills directly in `.claude/skills/` (they'd be overwritten on the next shared sync).
6. **One command at a time.** Plugin CLI commands can fail silently when chained. Run each install/enable/disable separately and check the result.
7. **Marketplace registration is durable.** Only `marketplace add` once per source. Check `known_marketplaces.json` before adding.
