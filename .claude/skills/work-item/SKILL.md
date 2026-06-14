---
name: work-item
description: "Retrieve a work item from Azure DevOps or Linear. Extracts title, description, acceptance criteria, status, assignee, and tags. Presents in clean markdown format for use by other skills."
---

# /work-item -- Retrieve Work Item

**Purpose:** Fetch a work item from Azure DevOps (ADO) or Linear and present it in a clean, structured format. Used standalone or called by other skills (/triage, /hotfix, /plan) when they need to pull in requirements or bug details from a tracker.

## When to Use

- Pull a ticket's details into the conversation by ID (ADO or Linear)
- Upstream of `/plan`, `/triage`, `/hotfix` when requirements live in a tracker
- You want a clean markdown summary rather than raw API JSON

## When NOT to Use

- The ticket content is already pasted in the conversation
- Tracker not configured — set up ADO/Linear integration first
- You need to modify the ticket — use the tracker's native CLI/UI

## Usage

```
/work-item --ado 12345
/work-item --linear BF-42
```

## Arguments

- `--ado <item-id>` -- fetch from Azure DevOps by work item ID
- `--linear <issue-id>` -- fetch from Linear by issue identifier (e.g., `BF-42`)

Exactly one of `--ado` or `--linear` is required.

## Azure DevOps Retrieval

Use the Azure CLI to fetch the work item:

```bash
az boards work-item show --id <item-id> --output json
```

Extract these fields from the JSON response:

| Field | JSON Path |
|-------|-----------|
| ID | `id` |
| Title | `fields."System.Title"` |
| Type | `fields."System.WorkItemType"` |
| State | `fields."System.State"` |
| Assigned To | `fields."System.AssignedTo".displayName` |
| Description | `fields."System.Description"` (HTML -- strip tags) |
| Acceptance Criteria | `fields."Microsoft.VSTS.Common.AcceptanceCriteria"` (HTML -- strip tags) |
| Tags | `fields."System.Tags"` |
| Priority | `fields."Microsoft.VSTS.Common.Priority"` |
| Iteration | `fields."System.IterationPath"` |
| Area | `fields."System.AreaPath"` |
| Parent | `fields."System.Parent"` |
| URL | `_links.html.href` |

If `az` CLI is not installed or not authenticated, report the error clearly:
```
Error: Azure CLI not available. Install with `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`
and authenticate with `az login` and `az devops configure --defaults organization=<org> project=<project>`.
```

## Linear Retrieval

Use the Linear MCP tool to fetch the issue:

```
linear get_issue --id <issue-id>
```

If the MCP tool is not available, try the `gh` CLI with the Linear API, or report clearly:
```
Error: Linear MCP tool not available. Ensure the Linear MCP server is configured.
```

Extract these fields:

| Field | Source |
|-------|--------|
| ID | `identifier` |
| Title | `title` |
| Type | `type` or label |
| State | `state.name` |
| Assigned To | `assignee.name` |
| Description | `description` (markdown) |
| Priority | `priority` (0=none, 1=urgent, 2=high, 3=medium, 4=low) |
| Labels | `labels[].name` |
| Project | `project.name` |
| Cycle | `cycle.name` |
| Parent | `parent.identifier` |
| URL | `url` |

## Output Format

Present the work item in this format:

```
Work Item: <ID> -- <Title>

  Type:        <Bug | User Story | Task | Feature | etc.>
  State:       <state>
  Priority:    <priority>
  Assigned To: <name or "Unassigned">
  Tags/Labels: <comma-separated list or "None">
  Iteration:   <iteration/cycle or "None">
  Project:     <project/area or "None">
  Parent:      <parent ID or "None">
  URL:         <link>

Description
  <cleaned description text, preserving paragraph breaks>

Acceptance Criteria
  <cleaned acceptance criteria, preserving list formatting>
  <or "None specified" if empty>
```

## HTML Cleaning

ADO fields often contain HTML. Strip tags but preserve structure:
- `<br>`, `<br/>` -> newline
- `<li>` -> `- ` (bullet)
- `<ol><li>` -> `1. ` (numbered)
- `<p>` -> paragraph break (double newline)
- `<b>`, `<strong>` -> `**text**`
- `<i>`, `<em>` -> `*text*`
- All other tags -> removed
- HTML entities -> decoded (`&amp;` -> `&`, `&lt;` -> `<`, etc.)

## Error Handling

If the work item is not found:
```
Error: Work item <id> not found. Verify the ID and your authentication.
```

If authentication fails:
```
Error: Not authenticated to <ADO|Linear>. <specific instructions for the platform>
```

## Key Rules

1. **Read-only on the tracker.** This skill fetches and displays. It does not modify work items.
2. **Stdout-only output. Does not write to disk.** Renders the work item to stdout in the format above. Persisting the rendered markdown to a file (e.g. `docs/plans/PRD-<slug>.md`) is the caller's responsibility. `/triage`, `/hotfix`, and `/execute-prd` each handle persistence on their own terms.
3. **Clean output.** Strip HTML, decode entities, preserve logical structure. The output must be readable as plain text and parseable by callers.
4. **Fail clearly.** If the tool or CLI is not available, say so with specific setup instructions. Do not guess at work item contents.
5. **Stable output format.** When /triage, /hotfix, or /execute-prd pass `--ado` or `--linear`, they call this skill internally and parse the output. Changes to the format are breaking changes to all callers.

## Contract

- **Inputs:** exactly one of `--ado <work-item-id>` or `--linear <issue-id>`.
- **Preconditions:** Azure CLI installed and authenticated (`az login`, `az devops configure`) for ADO; Linear MCP server configured for Linear.
- **Outputs:** rendered markdown to **stdout** in the fixed format under "Output Format". No file writes; no tracker mutations.
- **Postconditions:** caller receives parseable markdown and is responsible for any persistence (e.g. `/execute-prd` writes it to `docs/plans/PRD-<slug>.md`).
- **Failure modes:** auth/CLI/MCP unavailable → write `Error: …` to stdout with platform-specific setup instructions and exit non-zero. Item not found → `Error: Work item <id> not found.` Never invent content.
