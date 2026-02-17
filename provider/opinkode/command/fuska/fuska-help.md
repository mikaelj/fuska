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
fuska init → /fuska configure → /fuska plan → /fuska execute → repeat
```

**`/fuska`** is the universal entry point. Run it bare to see where you are, or with a verb to act:
\* `/fuska` — show current position and what to do next
\* `/fuska plan` — plan the current phase (auto-detects phase number)
\* `/fuska execute` — build the current phase
\* `/fuska do [mode] [desc]` — quick ad-hoc task

All `/fuska-*` commands below also work directly.

## Project Initialization

\* `fuska init` — Initialize project foundation (then `/fuska-configure-initiative`).
\* `/fuska-configure-initiative` — Configure initiative through unified flow.
\* `/fuska-map-codebase` — Map an existing codebase for brownfield projects.

## Phase Planning

\* `/fuska-discuss-phase <number>` — Articulate your vision for a phase before planning.
\* `/fuska-research-phase <number>` — Ecosystem research for niche/complex domains.
\* `/fuska-list-phase-assumptions <number>` — See what's planned before execution.
\* `/fuska-plan-phase <number>` — Create detailed execution plan.

## Execution

\* `/fuska-execute-phase <phase-number>` — Execute all plans in a phase with wave-based parallelization.

## Roadmap Management

\* `/fuska-add-phase <description>` — Add new phase to end of current milestone.
\* `/fuska-insert-phase <after> <description>` — Insert urgent work as decimal phase.
\* `/fuska-remove-phase <number>` — Remove a future phase and renumber subsequent phases.

## Milestone Management

\* `/fuska-new-milestone <name>` — Start a new milestone through unified flow.
\* `/fuska-complete-milestone <version>` — Archive completed milestone and prepare for next version.

## Progress Tracking

\* `fuska progress` — Check project status and intelligently route to next action.
\* `/fuska-resume-work` — Resume work from previous session with full context restoration.
\* `/fuska-pause-work` — Capture mental context when pausing work mid-phase.

## Debugging

\* `/fuska-debug [issue description]` — Systematic debugging with persistent state across context resets.

## Todo Management

\* `/fuska-add-todo [description]` — Capture idea or task as todo from current conversation.
\* `/fuska-check-todos [area]` — List pending todos and select one to work on.

## User Acceptance Testing

\* `/fuska-verify-work [phase]` — Validate built features through conversational UAT.

## Milestone Auditing

\* `/fuska-audit-milestone [version]` — Audit milestone completion against original intent.
\* `/fuska-plan-milestone-gaps` — Create phases to close gaps identified by audit.

## Configuration

\* `fuska config [project-dir]` — Manage Fuska settings interactively.

## Quick Tasks

\* `/fuska-do [mode] [description]` — Execute unplanned, ad-hoc tasks with Fuska guarantees.

## Codebase Analysis

\* `/fuska-refresh [--full] [--dead-code] [--json] [--prune]` — Refresh import graph with symbol indexing.
\* `/fuska-ask [question]` — Ask questions about the codebase using import graph data.

## Utility Commands

\* `/fuska-help` — Show this command reference.

## Getting Help

\* Run `/fuska` to see where you are and what to do next
\* Run `fuska progress` for detailed project status
\* Query `state` concept for current context
\* Query `roadmap` concept for phase status

---

# Full Verbose Format (Documentation Export Only)

# Fuska Command Reference

**Fuska** — Lean solo agentic development with MegaMemory knowledge graph. Works with OpenCode and Claude Code.

## Quick Start

1. `fuska init "My Project"` - Initialize project foundation (git, .megamemory/)
2. `/fuska` - See what to do next (or `/fuska configure` directly)
3. `/fuska plan` - Plan the current phase (auto-detects phase number)
4. `/fuska execute` - Build the current phase

## Core Workflow

```
fuska init → /fuska configure → /fuska plan → /fuska execute → repeat
```

**`/fuska`** is the universal entry point. Run bare to navigate, or with a verb to act. All `/fuska-*` commands also work directly.

### Project Initialization

**`fuska init [name]`**
Initialize project foundation.

Creates:
- `.megamemory/` directory for knowledge graph
- Main initiative concept in MegaMemory
- Git repository (if not already initialized)

Usage: `fuska init "My Project Name"`

**`/fuska-configure-initiative`**
Configure existing initiative through unified flow.

One command takes you from idea to ready-for-planning:
- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown and success criteria

Creates all MegaMemory concepts:
- `project` — root concept for the project
- `config` — workflow mode (interactive/yolo), model profile
- `research/*` — domain research (if selected)
- `requirements/*` — scoped requirements with REQ-IDs
- `roadmap` — phases mapped to requirements
- `state` — project memory and context

Usage: `/fuska-configure-initiative`

**`/fuska-map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates MegaMemory codebase concepts with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/fuska-configure-initiative` on existing codebases

Usage: `/fuska-map-codebase`

### Phase Planning

**`/fuska-discuss-phase <number>`**
Help articulate your vision for a phase before planning.

- Captures how you imagine this phase working
- Creates context concept with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/fuska-discuss-phase 2`

**`/fuska-research-phase <number>`**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates research concept with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/fuska-research-phase 3`

**`/fuska-list-phase-assumptions <number>`**
See what OpenCode is planning to do before it starts.

- Shows OpenCode's intended approach for a phase
- Lets you course-correct if OpenCode misunderstood your vision
- No concepts created - conversational output only

Usage: `/fuska-list-phase-assumptions 3`

**`/fuska-plan-phase <number>`**
Create detailed execution plan for a specific phase.

- Generates plan concepts in MegaMemory (e.g., `phase-01-01-plan`)
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (01, 02, etc.)

Usage: `/fuska-plan-phase 1`
Result: Creates plan concepts like `phase-01-01-plan`, `phase-01-02-plan`

### Execution

**`/fuska-execute-phase <phase-number>`**
Execute all plans in a phase.

- Groups plans by wave (from concept data), executes waves sequentially
- Plans within each wave run in parallel via Task tool
- Verifies phase goal after all plans complete
- Updates requirements, roadmap, and state concepts

Usage: `/fuska-execute-phase 5`

### Roadmap Management

**`/fuska-add-phase <description>`**
Add new phase to end of current milestone.

- Updates roadmap concept
- Uses next sequential number
- Creates phase concept

Usage: `/fuska-add-phase "Add admin dashboard"`

**`/fuska-insert-phase <after> <description>`**
Insert urgent work as decimal phase between existing phases.

- Creates intermediate phase concept (e.g., phase-07-1 between phase-07 and phase-08)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: `/fuska-insert-phase 7 "Fix critical auth bug"`
Result: Creates Phase 7.1 concept

**`/fuska-remove-phase <number>`**
Remove a future phase and renumber subsequent phases.

- Deletes phase concept and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: `/fuska-remove-phase 17`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`/fuska-new-milestone <name>`**
Start a new milestone through unified flow.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with phase breakdown

Similar to `/fuska-configure-initiative` flow for brownfield projects (existing initiative concept).

Usage: `/fuska-new-milestone "v2.0 Features"`

**`/fuska-complete-milestone <version>`**
Archive completed milestone and prepare for next version.

- Creates milestone concept with stats
- Archives full details
- Creates git tag for the release
- Prepares workspace for next version

Usage: `/fuska-complete-milestone 1.0.0`

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

### Session Management

**`/fuska-resume-work`**
Resume work from previous session with full context restoration.

- Shows exact task position from state (e.g., "Task 4 of 7")
- If paused earlier, shows your mental context
- Detects incomplete work and checkpoints
- Routes to appropriate next action

Usage: `/fuska-resume-work`

**`/fuska-pause-work`**
Capture mental context when pausing work mid-phase.

- Asks for your mental context (approach, next steps)
- Creates handoff concept with mental context + modified files
- Task position is already tracked continuously (no calculation needed)
- Optional: creates WIP commit for uncommitted changes

Usage: `/fuska-pause-work`

### Debugging

**`/fuska-debug [issue description]`**
Systematic debugging with persistent state across context resets using MegaMemory.

- Gathers symptoms through adaptive questioning
- Creates debug session concept to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives `/new` — run `/fuska-debug` with no args to resume
- Archives resolved issues to resolved concepts

Usage: `/fuska-debug "login button doesn't work"`
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
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done when work begins

Usage: `/fuska-check-todos`
Usage: `/fuska-check-todos api`

### User Acceptance Testing

**`/fuska-verify-work [phase]`**
Validate built features through conversational UAT.

- Extracts testable deliverables from summary concepts
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: `/fuska-verify-work 3`

### Milestone Auditing

**`/fuska-audit-milestone [version]`**
Audit milestone completion against original intent.

- Queries all verification concepts
- Checks requirements coverage
- Spawns integration checker for cross-phase wiring
- Creates audit concept with gaps and tech debt

Usage: `/fuska-audit-milestone`

**`/fuska-plan-milestone-gaps`**
Create phases to close gaps identified by audit.

- Queries audit concept and groups gaps into phases
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure phases to roadmap concept
- Ready for `/fuska-plan-phase` on new phases

Usage: `/fuska-plan-milestone-gaps`

### Configuration

**`fuska config [project-dir]`** (CLI command)
Manage Fuska settings interactively.

- Quick settings: switch model profile + workflow mode
- Configure model aliases (quality/balanced/budget)
- Git commit strategy (per-phase/per-plan/per-task)
- Set/clear stage model overrides
- Reset presets (full wizard)

Usage: `fuska config`
Usage: `fuska config --view` (non-interactive display)

### Quick Tasks

**`/fuska-do [mode] [description]`**
Execute unplanned, ad-hoc tasks with Fuska guarantees.

- Flexible mode selection: planned | checked | researched | verified
- Auto-executes for planned/verified; asks before executing for checked/researched
- Override with --ask or --auto flag
- Creates standalone task concepts (not tied to roadmap)

Usage: `/fuska-do planned fix typo in README`
Usage: `/fuska-do` (prompts for mode and description)

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

 Usage: `/fuska-ask "Who uses AuthService?"`
 Usage: `/fuska-ask "Is ItemSelectionSheet dead code?"`

 ### Utility Commands

 **`/fuska-help`**
 Show this command reference.

 ## MegaMemory Structure

All project data lives in MegaMemory concepts:

```
initiative (root)
├── config              # Workflow mode & gates
├── state               # Project memory & context
├── roadmap             # Current phase breakdown
├── requirements/*      # Scoped requirements
├── codebase/*          # Codebase map (brownfield)
├── research/*          # Domain research
├── phases/
│   ├── phase-01        # Phase concept
│   ├── phase-01-context # Phase context
│   ├── phase-01-research # Phase research
│   ├── phase-01-01-plan  # Plan concept
│   ├── phase-01-01-summary # Summary concept
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

Set during `/fuska-configure-initiative`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime with `fuska config`.

## Common Workflows

**Starting a new initiative:**

```
fuska init "My Project"    # Initialize project foundation
/fuska configure           # Questioning, research, requirements, roadmap
/new
/fuska plan                # Plan current phase (auto-detects phase 1)
/new
/fuska execute             # Build the current phase
```

Or just `/fuska` at any point to see where you are.

**Resuming work after a break:**

```
/fuska                     # See where you are and what to do next
/fuska resume              # Full context restoration from previous session
```

**Adding urgent mid-milestone work:**

```
/fuska insert 5 "Critical security fix"
/fuska plan 5.1
/fuska execute 5.1
```

**Completing a milestone:**

```
/fuska complete 1.0.0
/new
/fuska milestone           # Start next milestone
```

**Capturing ideas during work:**

```
/fuska todo                        # Capture from conversation context
/fuska todo Fix modal z-index      # Capture with explicit description
/fuska todos                       # Review and work on todos
/fuska todos api                   # Filter by area
```

**Debugging an issue:**

```
/fuska debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/new
/fuska debug                                    # Resume from where you left off
```

## Getting Help

- `/fuska` — see where you are and what to do next
- Query initiative concept for initiative vision
- Query state concept for current context
- Query roadmap concept for phase status
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

# Get phase plans
megamemory_understand(query="phase-01-plan", top_k=20)

# Get phase research
megamemory_understand(query="phase-01-research", top_k=1)

# List all debug sessions
megamemory_understand(query="debug session", top_k=20)
```
</reference>
