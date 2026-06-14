---
name: ideate
description: "Use before /plan or brainstorming to shape a rough ask, doc, or folder into a direction. Three modes: idea (general), ba (business-analysis), tech (technical options)."
model: opus
---

# /ideate — Explore and Shape Ideas

**Purpose:** Take a rough idea, a single document, or a folder of related documents and turn them into a clear direction with identified options, risks, and next steps. Does NOT produce implementation plans — use `superpowers:brainstorming` or `/plan` after the direction is chosen.

## When to Use

- Rough idea or scattered docs need shaping into a coherent direction
- Deciding between multiple technical or business approaches
- Upstream of `/plan` or `superpowers:brainstorming`, when the problem itself isn't framed yet

## When NOT to Use

- Direction is already clear — jump to `superpowers:brainstorming` or `/plan`
- You need an implementation plan — use `/plan`
- Requirements exist but are ambiguous — use `/prd-validate`

## Arguments

- `<mode>` — optional first arg: `idea` (default), `ba`, `tech`
- `<path-or-description>` — document path, folder path, or plain-language idea

Examples:
```
/ideate "We need a better enterprise onboarding experience"
/ideate ba docs/discovery/
/ideate tech docs/architecture/integration-notes.md
```

## Modes

| Mode | When to use | Deepens into |
|---|---|---|
| `idea` (default) | General idea shaping and option framing | Concept, options, what to validate next |
| `ba` | Business process, stakeholder alignment, workshop prep | Process, scope, assumptions, dependencies, workshop outputs |
| `tech` | Technical directions, architecture options, systems impact | Constraints, integration, architecture tradeoffs, validation steps |

If no mode is supplied, default to `idea`. Lean toward `ba` when the ask is primarily about business process or stakeholder alignment.

## Input Modes

### Single document

When the user provides one artifact (BRD, PRD, story, notes, proposal, architecture doc):
- Extract what the document already says
- Identify what it implies
- Surface gaps and open questions
- Turn it into a clearer ideation output

### Folder of documents

When the user provides a folder:
- Identify the most relevant files (don't read everything)
- Synthesize repeated themes
- Surface contradictions and missing decisions
- Name which files drove the conclusions

### Blank start

When the user has only a rough idea:
> "Tell me what you want to achieve in plain language. I'll help shape it into something we can explore with stakeholders."

## Shared Starting Flow (All Modes)

Always establish the lightest useful version of:
- Problem or opportunity
- Affected users or stakeholders
- Desired outcome
- Known facts
- Assumptions and risks
- Major open questions
- Plausible directions

Then branch by mode.

## Interaction Rules

- Ask one question at a time
- Prefer multiple-choice with a recommended default when practical
- Start with high-leverage ambiguity, not formatting
- Distinguish facts, assumptions, risks, and open questions
- If the user says "you choose," propose a default and explain the tradeoff
- Do not force implementation details during early ideation

## Outputs (lightest useful set)

### Idea framing
- Problem statement, affected users, desired outcome, success signals

### Scope shaping
- In scope, out of scope, MVP, later-phase ideas

### Option analysis (when multiple directions are plausible)
- Summary, benefits, tradeoffs, delivery/data/integration impact, recommendation

### Assumptions and gaps
- Known facts, assumptions, risks, dependencies, open decisions

### BA mode additions
- Current/future state, process friction, operational changes
- Workshop-ready: problem framing, stakeholder question set, decision agenda, parking lot

### Tech mode additions
- Systems touched, ownership boundaries, affected interfaces
- Data flows, source-of-truth concerns, integration patterns
- Major technical risks, spikes/experiments worth running
- Technical workshop brief: objective, systems in play, decision areas

## Output Patterns

### Quick synthesis
```
Idea summary

What appears to be true
- ...

What is still assumed
- ...

What needs a decision
- ...

Recommended next step
- ...
```

### Workshop brief
- Objective, participants, context summary, key questions, option areas, decisions to leave with

### Direction recommendation
- Recommendation, why this direction, tradeoffs to accept, what to validate next

## Handoff Guidance

At the end, recommend the next workflow:
- Continue ideation (more questions to resolve)
- Write/upgrade a BRD, PRD, AERS, or story → `/prd-validate`
- Design the solution → `superpowers:brainstorming`
- Plan the implementation → `/plan`
- Do not jump to `/plan` until the direction is clear enough to plan

## CRITICAL: Do Not Guess

- Do NOT invent certainty not supported by the source material or user input.
- Do NOT read every file in a folder if a smaller set establishes the pattern.
- Do NOT force technical implementation details during early ideation unless they materially change the business decision.
- Do NOT turn routine implementation defaults into workshop decisions.
- Do NOT jump to `/plan` until the direction is chosen.
- Do NOT lose shared ideation context when switching from `idea` into `ba` or `tech` mode.

## Contract

- **Inputs:** a rough ask, a single document path, or a folder of related documents; mode flag (`idea` | `ba` | `tech`, default `idea`).
- **Preconditions:** human operator at the keyboard (this is interactive ideation, not autonomous synthesis); inputs are readable.
- **Outputs:** a direction document with identified options, risks, closed decisions where settled, and explicit open questions. Hands off to `/prd-validate`, `/plan`, or `superpowers:brainstorming` once the direction is chosen.
- **Postconditions:** the artifact is concrete enough to drive `/prd-validate` or `/plan`; routine implementation defaults are NOT promoted into workshop decisions; mode-switch transitions preserve shared context.
- **Failure modes:** input too vague for any mode → ask one clarifying question and stop; multi-document inputs disagree on direction → surface the conflict, do not silently average them.
