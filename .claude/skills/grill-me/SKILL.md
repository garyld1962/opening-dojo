---
name: grill-me
description: "Use when user says 'grill me', wants to stress-test a plan, or validate assumptions. Walks the decision tree one question at a time, exploring the codebase when it can."
model: opus
---

# /grill-me -- Decision Stress Test

**Purpose:** Interview the user relentlessly about a plan, design, or architectural decision until every branch of the decision tree is resolved. Surfaces implicit assumptions and unexamined trade-offs BEFORE implementation begins.

## When to Use

- Before committing to an architectural decision in `/plan`
- After drafting a PRD or design doc — to find the gaps
- When a plan "feels right" but hasn't been challenged
- When the user explicitly wants their thinking stress-tested

## Arguments

- _(none)_ — grill on whatever plan/design is in context
- `<file>` — read the specified plan file and grill on its contents

## Workflow

### 1. Identify the Decision Space

Read the plan, design, or conversation context. Map the major decision branches:
- What are the key architectural choices?
- What are the assumptions (stated and unstated)?
- Where are the trade-offs?
- What's been decided vs. what's still open?

### 2. Walk the Decision Tree

For each branch, one question at a time:

1. **Ask one question.** Be specific. Provide your recommended answer.
2. **Wait for the response.** Don't batch questions.
3. **Follow up** if the answer opens new branches.
4. **Resolve dependencies** — if Decision B depends on Decision A, resolve A first.

### 3. Explore Instead of Asking (When Possible)

Before asking a question, check: **can the codebase answer this?**

- "What ORM does the project use?" → Read `package.json`, don't ask.
- "Is there an existing auth middleware?" → Search the codebase, don't ask.
- "What's the current test coverage pattern?" → Read test files, don't ask.

Only ask the user questions that require **human judgment** — priorities, trade-offs, business rules, stakeholder preferences.

### 4. Summarize Resolution

After all branches are resolved, output a compact summary:
```
## Decisions Resolved

1. **[Decision]**: [Chosen approach] — because [reason]
2. **[Decision]**: [Chosen approach] — because [reason]

## Assumptions Confirmed
- [Assumption that was validated]

## Open Items (if any)
- [Thing that still needs investigation]
```

## Question Quality

Good questions:
- "The plan uses a single database for both tenants. Have you considered the blast radius if one tenant's migration fails — should we isolate schemas?"
- "This service calls three external APIs sequentially. What's the timeout budget? If the third API is slow, do we fail the whole request or return partial data?"

Bad questions:
- "Have you thought about error handling?" ← Too vague
- "What language should we use?" ← Answerable from the codebase
- "Is this a good idea?" ← Not actionable

## Rules

- **One question at a time.** Never batch questions — it dilutes focus.
- **Provide your recommended answer.** Don't just ask — propose.
- **Explore before asking.** If the codebase can answer it, don't waste human attention.
- **Follow the dependencies.** Resolve upstream decisions before downstream ones.
- **Be relentless but respectful.** The goal is thoroughness, not antagonism.
- **Stop when done.** When all branches are resolved, summarize and stop. Don't manufacture questions.
