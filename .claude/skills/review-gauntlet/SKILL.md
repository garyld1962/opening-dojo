---
name: review-gauntlet
description: "Use when a code review's conclusions need scrutiny. Reviews THE REVIEW via 3 lenses (Skeptic, Architect, Pragmatist). Returns SOLID / MIXED / UNRELIABLE."
---

# /review-gauntlet -- Meta-Review of Code Reviews

**Purpose:** Validate the quality of a code review by reviewing THE REVIEW itself, not the code. Catches inaccurate findings, missed structural issues, and impractical recommendations before the team acts on them. Use this when you want confidence that a code review's findings are trustworthy and actionable.

## When to Use

- After /code-review produces its report and you want a quality check on the review itself
- When a review has many findings and you want to separate signal from noise
- When findings feel wrong but you are not sure which ones
- Before acting on a review that would trigger significant rework

## When NOT to Use

- You need a code review -- use /code-review
- You need to review specs / BA deliverables -- use /spec-review-adversarial
- The review is short (< 5 findings) and clearly correct -- just act on it

## Usage

```
/review-gauntlet <review-file>
/review-gauntlet .code-review/review-latest.json
/review-gauntlet docs/code-reviews/2026-03-15-review.md
```

## Arguments

- `<review-file>` -- path to the code review report or verdict JSON (required)

## Step 1: Load the Review

Read the review file. Identify:
- The list of findings (with IDs, severity, file locations, descriptions, and fix recommendations)
- The overall verdict
- The specialists/reviewers that produced the findings
- The scope of files reviewed

## Step 2: Load the Source Code

For each finding, read the actual source file at the referenced location. You need the real code to verify whether each finding is accurate.

Do NOT rely solely on the review's description of the code. Read the code yourself.

## Step 3: Apply Three Lenses

### Skeptic Lens -- Accuracy

The Skeptic verifies that each finding is factually correct.

For each finding, check:
- **Does the code actually have this issue?** Read the file and line range. Is the finding describing what the code really does?
- **Is the severity justified?** A "Blocker" must have concrete harm. A "High" must have meaningful impact.
- **Is the rule citation correct?** If the finding references a convention (from CLAUDE.md, a style guide, or a best practice), verify the convention actually says what the finding claims.
- **Is the context complete?** Did the reviewer miss surrounding code that addresses the concern? (e.g., null check exists but on a different line than expected)
- **Is this a false positive?** Common false positives: flagging intentional patterns as mistakes, applying rules from one context to a different context, misreading type narrowing.

Finding format:
```
[SKEPTIC-<N>] Finding <original-ID> -- <ACCURATE | INACCURATE | OVERSTATED>
  Source: <file>:<lines>
  Review claims: "<quoted finding description>"
  Actual code: "<what the code actually does>"
  Assessment: <why this is accurate, inaccurate, or overstated>
```

### Architect Lens -- Structural Fitness

The Architect checks whether the review assessed the right things at the right level.

Checks:
- **Missed structural issues.** Did the review focus on syntax and style while missing architectural problems? (e.g., caught a missing null check but missed a circular dependency)
- **Tree-for-forest.** Did the review flag many small issues but miss the big picture? (e.g., 10 naming findings but no comment on the fact that the service bypasses the repository layer)
- **Scope appropriateness.** Are findings about things that matter for this type of change? (e.g., a hotfix getting flagged for not having Storybook stories)
- **Cross-cutting blindspots.** Did the review only look at individual files without considering how they interact? (e.g., reviewed the API handler but not the client that calls it)

Finding format:
```
[ARCHITECT-<N>] <MISSED | MISFOCUSED | APPROPRIATE>
  Area: <what structural concern was missed or misfocused>
  Evidence: <specific files or patterns that demonstrate the gap>
  Impact: <what could go wrong if the team acts on the review as-is>
```

### Pragmatist Lens -- Actionability

The Pragmatist checks whether the findings can actually be acted upon.

Checks:
- **Vague recommendations.** "Consider refactoring this" -- refactor HOW? Into WHAT?
- **Contradictory guidance.** Finding A says extract a function, Finding B says keep it inline.
- **Disproportionate effort.** A "Medium" finding that requires rewriting half the module to fix.
- **Missing context for fix.** The finding says what is wrong but not how to fix it, and the fix is non-obvious.
- **Blocked fixes.** The recommended fix would break something else that the review did not consider.
- **Nitpick inflation.** Style preferences dressed up as quality findings.

Finding format:
```
[PRAGMATIST-<N>] Finding <original-ID> -- <ACTIONABLE | VAGUE | DISPROPORTIONATE | CONTRADICTED>
  Recommendation: "<quoted fix recommendation>"
  Issue: <why this is not actionable as written>
  Suggested revision: <how to make it actionable, or "Drop -- nitpick">
```

## Step 4: Synthesize Verdict

Count the assessment results across all three lenses:

| Verdict | Criteria |
|---------|----------|
| **SOLID** | >= 80% of findings are accurate, no missed structural issues of High+ severity, >= 80% of recommendations are actionable |
| **MIXED** | 50-79% of findings are accurate, OR 1+ missed structural issues of High severity, OR 50-79% of recommendations are actionable |
| **UNRELIABLE** | < 50% of findings are accurate, OR 1+ missed structural issues of Blocker severity, OR < 50% of recommendations are actionable |

## Step 5: Report

```
Review Gauntlet: <review file>

  Review Verdict:   <original review's verdict>
  Gauntlet Verdict: <SOLID | MIXED | UNRELIABLE>

Accuracy (Skeptic)
  Accurate:     <N> findings
  Inaccurate:   <N> findings
  Overstated:   <N> findings
  Accuracy:     <percentage>

Structural Fitness (Architect)
  Missed:       <N> areas
  Misfocused:   <N> areas
  Appropriate:  <N> areas

Actionability (Pragmatist)
  Actionable:       <N> findings
  Vague:            <N> findings
  Disproportionate: <N> findings
  Contradicted:     <N> findings
  Actionability:    <percentage>

---

<findings from all three lenses, grouped by lens>

---

Recommendations
  Trust these findings: <list of original finding IDs that are accurate + actionable>
  Revise these findings: <list of finding IDs that are overstated or vague, with corrections>
  Drop these findings: <list of finding IDs that are inaccurate or nitpicks>
  Address these gaps: <list of structural issues the original review missed>
```

## Key Rules

1. **Review the review, not the code.** Your job is to validate the review's findings, not to produce your own code review. If you find something the review missed, flag it as an Architect finding -- do not create a parallel review.
2. **Read the actual source code.** Never evaluate a finding based only on the review's description. Always read the file yourself to verify.
3. **Cite specific finding IDs and source code.** Every assessment must reference the original finding by ID and the actual code by file and line. No hand-waving.
4. **"I would have said it differently" is NOT a finding.** Different phrasing, different organization, different emphasis -- these are not quality issues. Only flag things that are wrong, missing, or unactionable.
5. **Severity recalibration is valid.** If a finding is accurate but overstated (Blocker when it should be Medium), that is a Skeptic finding. The review is partially wrong about impact.
6. **Respect the review's scope.** If the review was a `--quick` check, do not penalize it for not covering everything. Evaluate it against its stated mode.
7. **False positives in the gauntlet are worse than in the review.** If you flag a review finding as inaccurate, you must be certain. When in doubt, call it "Accurate" -- err toward trusting the review.
