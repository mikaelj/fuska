# Fuska Project - Claude Code Compatibility Plan

## Overview

Fuska is a project management system for solo agentic development, using MegaMemory's persistent knowledge graph for semantic search and typed relationships.

This document outlines the plan to add Claude Code compatibility alongside existing OpenCode support.

---

## Current State

- **Primary tool:** OpenCode (commands in `opencode/command/`, agents in `opencode/agents/`)
- **Backend:** MegaMemory MCP server for knowledge graph storage
- **Installation:** `fuska install` copies to `~/.config/opencode/`

---

## Target State

Dual-tool support via transform pipeline (source format remains OpenCode, transforms applied during install):

```bash
fuska install --opencode      # Install to ~/.config/opencode/ (direct copy)
fuska install --claude        # Install to ~/.claude/ (with transforms)
fuska install --both          # Install to both locations
```

**Note:** No autodetection. Users must specify target explicitly.

---

## Key Insight: Different Schemas Per Component Type

Claude Code uses **different field names** for different component types:

| Component | Tool Field | Format |
|-----------|------------|--------|
| **Skills** (commands) | `allowed-tools` | Comma-separated string |
| **Subagents** | `tools` | Comma-separated string |

A unified source format with both fields **will not work**. Instead, use OpenCode format as canonical source and transform during install.

---

## Source Format (OpenCode - No Changes Needed)

### Agents (keep as-is)

```yaml
---
name: fuska-executor
description: Executes Fuska plans with atomic commits and deviation handling
tools:
  read: true
  edit: true
  bash: true
  task: true
---

<role>
...content...
</role>
```

### Commands (keep as-is)

```yaml
---
name: fuska-execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
tools:
  - read
  - edit
  - bash
  - task
  - question
  - megamemory:understand
---

<objective>
...content...
</objective>
```

---

## Transformations During Install

### For Claude Code Skills (from commands)

| Source Field | Target Field | Transform |
|--------------|--------------|-----------|
| `tools:` (array) | `allowed-tools:` | Array → comma-separated string |
| `question` | `AskUserQuestion` | Tool name mapping |
| `name: fuska-help` | `/fuska-help` | Becomes slash command (no plugin needed) |

**Output example:**

```yaml
---
name: fuska-execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools: read, edit, bash, task, AskUserQuestion, megamemory:understand, megamemory:create_concept
---

<objective>
...content...
</objective>
```

### For Claude Code Subagents (from agents)

| Source Field | Target Field | Transform |
|--------------|--------------|-----------|
| `tools: {read: true, edit: true}` | `tools: read, edit` | Object → comma-separated string |
| `name: fuska-executor` | `fuska-executor.md` | Direct file |

**Output example:**

```yaml
---
name: fuska-executor
description: Executes Fuska plans with atomic commits and deviation handling
tools: read, edit, bash, glob, grep, task
---

<role>
...content...
</role>
```

---

## Directory Mapping

| Source | OpenCode Target | Claude Code Target |
|--------|-----------------|-------------------|
| `opencode/fuska/` | `~/.config/opencode/fuska/` | `~/.claude/fuska/` |
| `opencode/command/fuska/*.md` | `~/.config/opencode/command/fuska/` | `~/.claude/skills/fuska-*/SKILL.md` |
| `opencode/agents/fuska/*.md` | `~/.config/opencode/agents/fuska/` | `~/.claude/agents/fuska/*.md` |

---

## Tool Name Mappings

Lowercase works for both tools (case-insensitive matching):

| OpenCode | Claude Code | Transform Needed |
|----------|-------------|------------------|
| `read` | `Read` | No (lowercase works) |
| `write` | `Write` | No (lowercase works) |
| `edit` | `Edit` | No (lowercase works) |
| `bash` | `Bash` | No (lowercase works) |
| `glob` | `Glob` | No (lowercase works) |
| `grep` | `Grep` | No (lowercase works) |
| `task` | `Task` | No (lowercase works) |
| `question` | `AskUserQuestion` | **Yes** - must map |
| `megamemory:*` | `megamemory:*` | No change (MCP tools) |

