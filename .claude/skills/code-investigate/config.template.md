# Code Investigation Config

This file sets defaults for the /code-investigate skill.
Copy to `~/.claude/code-investigate.config.md` and fill in.

These are defaults only — invocation arguments override them.

## Settings

```yaml
# Where to write investigation reports (relative to project root)
report_root: <FILL IN: e.g., docs/code-investigations>

# Default repo roots to search when --folder is used without a path
# default_repo_roots:
#   - ~/repos
#   - ~/work

# Minimum confidence threshold (0.50 to 1.00)
# default_confidence_threshold: 0.70
```
