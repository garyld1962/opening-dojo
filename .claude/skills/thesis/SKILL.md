---
name: thesis
description: "Interrogate to discover the single-sentence product or architectural thesis, then audit all planned features and decisions against it."
model: opus
---

# /thesis — Application & Architectural Thesis

**Purpose:** Force a single-sentence answer to either *"What is this application for?"* (product mode) or *"What is the one technical idea that shapes this system?"* (arch mode) — then audit every planned feature or design decision against it. Sprawl is the enemy; the thesis is the referee.

Adapted from screenwriter Corey Mandel's "What is it about?" discipline. Applications fail the same way unfocused movies fail: they describe the *topic* instead of the *claim*, and the result is a feature list or architecture that can't tell you what to cut.

## When to Use

- Starting a new project and the scope feels wobbly
- Mid-project when the feature list or architecture won't stop growing
- Before writing a handoff doc for an AI coding CLI — thesis goes at the top
- When something "feels off" about a design but you can't name it
- When a project might actually be two projects tangled together

## Arguments

- `product` — user-facing thesis. Who is this for, what do they walk away with, what belief does it challenge?
- `arch` — technical thesis. What is the one organizing idea that every major design decision descends from?
- _(none)_ — ask the user which mode. Don't guess.

## Output

Thesis + audit only. This skill deliberately does **not** produce a PRD, design doc, or handoff doc. Those are separate artifacts; the thesis is the referee they all answer to. The output of this skill is meant to be pasted into the top of a handoff doc, PRD, or design doc — not replace them.

## Workflow

Three phases, strict order. Do not skip ahead.

### Phase 1 — Discover the Thesis

One question at a time. Goal: a **single declarative sentence** that passes the tests below.

**Product mode** — start here and adapt:

1. **"What's the working name and one-line pitch of the project?"** — raw material.
2. **"Who is the user you picture, specifically? Not a segment — a person."** — force a real human into focus. "Developers" is not a user. "A solo founder running a one-person SaaS who doesn't want to think about auth" is a user.
3. **"What do they currently do instead, and what's broken about it?"** — the tension. If there's no tension, there's no thesis.
4. **"What do they walk away with that they didn't have before? A capability, a belief, a workflow?"** — the transformation.
5. **Propose a thesis sentence.** Draft it in the form: *"[Project] is for [specific user] who [tension/problem] — it [the claim that makes this different]."* Let the user sharpen or reject.
6. **Iterate until the thesis passes the product tests.**

**Arch mode** — start here and adapt:

1. **"What does the system do, in the crudest possible terms?"** — raw material. One sentence, no jargon.
2. **"What's the one technical commitment that makes this system different from the obvious alternative?"** — the organizing idea. If the answer is a list, keep digging.
3. **"If you had to defend one design decision as non-negotiable, which one, and why?"** — this is often the thesis in disguise.
4. **"What would change if that commitment were reversed? Which decisions fall apart?"** — tests reach. A real architectural thesis has blast radius; reversing it should break many things.
5. **Propose a thesis sentence.** Draft it in the form: *"[System] treats [X] as [Y], not [Z] — so [consequence that shapes everything]."* Let the user sharpen or reject.
6. **Iterate until the thesis passes the arch tests.**

#### Thesis Tests

**Product thesis must:**
- Be one sentence.
- Name a specific user (not a segment).
- State a claim, not a topic. ("A construction app" is a topic. "The only construction app for owner-builders running their own project" is a claim.)
- Tell you what to *cut* — features outside the thesis should feel obviously wrong.
- Have a stake: the user gains, loses, or reconsiders something.

**Architectural thesis must:**
- Be one sentence.
- Name the organizing commitment, not a tech stack. ("Uses Kubernetes" is a stack. "Agents are Kubernetes-native workloads with cryptographic identity, not library calls" is a thesis.)
- Have **reach**: at least 3–4 major design decisions should be derivable from it.
- Exclude alternatives: you should be able to name the design this thesis *rejects*.
- Survive the reversal test: if you flipped the thesis, the system would need to be substantially redesigned.

If any test fails, keep interrogating. Do not advance to Phase 2.

### Phase 2 — Audit Against the Thesis

Thesis is locked. Now surface everything currently in scope — features, modules, design decisions, integrations, "nice to haves" — and test each against the thesis.

