# Plan: Improve Fuska Command Discoverability

**Created:** 2026-02-21
**Status:** Not started
**Estimated effort:** ~1.5 hours

## Problem

Command flags and options are hard to discover:
- `/fuska-do --review`, `--no-review`, `--auto-commit` only shown via `/fuska-do help`
- `/fuska-refresh --full`, `--dead-code`, `--json`, `--prune` only in the command file
- `/fuska-help` shows compact reference but omits most flags
- Users need to know to run `<cmd> help` first

## Solution Overview

Two-part approach:

1. **Part A:** Enhance `/fuska-help` with key flags in compact reference
2. **Part B:** Add `fuska help <cmd>` CLI command with detailed help

---

## Part A: Enhance `/fuska-help`

**File:** `provider/opinkode/command/fuska/fuska-help.md`

**Changes:** Add **Flags:** to each command entry in the compact format.

### Commands to Update

| Command | Current | New |
|---------|---------|-----|
| `/fuska-do` | `* /fuska-do [mode] [desc]` | `* /fuska-do [mode] [desc]` — Execute unplanned tasks. **Flags:** --review, --no-review, --auto-commit |
| `/fuska-refresh` | `* /fuska-refresh [--full] [--dead-code] [--json] [--prune]` | `* /fuska-refresh` — Refresh import graph. **Flags:** --full, --dead-code, --json, --prune |
| `/fuska-doc` | `* /fuska-doc [mode] <topic>...` | `* /fuska-doc [mode] <topic>` — Create docs. **Flags:** --type, --audience, --depth, --output |

### Example Format

```markdown
## Quick Tasks

* `/fuska-do [mode] [desc]` — Execute unplanned tasks. **Flags:** --review, --no-review, --auto-commit

## Codebase Analysis

* `/fuska-refresh` — Refresh import graph. **Flags:** --full, --dead-code, --json, --prune
* `/fuska-ask [question]` — Query codebase via import graph.

## Documentation

* `/fuska-doc [mode] <topic>` — Create docs. **Flags:** --type, --audience, --depth, --output
```

### Implementation Steps

1. Open `provider/opinkode/command/fuska/fuska-help.md`
2. Find each command entry in the compact reference section
3. Add **Flags:** with relevant flags after the description
4. Update both compact format (TTY) and verbose format sections

---

## Part B: Add `fuska help <cmd>` CLI Command

**Goal:** Git-style help command that shows detailed usage for specific commands.

**Usage:**
```bash
fuska help           # List all commands (brief)
fuska help do        # Show detailed help for /fuska-do
fuska help refresh   # Show detailed help for /fuska-refresh
fuska help doc       # Show detailed help for /fuska-doc
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/commands/help.ts` | Create: Lookup table + command handler |
| `src/cli.ts` | Edit: Register `help` subcommand |

### Implementation: `src/commands/help.ts`

```typescript
import chalk from 'chalk';

const commandHelp: Record<string, string> = {
  do: `
${chalk.bold('/fuska-do [mode] [description]')}

Execute unplanned tasks with mode-aware agent chain.

${chalk.bold('Modes:')}
  planned    Planner → Builder (auto-build)
  checked    + Plan Checker (ask first)
  researched + Researcher (ask first)
  verified   Full pipeline + Reviewer (auto-build)

${chalk.bold('Flags:')}
  --review       Force plan review before executing
  --no-review    Skip plan review (auto-execute)
  --auto-commit  Auto-commit without prompt

${chalk.bold('Examples:')}
  /fuska-do planned fix typo in README
  /fuska-do checked "add input validation"
  /fuska-do verified "implement auth" --auto-commit
`,

  refresh: `
${chalk.bold('/fuska-refresh [--flags]')}

Refresh import graph with file and symbol-level indexing.

${chalk.bold('Flags:')}
  --full       Force full re-scan (default: incremental)
  --dead-code  Show dead code report only
  --json       Output as JSON for scripts
  --prune      Remove dead code concepts that are no longer dead

