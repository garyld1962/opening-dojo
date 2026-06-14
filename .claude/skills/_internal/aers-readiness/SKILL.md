---
name: aers-readiness
description: "Reusable rubric defining the AERS (Agent-Executable Requirements Spec) readiness standard — required sections, closed-decision categories, ambiguity priorities, and interaction rules. Embedded by /prd-validate, /spec-review-adversarial, and /prd-acceptance. Not user-invokable."
user-invocable: false
internal: true
kind: reference
---

# AERS Readiness Rubric

Use this skill to evaluate or improve a requirements artifact before implementation planning.

**Preferred term:** **AERS** — Agent-Executable Requirements Spec.

## When to Use

- Scoring or shaping a requirements artifact against the readiness rubric
- Referenced internally by `/prd-validate`, `/kickoff`, and `/execute-prd` for their gates
- You need the authoritative definition of "implementation-ready"

## When NOT to Use

- You want an interactive interview to fix gaps — use `/prd-validate`
- Verifying a finished implementation — use `/prd-acceptance`
- Drafting a PRD from scratch — use `/ideate` first

## Input → Output Model

### Typical input

- business problem statement
- business-oriented PRD or BRD
- story or epic
- stakeholder notes
- partial engineering spec
- rough idea

### Expected output

- an **AERS** — a requirements artifact executable by engineers and coding agents with minimal re-interpretation

## Core Principle

> If the author already knows a fact, the artifact should say it.

Reduce execution drift by surfacing settled facts early.

## Relationship to Other Skills

- Use `/prd-validate` to run this rubric interactively
- Use `/kickoff` or `/execute-prd` after the artifact is ready
- Use `/plan` or `superpowers:writing-plans` for implementation planning (not this skill)
- BA plugin skills (`ba-problem-refiner`, `ba-spec-engineer`) can feed into this rubric

## Entry Modes

### Existing artifact

When the user provides a document (AERS, BRD, story, notes):
- Preserve what is already known
- Identify gaps
- Upgrade the artifact into an AERS

### Blank start

When the user only has an idea:
> "Tell me what you want to achieve in plain language. You do not need to format it yet — I will help turn it into a structured, implementation-ready artifact."

## Interaction Rules

- Ask one question at a time
- Prefer multiple-choice with a recommended default
- Explain why the question matters
- Challenge ambiguity instead of smoothing over it
- If the user says "you choose", propose a default and ask for confirmation

## What to Extract or Create

### Problem and outcome

- current pain, affected users, desired outcome, success signal

### Scope

- in scope, out of scope, MVP vs later

### Domain and workflow

- core entities, required vs optional fields
- enums/statuses/state transitions
- formulas, calculations, tie-breakers
- normalization, rounding, precision rules

### API / integration contract

- endpoints or actions, request/response shapes
- external systems, base URL or environment contracts

### UI behavior

- main surfaces/pages, create/edit/delete flow
- inline vs full-form editing
- empty/loading/error states, sort/filter ownership

### Quality and verification

- acceptance criteria, required test layers
- test data strategy, deterministic time strategy
- error-path expectations, empty-state expectations
- aggregation/reporting verification

### Execution context

- repo starting state, target framework/runtime version
- solution/workspace format, tooling assumptions
- integration test gating, package/project boundaries

## Prioritize Ambiguity by Risk

Ask about these first:

- unclear problem statement
- unclear actor/user
- unclear scope boundary
- unclear destructive behavior
- unclear source of truth
- unclear workflow/business rules
- unclear permissions/security boundary
- unclear calculation or normalization rules
- unclear stack/platform choice that changes implementation

Then ask about defaults:

- validation approach, styling system
- server vs client responsibility
- seed/bootstrap behavior
- test scope, test data ownership
- time determinism, error UX policy

## Required Sections in an Execution-Ready AERS

- Problem Summary
- Scope
- Functional Requirements
- Closed Decisions
- Open Decisions
- Public API or Public Interface
- Data Models
- Verification Matrix / Test Strategy
- Repo Starting State
- Tooling Assumptions
- Execution Preflight
- Definition of Done
- Readiness Assessment

### Closed Decisions

Mandatory. Include settled implementation choices:
- chosen stack/framework, validation approach, persistence choice
- delete semantics, styling system, migration/bootstrap behavior
- API contract style, testing expectations, required test layers
- test data creation strategy, time/clock determinism strategy
- error handling policy, normalization/precision/tie-breaker rules

### Open Decisions

List decisions still unresolved that could materially change implementation. Do not hide these in narrative prose.

### Public API / Interface

