---
name: dep-migrate
description: "Plan a dependency migration: analyze breaking changes, assess impact on your codebase, produce a step-by-step migration plan. Use when upgrading Node, TypeScript, frameworks, or major dependencies."
model: opus
---

# /dep-migrate — Dependency Migration Planner

**Purpose:** Analyze breaking changes for a dependency upgrade and produce a codebase-specific migration plan. Reads the changelog, maps breaking changes to your code, estimates scope, and generates an ordered task list. Project-agnostic.

## When to Use

- Upgrading Node.js (e.g., 20 → 22)
- Upgrading TypeScript (e.g., 5.3 → 5.7)
- Upgrading a framework (React 18 → 19, Next.js 14 → 15, Express 4 → 5)
- Upgrading a major dependency (Vitest 1 → 2, ESLint 8 → 9)
- When `/dep-audit` flags a major version update

## When NOT to Use

- Patch/minor updates — just update and run tests
- Adding a new dependency — not a migration
- Removing a dependency — just delete it

## Usage

```
/dep-migrate typescript 5.3 5.7
/dep-migrate node 20 22
/dep-migrate react 18 19
/dep-migrate vitest 1 2
/dep-migrate eslint 8 9 --scope=packages/api
```

## Arguments

- `<package>` — the package or runtime to migrate (required)
- `<from-version>` — current version (required)
- `<to-version>` — target version (required)
- `--scope <path>` — limit analysis to a specific package/directory
- `--dry-run` — analyze only, don't write a plan file

## Step 1: Gather Breaking Changes

### Fetch Release Notes

Search for the official migration guide or changelog:

1. Check the package's repository for `CHANGELOG.md`, `MIGRATION.md`, or `UPGRADING.md`
2. Search for "migrating from <from> to <to>" in official docs
3. Check GitHub releases between the two versions
4. Use context7 to fetch up-to-date documentation if available

### Classify Changes

For each breaking change, classify:

| Type | Impact | Example |
|------|--------|---------|
| **API Removal** | Must fix — code won't compile/run | Removed `fs.exists()` |
| **API Rename** | Must fix — find-and-replace | `render()` → `createRoot().render()` |
| **Behavior Change** | May fix — tests will catch | Default encoding changed |
| **Type Change** | Must fix (TypeScript) | Return type widened/narrowed |
| **Config Change** | Must fix — build/runtime config | New config format required |
| **Default Change** | May fix — behavior differs silently | `strict: true` now default |
| **Deprecation** | Should fix — works now, breaks later | Warning on old API usage |
| **New Requirement** | Must fix — prerequisites | Requires Node >= 18 |

## Step 2: Scan Codebase for Impact

For each breaking change, search the codebase for affected code:

```bash
# Example: search for removed API usage
grep -r "oldApiName" --include='*.ts' --include='*.tsx' --include='*.js'

# Example: search for changed config format
find . -name "tsconfig.json" -o -name ".eslintrc.*" -o -name "vite.config.*"
```

For each hit:
- File path and line number
- Whether it's source code or test code
- Whether it's in a direct dependency or a wrapper/abstraction

### Impact Matrix

Build a matrix:

```
| Breaking Change | Files Affected | Severity | Auto-fixable |
|-----------------|----------------|----------|--------------|
| Removed X API | 5 files | High | Yes (rename) |
| New config format | 1 file | Medium | Yes (transform) |
| Behavior change Y | 12 files | Low | No (manual review) |
```

## Step 3: Check Dependency Compatibility

For major framework upgrades, check that key dependencies are compatible:

```bash
# Check if plugins/extensions support the new version
pnpm outdated --json | jq '.[] | select(.latest != .current)'
```

Common compatibility issues:
- ESLint plugins with new ESLint major versions
- Babel plugins with new TypeScript versions
- Testing libraries with new framework versions
- Build tool plugins (Vite, webpack) with framework upgrades

Flag any dependency that:
- Doesn't have a release compatible with the target version
- Has known issues with the target version (check GitHub issues)

## Step 4: Estimate Scope

| Files Affected | Scope | Approach |
|----------------|-------|----------|
| 0-5 | Small | Inline changes, no plan file needed |
| 6-20 | Medium | Plan file, single pass |
| 21+ | Large | Plan file, consider phased approach |

For large migrations, suggest a phased approach:
1. Phase 1: Update build config and fix compilation errors
2. Phase 2: Update API usage (auto-fixable changes)
3. Phase 3: Manual behavior change review
4. Phase 4: Update tests for new behavior
5. Phase 5: Remove deprecated usage

## Step 5: Write Migration Plan

Unless `--dry-run`, write to `docs/plans/YYYY-MM-DD-migrate-<package>-<from>-to-<to>.md`:

```markdown
# Migration: <package> <from> → <to>

## Summary
- **Package:** <name>
- **From:** <from-version>
- **To:** <to-version>
- **Scope:** <N> files affected across <M> packages
- **Estimated effort:** small / medium / large

## Prerequisites
- [ ] Verify all tests pass on current version
- [ ] Check dependency compatibility (see below)
- [ ] Create a migration branch

## Dependency Compatibility
| Dependency | Current | Compatible with <to>? | Action |
|------------|---------|----------------------|--------|
| <dep> | <ver> | Yes/No/Unknown | Update to <ver> / Wait / Replace |

## Breaking Changes & Tasks

### Task 1: <breaking change title>
**Type:** API Removal / Rename / Behavior Change / etc.
**Severity:** High / Medium / Low
**Files:** <list>
**Change:** <what to change>
**Auto-fixable:** Yes (codemod) / No (manual)

[For each breaking change...]

## Migration Order
1. Update package version in package.json / Cargo.toml / etc.
2. [ordered tasks based on dependency chain]
3. Run build — fix compilation errors
4. Run tests — fix behavior changes
5. Remove deprecated usage

## Rollback Plan
If the migration fails:
1. `git checkout <pre-migration-branch>`
2. Revert version in lock file
3. `pnpm install`

## Verification
- [ ] Build passes (`pnpm -r build`)
- [ ] All tests pass (`pnpm -r test`)
- [ ] No deprecation warnings in logs
- [ ] Smoke test key functionality
```

## Step 6: Report

```
Migration Analysis: <package> <from> → <to>

  Breaking changes: <N> found
  Files affected: <N> across <M> packages
  Auto-fixable: <N> of <N> changes
  Dependency conflicts: <N>

  Scope: small / medium / large
  Plan: <path to plan file>

  Top risks:
  1. <highest risk change>
  2. <next risk>

  Next: review the plan, then run /execute-plan to implement.
```

## Key Rules

1. **Research first.** Always read the official migration guide before scanning code. Don't rely only on changelogs — behavior changes are often documented separately.
2. **Don't migrate blindly.** Every change must be mapped to actual code in the codebase. A breaking change that doesn't affect your code is not a task.
3. **Test before and after.** The migration plan always starts with "verify tests pass" and ends with "run full test suite."
4. **Rollback is mandatory.** Every migration plan must include a rollback strategy.
5. **Phased is better than big-bang.** For large migrations, suggest incremental phases that can each be tested independently.
6. **Check the ecosystem.** A dependency upgrade often cascades — plugins, extensions, and complementary libraries may also need updates.
