---
name: fuska-help
description: Show available Fuska commands and usage guide
---

<objective>
Display the complete Fuska command reference.

Output ONLY the reference content below. Do NOT add:

- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<reference>
## Output Format Selection

**This is a TTY/terminal context.** Output ONLY the **Compact Format** below (asterisk-prefixed list).

---

# Fuska Command Reference (Compact)

**Fuska** — Lean solo agentic development with MegaMemory knowledge graph.

## Quick Start

```
fuska init → /fuska-configure → /fuska-plan → /fuska-build → repeat
```

**`/fuska`** is the universal entry point. Run it bare to see where you are, or with a verb to act:
\* `/fuska` — show current position and what to do next
\* `/fuska-plan` — plan the current chapter (auto-detects chapter number)
\* `/fuska-build` — build the current chapter
\* `/fuska-do [mode] [desc]` — quick ad-hoc task

All `/fuska-*` commands below also work directly.

## Project Initialization

\* `fuska init` — Initialize project foundation: git, .megamemory/, MCP registration (then `/fuska-configure`).
\* `/fuska-configure` — Configure initiative through unified flow.
\* `/fuska-import` — Import existing initiative from another project.
\* `/fuska-map-codebase` — Map an existing codebase for brownfield projects.

## Chapter Planning

\* `/fuska-design <number>` — Articulate your vision for a chapter before planning.
\* `/fuska-research-chapter <number>` — Ecosystem research for niche/complex domains.
\* `/fuska-plan <number>` — Create detailed execution plan.

## Execution

\* `/fuska-build <chapter-number>` — Execute all plans in a chapter with batch-based parallelization.

## Roadmap Management

\* `/fuska-add-chapter <description>` — Add new chapter to end of current milestone.
\* `/fuska-insert-chapter <after> <description>` — Insert urgent work as decimal chapter.
\* `/fuska-remove-chapter <number>` — Remove a future chapter and renumber subsequent chapters.

## Milestone Management

\* `/fuska-new-milestone <name>` — Start a new milestone through unified flow.
\* `/fuska-complete <version>` — Archive completed milestone and prepare for next version.

## Progress Tracking

\* `fuska progress` — Check project status and intelligently route to next action.

> **Session continuity is automatic.** Your task position is tracked after every commit. Run `/fuska` anytime to see exactly where you are — no manual saving or resume command needed.

## Debugging

\* `/fuska-debug [issue description]` — Systematic debugging with persistent state across context resets.

## Todo Management

\* `/fuska-add-todo [description]` — Capture idea or task as todo from current conversation.
\* `/fuska-check-todos [area]` — List pending todos and select one to work on.

## User Acceptance Testing

\* `/fuska-review [chapter]` — Validate built features through conversational verification.

## Milestone Auditing

\* `/fuska-audit [version]` — Audit milestone completion against original intent.
\* `/fuska-plan-milestone-fixes` — Create chapters to close gaps identified by audit.

## Configuration

\* `fuska config [project-dir]` — Manage Fuska settings interactively.

## Migration Utilities

\* `fuska migrate planning [dir]` — Migrate `.planning/` directory to MegaMemory.
\* `fuska migrate terminology [dir]` — Rename phase→chapter and wave→batch in an existing MegaMemory database.

## Quick Tasks

\* `/fuska-do [mode] [description]` — Execute unplanned, ad-hoc tasks with Fuska guarantees. **Flags:** --review, --no-review, --auto-commit

## Code Review

\* `/fuska-code-review` — Review uncommitted git changes against project context from MegaMemory.

## Codebase Analysis

\* `/fuska-refresh` — Refresh import graph with symbol indexing. **Flags:** --full, --dead-code, --json, --prune
\* `/fuska-ask [question]` — Ask questions about the codebase using import graph data.
\* `/fuska-map-domains` — Map business domains to code areas for semantic scopes.

## Documentation

\* `/fuska-doc [mode] <topic>` — Create documentation as deliverables. **Flags:** --type, --audience, --depth, --output

## Utility Commands

\* `/fuska-help` — Show this command reference.
\* `/fuska-export-md` — Export MegaMemory concepts to markdown files.
\* `/fuska-git-message` — Generate Fuska-format commit messages.

## Thinking Variants

Fuska agents use named thinking variants to control reasoning budget per step:

\* `plan` — 32k thinking, ~33k output (researchers, planners, mappers)
\* `validate` — 24k thinking, ~41k output (checkers, verifiers, debuggers)
\* `execute` — 8k thinking, ~57k output (executors, writers)
\* `amend` — 16k thinking, balanced (git messages, follow-ups)

Configure in your OpenCode model definition under `"variants"`. See `fuska config --view` or docs/configuration.md.