When the solution exposes code, APIs, commands, events, or library methods, define the intended public surface: public methods, endpoint set, CLI, event contract, service interface.

### Data Models

Define structures that callers, APIs, or persisted entities depend on: field names, required vs optional, type expectations, enum/state values, normalization rules.

### Verification Matrix

| Layer | Required | What Must Be Proven | Notes |
|---|---|---|---|
| API integration | Yes | CRUD, filtering, validation, 404 paths | Use real DB if practical |

At minimum decide: unit vs data vs API vs browser test layers, whether tests must create their own data, how time-sensitive logic is made deterministic, whether stats/reporting needs deep assertions.

### Execution Preflight

Before implementation begins, make explicit:
- target framework or runtime version
- empty repo vs scaffolded vs existing
- solution/project/workspace format
- whether scaffolding should happen first
- how integration tests are gated
- whether package/project boundaries already exist

### UI Behavior Matrix (when UI work exists)

| Surface | User Action | Expected Behavior | Validation / Error Notes |
|---|---|---|---|
| New item form | Click Save | Record created, redirect to detail | Inline field errors on invalid |

### Readiness Assessment

End with:
```
Readiness: Not ready / Partially ready / Ready

Blocking gaps:
- ...

Recommended follow-ups:
- ...
```

## Automated readiness check (for callers)

`/kickoff` and `/execute-prd` need to decide whether to suggest the
interactive `/prd-validate` interview or proceed without it. Use this
deterministic heuristic — do not invent your own.

Compute the readiness score by inspecting the artifact for the
**Required Sections** above. For each section:

- **Present and substantive** (not just a heading; has at least one
  concrete bullet, table row, or sentence specific to this work) →
  **0 points**.
- **Present but stub** (heading exists but body is "TBD" /
  "TODO" / empty / generic boilerplate) → **1 point**.
- **Missing entirely** → **2 points**.

Also score these high-risk ambiguity categories (each unresolved one
adds **2 points**):

- unclear problem statement
- unclear actor/user
- unclear scope boundary
- unclear destructive behavior
- unclear source of truth
- unclear permissions/security boundary
- unclear calculation/normalization rules
- unclear stack/platform choice that changes implementation

### Verdict thresholds

| Total points | Readiness | Caller behavior |
|---|---|---|
| `0–2` | **Ready** | Proceed without `/prd-validate`. Note any single gap inline. |
| `3–6` | **Partially ready** | **Suggest** `/prd-validate` to the operator, but do not auto-invoke. In autonomous mode (no human at the keyboard), proceed and log the gap list as a known risk. |
| `7+` | **Not ready** | **Do not** draft a plan. In interactive mode, suggest `/prd-validate` to close gaps. In autonomous mode, halt with `prd-not-ready` finding and the gap list. |

### Why "suggest, don't auto-invoke"

`/prd-validate` is an interactive interview, not a gate. Auto-invoking
it from a non-interactive context (CI, autonomous run, scheduled
agent) hangs waiting for input. Callers must respect the interaction
boundary: `/prd-validate` runs only when a human is supervising.

The score is the gate; the interview is the remedy.

## Engineering Hardening Rule

If the input is a business PRD, do not simply polish it. Transform it into an engineer-executable AERS by adding the missing required sections.

## Success Criteria

This rubric succeeds when:
- the artifact says what is already known
- unresolved ambiguity is explicit
- downstream planning no longer needs to re-derive core decisions
- test and UX expectations are clear enough to verify implementation later
- the output is clearly an AERS, not just a business PRD with nicer wording

## Contract

- **Inputs:** a requirements artifact in any flavor (PRD, BRD, story, notes, partial spec, prompt). Optional repo audit from `/audit-existing` for repo-specific readiness scoring.
- **Preconditions:** the artifact is text and readable; this is a reference rubric, not an interactive interview (`/prd-validate` is the interactive remedy).
- **Outputs:** a deterministic readiness score using the **Automated readiness check** above (`Ready` 0–2, `Partially ready` 3–6, `Not ready` 7+); a gap list keyed to required sections and high-risk ambiguity categories; either an upgraded AERS (when used as a transformation pass) or recommendations.
- **Postconditions:** caller (`/kickoff`, `/execute-prd`, `/prd-validate`, `/prd-acceptance`, `/spec-review-adversarial`) acts per the verdict thresholds; the artifact's existing closed decisions are preserved.
- **Failure modes:** artifact unreadable / not text → return `Not ready` with the file-access error in the gap list; never invent answers to close gaps; never auto-invoke `/prd-validate` from a non-interactive context.
