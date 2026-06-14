# Prose-only Acceptance — negative fixture

This plan intentionally fails `validate-plan` check #4 (verifiable
acceptance criteria). Every Acceptance bullet below is interpretive
prose rather than a mechanical test/command/observable.

`validate-plan` should return `VERDICT: FAIL` with messages of the form:

```
Task N has no verifiable acceptance criteria. Each bullet must be a
test file/case, a shell command (exit 0), an observable state, or
a schema check. See examples in validate-plan/SKILL.md §4.
```

This fixture is referenced by the Task 7 acceptance block of
`docs/plans/claude-working-hardening.md`.

## Task 1: Make the widget handle errors

Improve the widget's error handling.

**Acceptance:**
- Errors are handled correctly.
- The widget behaves sensibly under bad input.
- Validation is in place.

## Task 2: Clean up the API

Tidy the public API surface.

**Acceptance:**
- API is easier to use.
- The interface feels clean.
- Documentation is better.
