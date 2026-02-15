# Fuska Project — Agent Instructions

This is the **Fuska** project itself — a project management system for solo agentic development using MegaMemory's knowledge graph.

---

## Scope Boundaries (CRITICAL)

**DO NOT look in global config directories for project context:**
- `~/.config/opencode/` — Global OpenCode settings and installed skills (NOT this project)
- `~/.claude/` — Global Claude Code settings and installed skills (NOT this project)
- `~/.config/fuska/` — Fuska CLI preference config (NOT this project)

**These directories are for INSTALLED packages, not source code.** This project's source is in `provider/` below.

---

## Directory Structure

| Directory | Purpose | Edit? |
|-----------|---------|-------|
| `provider/opinkode/` | Source for OpenCode commands, agents, fuska resources | Yes — AUTHORITATIVE |
| `provider/klod/` | Generated for Claude Code (build output) | No — AUTO-GENERATED |
| `src/` | TypeScript CLI source | Yes |
| `dist/` | Compiled TypeScript | No — AUTO-GENERATED |
| `tests/` | Jest tests | Yes |
| `.megamemory/` | Project knowledge graph database | No — MegaMemory managed |
| `.opencode/` | OpenCode local state (plans, cache) | No — IDE managed |
| `.claude/` | Claude local settings | No — IDE managed |

### Key Subdirectories in `provider/opinkode/`

- `command/fuska/` — Slash commands (*.md with YAML frontmatter)
- `agents/fuska/` — Agent definitions (*.md)
- `fuska/` — Shared resources:
  - `references/` — Reference documents for agents
  - `workflows/` — Workflow definitions
  - `templates/` — Template files
  - `scripts/` — Shell scripts

---

## Code Conventions

- **No comments** in code unless explicitly requested
- **Named exports** preferred over default exports
- **kebab-case** for file names
- Commands/agents use YAML frontmatter + markdown body

---

## MegaMemory Integration

This project uses MegaMemory for persistent knowledge. Workflow:

1. **Session start:** `megamemory:list_roots` to orient
2. **Before tasks:** `megamemory:understand` to load context
3. **After tasks:** `megamemory:create_concept` / `update_concept` / `link`

See `provider/opinkode/fuska/references/megamemory-integration.md` for full details.

---

## Path References in This Project

When reading referenced files from commands/agents:
- `@opencode/` → `provider/opinkode/`
- `@../../fuska/` → `provider/opinkode/fuska/`

Example: `@../../fuska/references/checkpoints.md` resolves to `provider/opinkode/fuska/references/checkpoints.md`

---

## Always Look Here

- `provider/opinkode/command/fuska/` — Command implementations
- `provider/opinkode/agents/fuska/` — Agent definitions
- `provider/opinkode/fuska/references/` — Reference documents
- `provider/opinkode/fuska/workflows/` — Workflow definitions
- `provider/opinkode/fuska/templates/` — Template files