## Getting Help

\* Run `/fuska` to see where you are and what to do next
\* Run `fuska progress` for detailed project status
\* Query `state` concept for current context
\* Query `roadmap` concept for chapter status

---

# Full Verbose Format (Documentation Export Only)

# Fuska Command Reference

**Fuska** — Lean solo agentic development with MegaMemory knowledge graph. Works with OpenCode and Claude Code.

## Quick Start

1. `fuska init "My Project"` - Initialize project foundation (git, .megamemory/)
2. `/fuska` - See what to do next (or `/fuska-configure` directly)
3. `/fuska-plan` - Plan the current chapter (auto-detects chapter number)
4. `/fuska-build` - Build the current chapter

## Core Workflow

```
fuska init → /fuska-configure → /fuska-plan → /fuska-build → repeat
```

**`/fuska`** is the universal entry point. Run bare to navigate, or with a verb to act. All `/fuska-*` commands also work directly.

### Project Initialization

**`fuska init [name]`**
Initialize project foundation.

Creates:
- `.megamemory/` directory for knowledge graph
- Main initiative concept in MegaMemory
- Git repository (if not already initialized)

Also registers MegaMemory as an MCP server (`megamemory install --target <target>`). For Claude Code, writes `.claude/settings.local.json` with `mcp__megamemory` permission. Requires a provider configured via `fuska install`; if missing, run `megamemory install --target claudecode|opencode` manually.

Usage: `fuska init "My Project Name"`

**`/fuska-configure`**
Configure existing initiative through unified flow.

One command takes you from idea to ready-for-planning:
- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with chapter breakdown and success criteria

Creates all MegaMemory concepts:
- `project` — root concept for the project
- `config` — workflow mode (interactive/yolo), model profile
- `research/*` — domain research (if selected)
- `requirements/*` — scoped requirements with REQ-IDs
- `roadmap` — chapters mapped to requirements
- `state` — project memory and context

Usage: `/fuska-configure`

**`/fuska-map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates MegaMemory codebase concepts with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/fuska-configure` on existing codebases

Usage: `/fuska-map-codebase`

### Chapter Planning

**`/fuska-design <number>`**
Help articulate your vision for a chapter before planning.

- Captures how you imagine this chapter working
- Creates context concept with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/fuska-design 2`

**`/fuska-research-chapter <number>`**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates research concept with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/fuska-research-chapter 3`

**`/fuska-plan <number>`**
Create detailed execution plan for a specific chapter.

- Generates plan concepts in MegaMemory (e.g., `chapter-01-01-plan`)
- Breaks chapter into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per chapter supported (01, 02, etc.)

Usage: `/fuska-plan 1`
Result: Creates plan concepts like `chapter-01-01-plan`, `chapter-01-02-plan`

### Execution

**`/fuska-build <chapter-number>`**
Execute all plans in a chapter.

- Groups plans by batch (from concept data), executes batches sequentially
- Plans within each batch run in parallel via Task tool
- Verifies chapter goal after all plans complete
- Updates requirements, roadmap, and state concepts

Usage: `/fuska-build 5`

### Roadmap Management

**`/fuska-add-chapter <description>`**
Add new chapter to end of current milestone.

- Updates roadmap concept
- Uses next sequential number
- Creates chapter concept

Usage: `/fuska-add-chapter Add admin dashboard`

**`/fuska-insert-chapter <after> <description>`**
Insert urgent work as decimal chapter between existing chapters.

- Creates intermediate chapter concept (e.g., chapter-07-1 between chapter-07 and chapter-08)
- Useful for discovered work that must happen mid-milestone
- Maintains chapter ordering

Usage: `/fuska-insert-chapter 7 Fix critical auth bug`
Result: Creates Chapter 7.1 concept

**`/fuska-remove-chapter <number>`**
Remove a future chapter and renumber subsequent chapters.

- Deletes chapter concept and all references
- Renumbers all subsequent chapters to close the gap
- Only works on future (unstarted) chapters
- Git commit preserves historical record

Usage: `/fuska-remove-chapter 17`
Result: Chapter 17 deleted, chapters 18-20 become 17-19

### Milestone Management

**`/fuska-new-milestone <name>`**
Start a new milestone through unified flow.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with chapter breakdown

Similar to `/fuska-configure` flow for brownfield projects (existing initiative concept).

Usage: `/fuska-new-milestone v2.0 Features`

**`/fuska-complete <version>`**
Archive completed milestone and prepare for next version.

- Creates milestone concept with stats
- Archives full details
- Creates git tag for the release
- Prepares workspace for next version

Usage: `/fuska-complete 1.0.0`

### Progress Tracking

**`fuska progress`** (CLI command)
Check project status and intelligently route to next action.

