# Development Guide

> Contributing to Fuska — setup, build, and architecture.

**Audience:** Contributors
**Prerequisites:** [Installation](installation.md) for end-user install

---

## Installation Architecture

Fuska uses **symlinks** to connect target directories to the npm package. This means:

- Updates to the package are immediately available (no reinstall needed)
- Development can happen directly in the source directory
- Both opencode and claude can coexist

For symlink details and target tables, see [installation.md](installation.md#what-fuska-install-does).

### Directory Structure

```
fuska/
├── provider/
│   ├── opinkode/             # Source format for OpenCode
│   │   ├── command/fuska/    # Slash commands (*.md)
│   │   ├── agents/fuska/     # Agent definitions (*.md)
│   │   └── fuska/            # Shared resources (scripts, references)
│   │
│   └── klod/                 # Generated format for Claude Code (build output)
│       ├── skills/fuska-*/   # Commands as skills (SKILL.md)
│       ├── agents/fuska/     # Agent subagents (*.md)
│       └── fuska/            # Shared resources (copy)
│
├── dist/                     # Compiled TypeScript CLI
│
└── scripts/
    └── build-claude.ts       # Transforms opinkode/ → klod/
```

## Build Process

```bash
npm run build
# 1. tsc           → Compile TypeScript to dist/
# 2. build:claude  → Transform provider/opinkode/ to provider/klod/
```

The `build:claude` script:
1. Copies `provider/opinkode/fuska/` → `provider/klod/fuska/`
2. Transforms commands to skills (adds `allowed-tools` field)
3. Transforms agents to subagents (reformats `tools` field)

## Development Workflow

```bash
# One-time setup
npm install
npm run build
npm link                    # Makes 'fuska' command available globally
fuska install --opencode    # Creates symlinks to this directory

# Development cycle
npm run build               # Rebuild after changes
# Changes are immediately available (no reinstall needed)

# After pulling updates
npm run build               # Rebuild if TypeScript changed
```

## Installation Methods

### 1. CLI Install (End Users)

```bash
npm install -g fuska
fuska install --opencode    # or --claude or --both
```

Creates symlinks from target directories to the npm package location.

### How Symlinks Work

When you run `fuska install`, the CLI creates symlinks pointing to the **package root**:

- **npm install -g fuska**: Symlinks point to `node_modules/fuska/`
- **npm link**: Symlinks point to your local development directory

With `npm link`, any changes you make to the source are immediately available to opencode/claude without reinstalling. This is intentional for development workflow.

### 2. Development Install

For working on Fuska itself:

```bash
# Install CLI globally from source
./install-cli.sh

# Install to target (symlinks to source dir)
./install-target.sh --opencode
```

**Scripts:**

| Script | Purpose | Result |
|--------|---------|--------|
| `install-cli.sh` | Build + `npm link` | `fuska` command available globally, points to local source |
| `install-target.sh` | Run `fuska install` | Symlinks from `~/.config/opencode/` → local source dir |

### 3. Manual Symlinks

```bash
# OpenCode
ln -s $(pwd)/provider/opinkode/fuska ~/.config/opencode/fuska
ln -s $(pwd)/provider/opinkode/command/fuska ~/.config/opencode/command/fuska
ln -s $(pwd)/provider/opinkode/agents/fuska ~/.config/opencode/agents/fuska

# Claude
ln -s $(pwd)/provider/klod/fuska ~/.claude/fuska
ln -s $(pwd)/provider/klod/agents/fuska ~/.claude/agents/fuska
for skill in provider/klod/skills/fuska-*; do
  ln -s "$(pwd)/$skill" ~/.claude/skills/$(basename $skill)
done
```

## Format Transformations

### Command → Skill

OpenCode commands have this frontmatter:
```yaml
---
name: fuska-plan-phase
description: Create execution plan for phase
tools:
  - read
  - bash
  - megamemory:understand
---
```

Claude skills need:
```yaml
---
name: fuska-plan-phase
description: Create execution plan for phase
allowed-tools: read, bash, megamemory:understand
---
```

The `build-claude.ts` script handles this transformation.

### Agent → Subagent

OpenCode agents:
```yaml
---
name: fuska-planner
description: Creates execution plans
tools:
  read: true
  bash: true
  megamemory:understand: true
---
```

Claude subagents:
```yaml
---
name: fuska-planner
description: Creates execution plans
tools: read, bash, megamemory:understand
---
```

### Deprecated Commands

Commands marked as `deprecated: true` in frontmatter are skipped during the Claude build:

```yaml
---
name: fuska-old-command
deprecated: true
deprecation_message: |
  Use `fuska new-command` instead.
tools:
  - read
  - bash
---
```

These commands:
- Remain in `provider/opinkode/command/fuska/` for backward compatibility
- Are NOT transformed to `provider/klod/skills/` 
- Display deprecation notice when invoked

The build script (`scripts/build-claude.ts`) checks for `data.deprecated` and returns `null` to skip transformation.

## CLI Options

```bash
fuska install [options]

Options:
  --opencode    Install to ~/.config/opencode/
  --claude      Install to ~/.claude/
  --both        Install to both locations
  --force       Replace existing directories without prompting
  --dry-run     Show what would be done without making changes
```

### Shell Script Options

```bash
./install-target.sh [options]

Options:
  --opencode    Install to ~/.config/opencode/
  --claude      Install to ~/.claude/
  --force       Replace existing directories without prompting
  --dry-run     Show what would be done without making changes
  --help        Show help
```

## Migration from Old Installations

When a directory exists (from old copy-based installs), the install command will:

1. **Symlink with same target**: Skip (already correct)
2. **Symlink with different target**: Update to new target
3. **Directory or file**: Prompt to replace (unless `--force`)

With `--force`, existing directories are removed without prompting.

## Rollback on Error

If installation fails mid-way, all changes are rolled back:

```
Installing to opencode at ~/.config/opencode/
  [OK] ~/.config/opencode/fuska → ...
  [ERROR] Failed to create ~/.config/opencode/command/fuska: Permission denied
Rolling back changes...
  Removed: ~/.config/opencode/fuska
Installation failed. Please check permissions and try again.
```

## Windows Compatibility

Directory symlinks use `'junction'` type on Windows for reliability without admin privileges.

## Provider Preference

The selected provider is saved to `~/.config/fuska/fuska.jsonc`:

```jsonc
// Fuska CLI Configuration
{
  "provider": "opencode"
}
```

This allows `fuska install` (without flags) to remember your preference.

---

## See Also

- [installation.md](installation.md) — End-user installation guide
- [commands.md](commands.md) — Full command reference
