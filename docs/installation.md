# Installation (Symlink-Based)

Running `fuska install` creates symlinks from global config directories to the project source.

## OpenCode Symlinks

| Global Target | Points To |
|---------------|-----------|
| `~/.config/opencode/fuska/` | `provider/opinkode/fuska/` |
| `~/.config/opencode/command/fuska/` | `provider/opinkode/command/fuska/` |
| `~/.config/opencode/agents/fuska/` | `provider/opinkode/agents/fuska/` |

## Claude Code Symlinks

| Global Target | Points To |
|---------------|-----------|
| `~/.claude/fuska/` | `provider/klod/fuska/` |
| `~/.claude/skills/fuska-*/` | `provider/klod/skills/fuska-*/` |
| `~/.claude/agents/fuska/` | `provider/klod/agents/fuska/` |
