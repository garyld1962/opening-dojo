---
name: ubiquitous-language
description: "Use when defining domain terms, after BA interviews, or onboarding to a new domain. Extracts a DDD glossary, flags ambiguities, saves UBIQUITOUS_LANGUAGE.md."
---

# /ubiquitous-language -- Domain Terminology Glossary

**Purpose:** Extract and formalize domain terminology into a consistent glossary. Scans conversation history and optionally the codebase to find domain-relevant terms, flag ambiguities, and propose canonical definitions. Saves to `UBIQUITOUS_LANGUAGE.md` in the working directory.

## When to Use

- After a BA interview or stakeholder conversation where domain terms were discussed
- When onboarding to a new project and need to understand the domain model
- When the same concept is being called different things across the team
- Before writing requirements or PRDs to ensure consistent terminology
- When `/ba-problem-thesis` or `/ba-current-state` reveals unclear domain language

## Arguments

- _(none)_ — extract from current conversation
- `--scan` — also scan the codebase for domain terms (type names, enum values, table names)
- `--update` — read existing `UBIQUITOUS_LANGUAGE.md` and merge new terms

## Workflow

### Step 1: Gather Terms

**From conversation:**
1. Scan the conversation for domain-relevant nouns, verbs, and concepts
2. Note where the same word is used for different things (ambiguity)
3. Note where different words are used for the same thing (synonyms)
4. Note vague or overloaded terms

**From codebase (if `--scan`):**
5. Search for domain entities: exported types, interfaces, enums, DB table/model names
6. Compare codebase terms against conversation terms — flag divergences

### Step 2: Propose Glossary

For each identified concept:
- **Pick a canonical term** — be opinionated, choose the clearest word
- **Write a one-sentence definition** — what it IS, not what it does
- **List aliases to avoid** — alternative names that should not be used
- **Group terms by domain cluster** — only if natural groupings emerge (e.g., order lifecycle, people, billing). If all terms belong to one cohesive domain, use a single table.

### Step 3: Map Relationships

Express how terms relate to each other:
- Use bold term names and cardinality where obvious
- Focus on relationships that clarify boundaries between concepts

### Step 4: Write Example Dialogue

Write 3-5 exchanges between a dev and a domain expert that demonstrate:
- Terms being used precisely
- Boundaries between related concepts
- How the vocabulary resolves common misunderstandings

### Step 5: Flag Ambiguities

Explicitly list terms that were used inconsistently, with a clear recommendation for resolution.

### Step 6: Save

Write to `UBIQUITOUS_LANGUAGE.md` in the working directory using this format:

```markdown
# Ubiquitous Language

## [Domain cluster name]

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Term** | One-sentence definition (what it IS) | alias1, alias2 |

## Relationships

- A **Term** belongs to exactly one **OtherTerm**
- A **Term** produces one or more **AnotherTerms**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is only generated once a **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — recommend: use **Customer** for the billing entity, **User** for the auth identity.
```

Output a brief inline summary after saving.

## Rules

- **Be opinionated.** Pick the best word, list others as aliases to avoid.
- **Flag conflicts explicitly.** Don't silently pick one — call out the ambiguity.
- **Domain terms only.** Skip module names, class names, and generic programming concepts (array, endpoint, middleware) unless they have domain-specific meaning.
- **One sentence per definition.** Define what it IS, not what it does.
- **Show relationships with cardinality.** "A **Vendor** has many **Contracts**."
- **Write the example dialogue.** It's the most valuable part — it shows terms in natural use.

## Re-running (`--update`)

1. Read the existing `UBIQUITOUS_LANGUAGE.md`
2. Incorporate new terms from subsequent discussion
3. Update definitions if understanding has evolved
4. Re-flag any new ambiguities
5. Rewrite the example dialogue to incorporate new terms
