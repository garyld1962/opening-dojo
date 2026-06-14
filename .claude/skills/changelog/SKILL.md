---
name: changelog
description: "Use to generate a release from Conventional Commits. Groups commits since the last tag, auto-bumps the version, updates CHANGELOG.md, tags, and releases."
---

# /changelog -- Generate Changelog and Release

**Purpose:** Generate a changelog from Conventional Commits, calculate the next semantic version, update `CHANGELOG.md`, and optionally create a git tag and GitHub Release. Every changelog entry maps to a real commit -- nothing is fabricated. Project-agnostic -- adapts to any codebase.

## When to Use

- You are ready to cut a release
- You want to preview what has changed since the last release
- You need to update CHANGELOG.md before tagging

## Usage

```
/changelog                          # Auto-calculate version, full release
/changelog --version 2.1.0          # Explicit version override
/changelog --dry-run                # Preview changelog without writing anything
/changelog --no-tag                 # Update CHANGELOG.md but skip git tag and GitHub Release
```

## Arguments

- `--version <semver>` -- explicit version string (e.g., `2.1.0`). Overrides auto-calculation.
- `--dry-run` -- preview the changelog output without writing files, creating tags, or publishing releases
- `--no-tag` -- update CHANGELOG.md and commit, but do not create a git tag or GitHub Release

## Step 1: Determine Baseline

Find the most recent version tag:

```bash
git fetch --tags origin
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
```

If no tags exist, collect all commits on the main branch:

```bash
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$MAIN" ]; then
  git show-ref --verify --quiet refs/remotes/origin/master && MAIN=master || MAIN=main
fi
```

## Step 2: Collect Commits

Gather all commits since the last tag (or all commits if no tag):

```bash
if [ -n "$LAST_TAG" ]; then
  git log "$LAST_TAG"..HEAD --pretty=format:"%H %s" --no-merges
else
  git log --pretty=format:"%H %s" --no-merges
fi
```

Parse each commit subject line against Conventional Commits format:

```
<type>[optional scope][optional !]: <description>
```

Recognized types and their changelog sections:

| Type | Section | Bumps |
|------|---------|-------|
| `feat` | Features | minor |
| `fix` | Bug Fixes | patch |
| `perf` | Performance | patch |
| `refactor` | Refactoring | patch |
| `docs` | Documentation | -- |
| `test` | Tests | -- |
| `chore` | Maintenance | -- |
| `style` | Style | -- |
| `ci` | CI/CD | -- |
| `build` | Build | -- |
| `hotfix` | Bug Fixes | patch |

**Breaking changes:** A `!` after the type/scope or a `BREAKING CHANGE:` footer triggers a **major** bump.

Commits that do not match Conventional Commits format are grouped under "Other Changes."

## Step 3: Calculate Version

If `--version` was provided, use that. Otherwise, auto-calculate:

1. Parse the last tag as semver (e.g., `v1.3.2` -> `1.3.2`)
2. Determine the highest bump level from the collected commits:
   - Any breaking change -> **major** (`1.3.2` -> `2.0.0`)
   - Any `feat` -> **minor** (`1.3.2` -> `1.4.0`)
   - Any `fix`, `perf`, `refactor`, `hotfix` -> **patch** (`1.3.2` -> `1.3.3`)
   - Only `docs`, `test`, `chore`, `style`, `ci`, `build` -> **patch** (still worth a release if there are commits)
3. If no previous tag exists, start at `0.1.0`

## Step 4: Generate Changelog Entry

Build the changelog entry in this format:

```markdown
## [<version>] - <YYYY-MM-DD>

### Breaking Changes
- **<scope>:** <description> (<sha-short>)

### Features
- **<scope>:** <description> (<sha-short>)

### Bug Fixes
- <description> (<sha-short>)

### Performance
- <description> (<sha-short>)

### Refactoring
- <description> (<sha-short>)

### Other Changes
- <description> (<sha-short>)
```

Rules:
- Only include sections that have entries. Do not render empty sections.
- Breaking Changes always appears first if present.
- Each line includes the short SHA linking to the commit.
- If a commit has a scope, bold it: `**auth:** fix token refresh`.
- If no scope, just the description: `fix off-by-one in pagination`.
- Never fabricate entries. Every line must map to a real commit SHA.

## Step 5: Preview (Dry Run Check)

If `--dry-run` was specified:
- Print the generated changelog entry to the console
- Print the calculated version
- Print the commit count by type
- Do NOT write any files, create tags, or publish releases
- Stop here

## Step 6: Update CHANGELOG.md

Read the existing `CHANGELOG.md` if it exists. Insert the new entry at the top, after the title line.

If no `CHANGELOG.md` exists, create one:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [<version>] - <YYYY-MM-DD>
...
```

## Step 7: Commit the Changelog

```bash
git add CHANGELOG.md
git commit -m "chore(release): v<version>"
```

If `--no-tag` was specified, stop here.

## Step 8: Create Git Tag

```bash
git tag -a "v<version>" -m "v<version>"
git push origin "v<version>"
git push origin HEAD
```

## Step 9: Create GitHub Release

```bash
gh release create "v<version>" \
  --title "v<version>" \
  --notes "$(cat <<'EOF'
<changelog entry content>
EOF
)"
```

## Step 10: Report

```
Release: v<version>

  Commits:    <N> total (<breakdown by type>)
  Changelog:  CHANGELOG.md updated
  Tag:        v<version> (pushed)
  Release:    <GitHub Release URL>

  Bump:       <previous> -> <version> (<major|minor|patch>)
  Reason:     <what triggered the bump level>
```

## Key Rules

1. **Never fabricate entries.** Every changelog line must correspond to a real commit SHA. If a commit does not parse as Conventional Commits, put it in "Other Changes" with its SHA.
2. **Respect `--dry-run`.** Do not write files, create tags, or publish releases in dry-run mode.
3. **Breaking changes are prominent.** They get their own section at the top and trigger a major bump.
4. **Idempotent.** Running `/changelog` twice with the same commits and version produces the same output. Do not duplicate entries already in CHANGELOG.md.
5. **Tag format is `v<semver>`.** Always prefix with `v`: `v1.4.0`, not `1.4.0`.
6. **Do not skip the commit.** The changelog update itself gets committed with `chore(release): v<version>` before tagging.