- Shows visual progress bar and completion percentage
- Summarizes recent work from summary concepts
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: `fuska progress`

### Debugging

**`/fuska-debug [issue description]`**
Systematic debugging with persistent state across context resets using MegaMemory.

- Gathers symptoms through adaptive questioning
- Creates debug session concept to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives `/new` — run `/fuska-debug` with no args to resume
- Archives resolved issues to resolved concepts

Usage: `/fuska-debug login button doesn't work`
Usage: `/fuska-debug` (resume active session)

### Todo Management

**`/fuska-add-todo [description]`**
Capture idea or task as todo from current conversation.

- Extracts context from conversation (or uses provided description)
- Creates structured todo concept
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates state concept todo count

Usage: `/fuska-add-todo` (infers from conversation)
Usage: `/fuska-add-todo Add auth token refresh`

**`/fuska-check-todos [area]`**
List pending todos and select one to work on.

- Lists all pending todo concepts with title, area, age
- Optional area filter (e.g., `/fuska-check-todos api`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to chapter, brainstorm)
- Moves todo to done when work begins

Usage: `/fuska-check-todos`
Usage: `/fuska-check-todos api`

### User Acceptance Testing

**`/fuska-review [chapter]`**
Validate built features through conversational verification.

- Extracts testable deliverables from summary concepts
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: `/fuska-review 3`

### Milestone Auditing

**`/fuska-audit [version]`**
Audit milestone completion against original intent.

- Queries all verification concepts
- Checks requirements coverage
- Spawns integration checker for cross-chapter wiring
- Creates audit concept with gaps and tech debt

Usage: `/fuska-audit`

**`/fuska-plan-milestone-fixes`**
Create chapters to close gaps identified by audit.

- Queries audit concept and groups gaps into chapters
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure chapters to roadmap concept
- Ready for `/fuska-plan` on new chapters

Usage: `/fuska-plan-milestone-fixes`

### Configuration

**`fuska config [project-dir]`** (CLI command)
Manage Fuska settings interactively.

- Quick settings: switch model profile + workflow mode
- Configure model aliases (quality/balanced/budget/explore)
- Git commit strategy (per-chapter/per-plan/per-task)
- Set/clear stage model overrides
- Reset presets (full wizard)

Usage: `fuska config`
Usage: `fuska config --view` (non-interactive display)

### Migration Utilities

**`fuska migrate planning [project-dir]`**
Migrate `.planning/` directory format to MegaMemory knowledge graph.

- Copies `.planning/` to `.planning.backup`, then creates MegaMemory concepts from all markdown files
- Use `--clean` to delete existing database before migrating

Usage: `fuska migrate planning`
Usage: `fuska migrate planning [project-dir] --clean`

**`fuska migrate terminology [project-dir]`**
Rename `phase`→`chapter` and `wave`→`batch` in an existing MegaMemory database.

- Updates concept IDs, names, summaries, and edge references in-place
- Run this if your database was created before Fuska renamed these concepts
- Prints a summary of renamed IDs, updated nodes, and fixed edges

Usage: `fuska migrate terminology`
Usage: `fuska migrate terminology [project-dir]`

### Quick Tasks

**`/fuska-do [mode] [description]`**
Execute unplanned, ad-hoc tasks with Fuska guarantees.

- Flexible mode selection: planned | checked | researched | verified
- Auto-executes for planned/verified; asks before executing for checked/researched
- Override plan review with --review (force) or --no-review (skip)
- Override commit with --auto-commit to skip the prompt and commit automatically
- Creates standalone task concepts (not tied to roadmap)

 Usage: `/fuska-do planned fix typo in README`
 Usage: `/fuska-do planned fix typo in README --no-review --auto-commit`
 Usage: `/fuska-do` (prompts for mode and description)

 ### Code Review

 **`/fuska-code-review`**
 Review uncommitted git changes against project context from MegaMemory.

 - Loads current chapter, plan, and research from MegaMemory for context
 - Gets git diff HEAD for all uncommitted changes
 - Spawns fuska-code-reviewer agent to check for bugs, security issues, plan deviations
 - Checks for stubs, missing wiring, and anti-patterns
 - Does NOT commit — returns findings for you to act on

 Use after manual coding, or when you want a quality check without the full `/fuska-do` pipeline.

 Usage: `/fuska-code-review`

  ### Codebase Analysis

 **`/fuska-refresh [--full] [--dead-code] [--json] [--prune]`**
 Refresh the import graph stored in MegaMemory.

 - Scans codebase for imports, exports, and symbols
 - Creates file and symbol concepts with usage edges
 - Detects potentially dead code (no incoming usage)
 - Incremental by default (only changed files)

 Flags:
 - `--full` -- Force full re-scan
 - `--dead-code` -- Only show dead code report
 - `--json` -- Output as JSON
 - `--prune` -- Remove stale dead code markers

 Usage: `/fuska-refresh`
 Usage: `/fuska-refresh --dead-code`

 **`/fuska-ask [question]`**
 Ask questions about the codebase using the import graph.

 Supported questions:
 - "What imports X?" / "Who imports X?"
 - "Who uses Symbol?" / "What calls X?"
 - "Is X dead code?"
 - "What if I delete X?"
 - "Where is Symbol defined?"
 - "What does X export?"

 Falls back to grep if import graph is empty or stale.

 Usage: `/fuska-ask Who uses AuthService?`
 Usage: `/fuska-ask Is ItemSelectionSheet dead code?`

 ### Utility Commands

 **`/fuska-help`**
 Show this command reference.

 ## MegaMemory Structure

