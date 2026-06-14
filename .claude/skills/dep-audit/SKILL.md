---
name: dep-audit
description: "Audit project dependencies: check for vulnerabilities, outdated packages, unused deps, and license compliance. Use periodically or before releases."
---

# /dep-audit — Dependency Health Check

**Purpose:** Comprehensive audit of project dependencies — security vulnerabilities, outdated packages, unused dependencies, and license compliance. Project-agnostic — adapts to npm/pnpm/yarn/cargo/pip.

## When to Use

- Before cutting a release
- Periodically (monthly or per-wave) for hygiene
- After adding new dependencies
- When investigating supply chain concerns
- When a CVE advisory drops for a dependency you might use

## Usage

```
/dep-audit                           # Full audit
/dep-audit --security-only           # Just vulnerability check
/dep-audit --check outdated          # Just outdated packages
/dep-audit --check unused            # Just unused dependency detection
/dep-audit --check licenses          # Just license compliance
```

## Arguments

- `--security-only` — run only the vulnerability audit (fastest)
- `--check <type>` — run a specific check: `outdated`, `unused`, `licenses`, `security`
- `--fix` — auto-update patch-level vulnerable dependencies (security only)

## Step 1: Detect Package Manager

Read `CLAUDE.md` and project root for:

| File | Manager | Lock File |
|------|---------|-----------|
| `pnpm-workspace.yaml` or `pnpm-lock.yaml` | pnpm | `pnpm-lock.yaml` |
| `package-lock.json` | npm | `package-lock.json` |
| `yarn.lock` | yarn | `yarn.lock` |
| `bun.lock` | bun | `bun.lock` |
| `Cargo.toml` | cargo | `Cargo.lock` |
| `requirements.txt` or `pyproject.toml` | pip/uv | varies |

If monorepo, identify all workspace packages.

## Step 2: Security Vulnerabilities

### Node.js (pnpm/npm/yarn)

```bash
pnpm audit --json 2>/dev/null || npm audit --json 2>/dev/null
```

Parse results and classify:

| Severity | Action |
|----------|--------|
| Critical | **FAIL** — must fix before release |
| High | **WARN** — should fix, check if exploitable in your context |
| Moderate | **INFO** — note for backlog |
| Low | **INFO** — note only |

For each vulnerability:
- Package name and version
- Vulnerability ID (CVE/GHSA)
- Severity and CVSS score
- Fix available? (patched version)
- Is it a direct or transitive dependency?

### Rust (cargo)

```bash
cargo audit 2>/dev/null
```

If `cargo-audit` not installed, note it and skip.

### Python (pip)

```bash
pip-audit --format json 2>/dev/null || safety check --json 2>/dev/null
```

## Step 3: Outdated Packages

### Node.js

```bash
pnpm outdated --json 2>/dev/null || npm outdated --json 2>/dev/null
```

Classify updates:

| Type | Risk | Example |
|------|------|---------|
| Patch | Low | 1.2.3 → 1.2.4 |
| Minor | Medium | 1.2.3 → 1.3.0 |
| Major | High | 1.2.3 → 2.0.0 |

Report:
- Total outdated count
- Major updates (list each — these need migration plans)
- Patch/minor updates available

### Rust

```bash
cargo outdated 2>/dev/null
```

## Step 4: Unused Dependencies

### Node.js

Check each dependency listed in `package.json` files:

For each `dependencies` and `devDependencies` entry:
1. Search the source tree for imports of that package
2. Check if it's used in scripts (build tools, CLI tools)
3. Check if it's a type-only dependency (`@types/*`)

```bash
# For each dependency, check if it's imported anywhere
grep -r "from ['\"]<package>" src/ --include='*.ts' --include='*.tsx' --include='*.js'
grep -r "require(['\"]<package>" src/ --include='*.ts' --include='*.js'
```

Classify:
- **Definitely unused**: no imports found anywhere in source or config
- **Possibly unused**: only imported in one place (flag for review)
- **Build tool**: used in scripts/config only (webpack, vite, eslint plugins, etc.)

## Step 5: License Compliance

### Node.js

```bash
npx license-checker --json --production 2>/dev/null
```

Or manually parse `package.json` license fields.

Classify licenses:

| Category | Licenses | Risk |
|----------|----------|------|
| Permissive | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD | PASS |
| Weak Copyleft | LGPL-2.1, LGPL-3.0, MPL-2.0 | WARN — review usage |
| Strong Copyleft | GPL-2.0, GPL-3.0, AGPL-3.0 | FAIL — may require your code to be open source |
| Unknown | UNLICENSED, missing, custom | WARN — review manually |

## Step 6: Auto-Fix (with `--fix`)

Only for security vulnerabilities with available patches:

```bash
pnpm audit --fix 2>/dev/null || npm audit fix 2>/dev/null
```

Only apply patch-level fixes automatically. For minor/major version bumps, report them as manual actions.

After fixing:
```bash
pnpm install  # Regenerate lock file
pnpm -r build # Verify build still works
```

## Step 7: Report

```
## Dependency Audit

**Manager:** pnpm | **Workspaces:** N | **Total deps:** N

### Security
| Severity | Count | Fixable |
|----------|-------|---------|
| Critical | N | N |
| High | N | N |
| Moderate | N | N |
| Low | N | N |

[List critical/high vulnerabilities with CVE IDs]

### Outdated
- Major updates available: N [list]
- Minor updates available: N
- Patch updates available: N

### Unused (suspected)
- Definitely unused: [list]
- Possibly unused: [list]

### Licenses
- Permissive: N
- Weak copyleft: N [list]
- Strong copyleft: N [list — REVIEW REQUIRED]
- Unknown: N [list]

### Verdict: CLEAN / NEEDS ATTENTION / CRITICAL

[CLEAN: no critical/high vulns, no copyleft concerns]
[NEEDS ATTENTION: has high vulns or copyleft deps]
[CRITICAL: has critical vulns or AGPL/GPL deps in production]
```

## Key Rules

1. **Read-only by default.** Only `--fix` makes changes, and only patch-level security fixes.
2. **Context matters.** A critical vulnerability in a dev-only tool is less urgent than a moderate vulnerability in a production HTTP parser.
3. **Don't cry wolf.** Only flag unused deps you're confident about. Build tools, PostCSS plugins, and type packages are easily missed by import scanning.
4. **License is not legal advice.** Flag potential issues but recommend the user consult their organization's open source policy for copyleft questions.
5. **Transitive vs direct.** Always note whether a vulnerable package is a direct dependency (you can fix it) or transitive (you need the parent to update).
