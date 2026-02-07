---
name: gsd-mm-help
description: Show available GSD-MM commands and usage guide
---

<objective>
Display the complete GSD-MM command reference.

Output ONLY the reference content below. Do NOT add:

- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<reference>
# GSD-MM Command Reference

**GSD-MM** (Get Shit Done - MegaMemory) creates hierarchical project plans optimized for solo agentic development with OpenCode, storing all project data in MegaMemory knowledge graph.

## Quick Start

1. `/gsd-mm-new-project` - Initialize project (includes research, requirements, roadmap)
2. `/gsd-mm-plan-phase 1` - Create detailed plan for first phase
3. `/gsd-mm-execute-phase 1` - Execute the phase

## Core Workflow

```
/gsd-mm-new-project → /gsd-mm-plan-phase → /gsd-mm-execute-phase → repeat
```

### Project Initialization

**`/gsd-mm-new-project`**
Initialize new project through unified flow.

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

Usage: `/gsd-mm-new-project`

**`/gsd-mm-map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates MegaMemory codebase concepts with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/gsd-mm-new-project` on existing codebases

Usage: `/gsd-mm-map-codebase`

### Phase Planning

**`/gsd-mm-discuss-phase <number>`**
Help articulate your vision for a phase before planning.

- Captures how you imagine this phase working
- Creates context concept with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/gsd-mm-discuss-phase 2`

**`/gsd-mm-research-phase <number>`**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates research concept with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/gsd-mm-research-phase 3`

**`/gsd-mm-list-phase-assumptions <number>`**
See what OpenCode is planning to do before it starts.

- Shows OpenCode's intended approach for a phase
- Lets you course-correct if OpenCode misunderstood your vision
- No concepts created - conversational output only

Usage: `/gsd-mm-list-phase-assumptions 3`

**`/gsd-mm-plan-phase <number>`**
Create detailed execution plan for a specific phase.

- Generates plan concepts in MegaMemory (e.g., `phase-01-01-plan`)
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (01, 02, etc.)

Usage: `/gsd-mm-plan-phase 1`
Result: Creates plan concepts like `phase-01-01-plan`, `phase-01-02-plan`

### Execution

**`/gsd-mm-execute-phase <phase-number>`**
Execute all plans in a phase.

- Groups plans by wave (from concept data), executes waves sequentially
- Plans within each wave run in parallel via Task tool
- Verifies phase goal after all plans complete
- Updates requirements, roadmap, and state concepts

Usage: `/gsd-mm-execute-phase 5`

### Quick Mode

**`/gsd-mm-quick`**
Execute small, ad-hoc tasks with GSD-MM guarantees but skip optional agents.

Quick mode uses the same system with a shorter path:
- Spawns planner + executor (skips researcher, checker, verifier)
- Quick tasks live as separate concepts from planned phases
- Updates state concept tracking (not roadmap concept)

Use when you know exactly what to do and the task is small enough to not need research or verification.

Usage: `/gsd-mm-quick`
Result: Creates quick task concepts and summary concepts

### Roadmap Management

**`/gsd-mm-add-phase <description>`**
Add new phase to end of current milestone.

- Updates roadmap concept
- Uses next sequential number
- Creates phase concept

Usage: `/gsd-mm-add-phase "Add admin dashboard"`

**`/gsd-mm-insert-phase <after> <description>`**
Insert urgent work as decimal phase between existing phases.

- Creates intermediate phase concept (e.g., phase-07-1 between phase-07 and phase-08)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: `/gsd-mm-insert-phase 7 "Fix critical auth bug"`
Result: Creates Phase 7.1 concept

**`/gsd-mm-remove-phase <number>`**
Remove a future phase and renumber subsequent phases.

- Deletes phase concept and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: `/gsd-mm-remove-phase 17`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`/gsd-mm-new-milestone <name>`**
Start a new milestone through unified flow.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with phase breakdown

Mirrors `/gsd-mm-new-project` flow for brownfield projects (existing project concept).

Usage: `/gsd-mm-new-milestone "v2.0 Features"`

**`/gsd-mm-complete-milestone <version>`**
Archive completed milestone and prepare for next version.

- Creates milestone concept with stats
- Archives full details
- Creates git tag for the release
- Prepares workspace for next version

Usage: `/gsd-mm-complete-milestone 1.0.0`

### Progress Tracking

**`/gsd-mm-progress`**
Check project status and intelligently route to next action.