${chalk.bold('Examples:')}
  /fuska-refresh
  /fuska-refresh --full
  /fuska-refresh --dead-code
`,

  doc: `
${chalk.bold('/fuska-doc [mode] <topic> [--flags]')}

Create documentation as deliverables.

${chalk.bold('Modes:')}
  planned   Plan → Write (default)
  checked   Plan → Check → Write
  researched Research → Plan → Check → Write
  verified  Full pipeline + Review

${chalk.bold('Flags:')}
  --type       Document type: architecture, implementation, guide, design, migration, story-breakdown
  --audience   Target: self, team, stakeholder, contractor
  --depth      Length: brief, standard, comprehensive
  --output     Output file path (default: docs/<slug>.md)

${chalk.bold('Examples:')}
  /fuska-doc "Authentication Architecture" --type architecture --audience team
  /fuska-doc researched "API Migration Guide" --depth comprehensive
`,

  debug: `
${chalk.bold('/fuska-debug [issue description]')}

Debug issues using scientific method with persistent state.

${chalk.bold('Flow:')}
  1. Gather symptoms (expected, actual, errors, reproduction)
  2. Spawn fuska-debugger agent to investigate
  3. Root cause found → Select fix mode

${chalk.bold('Fix Modes:')}
  planned    Planner → Builder (auto-build)
  checked    + Plan Checker (ask first)
  researched + Researcher (ask first)
  verified   Full pipeline + Reviewer (auto-build)
  manual     Display findings, I'll fix it myself

${chalk.bold('Examples:')}
  /fuska-debug "login button doesn't work"
  /fuska-debug  # Resume active session
`,
};

const allCommands = `
${chalk.bold('Fuska Commands')}

Run ${chalk.cyan('fuska help <command>')} for detailed help.

${chalk.bold('Quick Tasks:')}
  do          Execute unplanned tasks

${chalk.bold('Planning:')}
  configure   Configure initiative
  plan        Plan current chapter
  design      Design chapter vision
  research    Research chapter domain

${chalk.bold('Execution:')}
  build       Build current chapter

${chalk.bold('Analysis:')}
  refresh     Refresh import graph
  ask         Query codebase

${chalk.bold('Documentation:')}
  doc         Create documentation

${chalk.bold('Debugging:')}
  debug       Debug issues

${chalk.bold('Progress:')}
  resume      Resume work
  pause       Pause work
  progress    Show progress (CLI)

${chalk.bold('Milestone:')}
  milestone   Start new milestone
  complete    Complete milestone
  audit       Audit milestone
`;

export function helpCommand(command?: string): void {
  if (!command) {
    console.log(allCommands);
    return;
  }

  const help = commandHelp[command.toLowerCase()];
  if (help) {
    console.log(help);
  } else {
    console.log(chalk.yellow(`No detailed help for '${command}'.`));
    console.log(`Run ${chalk.cyan('fuska help')} to see all commands.`);
  }
}
```

### Implementation: `src/cli.ts` Changes

Add to command registration:

```typescript
import { helpCommand } from './commands/help';

// ... in program setup ...

program
  .command('help [command]')
  .description('Show help for Fuska commands')
  .action((command?: string) => {
    helpCommand(command);
  });
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `provider/opinkode/command/fuska/fuska-help.md` | Edit | Add flags to compact reference |
| `src/commands/help.ts` | Create | CLI help command with lookup table |
| `src/cli.ts` | Edit | Register `help` subcommand |

---

## Testing

After implementation:

1. **Part A:** Run `/fuska-help` and verify flags appear in compact output
2. **Part B:** Run `fuska help`, `fuska help do`, `fuska help refresh`
3. Verify both compact and verbose formats in `/fuska-help`

---

## Future Enhancements (Out of Scope)

- Auto-generate help from command files (D option)
- `fuska help --all` for complete verbose output
- Shell completion for `fuska help <tab>`
