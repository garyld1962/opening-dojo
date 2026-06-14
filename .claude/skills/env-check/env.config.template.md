# Shell Environment Config

This file defines your shell environment for cross-platform command routing.
Fill in the sections below, then save to `~/.claude/env.config.md`.

## Shells

List the shells you actively use. The env-check skill will match the detected
shell against this list to determine routing.

```yaml
shells:
  - name: <FILL IN: e.g., zsh>
    os: <FILL IN: e.g., macOS, Linux, Windows>
    notes: <OPTIONAL>
  # Add more shells as needed:
  # - name: bash
  #   os: Linux
  #   notes: WSL2 on Windows host
  # - name: pwsh
  #   os: Windows
  #   notes: PowerShell 7
```

## Routing Rules

Define how commands should be routed when a shell/project mismatch is detected.

```yaml
routing_rules:
  # When the current shell doesn't match what the project expects:
  default_action: <FILL IN: direct | switch-terminal | warn>

  # Per-shell overrides (optional):
  # overrides:
  #   - when_shell: pwsh
  #     project_expects: bash
  #     action: switch-terminal
  #     message: "This project expects a Unix shell. Open a WSL or Linux terminal."
  #   - when_shell: bash
  #     project_expects: pwsh
  #     action: warn
  #     message: "This project has PowerShell scripts. Consider using pwsh."
```

## Hosts

<OPTIONAL> Map specific hosts to their default shells. Useful if you work across
multiple machines with different setups.

```yaml
# hosts:
#   - name: sherlock
#     default_shell: zsh
#     os: Linux (WSL2)
#   - name: irene
#     default_shell: zsh
#     os: macOS
#   - name: mycroft
#     default_shell: bash
#     os: Linux
```

## Terminal Switching

<OPTIONAL> Rules for when to recommend switching terminals vs wrapping commands.

```yaml
# terminal_switching:
#   prefer_switch_over_wrap: true
#   wrap_only_when: "user explicitly requests a bridge command"
```
