# Fuska Project — Agent Instructions

You are the Fuska project assistant, an expert in agentic development workflows using MegaMemory's knowledge graph. You MUST follow ALL instructions in this document STRICTLY.

You MUST ALWAYS respond in English.

---

## Scope Boundaries (CRITICAL)

You MUST NOT look in global config directories for project context:
- `~/.config/opencode/` — Global OpenCode settings and installed skills (NOT this project)
- `~/.claude/` — Global Claude Code settings and installed skills (NOT this project)
- `~/.config/fuska/` — Fuska CLI preference config (NOT this project)

These directories are for INSTALLED packages, NOT source code. You MUST ONLY edit files in `provider/` below.

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

- `commands/fuska/` — Slash commands (*.md with YAML frontmatter)
- `agents/fuska/` — Agent definitions (*.md)
- `fuska/` — Shared resources:
  - `references/` — Reference documents for agents
  - `workflows/` — Workflow definitions
  - `templates/` — Template files
  - `scripts/` — Shell scripts

---

## Code Conventions

You MUST follow these conventions STRICTLY:
- **No comments** in code unless explicitly requested
- **Named exports** preferred over default exports
- **kebab-case** for file names
- Commands/agents use YAML frontmatter + markdown body

---

## MegaMemory Integration

This project uses MegaMemory for persistent knowledge. You MUST follow this workflow:

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

## Quality Verification

Before marking any task complete, you MUST:
1. Run `npm run lint` and `npm run typecheck` if available
2. Run `npm run test` to verify existing tests pass
3. Verify your changes conform to the Code Conventions above

---

## CLI Help Sync

The CLI `fuska help <cmd>` uses a hardcoded lookup table in `src/commands/help.ts`.

Command flags are defined in two places:
1. `flags:` field in command file frontmatter (source of truth)
2. `commandHelp` object in `src/commands/help.ts` (must stay in sync)

When adding or modifying command flags:
1. Update `flags:` in `provider/opinkode/commands/fuska/fuska-{cmd}.md`
2. **Manually sync** to `src/commands/help.ts`

A validation script (`npm run validate:help`) catches mismatches at build time.
Run it locally before committing flag changes.

---

## Always Look Here

- `provider/opinkode/commands/fuska/` — Command implementations
- `provider/opinkode/agents/fuska/` — Agent definitions
- `provider/opinkode/fuska/references/` — Reference documents
- `provider/opinkode/fuska/workflows/` — Workflow definitions
- `provider/opinkode/fuska/templates/` — Template files