All project data lives in MegaMemory concepts:

```
initiative (root)
├── config              # Workflow mode & gates
├── state               # Project memory & context
├── roadmap             # Current chapter breakdown
├── requirements/*      # Scoped requirements
├── codebase/*          # Codebase map (brownfield)
├── research/*          # Domain research
├── chapters/
│   ├── chapter-01        # Chapter concept
│   ├── chapter-01-context # Chapter context
│   ├── chapter-01-research # Chapter research
│   ├── chapter-01-01-plan  # Plan concept
│   ├── chapter-01-01-summary # Summary concept
│   └── ...
├── todos/
│   ├── pending/*       # Pending todo concepts
│   └── done/*          # Completed todo concepts
├── debug/
│   ├── session-001     # Active debug session
│   └── resolved-001    # Archived resolved issue
└── quick/
    └── 001-task        # Quick task concept
```

## Workflow Modes

Set during `/fuska-configure`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime with `fuska config`.

## Thinking Variants

Fuska agents use named thinking variants to control reasoning budget per step type:

| Variant | Thinking | Output | Used By |
|---------|----------|--------|---------|
| `plan` | 32k | ~33k | Researchers, planners, codebase mappers |
| `validate` | 24k | ~41k | Checkers, verifiers, debuggers |
| `execute` | 8k | ~57k | Executors, doc writers |
| `amend` | 16k | balanced | Git message generators, follow-ups |

Configure in your OpenCode model definition (`opencode.jsonc`):

```jsonc
"variants": {
  "plan": { "thinking": { "type": "enabled", "budgetTokens": 32000 } },
  "validate": { "thinking": { "type": "enabled", "budgetTokens": 24000 } },
  "execute": { "thinking": { "type": "enabled", "budgetTokens": 8000 } },
  "amend": { "thinking": { "type": "enabled", "budgetTokens": 16000 } }
}
```

Without variants, all agents use the model's default thinking budget.

## Common Workflows

**Starting a new initiative:**

```
fuska init "My Project"    # Initialize project foundation
/fuska-configure           # Questioning, research, requirements, roadmap
/new
/fuska-plan                # Plan current chapter (auto-detects chapter 1)
/new
/fuska-build               # Build the current chapter
```

Or just `/fuska` at any point to see where you are.

**Resuming work after a break:**

```
/fuska                     # See where you are and what to do next
```

**Adding urgent mid-milestone work:**

```
/fuska-insert 5 "Critical security fix"
/fuska-plan 5.1
/fuska-build 5.1
```

**Completing a milestone:**

```
/fuska-complete 1.0.0
/new
/fuska-milestone           # Start next milestone
```

**Capturing ideas during work:**

```
/fuska-add-todo                       # Capture from conversation context
/fuska-add-todoFix modal z-index      # Capture with explicit description
/fuska-check-todos                       # Review and work on todos
/fuska-check-todos api                   # Filter by area
```

**Debugging an issue:**

```
/fuska-debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/new
/fuska-debug                                    # Resume from where you left off
```

## Getting Help

- `/fuska` — see where you are and what to do next
- Query initiative concept for initiative vision
- Query state concept for current context
- Query roadmap concept for chapter status
- Run `fuska progress` to check where you're up to

## MegaMemory Query Examples

All data access uses `megamemory:understand()`:

```
# Get project state
megamemory_understand(query="state", top_k=5)

# Get roadmap
megamemory_understand(query="roadmap", top_k=5)

# Get all requirements
megamemory_understand(query="requirements", top_k=50)

# Get chapter plans
megamemory_understand(query="chapter-01-plan", top_k=20)

# Get chapter research
megamemory_understand(query="chapter-01-research", top_k=1)

# List all debug sessions
megamemory_understand(query="debug session", top_k=20)
```
</reference>
