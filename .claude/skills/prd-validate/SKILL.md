---
name: prd-validate
description: "Turn a rough story, BRD, AERS draft, or idea into an implementation-ready AERS. Interviews the author, closes ambiguity, generates missing sections. Use before planning, /kickoff, or /execute-prd."
model: opus
---

# /prd-validate — AERS Readiness Gate

**Purpose:** Take a requirements artifact (story, BRD, PRD, partial AERS, or plain-language ask) and turn it into an implementation-ready AERS through focused interview. Complements `/prd-acceptance` (post-implementation validation).

**Use before planning, `/kickoff`, or `/execute-prd`** when the requirements are still ambiguous.

## When to Use

- Requirements have ambiguity, missing sections, or unclear acceptance criteria
- A BRD, story, or partial AERS needs to be made implementation-ready
- Before planning, `/kickoff`, or `/execute-prd` on a new feature

## When NOT to Use

- Requirements are already implementation-ready — skip to `/plan` or `/kickoff`
- Verifying completed work — use `/prd-acceptance`
- You need the rubric itself — see `_internal/aers-readiness/SKILL.md`

## Arguments

- `<path>` — path to the requirements artifact. If not provided, scan common locations: `AERS.md`, `PRD.md`, `docs/plans/*.md` (most recent).
- `--refine-problem` — focus on problem refinement mode (vague problem → precise statement)
- `--full-spec` — produce a complete requirements specification (interview in batches)

## Rubric

This skill follows `_internal/aers-readiness/SKILL.md` for the full AERS checklist, section requirements, ambiguity priorities, and engineering hardening rules.

## Workflow

### Step 1: Read the Artifact

Read the provided file or scan for common locations. If nothing is found, ask:
> "No requirements artifact found. Tell me what you want to achieve in plain language."

### Step 2: Assess Current State

Scan the artifact against the AERS required sections (from `_internal/aers-readiness/SKILL.md`):
- Which sections exist and are complete?
- Which sections are missing?
- Which contain blocking ambiguity?

Report a quick readiness snapshot:
```
Current readiness: Partially ready

Present: Problem Summary, Scope, Functional Requirements
Missing: Closed Decisions, Data Models, Verification Matrix, Execution Preflight
Ambiguous: scope boundary (is X in or out?), delete semantics
```

### Step 3: Interview

Follow the interaction rules from `_internal/aers-readiness/SKILL.md`:
- One question at a time
- Prefer multiple-choice with recommended default
- Prioritize by risk (unclear problem > unclear scope > unclear business rules > defaults)
- Challenge ambiguity instead of smoothing over it

### Step 4: Generate Missing Sections

As answers come in, produce the lightest useful version of:
- gap report
- Closed Decisions section
- Open Decisions section
- Public API / interface section (when relevant)
- Data Models section (when relevant)
- example JSON or contract snippets where ambiguity exists
- Execution Preflight
- Verification Matrix
- UI Behavior Matrix (when UI work is involved)

### Step 5: Readiness Verdict

End with:
```
Readiness: Ready / Partially ready / Not ready

Blocking gaps:
- (list, or "None")

Recommended next step:
- /plan <path>  (if ready)
- Continue refining (if not ready)
```

## Modes

### Default mode

Upgrade an existing artifact into an AERS. Focus on closing ambiguity and adding missing sections.

### Problem refinement mode (`--refine-problem`)

Bias toward:
- turning solution-shaped requests back into problem statements
- surfacing stakeholder, scope, impact, root-cause, success, and assumption gaps
- producing a concise problem statement plus a gap map

### Full spec mode (`--full-spec`)

Bias toward:
- building a complete AERS through batched interview
- making acceptance criteria independently testable
- calling out assumptions, risks, and unresolved decisions explicitly

## CRITICAL: Do Not Guess

- Do NOT invent settled facts. If the author knows something, ask them.
- Do NOT silently choose architecture-impacting defaults when the choice is still open.
- Do NOT overwrite an existing artifact wholesale without showing proposed changes.
- Do NOT mark the artifact ready if blocking ambiguity remains.
- Do NOT stop at a business-oriented PRD if the user needs an engineering-executable output.
- Do NOT drift into implementation planning — that belongs in `/plan`.

## Contract

- **Inputs:** `<path>` to a requirements artifact, OR the artifact pasted into the conversation. Optional flags: `--refine-problem`, `--full-spec`. Embeds `_internal/aers-readiness` for the rubric.
- **Preconditions:** human operator is at the keyboard — this is an interactive interview, not a gate. Callers (`/kickoff`, `/execute-prd`) MUST NOT auto-invoke this skill from a non-interactive context.
- **Outputs:** an enriched AERS written back to the artifact path (or a sibling `AERS.md` when started from a non-file source); closed decisions inlined; a fresh readiness score per the rubric's automated check; a gap list for residual unresolved items.
- **Postconditions:** artifact moves toward `Ready` — but does not require it (`Partially ready` is an acceptable exit when residual gaps are documented as open decisions); callers can re-score with `_internal/aers-readiness` to confirm.
- **Failure modes:** non-interactive context detected → refuse to start and suggest `_internal/aers-readiness` for a deterministic score instead; user says "you choose" on a non-default question → propose a default and ask for confirmation, do not silently pick.