---

## Slash Command Naming

Keep `fuska-` prefix for all commands:

- `name: fuska-help` → `/fuska-help`
- `name: fuska-execute-phase` → `/fuska-execute-phase`

**No plugin structure needed.** Direct skill installation to `~/.claude/skills/` is the standard pattern for Claude Code users. The colon syntax (`/fuska:help`) is only for plugin namespacing, which is unnecessary for solo developer tools.

---

## Implementation Tasks

### Phase 1: Install Command Enhancement (~3 hrs)

Modify `src/commands/install.ts`:

```typescript
interface InstallTarget {
  name: 'opencode' | 'claude';
  configDir: string;
}

program
  .command('install')
  .description('Install Fuska to target tool')
  .option('--opencode', 'Install to ~/.config/opencode/')
  .option('--claude', 'Install to ~/.claude/')
  .option('--both', 'Install to both locations')
  .option('--force', 'Overwrite existing directories')
  .action(async (options) => {
    if (!options.opencode && !options.claude && !options.both) {
      console.error('Error: Must specify --opencode, --claude, or --both');
      process.exit(1);
    }
    // ... install logic
  });
```

**Transform functions:**

```typescript
function transformCommandToSkill(sourcePath: string): { name: string; content: string } {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  
  const tools = frontmatter.tools || [];
  const allowedTools = tools.map((t: string) => 
    t === 'question' ? 'AskUserQuestion' : t
  ).join(', ');
  
  const newFrontmatter = {
    name: frontmatter.name,
    description: frontmatter.description,
    'argument-hint': frontmatter['argument-hint'],
    'allowed-tools': allowedTools
  };
  
  return {
    name: frontmatter.name,
    content: `---\n${yaml.dump(newFrontmatter)}---\n${body}`
  };
}

function transformAgentToSubagent(sourcePath: string): { name: string; content: string } {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  
  const tools = Object.entries(frontmatter.tools || {})
    .filter(([_, v]) => v === true)
    .map(([k]) => k)
    .join(', ');
  
  const newFrontmatter = {
    name: frontmatter.name,
    description: frontmatter.description,
    tools
  };
  
  return {
    name: frontmatter.name,
    content: `---\n${yaml.dump(newFrontmatter)}---\n${body}`
  };
}
```

### Phase 2: Testing (~30 min)

- [x] Test `fuska install --opencode` on fresh config
- [x] Test `fuska install --claude` on fresh config
- [x] Test `fuska install --both`
- [x] Verify skills have `allowed-tools` (not `tools`)
- [x] Verify subagents have `tools` (not `allowed-tools`)
- [x] Verify `question` → `AskUserQuestion` transformation
- [ ] Verify MegaMemory MCP works in both tools
- [ ] Test `/fuska-help` loads correctly in Claude Code
- [ ] Spawn a fuska subagent to verify agents work

### Phase 3: Documentation (~15 min)

- [x] Update README.md with Claude Code instructions
- [x] Update `fuska install --help` output

---

## Key Differences Between Tools

| Feature | OpenCode | Claude Code |
|---------|----------|-------------|
| Commands location | `~/.config/opencode/command/` | `~/.claude/skills/fuska-*/` |
| Agents location | `~/.config/opencode/agents/` | `~/.claude/agents/fuska/` |
| Skill tool field | `tools:` (array) | `allowed-tools:` (comma string) |
| Subagent tool field | `tools:` (object) | `tools:` (comma string) |
| Question tool | `question` | `AskUserQuestion` |

---

## Notes

- Both tools support MCP natively, so `megamemory:*` tools work unchanged
- Claude Code normalizes tool names internally, so lowercase works
- Reference includes (`@./path`) work in both tools
- Claude Code skills support directories with supporting files (templates, scripts)
- No source file changes needed - transforms happen at install time

---

## Related Files

- `src/commands/install.ts` — Installation logic
- `src/index.ts` — CLI entry point
- `opencode/` — Source files for commands, agents, resources
- `README.md` — User documentation
