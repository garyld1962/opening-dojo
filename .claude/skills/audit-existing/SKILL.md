---
name: audit-existing
description: "Audit a repository before planning or extending it. Produces an implemented/missing/duplicated/broken checklist without editing files."
---

# audit-existing

Purpose: produce a fast, structured inventory of what exists before code
generation begins. This prevents plans from assuming greenfield state and
surfaces duplicated contracts, missing tests, and broken wiring early.

## When to Use

- Before `/execute-prd` drafts a plan from a PRD/prompt/RFC.
- When the requirements source predates the repo and may be out of sync.
- When a user asks "what's already here?" before extending a package.

## When NOT to Use

- The repo is provably greenfield (an empty workspace stub) and the
  requirement is to scaffold from zero — `/execute-prd` will say so and
  skip the audit.
- You need to *change* code — this skill is read-only by contract.

## Workflow

1. Read repo instructions (`CLAUDE.md`) and the active requirements
   source, if any.
2. List source files, manifests, configs, schemas, migrations, and tests.
3. Identify implemented surfaces by package/module.
4. Compare current state to the requested scope.
5. Flag duplicated public contracts/constants, mismatched API/runtime
   types, missing validation, missing failure-path tests, and
   generated/native artifacts that may need runtime probes.
6. **Classify external dependencies** using `_internal/dependency-classification/SKILL.md`. Flag miscategorizations as test gaps — e.g., Postgres mocked instead of substituted with PGLite, internal services treated as true-external, filesystem mocked instead of using `memfs`. These miscategorizations are coverage smells: tests pass but exercise the mock, not the real semantics.
7. Return an audit only; do not edit files.

## Output

```markdown
## Existing State
- Package/module: implemented surfaces and key files

## Missing Or Partial
- Requirement or surface: evidence

## Duplicated Or Divergent Contracts
- Contract: locations and risk

## Test And Verification Gaps
- Gap: suggested focused verification

## Planning Implications
- Tasks or ownership constraints the execution plan should include
```

Keep it concise and cite file paths. If the repo is genuinely greenfield,
say so and list the evidence.

## Things you must not do

- Do not edit files. The audit is read-only by contract.
- Do not propose fixes — only surface gaps. Fixes are the planner's job.
- Do not duplicate work `/code-review` does. Audit is *what exists*, not
  *what's wrong with what exists*.

## Contract

- **Inputs:** repository path (default cwd); optional scope hints from the calling skill. Calls `_internal/dependency-classification` to label dependencies (mocked / substituted / real).
- **Preconditions:** in a git repo (or a directory with a recognisable project shape); read access only — never modifies the working tree.
- **Outputs:** structured audit report listing existing packages, public surfaces, persistence layout, current verification posture, dependency classifications, and gaps relative to the requested feature scope.
- **Postconditions:** caller (`/execute-prd`, `/modernize`) consumes the audit as a plan input; the audit reports state-of-the-repo, not opinions about state-of-the-repo.
- **Failure modes:** repo unreadable → halt; asked to propose fixes → refuse and surface the request as a finding (fixes belong to the planner); duplication with `/code-review` requested → refuse — audit is "what exists", review is "what's wrong with what exists".