- Shows visual progress bar and completion percentage
- Summarizes recent work from summary concepts
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: `/gsd-mm-progress`

### Session Management

**`/gsd-mm-resume-work`**
Resume work from previous session with full context restoration.

- Queries state concept for project context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: `/gsd-mm-resume-work`

**`/gsd-mm-pause-work`**
Create context handoff when pausing work mid-phase.

- Creates handoff concept with current state
- Updates state concept session continuity section
- Captures in-progress work context

Usage: `/gsd-mm-pause-work`

### Debugging

**`/gsd-mm-debug [issue description]`**
Systematic debugging with persistent state across context resets using MegaMemory.

- Gathers symptoms through adaptive questioning
- Creates debug session concept to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives `/new` — run `/gsd-mm-debug` with no args to resume
- Archives resolved issues to resolved concepts

Usage: `/gsd-mm-debug "login button doesn't work"`
Usage: `/gsd-mm-debug` (resume active session)

### Todo Management

**`/gsd-mm-add-todo [description]`**
Capture idea or task as todo from current conversation.

- Extracts context from conversation (or uses provided description)
- Creates structured todo concept
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates state concept todo count

Usage: `/gsd-mm-add-todo` (infers from conversation)
Usage: `/gsd-mm-add-todo Add auth token refresh`

**`/gsd-mm-check-todos [area]`**
List pending todos and select one to work on.

- Lists all pending todo concepts with title, area, age
- Optional area filter (e.g., `/gsd-mm-check-todos api`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done when work begins

Usage: `/gsd-mm-check-todos`
Usage: `/gsd-mm-check-todos api`

### User Acceptance Testing

**`/gsd-mm-verify-work [phase]`**
Validate built features through conversational UAT.

- Extracts testable deliverables from summary concepts
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: `/gsd-mm-verify-work 3`

### Milestone Auditing

**`/gsd-mm-audit-milestone [version]`**
Audit milestone completion against original intent.

- Queries all verification concepts
- Checks requirements coverage
- Spawns integration checker for cross-phase wiring
- Creates audit concept with gaps and tech debt

Usage: `/gsd-mm-audit-milestone`

**`/gsd-mm-plan-milestone-gaps`**
Create phases to close gaps identified by audit.

- Queries audit concept and groups gaps into phases
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure phases to roadmap concept
- Ready for `/gsd-mm-plan-phase` on new phases

Usage: `/gsd-mm-plan-milestone-gaps`

### Configuration

**`/gsd-mm-settings`**
Configure workflow toggles and model profile interactively.

- Toggle researcher, plan checker, verifier agents
- Select model profile (quality/balanced/budget)
- Updates config concept

Usage: `/gsd-mm-settings`

**`/gsd-mm-set-profile <profile>`**
Quick switch model profile for GSD-MM agents.

- `quality` — Opus everywhere except verification
- `balanced` — Opus for planning, Sonnet for execution (default)
- `budget` — Sonnet for writing, Haiku for research/verification

Usage: `/gsd-mm-set-profile budget`

 ### Utility Commands
 
 **`/gsd-help`**
 Show this command reference.
 
 ## MegaMemory Structure

All project data lives in MegaMemory concepts:

```
project (root)
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

Set during `/gsd-mm-new-project`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime by editing config concept with `/gsd-mm-settings`.

## Common Workflows

**Starting a new project:**

```
/gsd-mm-new-project      # Unified flow: questioning → research → requirements → roadmap
/new
/gsd-mm-plan-phase 1     # Create plans for first phase
/new
/gsd-mm-execute-phase 1  # Execute all plans in phase
```

**Resuming work after a break:**

```
/gsd-mm-progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/gsd-mm-insert-phase 5 "Critical security fix"
/gsd-mm-plan-phase 5.1
/gsd-mm-execute-phase 5.1
```

**Completing a milestone:**

```
/gsd-mm-complete-milestone 1.0.0
/new
/gsd-mm-new-milestone  # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/gsd-mm-add-todo                    # Capture from conversation context
/gsd-mm-add-todo Fix modal z-index  # Capture with explicit description
/gsd-mm-check-todos                 # Review and work on todos
/gsd-mm-check-todos api             # Filter by area
```

**Debugging an issue:**

```
/gsd-mm-debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/new
/gsd-mm-debug                                    # Resume from where you left off
```

## Getting Help

- Query project concept for project vision
- Query state concept for current context
- Query roadmap concept for phase status
- Run `/gsd-mm-progress` to check where you're up to

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
