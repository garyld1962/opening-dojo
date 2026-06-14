# `_internal/` — non-user-invokable skills

Skills under `_internal/` are not callable directly by the user. They
exist to be referenced or invoked by other skills. Every SKILL.md
here carries the same frontmatter shape:

```yaml
---
name: <skill-name>
description: <one-line>
user-invocable: false
internal: true
kind: <reference | embedded>
---
```

## `kind:` taxonomy

The two values describe how callers consume the skill:

- **`reference`** — a definition, schema, rubric, or governance
  document. Callers *consult* it (read fields, apply rules, cite the
  contract). It is not a procedure that produces output. Examples:
  `aers-readiness`, `decision-record`, `diff-manifest`, `disposition`,
  `professional-rubric`, `repo-delivery`.

- **`embedded`** — a reusable procedure with explicit Inputs /
  Outputs / Failure modes. Callers *invoke* it (run the rubric over a
  diff, classify a dependency) and act on the structured result.
  Examples: `security-quick-check`.

When in doubt: if you'd describe what it produces in terms of "PASS
/ FAIL plus findings", it's `embedded`. If you'd describe it in terms
of "the schema for X" or "the rules for Y", it's `reference`.

## Discoverability

`_internal/` is conventionally not listed by user-facing skill
indexes. The `closed-decisions/` directory is a fragment store
(referenced by glob from plan files) and is not itself a skill.
