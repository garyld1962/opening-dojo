---
name: skill-help
description: "List available skills or show detailed help for a specific skill. Use when the user asks 'what skills are available', 'help with a skill', 'what can you do', 'list skills', or '/skill-help'."
model: haiku
---

# /skill-help — Agent Reference

**Purpose:** Show available skills and their usage. With no argument, list all user-invokable skills with descriptions. With a name, show detailed help for that skill.

## When to Use

- User asks "what skills/skills are available" or "what can you do"
- User asks for help on a specific skill by name
- User is new to the repo and needs an orientation

## When NOT to Use

- User already named a skill and wants it executed — invoke it directly
- You need the runtime's built-in help (Claude Code, Kimi, etc.) — use `/help`

## Arguments

- _(none)_ — list all available skills
- `<name>` — show detailed help for the named skill (e.g., `/skill-help plan`)

## Workflow

### List Mode (no argument)

1. **Discover skills.** Find all top-level SKILL.md files at `.claude/skills/*/SKILL.md` — these are user-invokable skills. Do NOT include nested sub-skills (specialists, analysts, writers under a parent skill directory) — those are internal to skill workflows.

2. **Read frontmatter.** For each discovered SKILL.md, extract the `name` and `description` fields from the YAML frontmatter.

3. **Group by category.** Organize skills into these groups based on their purpose:

   | Category | Skills |
   |----------|--------|
	   | **Planning & Design** | grill-me, ideate, thesis, ubiquitous-language, what-is-it-about |
	   | **Development** | audit-existing, execute-prd, execute-plan, kickoff, validate-plan, test-plan, hotfix, triage, parallel-optimization, process-tune |
	   | **Quality** | code-review, code-review-professional, review-gauntlet, review-adversarial, checkpoint |
   | **Specs & Requirements** | spec-review-adversarial, prd-acceptance, prd-validate (rubric: aers-readiness) |
   | **Investigation** | code-investigate, postmortem |
   | **Source Control** | pr, ship, sync-main, changelog |
   | **Operations** | k8s-verify, dep-audit, dep-migrate, env-check |
	   | **Team & Workflow** | work-item |
	   | **Session** | repo-status |
   | **Configuration** | configure |
   | **Meta** | skill-help, skill-audit, find-skills |

   This table is a suggested default. **Always read the filesystem first** — any skill not in the table goes to an "Other" category. If a project has skills in `.claude/skills/_project/`, include them under "Project-Specific". Non-skill assets (e.g. `pr-guardrail/` — a hook utility with no SKILL.md) should be excluded, not categorized.

4. **Present as a table** per category:

   ```
   ## Planning & Design

   | Skill | Description |
   |-------|-------------|
	   | `/thesis` | Interrogate the product or architectural thesis |
   | `/grill-me` | Stress-test a plan or design by walking every decision branch |
   ```

5. **Footer.** Add: `Run /skill-help <name> for detailed usage of any skill.`

### Detail Mode (`<name>` provided)

1. **Find the skill.** Look for `.claude/skills/<name>/SKILL.md`. If not found, search case-insensitively and suggest the closest match.

2. **Read the full SKILL.md.** Present to the user:
   - **Name and description** from frontmatter
   - **Purpose** — the first paragraph after the heading
   - **Arguments** — the arguments section if present
   - **Workflow summary** — the major phases/steps (headings only, not full content)
   - **When to use** — the "When to Use" section if present

3. **Format concisely.** Don't dump the entire SKILL.md — summarize the workflow into a readable overview.

## Rules

- **User-invokable only.** Only list skills at `.claude/skills/*/SKILL.md` (depth 1) unless frontmatter says `user-invocable: false`. Never list `_internal`, specialists, analysts, foundations, or writers nested under a parent skill.
- **Dynamic discovery.** Always read from the filesystem — don't hardcode the list. Projects add custom skills to `_project/`.
- **Concise output.** List mode should fit on one screen. Detail mode should give enough to use the skill without reading the SKILL.md.
- **Use "skill" terminology consistently.** This is a skills library; the slash command surface matches the skill names.
