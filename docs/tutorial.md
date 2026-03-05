# Fuska Tutorial: Build a Todo App with AI-Driven Project Management

> **"Fuska"** means "to cheat" in Swedish — because the smartest way to build software is to let AI do the heavy lifting.

This tutorial walks you through building a one-page web Todo app using **Fuska**, an initiative-based project management system for solo agentic development. By the end you'll understand how Fuska structures work into initiatives, chapters, and plans — and why that beats winging it with a blank prompt.

**What you'll learn:**

- Installing and configuring Fuska
- Initializing a project with `fuska init`
- Configuring your initiative interactively with `/fuska-configure`
- Designing chapters with `/fuska-design`
- Working through chapters: plan → build → review
- How the expert panel plan-checker and code reviewer catch problems before they ship
- Completing a milestone with `/fuska-complete`

**Prerequisites:**

- Node.js >= 18
- Git
- [OpenCode](https://github.com/nichochar/opencode) installed (or Claude Code)
- An API key for your preferred LLM provider (Anthropic, OpenAI, etc.)

---

## Part 1 — Install Fuska

### 1.1 Install the npm package

```bash
npm install -g fuska-magistern@latest
```

This gives you the `fuska` CLI globally.

### 1.2 Run the Fuska installer

```bash
fuska install
```

You'll be prompted to select your AI provider:

```
? Select provider(s) to install for:
  ❯ opencode
    claude
    both
```

Pick **opencode** (or your provider of choice). Fuska creates symlinks so future `npm update -g fuska-magistern` updates take effect immediately — no reinstall needed.

**What just happened?** Fuska installed slash commands (`/fuska-configure`, `/fuska-plan`, `/fuska-build`, etc.) as OpenCode user commands. MegaMemory registration happens later during `fuska init`.

---

## Part 2 — Configure Fuska (Global Settings)

Before creating a project, you can tweak Fuska's global configuration:

```bash
fuska config
```

This opens an interactive TUI where you can set:

- **Model aliases** — map `quality_model`, `balanced_model`, `budget_model` to any OpenCode-supported model
- **Default workflow mode** — `standard`, `thorough`, `balanced`, `fast`, `quick`, or `direct`
- **Commit strategy** — `per-task`, `per-plan`, or `per-chapter`
- **Interactive review** — whether to prompt you before building

For this tutorial, the defaults work fine. Move on or explore the settings — the TUI is self-explanatory.

> **Why this matters:** Unlike raw AI coding where you configure nothing and get inconsistent results, Fuska lets you lock in your preferences once. Every future session respects them.

---

## Part 3 — Create the Todo App Project

### 3.1 Scaffold the project

```bash
mkdir fuska-todo-app
cd fuska-todo-app
git init
```

Create a minimal starting point — just an empty `index.html`:

```bash
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App</title>
</head>
<body>
  <h1>Todo App</h1>
</body>
</html>
EOF

git add -A && git commit -m "chore: initial scaffold"
```

### 3.2 Initialize Fuska

```bash
fuska init --no-map
```

Output:

```
Created initiative: Main
MegaMemory MCP configured for opencode

Updating local permissions...
  Updated .opencode/opencode.jsonc with 3 fuska permission(s)

  fuska map                 Run codebase analysis later

MegaMemory MCP: registered automatically.
Next: Run `opencode` then `/fuska-configure <description>` to complete setup.
```

This does several things:

1. **Creates `.megamemory/`** — the SQLite knowledge graph database
2. **Creates the "main" initiative** — with state, roadmap, milestones, todos, and research modules
3. **Registers MegaMemory as an MCP server** so your AI agent can read/write project knowledge
4. **Configures permissions** — grants the AI agent access to Fuska's slash commands

The `--no-map` flag skips codebase analysis (useful for greenfield projects with nothing to analyze yet). You can always run `fuska map` later.

> **Why this matters (vs. manual AI coding):** Without Fuska, your AI agent starts every session with zero context. It doesn't know what you've built, what you've decided, or where you left off. With `fuska init`, all that context is persisted in MegaMemory's knowledge graph — forever searchable, session-independent.

---

## Part 4 — Configure the Initiative (Interactive Mode)

Launch OpenCode in your project directory:

```bash
opencode
```

Then run the configure command with your project description:

```
/fuska-configure A single-page vanilla JS todo app with local storage persistence, add/complete/delete tasks, and a clean modern UI
```

### Step 1 — Project context

Since you provided a description, Fuska skips the questioning phase and derives context directly:

```
-----------------------------------------------------
 Fuska: CONFIGURE INITIATIVE
-----------------------------------------------------

Description provided. Deriving project context...

Project: Single-page vanilla JS todo app
Core Value: Zero-dependency todo management that works offline and persists data locally
```

### Step 2 — Workflow preferences

Fuska asks 7 questions about how you want to work:

```
? How do you want to work?
  ❯ YOLO (Recommended) — Auto-approve, just execute
    Interactive — Confirm at each step

? How thorough should planning be?
    Quick — Ship fast (3-5 chapters, 1-3 plans each)
  ❯ Standard — Balanced scope and speed (5-8 chapters, 3-5 plans each)
    Comprehensive — Thorough coverage (8-12 chapters, 5-10 plans each)

? Run plans in parallel?
    Parallel (Recommended) — Independent plans run simultaneously
  ❯ Sequential — One plan at a time

? How should git commits be structured?
  ❯ Per chapter (Recommended) — One commit when all plans complete
    Per plan — One commit per plan
    Per task — One commit per task (most granular)

? Research before planning each chapter?
  ❯ Yes (Recommended) — Investigate domain, find patterns, surface gotchas
    No — Plan directly from requirements

? Verify plans will achieve their goals?
  ❯ Yes (Recommended) — Catch gaps before execution starts
    No — Execute plans without verification

? Review work satisfies requirements after each chapter?
  ❯ Yes (Recommended) — Confirm deliverables match chapter goals
    No — Trust execution, skip verification
```

For this tutorial, the user chose: Interactive, Quick, Sequential, Per chapter, Yes, Yes, Yes.

### Step 3 — Research

With research enabled, Fuska investigates the domain before defining requirements:

```
-----------------------------------------------------
 Fuska: RESEARCHING
-----------------------------------------------------

Researching todo app ecosystem...

[IN_PROGRESS] Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

The four researchers run concurrently, each exploring a different dimension. The **stack researcher** evaluated build tools (recommending Vite), CSS approaches (CSS Custom Properties), testing options (Vitest), and storage patterns (localStorage abstraction). The **features researcher** categorized table-stakes vs. differentiator features. The **architecture researcher** analyzed component patterns and data flow. The **pitfalls researcher** surfaced common gotchas (XSS via innerHTML, localStorage quota limits, timezone edge cases).

All findings are stored in MegaMemory as research concepts — available to every downstream agent.

### Step 4 — Requirements

Based on the description and research, Fuska defines scoped requirements:

```
-----------------------------------------------------
 Fuska: DEFINING REQUIREMENTS
-----------------------------------------------------

V1 Requirements (13 total)

CORE Features:
- CORE-01: Add new tasks with text input validation
- CORE-02: Mark tasks complete/incomplete with visual feedback
- CORE-03: Delete tasks with confirmation
- CORE-04: Edit existing task text

STORAGE Features:
- STORAGE-01: Persist todos to localStorage with JSON and error handling
- STORAGE-02: Load todos from localStorage on initialization

UI Features:
- UI-01: Clean modern UI with semantic HTML, CSS variables, responsive design
- UI-02: Filter todos by status (all/active/completed)
- UI-03: Display task counts (total, active, completed)
- UI-04: Bulk delete all completed tasks
- UI-05: Empty state message when no todos exist
- UI-06: Keyboard support (Enter, Tab, Escape)

ENHANCEMENT Features:
- ENHANCE-01: Due dates with date picker, overdue indicators, sorting
```

### Step 5 — Roadmap

Fuska generates a chapter-based roadmap and maps every requirement to exactly one chapter:

```
-----------------------------------------------------
 Fuska: CREATING ROADMAP
-----------------------------------------------------
```

| Chapter | Goal | Requirements |
|---------|------|--------------|
| 1 - UI Foundation | Clean, responsive, accessible interface | UI-01, UI-05, UI-06 |
| 2 - Core Operations | Create, complete, edit, delete tasks | CORE-01, CORE-02, CORE-03, CORE-04 |
| 3 - Data Persistence | Todos survive browser refresh | STORAGE-01, STORAGE-02 |
| 4 - Filtering & Management | Organize and manage tasks efficiently | UI-02, UI-03, UI-04 |
| 5 - Due Dates | Track deadlines and overdue items | ENHANCE-01 |

After you approve, Fuska presents the summary:

```
-----------------------------------------------------
  Fuska: Initiative configured
-----------------------------------------------------

**Main**

| Concept Type | Count |
|-------------|--------|
| Requirements | 13 |
| Chapters      | 5 |
| Research     | 4 |

All v1 requirements mapped to chapters [OK]
```

**This is where Fuska diverges fundamentally from "just ask the AI to build it."** Instead of a single vague prompt, you now have:

- **13 structured requirements** captured permanently
- **A 5-chapter roadmap** with explicit deliverables
- **Research findings** informing every decision
- **Everything stored in MegaMemory** — searchable, persistent, resumable

---

## Part 4.5 — Design (Optional)

Before planning, you can discuss a chapter's design to lock in decisions that guide downstream agents:

```
/fuska-design 1
```

```
-----------------------------------------------------
  Fuska: Chapter 1 Design Session
-----------------------------------------------------

**Chapter 1: UI Foundation**

Goal: Users see a clean, responsive, accessible todo interface ready for task management
Status: Not Started

This session gathers context and decisions to guide planning.
You'll discuss implementation choices for this chapter.
```

Fuska surfaces its assumptions (technical approach, implementation order, scope boundaries, risks) and asks you to validate them. Once assumptions are confirmed, it identifies **gray areas** — decisions that could go multiple ways:

- **Visual Design & Layout** — Color scheme, spacing, typography, what "clean modern" means
- **Empty State Messaging** — What the empty state says, how prominent, any illustrations
- **Keyboard Navigation** — Tab order strategy, focus indicators, Enter/Escape behavior
- **Responsive Behavior** — Breakpoints, mobile vs desktop priorities

For each area, you discuss and capture concrete decisions. For example:

- Color scheme: Light gray background (#f4f6f8), white cards, blue accent (#3b82f6)
- Typography: System font stack (Inter, system-ui), base 16px
- Breakpoints: 480px (phones), 768px (tablets), 1024px (desktop)
- Touch targets: Minimum 44px height
- Empty state: "No tasks yet. Add your first task to get started!"

These decisions are stored as a **chapter context concept** in MegaMemory. Every downstream agent — researcher, planner, executor — reads this context and respects these decisions without asking you again.

---

## Part 5 — Work Through the Chapters

### 5.1 Chapter 1: UI Foundation

#### Plan

```
/fuska-plan 1
```

Fuska researches the chapter domain, then spawns the planner:

```
-----------------------------------------------------
 Fuska: RESEARCHING CHAPTER 1
-----------------------------------------------------
```

```
-----------------------------------------------------
 Fuska: PLANNING CHAPTER 1
-----------------------------------------------------
```

The planner creates 3 plans in 2 batches:

| Batch | Plan | Objective |
|-------|------|-----------|
| 1 | chapter-01-plan-01 | Set up Vite project and create semantic HTML with accessibility |
| 1 | chapter-01-plan-02 | Create CSS with custom properties and mobile-first responsive layout |
| 2 | chapter-01-plan-03 | Add keyboard event handlers and empty state SVG icon |

Because plan verification is enabled, the plans go through the **expert panel** — three specialized reviewers (Quality Advocate, contextual role, dynamic expert) who independently evaluate the plans:

```
-----------------------------------------------------
 Fuska: VERIFYING PLANS
-----------------------------------------------------

## VERIFICATION PASSED

Chapter: Chapter 1: UI Foundation
Plans verified: 3
Status: All checks passed
```

All 7 verification checks pass: requirement coverage (UI-01, UI-05, UI-06), task completeness, dependency correctness, scope sanity, and context fidelity.

#### Build

```
/fuska-build chapter-1
```

```
-----------------------------------------------------
  Fuska: Chapter 1 Execution Plan
-----------------------------------------------------

**Chapter 1: UI Foundation**

Goal: Users see a clean, responsive, accessible todo interface

3 plan(s) to execute in 2 batch(s):

### Batch 1
- **chapter-01-plan-01**: Vite setup + semantic HTML + accessibility
- **chapter-01-plan-02**: CSS custom properties + mobile-first layout

### Batch 2
- **chapter-01-plan-03**: Keyboard handlers + empty state SVG
```

The builder executes each plan. After all plans complete, the **code reviewer** validates the implementation:

```
## REVIEW PASSED

Task: Chapter 01 - Clean, responsive, accessible todo interface
Files reviewed: 7
Status: All checks passed

| Dimension | Status | Notes |
|-----------|--------|-------|
| Plan Fulfillment | PASS | All 3 plan tasks fully implemented |
| Completeness | PASS | No stubs, TODOs, or placeholders |
| Wiring | PASS | All files properly connected |
| Anti-Patterns | PASS | No blocking issues |
```

Chapter verification confirms 3/3 requirements verified (UI-01, UI-05, UI-06) and 5 artifacts checked.

```
[main 64b0755] feat(ui): establish todo app foundation with Vite and accessible UI
 7 files changed, 1215 insertions(+), 8 deletions(-)
```

> **This is the key insight.** Without Fuska, your AI agent would just start writing code. No review, no second opinion, no accessibility check. Fuska's expert panel catches issues *before a single line of code is written*, and the code reviewer validates *after* — with up to 3 fix iterations automatically.

### 5.2 Chapter 2: Core Operations

```
/fuska-plan 2
/fuska-build 2
```

Chapter 2 follows the same plan → verify → build → review cycle. It implements:

- State management with in-memory todos array
- CRUD operations (add, toggle complete, delete with confirmation, inline edit)
- Input validation (trim, non-empty check)
- Visual feedback (strikethrough + 0.6 opacity for completed, highlight animation for new tasks)
- Event delegation pattern for efficient event handling
- Unidirectional data flow (action → update state → render)

All 3 plans execute in a single batch. Code review passes on all dimensions.

### 5.3 Chapter 3: Data Persistence

#### Plan

```
/fuska-plan chapter-3
```

The planner creates 2 plans in 2 batches:

| Batch | Plan | Objective |
|-------|------|-----------|
| 1 | chapter-03-plan-01 | StorageService and integration |
| 2 | chapter-03-plan-02 | Cross-tab sync (depends on Plan 01) |

**Here's where plan verification earns its keep.** The first verification found issues:

```
-----------------------------------------------------
 Fuska: VERIFYING PLANS
-----------------------------------------------------

Iteration 1: Issues found
  HIGH: Schema validation missing on localStorage load
  MEDIUM: Unclear 'isNew' flag behavior
  MEDIUM: Input sanitization not documented
```

The planner revises, the checker re-evaluates. It took **3 iterations** to pass — 5 issues fixed in total:

```
Iteration 3:
## VERIFICATION PASSED — 5 issues fixed across 3 iterations
```

> Without plan checking, the schema validation gap would have shipped — and you'd discover it as a runtime bug when a user has corrupted localStorage data.

#### Build

```
/fuska-build chapter-3
```

The builder creates `src/storage.js` (141 lines) with the `StorageService` class: `load()`, `save()`, `clear()`, `validateTodoArray()`, plus feature detection, schema validation, and error handling. Cross-tab sync listens for `storage` events and validates before accepting data.

```
## REVIEW PASSED

| Dimension | Status | Notes |
|-----------|--------|-------|
| Plan Fulfillment | PASS | All tasks implemented |
| Completeness | PASS | No stubs detected |
| Wiring | PASS | All new files connected |
| Anti-Patterns | PASS | No issues found |
```

```
[main 02d165f] feat(chapter-03): add localStorage persistence with cross-tab sync
 3 files changed, 212 insertions(+), 1 deletion(-)
```

### 5.4 Chapter 4: Filtering & Management

#### Plan

```
/fuska-plan chapter-4
```

2 plans in 1 batch: filter controls + task counts (Plan 01) and clear completed + empty states (Plan 02). Verification **passed first try** — no iterations needed.

#### Build

```
/fuska-build 4
```

Built filter controls (All/Active/Completed buttons), real-time task counts, and bulk delete for completed tasks. Code review passed on all dimensions.

**Verification found a gap:** 11/12 requirements verified — filter preference does **not persist across page refreshes** (not saved to localStorage). This was flagged as tech debt, not a blocker.

```
[main ce45d8a] feat(tasks): add filtering and bulk management controls
 3 files changed, 235 insertions(+), 6 deletions(-)
```

### 5.5 Chapter 5: Due Dates

#### Plan

```
/fuska-plan 5
```

2 plans in 2 batches: data model + date utilities (Plan 01) and date picker UI + overdue styling (Plan 02). Verification passed after **1 revision** (3 issues fixed: filter+sort integration clarity, CSS custom property assumption, backward compatibility).

#### Build

```
/fuska-build 5
```

The builder adds due date support: native HTML5 date picker, `dueDate` field on todos, `isTodoOverdue()` logic (excludes completed tasks), `formatDate()` using `Intl.DateTimeFormat`, sort-by-date with null dates last, and overdue CSS highlighting.

Code review passes. Chapter verification confirms 3/3 success criteria verified.

```
[main 7de56a4] feat(todos): add due date tracking with date picker and overdue indicators
```

---

## Part 6 — What Fuska Gave You (vs. Doing It Manually)

Let's be explicit about what was different:

| Aspect | Manual AI Coding | With Fuska |
|--------|-----------------|------------|
| **Context between sessions** | Gone. Start over every time. | Persistent in MegaMemory. Pick up exactly where you left off. |
| **Plan quality** | You hope the AI's first idea is good | Expert panel of 3 specialized reviewers catches issues before coding starts |
| **Cross-cutting concerns** | Forgotten unless you remember to ask | Automatically checked — accessibility, security, edge cases |
| **Code review** | None, or you do it yourself after | Automatic review against the plan, up to 3 fix iterations |
| **Commit history** | One giant commit (or none) | Domain-aware commits per chapter: `64b0755`, `02d165f`, `ce45d8a`, `7de56a4` |
| **Resumability** | "Where was I?" | `fuska progress` tells you exactly what's next |
| **Structure** | Freeform chat | Initiatives → Chapters → Plans → Tasks with dependencies |
| **Verification gaps** | You find them in production | Fuska flags them — like the filter persistence gap in Chapter 4 |

---

## Part 7 — Complete the Milestone

With all 5 chapters done, complete the milestone:

```
/fuska-complete
```

Fuska audits the milestone — checking all chapter verifications, aggregating requirements coverage, and surfacing tech debt:

```
## [AUTO] Milestone v1.0 — Tech Debt Review

Score: 13/13 requirements satisfied

Tech Debt Items:
1. Filter Preference Persistence (Chapter 4 - Minor)
   - Issue: Filter preference (All/Active/Completed) does not persist across page refreshes
   - Impact: User loses their filter view preference on refresh
   - Recommendation: Add localStorage persistence for currentFilter state

Verification Status:
- ✓ All 5 chapters marked Complete
- ✓ All 13 requirements satisfied
```

You choose to accept the minor tech debt and complete:

```
✅ Milestone v1.0 COMPLETED

Delivered:
- 5 chapters: UI Foundation → Core Operations → Persistence → Filtering → Due Dates
- 13/13 requirements satisfied
- Git tag v1.0 created locally

Tech Debt:
- Filter preference doesn't persist across refreshes — minor enhancement for v2.0

Archive: v10-milestone-archive concept created in MegaMemory
```

---

## Part 8 — Initiatives: Separate Efforts in the Same Codebase

Your todo app is complete. If you wanted to add a major new feature — say, collaborative real-time sync — that would be a **new initiative**, not more chapters in "main".

> **Initiatives are efforts, not codebases.** "main" was about building the todo app. A second initiative is a separate effort with its own requirements, roadmap, and milestones — even though they touch the same files.

### Managing initiatives

```bash
# Create a new initiative
fuska initiative new sync "Add real-time collaborative sync between devices"

# List all initiatives
fuska initiative list

# Switch between initiatives
fuska initiative switch main
fuska initiative switch sync
```

Each initiative maintains independent state, progress, and roadmap — all in the same MegaMemory knowledge graph.

---

## Part 9 — The Ad-Hoc Alternative: `fuska do`

Not everything needs the full chapter lifecycle. For quick tasks, use `fuska do` with one of four modes:

```bash
# Simple: just plan and build
fuska do planned "add a favicon to the todo app"

# Validated: plan gets checked before building
fuska do checked "add dark mode toggle to the settings page"

# Researched: research first, then plan, check, and build
fuska do researched "implement OAuth login with Google"

# Full pipeline: research, plan, check, build, review
fuska do verified "add PWA offline support"
```

> **Note:** The CLI `fuska do` command runs non-interactively by default — it auto-commits without prompting. For interactive mode with review prompts, use the OpenCode slash command `/fuska-do` instead.

Each mode adds layers of validation:

| Mode | Pipeline | Best for |
|------|----------|----------|
| `planned` | Plan → Build → Code Review | You know exactly what you want |
| `checked` | Plan → **Plan Check** → Build → Code Review | Want a second opinion on the plan |
| `researched` | **Research** → Plan → Plan Check → Build → Code Review | Need to investigate before planning |
| `verified` | Research → Plan → Plan Check → Build → Code Review → **Verification** | High-stakes changes, need post-build verification |

> **Tip:** If your `/fuska-do` discussion grows complex with 5+ tasks, run `/fuska-chapterize` with no arguments. Fuska extracts tasks from the conversation and creates a structured chapter — ready for the full planning workflow.

---

## Part 10 — Session Continuity: Just Pick Up Where You Left Off

One of Fuska's strongest features is invisible: **you never need to "save" or "pause" your work.** State is written to MegaMemory after every operation.

Close your terminal. Come back tomorrow. Open your project:

```bash
cd fuska-todo-app
opencode
```

Type:

```
/fuska
```

Fuska reads MegaMemory and tells you exactly where you are:

```
Initiative main using interactive mode

Status: milestone complete (5/5 chapters)

All chapters for "main" are complete.
Milestone v1.0 archived.

No pending work. Create a new initiative or use:
  fuska do <mode> <description>
```

No context loss. No "let me re-read the codebase." No starting over. MegaMemory remembers everything.

---

## Summary: The Fuska Workflow

```
fuska install              # One-time: install CLI and slash commands
fuska config               # One-time: set model preferences

fuska init --no-map        # Per-project: create initiative + register MCP
/fuska-configure <desc>    # Per-initiative: research + requirements + roadmap
/fuska-design 1            # Optional: discuss chapter design before planning

/fuska-plan                # Per-chapter: create verified task list
/fuska-build               # Per-chapter: implement with code review
/fuska                     # Anytime: see where you are and what's next

/fuska-complete            # When all chapters done: audit + archive + tag

fuska do <mode> "task"     # Ad-hoc: quick tasks outside the chapter lifecycle
fuska initiative new       # Create a new initiative
fuska initiative switch    # Switch between efforts in the same codebase
```

**The mental model:**
- An **initiative** is an effort ("build the app", "add real-time sync")
- A **chapter** is a deliverable chunk with a goal and success criteria
- A **plan** is a dependency-aware task list, validated by an expert panel
- A **milestone** is a release point — all chapters complete, audited, tagged
- **MegaMemory** is the persistent brain that makes it all survive across sessions

---

## Next Steps

- Read the full [Fuska README](https://github.com/mikaelj/fuska) for the complete command reference
- Check [docs/workflow.md](https://github.com/mikaelj/fuska/blob/main/docs/workflow.md) for 9 end-to-end workflow scenarios
- See [docs/fuska-do-session-distilled.md](https://github.com/mikaelj/fuska/blob/main/docs/fuska-do-session-distilled.md) for an annotated real session where the code reviewer catches a bug
- Explore [docs/configuration.md](https://github.com/mikaelj/fuska/blob/main/docs/configuration.md) for all the configuration knobs
