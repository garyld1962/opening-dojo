---
id: concept/_severity
type: shared
title: Severity scale (shared)
---

# Severity scale (shared)

Single source of truth for finding severity across all concept lenses.
Individual concept files reference this file rather than duplicating
the scale inline — keeps the rubric drift-free as the vocabulary
evolves.

- **critical** — will cause incident, data loss, or security breach in
  production. Blocks.
- **major** — meaningful degradation under load, real maintenance
  burden, or latent bug. Revise before merge.
- **minor** — worth fixing but not blocking. Leave a note.
- **nit** — style or taste. Mention once, don't belabor.

Two additional severity tags are defined by `execute-plan` for its
plan-alignment and ambiguity-handling phases (not concept-lens
findings):

- **plan-ambiguity** — see `/execute-plan` Phase 1.5. Requires
  terminal disposition.
- **plan-deviation** — see `/execute-plan` Phase 3d. Requires terminal
  disposition.

Full disposition vocabulary and status lifecycle live in
`_internal/disposition/SKILL.md`.