For each item, one at a time:

> **"Does this serve the thesis? If you cut it, does the thesis survive?"**

- **Direct service:** how does this advance the thesis?
- **Indirect but necessary:** is this scaffolding the thesis needs (auth, persistence, deploy) even though it's not thesis-specific?
- **Weakly related:** is there a tighter version? A deferred version? A cut version?
- **Darling:** be willing to say *"I think this one goes."* The user can overrule, but make them defend it.

Watch for the **two-projects signal**: if a meaningful chunk of the scope doesn't serve the thesis *and* the user resists cutting it, the project may actually be two projects tangled together. Name it when you see it.

### Phase 3 — Produce the Artifact

Tight output. Paste-ready for the top of a handoff doc, PRD, or design doc.

**Product mode:**

```
# [Project]: Product Thesis

## Thesis
[One sentence. The referee.]

## User
- Who: [specific user]
- Currently does: [what they do instead]
- Walks away with: [transformation]

## In scope (serves the thesis)
- [Feature/module] — [how it serves]
- [Feature/module] — [how it serves]

## Out of scope (cut or deferred)
- [Feature] — [reason it didn't serve the thesis]

## Open questions
- [Anything unresolved that the thesis doesn't yet settle]
```

**Arch mode:**

```
# [System]: Architectural Thesis

## Thesis
[One sentence. The referee.]

## The commitment
- This system treats [X] as [Y], not [Z].
- Rejected alternative: [what this thesis says no to]

## Decisions that follow from the thesis
- [Decision] — because the thesis says [...]
- [Decision] — because the thesis says [...]

## Decisions NOT downstream of the thesis (audit these)
- [Decision] — [is this incidental, scaffolding, or a second thesis hiding?]

## Open questions
- [Anything the thesis doesn't yet settle]
```

## Rules

- **One question at a time.** Never batch. The user's answer to Q1 changes Q2.
- **Phase discipline.** Don't audit before the thesis is locked. Don't lock the thesis before it passes the tests.
- **Propose, don't just ask.** When the thesis is forming, draft a candidate and let the user react. Faster than pure Socratic.
- **Kill darlings out loud.** Name the cuts. The user can overrule.
- **Respect the composition.** This skill produces a thesis artifact, not a handoff doc. Offer at the end: *"Want to hand this to your coding CLI now? The handoff doc goes on top of this."*
- **Stop when done.** Thesis produced, audit complete, user confirms. Don't keep grilling.

## Examples of Thesis Quality

**Weak product theses (topics, not claims):**
- "A construction project management app."
- "A decision log with AI features."
- "An agent orchestration platform."

**Strong product theses:**
- "BuildFlow is for owner-builders managing their own residential project — it treats the owner, not the GC, as the primary user, because every other construction app assumes a crew."
- "Resolve is the decision log a solo founder keeps *alongside* their task tracker — because decisions have a different lifecycle than tasks and deserve their own memory with integrity guarantees."

**Weak architectural theses (stacks and lists, not commitments):**
- "Uses NATS JetStream and Kubernetes."
- "Drizzle + Neon + tRPC + Next.js."
- "Agents that can talk to each other."

**Strong architectural theses:**
- "Baker Street treats agents as Kubernetes-native workloads with cryptographic identity, not library calls — so every agent gets isolation, observability, and capability attenuation for free from the platform."
- "Resolve treats decisions as content-addressed artifacts in a Merkle accumulator, not rows in a table — so integrity is provable without a central authority."

The weak versions don't tell you what to cut or which alternative to reject. The strong ones do.

## Anti-patterns

- **Stack as thesis.** "We're using NATS" is not an architectural thesis. The thesis is *why* NATS — what commitment does NATS serve?
- **Persona as thesis.** "For developers" is not a product thesis. The thesis is *which* developers, doing *what*, and what's broken about their current approach.
- **The "everything platform."** Symptom: thesis has "and" in it, or the feature list spans unrelated capabilities. Fix: the thesis isn't narrow enough, or you have two projects.
- **The missing product thesis.** Symptom: a crisp architectural thesis but a fuzzy user. Fix: run the skill again in `product` mode. These are different artifacts.
- **The buried thesis.** Symptom: the real organizing idea shows up in design decision #6, not at the top. Fix: the decision is the thesis — promote it.
