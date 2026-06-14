---
name: modernization-rubric
description: "Internal calibration rubric for /modernize. Encodes project-shape detection, sample-read strategy, per-theme finding patterns, admissible-moves matrix, and cull criteria. Embedded by /modernize. Not user-invocable."
user-invocable: false
internal: true
kind: reference
---

# Modernization Rubric

Internal contract called by `/modernize`. Encodes the calibration the skill applies when auditing a codebase against current AI toolchain capability. Do not invoke directly.

## 1. Project Shape Detection

### 1a. Language detection

Read root manifests in this order; the first match identifies the primary language:

| Manifest | Language |
|---|---|
| `package.json` | JavaScript / TypeScript (read `type`, `main`, `dependencies`) |
| `Cargo.toml` | Rust |
| `pyproject.toml` / `setup.py` / `requirements.txt` | Python |
| `go.mod` | Go |
| `*.csproj` / `*.sln` / `*.slnx` | C# / .NET |
| `pom.xml` / `build.gradle*` | Java / Kotlin |
| `mix.exs` | Elixir |
| `Gemfile` | Ruby |

If multiple language manifests exist, pick the language with the most LOC by source-file extension count.

### 1b. Type classification

| Type | Signals |
|---|---|
| **CLI** | `bin` field in `package.json` / `[[bin]]` in `Cargo.toml`; argv parsing visible at entry; no HTTP server import |
| **Library** | Exports a module API; entry point has no top-level execution; README has a "Usage" / "API" section |
| **App** | UI framework imported (React / Vue / Solid / Svelte / etc.); `index.html` present; build output configured |
| **Service** | HTTP framework imported (Express / Fastify / FastAPI / axum / Actix / Spring / etc.); server start visible at entry |
| **Monorepo** | Workspace config present (`pnpm-workspace.yaml` / `turbo.json` / Cargo `[workspace]` / `lerna.json` / etc.) — recurse into members |

A project may be more than one (e.g. a service that exposes a CLI). Use the dominant signal; note secondary in the report.

### 1c. Size class

| Class | LOC range | Behaviour |
|---|---|---|
| **Tiny** | <500 | Refuse — recommend `/simplify` or direct edit |
| **Small** | 500–5,000 | Standard audit |
| **Medium** | 5,000–50,000 | Standard audit, watch token budget |
| **Large** | 50,000–250,000 | Caution: sample-read strategy is mandatory |
| **Very large** | >250,000 | Halt — recommend per-package audit instead |

### 1d. Test coverage signal

| Signal | Heuristic |
|---|---|
| **Strong** | test:src LOC ratio >0.5; every public module has a test file |
| **Present** | ratio 0.2–0.5; some modules tested |
| **Thin** | ratio <0.2 or shallow tests dominate |
| **Absent** | no tests directory, no test files |

Test coverage gates which moves are admissible — refactors against an absent test base must include characterization tests as a prerequisite move.

### 1e. Detected patterns

Look for explicit architectural patterns:
- **Layered** — controllers / services / repositories
- **Hexagonal** — explicit ports / adapters
- **MVC** — model / view / controller separation
- **Functional core / imperative shell** — pure logic separated from side effects
- **None detected** — flat or ad-hoc

## 2. Admissible Moves By Shape

Cull recommendations against this matrix. A move that is "rarely" admissible for a shape needs a strong rationale; "no" is a hard cut to the out-of-scope appendix.

| Move | CLI | Library | App | Service | Monorepo |
|---|---|---|---|---|---|
| Introduce DI container | rarely | sometimes | sometimes | often | often |
| Hexagonal architecture | no | rarely | sometimes | often | sometimes |
| Workspace splitting | no | sometimes | sometimes | sometimes | often |
| Branded / nominal types | sometimes | often | often | often | often |
| Top-level error boundary | sometimes | no | often | often | often |
| Module-per-feature reorganization | sometimes | sometimes | often | often | often |
| Replace stringly-typed enum with discriminated union | often | often | often | often | often |
| Extract config module | sometimes | sometimes | often | often | often |
| Introduce result/either type for error handling | sometimes | often | sometimes | often | often |
| Characterization tests for untested logic | often | often | often | often | often |

Extend this matrix as new patterns are surfaced; do not silently apply moves outside it.

### Size-class admissibility

| Class | Max admissible blast radius (primary plan) |
|---|---|
| Small | up to 30% of files |
| Medium | up to 20% of files |
| Large | up to 10% of files |
| Very large | per-package only |

If a move exceeds the admissible blast radius, demote to the "Considered, not in primary plan" appendix.

## 3. Sample-read Strategy

**Do not read every file.** Sample by signal category and stop at the token-budget guardrail.

| Category | What to read |
|---|---|
| **Breadth** | First file (alphabetically) in every top-level directory |
| **Depth** | Top 5 modules by LOC, fully |
| **Boundaries** | Every `index.{ts,js,py}` / `__init__.py` / `mod.rs` / equivalent |
| **Public surface** | Every file re-exported from the package entry point |
| **Risk hotspots** | Files >500 LOC; files matching `utils*` / `helpers*` / `common*` / `lib*` / `misc*` (kitchen-sink heuristic) |
| **Test parity** | Spot-check: pick 3 representative source files, look for matching tests |

