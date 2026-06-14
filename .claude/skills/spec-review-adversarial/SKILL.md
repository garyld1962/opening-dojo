---
name: spec-review-adversarial
description: "Adversarially review PRDs, requirements, user stories, or acceptance criteria using 1–3 lens reviewers. Returns PASS/CONTESTED/REJECT."
model: opus
---

# /spec-review-adversarial — Adversarial Review of Specifications

**Purpose:** Stress-test business analysis work products (requirements, user stories, acceptance criteria, process flows) by applying adversarial reviewer lenses. Finds gaps, contradictions, and ambiguities BEFORE they become code defects. This skill reviews BA deliverables, not code -- use /code-review for code.

## When to Use

- A BA has produced requirements, user stories, or acceptance criteria for review
- You want to validate a PRD or feature specification before implementation begins
- A work item's acceptance criteria need a quality check
- You are about to start a sprint and want to catch ambiguity early

## When NOT to Use

- You need to review code -- use /code-review
- You need to review a code review -- use /review-gauntlet
- The deliverable is purely technical (architecture doc, API spec) -- use /code-review or a technical review

## Usage

```
/spec-review-adversarial <file-or-text>
/spec-review-adversarial docs/requirements/auth-flow.md
/spec-review-adversarial --ado 12345
/spec-review-adversarial --linear BF-42
/spec-review-adversarial --phase discovery
```

## Arguments

- `<file-or-text>` -- path to the BA deliverable or inline text to review
- `--ado <item-id>` -- fetch the work item from ADO and review its description + acceptance criteria
- `--linear <issue-id>` -- fetch the issue from Linear and review its description + acceptance criteria
- `--phase <phase>` -- override automatic phase detection (discovery, analysis, specification, validation)

## Step 1: Load the Deliverable

Obtain the BA work product:

1. If a file path is provided, read the file
2. If `--ado` or `--linear` is provided, use /work-item to fetch it
3. If inline text is provided, use that directly

Identify the deliverable type:
- **Requirements document** -- contains "shall", "must", "requirement", numbered items
- **User stories** -- contains "As a ... I want ... so that"
- **Acceptance criteria** -- contains "Given/When/Then" or checkbox lists
- **Process flow** -- contains sequential steps, decision points, swim lanes
- **PRD** -- contains sections like Overview, Goals, User Personas, Features

## Step 2: Detect Phase

Determine the BA phase to select appropriate lenses. Auto-detect from deliverable type, or use `--phase` override:

| Phase | Typical Deliverables | Lenses |
|-------|---------------------|--------|
| **Discovery** | Problem statement, stakeholder needs, market context | Skeptic, Devil's Advocate |
| **Analysis** | Requirements, process flows, gap analysis | Skeptic, Coherence, Devil's Advocate |
| **Specification** | User stories, acceptance criteria, detailed requirements | Skeptic, Coherence |
| **Validation** | Test plans mapped to requirements, traceability matrix | Coherence, Devil's Advocate |

## Step 3: Apply Reviewer Lenses

### Skeptic Lens

The Skeptic questions every assumption and asks "how do you know?"

Checks for:
- **Unsupported claims.** "Users prefer X" -- based on what evidence?
- **Vague quantifiers.** "Fast", "easy", "most users", "seamless" -- define the threshold
- **Missing metrics.** Success criteria without measurable targets
- **Assumed context.** References to systems, processes, or terms not defined in the document
- **Happy path bias.** Only describes what happens when everything works. What about errors, edge cases, timeouts, partial failures?
- **Missing personas.** Who is "the user"? Are there different user types with different needs?

Finding format:
```
[SKEPTIC-<N>] <severity> | Section: <reference>
  Claim: "<quoted text>"
  Challenge: <what is wrong or missing>
  Evidence needed: <what would resolve this>
```

### Coherence Lens

The Coherence reviewer checks internal consistency and completeness.

Checks for:
- **Contradictions.** Section A says X, Section B says not-X
- **Gaps in flow.** Step 3 produces output Y, but Step 4 expects input Z
- **Undefined terms.** A term is used but never defined, or defined differently in different places
- **Orphaned requirements.** A requirement is stated but no acceptance criteria cover it
- **Orphaned acceptance criteria.** AC exists but traces to no requirement
- **Missing states.** A status field has values A, B, C but the flow only describes transitions for A and B
- **Boundary ambiguity.** "Up to 10 items" -- is 10 included? What happens at 11?
- **Implicit ordering.** Steps described without specifying whether they are sequential, parallel, or unordered

