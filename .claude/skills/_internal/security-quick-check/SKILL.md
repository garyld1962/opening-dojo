---
name: security-quick-check
description: "Reusable 7-point security review for diffs. Embedded by /hotfix (mandatory), /pr, /ship, /code-review (conditional, per canonical trigger criteria). Not user-invokable."
user-invocable: false
internal: true
kind: embedded
---

# Security Quick Check

A focused, low-cost security pass over the current diff. Designed to catch the OWASP-flavored mistakes that a hurried implementer most commonly introduces. **Not** a substitute for full threat modeling or a security review on architecturally significant changes.

## When to Use

Embed this rubric in any skill that ships code without going through full `/code-review`.

### Per-skill invocation policy

| Caller | Policy | Notes |
|---|---|---|
| `/hotfix` | **mandatory** | The one review step you never skip on an expedited fix. |
| `/pr`, `/ship` | **conditional** | Apply when the diff matches the canonical trigger criteria below. |
| `/code-review` | **conditional** | When a fast security pass is warranted (e.g. `breakpoint` profile on sensitive paths). |

### Canonical trigger criteria

Apply (or keep applying) the rubric when the diff:

**Touches sensitive functional surfaces** (any of):
- Authentication / authorization / session handling.
- Input handling at a trust boundary (HTTP handlers, RPC, message consumers, CLI entrypoints).
- Rendering of user-controlled content (HTML, templates, markdown-to-HTML, URL construction).
- Persistence (SQL, ORM, file I/O, deserialization).
- Cryptography, secret handling, signing, verification.

**Touches sensitive paths** (any glob below, by default):
```
src/auth/**
src/payments/**
src/billing/**
src/session/**
**/crypto/**
**/security/**
migrations/**
db/schema/**
```

A consumer repo may extend this list via its CLAUDE.md `## Commands`
section under a `security_trigger_paths:` key (additive, not
replacement).

### Skip criteria

Skip when the diff is purely cosmetic — formatting, comments, docs,
type-only changes with no runtime behavior — even if it touches a
sensitive path.

## The 7 Points

For the current diff, verify each:

1. **No new secrets or credentials committed.**
   - No API keys, tokens, passwords, connection strings, or private keys in source, configs, or fixtures.
   - No `.env`, `.pem`, `.key`, or credential JSON files added.
   - Check both added lines and any new files.

2. **No injection vulnerabilities introduced.**
   - SQL: no string concatenation or interpolation building queries — parameterized queries only.
   - Shell: no unescaped user input passed to `exec`, `system`, `child_process.exec`, `os.system`, etc.
   - LDAP, NoSQL, XPath, command injection: same rule.

3. **No auth or authorization bypasses.**
   - New routes, handlers, or RPC methods enforce authentication where peers do.
   - Authorization checks (role, ownership, tenant) preserved on modified handlers.
   - No `// TODO: add auth` left in production paths.

4. **Input validation remains intact.**
   - Removed validation must be replaced, not silently dropped.
   - New inputs validated at the trust boundary (size, type, range, allowed values).
   - Trust-boundary fields (IDs, paths, URLs, redirects) cannot be attacker-controlled without checks.

5. **No unsafe dynamic code execution.**
   - No new `eval`, `Function(...)`, `exec`, `vm.runInThisContext`, or equivalent.
   - No dynamic `require`/`import` of attacker-controllable paths.
   - No deserialization of untrusted data with formats that allow code execution (pickle, Java serialization, YAML `!!python/object`).

6. **No unescaped user content rendered as HTML.**
   - Templating uses auto-escaping; raw/`unsafe`/`{{{...}}}` blocks are explicitly safe.
   - No `innerHTML = userInput` or React `dangerouslySetInnerHTML` with non-sanitized data.
   - URLs in `href`/`src` validated against `javascript:` and `data:` schemes where relevant.

7. **No raw SQL string interpolation.**
   - Even when input "looks safe," all SQL goes through parameterized queries or a query builder.
   - Dynamic identifiers (table/column names) come from an allow-list, never user input.

## Output Format

When invoked, produce one of:

- **PASS:** "Security quick check: 7/7 clear." — no findings, proceed.
- **FAIL:** Bulleted list of findings with file/line and which point failed:

  ```
  Security quick check: 2 findings.
  - [#2 injection] src/api/users.ts:48 — query built via template string with `name` from req body
  - [#6 unescaped HTML] src/views/profile.tsx:22 — dangerouslySetInnerHTML on `bio` without sanitizer
  ```

Findings block the calling workflow until resolved. The user may override (`--security-override <reason>`) only on hotfix when explicitly justified.

## Rules

- **Diff-scoped, not codebase-scoped.** Only review what changed. A pre-existing issue in untouched code is out of scope here — surface it as a separate note.
- **No false-positive theater.** If a flagged pattern is provably safe in context (constant input, internal-only path, escaped by a verified helper), say so and pass. Do not pad findings.
- **One screen.** Default output fits on a screen. Cite the rule number so the caller can trace.
- **Not a replacement for full review.** This is the fast path. Architecturally significant changes still need `/code-review` or `/code-review-professional`.

## Contract

- **Inputs:** the diff (added lines and any new files in scope).
- **Preconditions:** caller has determined that the trigger criteria above match (or, in `/hotfix`, this is invoked unconditionally).
- **Outputs:** either `Security quick check: 7/7 clear.` (PASS) or a bulleted findings list with rule number and `file:line`. Fits on one screen.
- **Postconditions:** findings block the calling workflow until resolved. Caller does not auto-fix.
- **Failure modes:** override only via `--security-override <reason>` on `/hotfix`. Other callers must not bypass. No false-positive padding.