**Token guardrail:** stop reading when the cumulative read consumes 30% of the available context window. Synthesis (Phases 5–7 in the calling skill) needs the remaining headroom.

For monorepos, run sample-read per workspace member; do not mix workspaces in a single audit pass.

## 4. Per-theme Finding Patterns

Each finding pattern has a default severity. The calling skill may upgrade severity based on test-coverage signal or downgrade based on within-stack admissibility.

### 4a. Abstraction

| Pattern | Default severity |
|---|---|
| Function >100 LOC without natural break | medium |
| Class with >10 public methods | medium |
| Conditional nesting depth ≥3 | high |
| `Manager` / `Handler` / `Service` class that just holds state and forwards calls | medium |
| Inheritance chain ≥3 levels | medium |
| `switch` / `case` on stringly-typed dimension that should be a discriminated union | high |
| Function takes >5 positional args (no options object) | medium |

### 4b. Separation of concerns

| Pattern | Default severity |
|---|---|
| Business logic in HTTP handler / UI component | high |
| File mixing >2 concerns (e.g. API call + transform + UI render) | medium |
| Module A imports module B's internal types | high |
| Circular dependency | high |
| Side effects at module top level (not inside `main` / init function) | medium |
| Constants defined in feature modules instead of a shared module | low |

### 4c. Types

| Pattern | Default severity |
|---|---|
| `any` / `unknown` cast not at a JSON / external boundary | high |
| Untyped dict / kwargs proliferation (Python) | medium |
| Repeated string literal that should be a typed enum | medium |
| Stale type comments instead of annotations (e.g. Python `# type:` comments) | low |
| Type assertion instead of type narrowing | medium |
| Optional / nullable everywhere ("just in case") | medium |

### 4d. Errors

| Pattern | Default severity |
|---|---|
| Bare `catch` / `except` swallowing the error | high |
| Caught error logged and execution continues silently | high |
| Error returned as `null` / `undefined` instead of typed error | medium |
| Same error message in multiple places (string-comparison-based handling) | low |
| Error handling path not exercised by any test | medium |
| Generic `Error` thrown where a typed subclass exists | low |

### 4e. Tests

| Pattern | Default severity |
|---|---|
| Test file present but only 1–2 trivial cases | medium |
| Mocked-everything test (no real boundary tested) | medium |
| Snapshot test against opaque output (no assertions on shape) | low |
| Test names that just repeat the function name | low |
| No edge-case tests on the trickiest modules | high |
| Test imports source's internal helpers (private API) | medium |

### 4f. Infra

| Pattern | Default severity |
|---|---|
| Hardcoded URLs / API keys / paths in source | high |
| Settings scattered across files instead of one config module | medium |
| Build config has stale optimizations or missing modern defaults | medium |
| No `.env.example` / no config schema | low |
| CI YAML duplicates `package.json` scripts inline | low |
| Logging without structured fields (printf-style only) | medium |

## 5. Cull Criteria

Apply each in order. Anything that fails one is cut from the primary plan or demoted per the rule.

### 5a. Senior engineer test
"Would a senior engineer with no prior codebase context, given a clear before / after, agree the after is better?" If no → cut.

### 5b. Stylistic-preference test
"Is this an objective improvement, or a taste call?" Cut taste calls. Examples (always cut):
- Variable renames for personal style
- Switching between equivalent idioms (for-loop ↔ forEach ↔ map)
- Reformatting whitespace
- Switching between quote styles or trailing-comma rules

### 5c. Within-stack test
"Does this stay inside the current platform / stack?" Items that fail are demoted to the **out-of-scope** appendix (not deleted — surfaced for human decision):
- "Replace Express with Fastify"
- "Switch from npm to bun"
- "Migrate from REST to GraphQL"
- "Rewrite in Rust"

### 5d. Blast-radius vs. impact test
For high-blast-radius moves, demand proportional impact:

| Blast radius | Required impact |
|---|---|
| <5% of files | any impact tier |
| 5–15% | medium or high |
| 15–25% | high |
| >25% | high AND a verifiable benchmark (perf, type-error count, test-coverage delta) |

Demote anything that doesn't clear the bar.

### 5e. Cap test
Keep top `--max-moves` by `(impact_score × ease_score)` where:
- impact: high=3, medium=2, low=1
- ease: low (effort)=3, medium=2, high (effort)=1

Move the remainder to the **"Considered, not in primary plan"** appendix.

## 6. Output Contract

The calling skill (`/modernize`) expects findings in this shape per move:

```yaml
move:
  theme: abstraction | separation | types | errors | tests | infra
  pattern: <which pattern from §4 — name or one-line summary>
  examples:
    - file: src/lib/foo.ts
      line: 42
      excerpt: "..."
    # (max 3 examples per move)
  proposed_state: "..."  # one paragraph
  impact: high | medium | low
  ease: low | medium | high  # ease of execution; low=easy
  blast_radius: <integer file count>
  rationale: "..."  # one sentence — why this is a win
  scope_status: in-scope | out-of-scope | considered-not-primary
  acceptance:
    - "<mechanically verifiable criterion>"
    # at least one; ideally 2–3
```

The calling skill assembles these into a plan format consumable by `/execute-prd --type=refactor` (Tasks with Acceptance bullets, characterization tests first per refactor task shape).