Finding format:
```
[COHERENCE-<N>] <severity> | Sections: <ref-A> vs <ref-B>
  Conflict: <what contradicts or is incomplete>
  Impact: <what goes wrong if this is not resolved>
  Suggestion: <how to fix>
```

### Devil's Advocate Lens

The Devil's Advocate argues the opposite position and stress-tests decisions.

Checks for:
- **Alternative approaches.** "We chose X" -- why not Y? What was the trade-off analysis?
- **Worst-case scenarios.** What if this feature is used maliciously? At 100x expected scale? By a confused user?
- **Stakeholder conflicts.** Does this serve all stakeholders, or does it optimize for one at the expense of another?
- **Future fragility.** This design works now, but what known upcoming changes would break it?
- **Reversibility.** If this decision is wrong, how hard is it to undo?
- **Second-order effects.** If we do X, what does that imply for Y and Z?

Finding format:
```
[DEVIL-<N>] <severity> | Section: <reference>
  Position: "<the decision or claim being challenged>"
  Counter: <the opposing argument>
  Risk if ignored: <what could go wrong>
```

## Step 4: Severity Classification

Each finding is classified:

| Severity | Meaning |
|----------|---------|
| **Blocker** | Cannot proceed to implementation. Ambiguity or contradiction will cause incorrect code. |
| **High** | Significant gap that will likely cause rework or defects if not addressed. |
| **Medium** | Unclear area that could lead to misinterpretation. Should be clarified. |
| **Low** | Minor improvement. Nice to have but not blocking. |

## Step 5: Lead Judgment (Filter False Positives)

After all lenses run, apply lead judgment to filter results:

1. **Remove pedantic findings.** If a finding is technically correct but practically irrelevant (e.g., "you said 'fast' but in context the SLA is clearly defined elsewhere"), discard it.
2. **Merge duplicates.** If the Skeptic and Coherence lenses flag the same issue, keep the one with the better explanation.
3. **Downgrade over-severity.** If a finding is marked Blocker but the impact is actually limited, downgrade it.
4. **Preserve genuine issues.** Do not filter findings just because they are uncomfortable. The point is to find real problems.

Mark filtered findings with a note: `[Filtered: <reason>]`

## Step 6: Verdict

Calculate the verdict from unfiltered findings:

| Verdict | Criteria |
|---------|----------|
| **PASS** | 0 Blockers, 0 High. Deliverable is ready for implementation. |
| **CONTESTED** | 0 Blockers, >=1 High. Deliverable needs targeted revisions. |
| **REJECT** | >=1 Blocker. Deliverable has fundamental issues that must be resolved before implementation. |

## Step 7: Report

```
BA Adversarial Review: <deliverable title or file>

  Phase:    <Discovery | Analysis | Specification | Validation>
  Lenses:   <list of lenses applied>
  Verdict:  <PASS | CONTESTED | REJECT>

Findings: <total> (<N> Blocker, <N> High, <N> Medium, <N> Low)
Filtered: <N> findings removed by lead judgment

---

<findings grouped by lens, ordered by severity>

---

Summary
  <2-3 sentence overall assessment>

Recommended Actions
  1. <most critical action>
  2. <next action>
  ...

Tracking: <ADO/Linear reference if provided>
```

## Key Rules

1. **BA deliverables, not code.** This skill reviews requirements, stories, and criteria. For code, use /code-review.
2. **Specific, evidence-based findings.** Every finding must cite a specific section, quote the relevant text, and explain the issue concretely. "This could be clearer" is not a finding.
3. **Lead judgment is mandatory.** Raw adversarial output is noisy. The filtering step separates signal from pedantry.
4. **"I would have written it differently" is NOT a finding.** Style preferences are not defects. Only flag issues that would cause implementation problems.
5. **Respect the phase.** Discovery deliverables are intentionally less precise than specifications. Apply phase-appropriate standards.
6. **Severity must be justified.** A Blocker must explain what specific implementation harm results. If you cannot articulate the harm, it is not a Blocker.
