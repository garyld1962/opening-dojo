# Ship Config

This file defines the delivery commands for this project.
Copy to `<project>/.claude/ship.config.md` and fill in the commands.

Alternatively, you can define these in a `## Ship` section of your project's `CLAUDE.md`.

## Commands

```yaml
# Required — these must be filled in
build_command: <FILL IN: e.g., npm run build>
test_command: <FILL IN: e.g., npm test>
ship_command: <FILL IN: e.g., git push -u origin HEAD>

# Optional — leave commented if not applicable
# tag_command: git tag -a v$(cat package.json | jq -r .version) -m "Release"
# release_command: gh release create
# deploy_command: <your deploy command>
```

## Commit Conventions

```yaml
# Optional — leave commented to use default behavior
# commit_style: conventional  # conventional | freeform
# commit_scope: true          # include scope in conventional commits
```
