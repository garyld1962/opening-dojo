# Configure Target Registry

This file maps configure targets to their template source, destination path, and required fields. Read by the `/configure` skill at runtime.

## Registry

```yaml
env:
  description: "Shell and host routing for cross-platform workflows"
  template: claude/env-check/env.config.template.md
  destination: ~/.claude/env.config.md
  scope: per-user-global
  required_sections:
    - shells
    - routing_rules
  optional_sections:
    - hosts
    - terminal_switching

ship:
  description: "Project delivery commands (build, test, tag, release, deploy)"
  template: claude/ship/config.template.md
  destination: "{project}/.claude/ship.config.md"
  scope: per-project
  required_fields:
    - build_command
    - test_command
    - ship_command
  optional_fields:
    - tag_command
    - release_command
    - deploy_command

code-investigate:
  description: "Default report output root and repo search paths"
  template: claude/code-investigate/config.template.md
  destination: ~/.claude/code-investigate.config.md
  scope: per-user-global
  required_fields:
    - report_root
  optional_fields:
    - default_repo_roots
    - default_confidence_threshold

copilot-env:
  description: "Shell and host routing for Copilot CLI (parallel to env)"
  template: copilot-native/templates/env.config.template.md
  destination: $HOME/.copilot/env.config.md
  scope: per-user-global
  required_sections:
    - shells
    - routing_rules
  optional_sections:
    - hosts
    - terminal_switching
```

## Adding New Targets

When porting a new skill that requires config, add an entry here with:
- `description` — one-line explanation shown in `/configure` listing
- `template` — path relative to the skills repo root (where the blank template lives)
- `destination` — where the filled config is written. Use `{project}` for project root.
- `scope` — `per-user-global` or `per-project`
- `required_fields` or `required_sections` — what the pre-flight check validates
- `optional_fields` or `optional_sections` — offered but not blocking
