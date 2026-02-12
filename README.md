# MegaMemory GSD

Based on [gsd-opencode](https://github.com/rokicool/gsd-opencode). The goal of this project is to replace gsd-opencode's Markdown-file backend with [MegaMemory](https://github.com/0xK3vin/MegaMemory)'s persistent knowledge graph, enabling semantic search and typed relationships instead of flat `.planning/` file storage.

The backend replacement was implemented by Claude Opus 4.6 and GLM-4.7.

**THE AUTHOR TAKES NO RESPONSIBILITY FOR DATA LOSS IN EXISTING GSD PROJECTS. USE AT YOUR OWN PERIL.**

---

## Table of Contents

- [Installation](#installation)
- [What is a "Project"?](#what-is-a-project)
- [Getting Started](#getting-started)
- [Workflow Examples](#workflow-examples)
- [Core Workflow: Phases](#core-workflow-phases)
  - [What is a Phase?](#what-is-a-phase)
  - [Step-by-Step](#step-by-step)
  - [Adding/Removing Phases](#addingremoving-phases)
- [Other Workflows](#other-workflows)
  - [Quick Fixes](#quick-fixes)
  - [Milestones](#milestones)
  - [Todos](#todos)
  - [Merging Worktrees](#merging-worktrees)
  - [Settings & Configuration](#settings--configuration)
    - [Model Profiles](#model-profiles)
    - [Stages](#stages)
    - [Workflow Modes](#workflow-modes)
    - [Git Commit Strategy](#git-commit-strategy)
    - [Per-Command Overrides](#per-command-overrides)
- [Session Continuity](#session-continuity)
- [Migration from .planning/](#migration-from-planning)
- [Why MegaMemory? (Benchmarks)](#why-megamemory-benchmarks)
- [Command Reference](#command-reference)
  - [Git Integration](#git-integration)
- [Glossary](#glossary)
- [Acknowledgments & License](#acknowledgments--license)

---

## Installation

```bash
npm install -g gsd-mm
gsd-mm install
```

Or manually copy the three directories into your OpenCode config:

```bash
# Commands
cp -r opencode/command/gsd-mm/ ~/.config/opencode/command/gsd-mm/

# Agents
cp -r opencode/agents/gsd-mm/ ~/.config/opencode/agents/gsd-mm/

# Scripts, templates, references, and workflows
cp -r opencode/gsd-mm/ ~/.config/opencode/gsd-mm/
```

Use `--force` to overwrite existing directories:
```bash
gsd-mm install --force
```

---

## What is a "Project"?

**A project is an EFFORT or INITIATIVE — not a codebase or version.**

It's: "I want to build X" where X = feature, system, or product.

### Examples

| Scenario | What "Project" Means |
|----------|---------------------|
| New app from scratch | The entire app: "Todo App" |
| Existing app, adding feature | Specific work: "Add push notifications" |
| Multiple features in same codebase | Separate projects: "Push notifications", "Dark mode", "User profiles" |

### Can You Have Multiple Projects?

**Yes!** You can have multiple projects in one codebase. Each has its own:
- Name/slug (e.g., "push-notifications")
- Requirements
- Roadmap with phases
- Milestones (optional)

**Example structure:**
```
my-flutter-app/
├── lib/
├── .megamemory/
│   └── knowledge.db          ← Single database contains:
│       ├── project: push-notifications
│       ├── project: dark-mode
│       ├── project: user-profiles
│       └── ... (more projects)
└── pubspec.yaml
```

---

## Getting Started

### 1. (Optional) Map Your Codebase

If you have an existing codebase, map it first so GSD-MM understands the architecture:

```bash
/gsd-mm-map-codebase [area]
```

### 2. Initialize a Project

```bash
/gsd-mm-new-project ["description"]
```

Walks through project setup:
- Project name, core value, goals
- Research domain ecosystem (optional)
- Define requirements
- Create roadmap with phases

The optional description argument (e.g., "Push Notifications") is used as the milestone name. If omitted, you'll be prompted.

This creates all phases for the milestone at once (e.g., Phase 1–5). You then iterate through each phase: discuss → plan → execute → verify.

### 3. Work Through Phases

| Step | Command |
|------|---------|
| (Optional) Discuss phase | `/gsd-mm-discuss-phase <N>` |
| Plan phase | `/gsd-mm-plan-phase <N>` |
| Execute phase | `/gsd-mm-execute-phase <N>` |
| (Optional) Verify work | `/gsd-mm-verify-work <N>` |
| Move to next phase | `/gsd-mm-discuss-phase <N+1>` or `/gsd-mm-plan-phase <N+1>` |

That's it — repeat for each phase until the milestone is complete.

---

## Workflow Examples

The following scenarios show what GSD-MM looks like in practice. All examples use **RecipeVault** — an imaginary Next.js recipe-sharing app with users, recipes, search, and a Prisma/PostgreSQL backend.

### Scenario 1: Building a Feature from Scratch

*You want to add a **Meal Planner** — weekly calendar, shopping lists, nutritional summaries. This is a big feature, so you use the full workflow.*

First, map the codebase so GSD-MM understands your architecture, then create the project:

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-map-codebase` | — | Scans `recipevault/`. Discovers Next.js 14 app router, Prisma schema with `User`, `Recipe`, `Ingredient` models, TailwindCSS, and a `/api` directory with REST endpoints. Creates codebase map in MegaMemory. |
| 2 | `/gsd-mm-new-project "Meal Planner"` | *"Users can plan weekly meals, generate shopping lists from selected recipes, and see nutritional summaries per day."* | Asks clarifying questions about scope. You answer interactively. Creates project **meal-planner** with milestone "Meal Planner v1.0" and 4 phases: (1) Calendar UI & Data Model, (2) Shopping List Generation, (3) Nutritional Summary, (4) Polish & Edge Cases. |
| 3 | `/gsd-mm-discuss-phase 1` | *"Calendar should be a weekly grid, Monday–Sunday. Users drag recipes from a sidebar into day slots. Mobile: vertical stack instead of grid."* | Identifies 6 open questions (drag-and-drop library? max recipes per slot? recurring meals?). You answer each. Saves decisions as phase-1 context. |
| 4 | `/gsd-mm-plan-phase 1 --research` | — | Researcher agent investigates `@dnd-kit` vs `react-beautiful-dnd`, checks Prisma relation patterns for calendar events. Planner creates 14 tasks across 3 waves: DB migration → API routes → UI components. Plan-checker validates task dependencies. |
| 5 | `/gsd-mm-execute-phase 1` | — | Executor starts Wave 1: creates `MealSlot` model in Prisma, runs migration, adds API routes. Wave 2: builds `<WeekGrid>`, `<DayColumn>`, `<RecipeDragCard>` components. Wave 3: wires drag-and-drop, adds optimistic updates. 14 atomic commits total. |
| 6 | `/gsd-mm-verify-work 1` | — | Verifier checks success criteria: "Users can drag recipes onto a weekly calendar" → **PASS**. "Calendar persists across page reloads" → **PASS**. "Mobile layout stacks vertically" → **PASS**. Phase 1 marked complete. |
| 7 | `/gsd-mm-plan-phase 2` | — | Plans the Shopping List phase. 11 tasks across 2 waves: ingredient aggregation logic → shopping list UI with grouping by aisle. |
| 8 | `/gsd-mm-execute-phase 2` | — | Builds shopping list. Aggregates ingredients across selected meals, deduplicates, groups by category. Adds print-friendly view. |

---

### Scenario 2: Pausing and Resuming Across Sessions

*You're midway through executing Phase 2 (Shopping List) when you need to stop for the day.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-execute-phase 2` | — | Executor starts. Completes Wave 1 (ingredient aggregation logic, 5 tasks). Begins Wave 2 (shopping list UI)… |
| 2 | `/gsd-mm-pause-work` | — | Creates checkpoint: "Phase 2, Wave 2, task 3/6 complete. Shopping list renders but grouping-by-aisle not started. 7 commits so far." Saves to MegaMemory. |

*Next morning, new session:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 3 | `/gsd-mm-resume-work` | — | Restores checkpoint. Shows summary: "Resuming Phase 2 — Shopping List Generation. Wave 2, 3 tasks remaining: aisle grouping, quantity combining, print view." Continues execution. |
| 4 | `/gsd-mm-add-todo` | *"Look into Instacart API for direct-to-cart shopping list export"* | Creates todo tagged `integration`: "Investigate Instacart API for shopping list export." Doesn't interrupt current work. |
| 5 | *(execution completes)* | — | Remaining 3 tasks complete. 4 more atomic commits. Phase 2 execution finished. |
| 6 | `/gsd-mm-verify-work 2` | — | "Shopping list aggregates ingredients from weekly plan" → **PASS**. "Items grouped by aisle" → **PASS**. "Print view renders cleanly" → **PASS**. Phase 2 complete. |

---

### Scenario 3: Discovering Unplanned Work

*While building Phase 3 (Nutritional Summary), you realize the USDA FoodData API needs OAuth2 — something nobody planned for.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-execute-phase 3` | — | Executor starts Wave 1. While implementing the nutrition data fetcher, flags a deviation: "USDA FoodData Central API requires API key registration and OAuth2 token flow. This was not in the plan." |
| 2 | `/gsd-mm-add-phase "USDA API OAuth2 integration"` | — | Creates Phase 5: "USDA API OAuth2 Integration" with auto-generated requirements: token management, refresh flow, secure key storage. Added after Phase 4 in the roadmap. |
| 3 | `/gsd-mm-insert-phase 3 "USDA API OAuth2 integration"` | — | Inserts the OAuth2 phase *before* Phase 3 (now renumbered to Phase 4) so the auth is ready before the nutritional summary needs it. Existing phases renumber automatically. |
| 4 | `/gsd-mm-plan-phase 3` | — | Plans the new OAuth2 phase: 6 tasks — environment variable setup, token fetcher service, refresh middleware, Prisma model for token storage, integration tests. |
| 5 | `/gsd-mm-execute-phase 3` | — | Builds the OAuth2 integration. 6 atomic commits. Token refresh tested against USDA sandbox. Now Phase 4 (Nutritional Summary) can proceed with auth in place. |

---

### Scenario 4: Verification Failure and Recovery

*You built a **Recipe Import** feature (paste a URL, scrape the recipe). Verification catches a gap.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-new-project "Recipe Import"` | *"Users paste a recipe URL, the app scrapes the title, ingredients, and steps, and creates a new Recipe."* | Creates project **recipe-import** with milestone "Recipe Import v1.0" and 2 phases: (1) URL Scraper & Parser, (2) Import UI & Error Handling. |
| 2 | `/gsd-mm-plan-phase 1` | — | Plans 8 tasks: URL validator, HTML fetcher, Cheerio-based parser for common recipe sites, ingredient normalizer, step extractor, Prisma integration, tests. |
| 3 | `/gsd-mm-execute-phase 1` | — | Builds the scraper. Handles AllRecipes, Epicurious, and Food Network formats. 8 atomic commits. |
| 4 | `/gsd-mm-verify-work 1` | — | "Scraper extracts title from AllRecipes" → **PASS**. "Scraper extracts ingredients" → **PASS**. "Scraper handles JSON-LD structured data" → **FAIL** — the scraper only parses HTML microdata, but many sites embed recipes as JSON-LD `<script>` tags. |
| 5 | `/gsd-mm-execute-phase 1` | — | Re-executes with verification feedback. Adds JSON-LD parser that extracts `Recipe` schema from `<script type="application/ld+json">` tags. Falls back to HTML scraping when JSON-LD is absent. 2 additional commits. |
| 6 | `/gsd-mm-verify-work 1` | — | Re-verifies. "JSON-LD structured data" → **PASS**. "Fallback to HTML scraping" → **PASS**. All criteria met. Phase 1 complete. |

---

### Scenario 5: Quick Fix for a Production Bug

*A week after shipping Recipe Import, users report the scraper crashes on URLs with query parameters.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-do quick "The recipe scraper crashes when the URL contains query parameters like ?ref=share. The URL validator rejects anything after ?. Need to strip or preserve query params before validation."` | — | Spawns planner + executor directly. Plans 2 tasks: fix URL validator regex to allow query strings, add test cases for URLs with `?`, `#`, and `&`. Executes immediately. 1 atomic commit. Quick task logged separately from the roadmap. |
| 2 | `/gsd-mm-check-todos` | — | Shows 1 open todo: "Investigate Instacart API for shopping list export" (from Scenario 2). No new todos from the quick fix. |

---

### Scenario 6: Multiple Projects in One Codebase

*You're working on **Meal Planner** and **Recipe Import** in the same codebase, switching between them.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-progress` | — | Shows both projects: **meal-planner** — Phase 2 of 4 complete (Shopping List done, Nutritional Summary next). **recipe-import** — Phase 1 of 2 complete (Scraper done, Import UI next). |
| 2 | `/gsd-mm-plan-phase 2` | *Selects project: recipe-import* | Plans Phase 2 for Recipe Import: import modal UI, URL input with preview, error states, loading skeleton. 9 tasks. |
| 3 | `/gsd-mm-execute-phase 2` | — | Builds the import UI for recipe-import. Modal with URL paste, live preview of scraped recipe, confirm/edit before saving. 9 commits. |
| 4 | `/gsd-mm-verify-work 2` | — | Recipe Import Phase 2 verified. All criteria pass. |
| 5 | `/gsd-mm-plan-phase 4` | *Selects project: meal-planner* | Switches to Meal Planner. Plans Phase 4 (Polish & Edge Cases): empty states, error boundaries, loading skeletons, keyboard navigation. 7 tasks. |
| 6 | `/gsd-mm-execute-phase 4` | — | Builds polish phase for meal-planner. 7 commits. Project continues independently from recipe-import. |

---

### Scenario 7: Milestones and Releases

*Meal Planner v1.0 shipped. Now you're starting v1.1 with two new features: meal sharing and dietary presets.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-complete-milestone` | *Selects project: meal-planner* | Marks "Meal Planner v1.0" as complete. Summary: 4 phases completed, 45 tasks executed, 45 atomic commits. |
| 2 | `/gsd-mm-new-milestone "Meal Planner v1.1"` | *"Two features: (1) share weekly meal plans with other users, (2) dietary preset filters (vegetarian, keto, gluten-free) that restrict recipe suggestions."* | Creates milestone "Meal Planner v1.1" with 3 phases: (1) Sharing Backend & Permissions, (2) Dietary Presets & Filtering, (3) Integration & Polish. |
| 3 | `/gsd-mm-plan-phase 1` | — | Plans the sharing phase: permission model, share-link generation, recipient view, Prisma relations for shared plans. 12 tasks. |
| 4 | `/gsd-mm-execute-phase 1` | — | Builds sharing backend. 12 commits. |
| 5 | `/gsd-mm-audit-milestone` | — | Audit shows: Phase 1 complete, Phases 2–3 pending. Estimates ~20 tasks remaining. No blockers detected. |
| 6 | `/gsd-mm-complete-milestone` | — | *(After completing all phases)* Marks "Meal Planner v1.1" complete. Summary: 3 phases, 28 tasks, 28 commits. Both milestones visible in project history. |

---

### Scenario 8: Merging Knowledge from Git Worktrees

*You're building Meal Planner v1.1 using git worktrees. Two developers (you + AI) work in parallel on separate branches, each with its own knowledge database. After merging code, you need to merge the knowledge graphs.*

**Setup:**
```
recipevault/                          # Main worktree (main branch)
  .megamemory/knowledge.db           ← 85 concepts (base project)

recipevault/feature-sharing/          # Worktree for sharing feature
  .megamemory/knowledge.db           ← 52 concepts (sharing plans, research, summaries)

recipevault/feature-dietary/          # Worktree for dietary presets
  .megamemory/knowledge.db           ← 41 concepts (dietary plans, research, summaries)
```

*After `git merge feature-sharing` and `git merge feature-dietary` complete, you merge the knowledge:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/gsd-mm-merge-worktrees feature-sharing feature-dietary` | — | Verifies all three databases exist. Creates backup: `knowledge.db.backup-20250211-143022`. Starts merge session. |
| 2 | *(merge 1/2: feature-sharing)* | — | Runs `megamemory merge` with main + feature-sharing. 48 clean merges, 2 conflicts detected. |
| 3 | *(conflict: phase-01 context)* | *Selects "AI verify"* | AI reads referenced files. `src/lib/sharing/permissions.ts` exists, `src/lib/auth/sharing-middleware.ts` was renamed to `src/middleware/sharing.ts`. Resolves with updated file refs. |
| 4 | *(conflict: req-SOCIAL-01)* | *Selects "Keep right"* | Keeps the feature-sharing version of the social requirement (more detailed after implementation). |
| 5 | *(merge 2/2: feature-dietary)* | — | Merges feature-dietary into the already-merged database. 39 clean merges, 0 conflicts. |
| 6 | *(post-merge validation)* | — | Final conflict check: 0 remaining. Database readable. Displays summary: 2 branches merged, 2 conflicts detected, 2 resolved. Backup preserved. |

---

## Core Workflow: Phases

### What is a Phase?

A **phase** is a work bucket that groups related requirements into a deliverable unit. Each phase has:

- A **goal** — the outcome to achieve
- **Requirements** — what needs to be built
- **Success criteria** — observable behaviors that must be true when the phase completes
- **Plans** — detailed task lists with dependencies, generated during planning

**Example phases for a "Push Notifications" project:**
- Phase 1: Backend API (goal: "Users can send push notifications")
- Phase 2: iOS implementation (goal: "iOS users receive notifications")
- Phase 3: Android implementation (goal: "Android users receive notifications")

### Step-by-Step

#### 1. Discuss Phase (Optional)

Gather implementation decisions before planning.

```bash
/gsd-mm-discuss-phase <N>
```

Analyzes the phase to identify gray areas (UI, UX, behavior) and asks targeted questions. Creates a `phase-{N}-context` concept with decisions that guide research and planning.

**Skip this if** you have clear requirements and know what to build.

#### 2. Plan Phase

```bash
/gsd-mm-plan-phase <N> [--research | --skip-research | --skip-verify]
```

Creates a detailed execution plan for phase N.

**Flags:**
- `--research` — Enable the researcher agent (overrides settings)
- `--skip-research` — Skip research
- `--skip-verify` — Skip plan verification

**Process:** Research (optional) → Plan → Plan Check (optional)

#### 3. Execute Phase

```bash
/gsd-mm-execute-phase <N>
```

Executes tasks from the plan with atomic commits. Handles deviations, pauses, and checkpoints.

**During execution you can:**
- `/gsd-mm-pause-work` — Pause mid-phase (creates a checkpoint)
- `/gsd-mm-resume-work` — Resume from where you left off
- `/gsd-mm-add-todo` — Capture ideas without derailing current work

#### 4. Verify Work (Optional)

```bash
/gsd-mm-verify-work <N>
```

Verifies phase completion against success criteria using goal-backward verification — checking whether the code *delivers* what the phase promised, not just whether tasks were completed.

To disable verification permanently, use `/gsd-mm-settings` → Quick settings → Set "Execution Verifier" to "No". When disabled, phases complete automatically after execution.

#### 5. Move to Next Phase

After completing Phase N, simply start the next one:

```bash
/gsd-mm-discuss-phase <N+1>   # or /gsd-mm-plan-phase <N+1>
```

All phases were created during `/gsd-mm-new-project` — you just iterate through them.

### Adding/Removing Phases

Use these commands **only when you discover unplanned work** during execution (e.g., a missed prerequisite or a new user request):

- `/gsd-mm-add-phase <desc>` — Add a phase to the current milestone
- `/gsd-mm-insert-phase <N> <desc>` — Insert a phase between existing ones
- `/gsd-mm-remove-phase <N>` — Remove a phase
- `/gsd-mm-list-phase-assumptions <N>` — List assumptions for a phase

---

## Other Workflows

### Quick Fixes

For small, ad-hoc tasks that don't need full phase planning:

```bash
/gsd-mm-do [mode] [description]
```

- Mode-aware agent chain: direct | quick | fast | balanced | thorough | standard
- Auto-executes for quick/fast/standard; asks before executing for direct/balanced/thorough
- Creates separate "quick task" concepts (not tied to the roadmap)
- Uses project's configured workflow mode by default, or specify one explicitly

**Examples:**
```bash
/gsd-mm-do fix the login redirect bug          # Uses project's default mode
/gsd-mm-do quick fix typo in README            # Quick mode: plan + auto-execute
/gsd-mm-do thorough add payment integration    # Thorough: research + plan + check + ask
```

**When to use:** bug fixes, small refactorings, one-off tasks, unplanned work outside phase structure.

**Note:** `/gsd-mm-do` creates standalone task concepts separate from your project's phase structure. For speed-focused work within a phase, use `/gsd-mm-plan-phase <N> --mode quick` instead.

### Milestones

Milestones group phases into releases and track progress across them. They are **optional** — a default milestone (e.g., "v1.0") is created automatically during `/gsd-mm-new-project`.

```bash
/gsd-mm-new-milestone "[name]"       # Start new milestone cycle
/gsd-mm-audit-milestone              # Check milestone progress
/gsd-mm-complete-milestone           # Mark milestone complete
/gsd-mm-plan-milestone-gaps          # Plan gaps between milestones
```

**When to use:** releasing a version (v1.0, v1.1), grouping related features, tracking major deliverables.

### Todos

Capture ideas, issues, and tasks for future work:

```bash
/gsd-mm-add-todo [description]    # Capture from conversation
/gsd-mm-check-todos               # View all todos
```

- Auto-extracts context from conversation if no description provided
- Tracks by area (api, ui, auth, database, etc.)
- Checks for duplicates before creating

**When to use:** mid-work ideas, issues found during testing, future feature requests.

**Note:** Don't create todos for work in the current plan — that's handled by the deviation rules.

### Merging Worktrees

When using `git worktree` with GSD-MM, each worktree gets its own independent `.megamemory/knowledge.db`. After merging feature branch code back into main with git, the knowledge graphs need merging too.

```bash
/gsd-mm-merge-worktrees <branch1> [branch2] [branch3...]
```

Run this from your **main worktree** directory. Arguments are the subdirectory names of your feature worktrees.

**How it works:**

1. Creates a timestamped backup of the main database
2. Merges each worktree database sequentially (MegaMemory supports two-way merges only)
3. Detects conflicts and offers resolution options: AI-assisted (reads actual codebase files to verify), keep left/right/both, or skip
4. Tracks progress in a JSON session file that survives context resets
5. On failure, restores the backup automatically

**AI-assisted resolution** reads the files referenced by each conflict version and determines which version matches the actual codebase. It checks for edge cases like deleted files, renames, and complementary changes, then writes a merged resolution using MegaMemory's `resolve_conflict` tool.

**Session resume:** If a merge is interrupted (e.g., context reset), re-running the command detects the existing session file and offers to resume where it left off.

**When to use:** after `git merge` completes and you want to unify knowledge graphs from feature worktrees back into main.

---

## Settings & Configuration

```bash
/gsd-mm-settings
```

From this menu you can configure:
- **Model profile** — switch between quality / balanced / budget
- **Workflow mode** — Preconfigured agent combinations (Direct, Quick, Fast, Balanced, Thorough, Standard)
- **Git commit strategy** — switch between per-phase / per-plan / per-task
- **Per-stage model overrides** — set a specific model for planning, execution, or verification
- **Reset presets** — re-discover available models and reconfigure all profiles

### Model Profiles

A **model profile** controls which AI model is used for each stage. Three presets are available:

| Profile | Planning | Execution | Verification | Best For |
|---------|----------|-----------|--------------|----------|
| **quality** | Strongest | Strongest | Strongest | Critical architecture, quota available |
| **balanced** (default) | Strong | Mid-tier | Mid-tier | Normal development |
| **budget** | Mid-tier | Mid-tier | Lightweight | High-volume work, conserving quota |

Switch profiles:

```bash
/gsd-mm-set-profile <quality|balanced|budget>
```

### Stages

A **stage** is a category of work in the GSD workflow. Each stage uses different agents, and the model profile determines which AI model powers them.

| Stage | Agents | Purpose |
|-------|--------|---------|
| **Planning** | planner, plan-checker, researcher, roadmapper, project-researcher, research-synthesizer, codebase-mapper | Phase decomposition, dependency analysis, goal-backward verification |
| **Execution** | executor, debugger | Implementing plan tasks with atomic commits, deviation handling |
| **Verification** | verifier, integration-checker | Goal-backward verification, quality assurance |

**Why planning gets the strongest models:** Planning involves architecture decisions, goal decomposition, and task design — where model quality has the highest impact. Execution follows the plan's explicit instructions, so mid-tier models suffice.

### Workflow Modes

**Workflow modes** provide preconfigured combinations of agents that balance speed vs. quality. Choose a mode based on your needs.

| Mode | Workflow | What You Lose | What You Keep | Time Saved | Use When |
|------|-----------|----------------|----------------|-------------|-----------|
| **Direct** (0%) | Planner → Executor | Tech research, plan validation, code verification | Task breakdown, atomic commits, MegaMemory state | ~80% | You already know exactly what to do and need quick execution. This is essentially "give me a todo list and I'll do it." |
| **Quick** (15%) | Planner → Executor | Tech research, plan validation, code verification | Task breakdown, atomic commits, deviation handling, state tracking | ~70% | Small tasks with known solutions. For unplanned ad-hoc tasks, use `/gsd-mm-do` instead. |
| **Fast** (30%) | Planner → Plan Checker → Executor | Tech research, code verification | Requirement coverage, task completeness, dependency validation, wiring checks, atomic commits | ~50% | You know the tech stack but want validated plans. Good for features in familiar stacks, CRUD operations, UI components |
| **Balanced** (50%) | Researcher → Planner → Executor | Plan validation, code verification | Ecosystem research, standard patterns, pitfall avoidance, task breakdown, atomic commits | ~35% | Moderate tech uncertainty, want to avoid wrong library choices. Good for adding new library, exploring unfamiliar framework area, integration work |
| **Thorough** (70%) | Researcher → Planner → Plan Checker → Executor | Code verification | Full plan validation, tech research, ecosystem patterns, atomic commits | ~20% | New domains, unfamiliar tech, need verified plans but will manually verify. Good for new feature areas, greenfield projects, learning new tech |
| **Standard** (100%) | Researcher → Planner → Plan Checker → Executor → Verifier | Nothing | Full goal-backward chain, code-level verification, gap detection | ~0% | Critical architecture, production systems, high stakes. Good for payment systems, auth systems, data migrations, core infrastructure |

**Key concepts:**
- **Time saved** compared to Standard mode (100% advantages)
- **Advantages preserved** relative to full Standard workflow
- Use `/gsd-mm-settings` to change workflow mode
- Per-phase flags (`--research`, `--skip-verify`) augment your selected mode but never reduce it

### Quick Mode vs /gsd-mm-do

| Aspect | Quick mode (`--mode quick`) | `/gsd-mm-do` command |
|---------|-----------------------------|---------------------------|
| **Purpose** | Speed-focused planning within a phase | Unplanned ad-hoc tasks |
| **Agent flow** | Planner → Executor only | Planner → Executor only |
| **Concept storage** | Phase-based: `phase-01-plan-001` | Standalone: `task-001-fix-typo` |
| **Roadmap ties** | ✅ Tied to phase structure | ❌ Separate from roadmap |
| **State updates** | Updates roadmap and phase status | Updates `state.tasks_completed` |
| **User input** | Must specify phase: `/gsd-mm-plan-phase 2 --mode quick` | Just run command, prompted: `/gsd-mm-do` |

**Quick mode** (`--mode quick`) is for small tasks within a phase where you want GSD-MM guarantees (atomic commits, state tracking) but faster execution.

**`/gsd-mm-do`** is for unplanned work—bug fixes, small refactorings, one-off tasks—that you don't want to tie to any phase.

### Git Commit Strategy

Controls how often GSD creates git commits during execution. Set during `/gsd-mm-new-project`.

| Strategy | Commits When | Git Log Looks Like |
|----------|--------------|--------------------|
| **per-phase** (default) | Once when all plans in a phase complete | `feat(phase-02): user authentication system` |
| **per-plan** | Once per plan (groups all tasks) | `feat(02-01): JWT generation and validation` |
| **per-task** | After every individual task | `feat(02-01): add JWT signing helper` *(3 commits for 3 tasks in plan 02-01)* |

**Example: same work, different strategies**

Three tasks in plan 02-01 (JWT auth): set up jose library, add refresh token rotation, protect routes with middleware.

*per-phase* — 1 commit for the entire phase:
```
feat(phase-02): user authentication system
```

*per-plan* — 1 commit for the plan:
```
feat(02-01): JWT auth with refresh token rotation
```

*per-task* — 3 separate commits:
```
feat(02-01): set up jose library and token generation
feat(02-01): add refresh token rotation with secure storage
feat(02-01): protect routes with auth middleware
```

**Stored in config concept as:**
```json
{
  "git": {
    "commit_strategy": "per-phase"
  }
}
```

**Commit message format (all strategies):**

```
{type}({scope}): {concise description}

- {high-level change 1}
- {high-level change 2}
```

Commit messages are kept concise by design:
- Subject line: max 72 characters, imperative mood
- Body: **2-4 bullet points maximum** — each bullet is one high-level sentence
- Never lists implementation details like imports, field names, parameter types, or null checks
- The git diff is the source of truth for *how* — the commit message explains *what* and *why*

**Why per-phase is the default:** For solo dev + AI workflows, MegaMemory already tracks granular task completion. Per-phase gives the cleanest git history while MegaMemory handles the detailed context. Use per-task if you need fine-grained `git bisect` or work with other developers who rely on git log.

### Per-Command Overrides

Override the model for a specific stage without changing the profile:

```bash
/gsd-mm-set-model <stage> <model>
```

Where `<stage>` is one of: `planning`, `execution`, or `verification`.

You can also override per-phase with flags on `/gsd-mm-plan-phase`:
- `--mode <MODE>` — Override workflow mode for this phase only (one-off, doesn't persist)
- `--research` — Enable researcher (augments the selected mode)
- `--skip-research` — Skip researcher
- `--skip-verify` — Skip plan verification

You can override per-phase with flags on `/gsd-mm-execute-phase`:
- `--mode <MODE>` — Override workflow mode for this phase only (one-off, doesn't persist)
- `--verify` — Force verifier to run (even in modes that normally skip it)

---

## Session Continuity

### Pausing Mid-Phase

```bash
/gsd-mm-pause-work
```

Creates a **checkpoint** — a snapshot of your current progress including completed tasks, pending work, and context — and saves it to MegaMemory.

### Resuming Later

```bash
/gsd-mm-resume-work
```

Restores from the checkpoint and continues where you left off.

### Checking Progress

```bash
/gsd-mm-progress       # Detailed progress with phase status
```

---

## Migration from `.planning/`

If you have an existing project using GSD's `.planning/` directory, run the migration script to move everything into MegaMemory.

**Prerequisites:** MegaMemory >= 1.3.1 installed in the target project's `node_modules`.

```bash
gsd-mm migrate [project-dir]
```

The script:
1. Copies `.planning/` to `.planning.backup`
2. Creates MegaMemory concepts from all planning markdown files
3. Validates migration with semantic queries
4. Removes the `.planning/` directory on success

Use `--clean` to delete existing database before migration:

```bash
gsd-mm migrate [project-dir] --clean
```

To rollback, restore from `.planning.backup` and remove `.megamemory/knowledge.db`.

---

## Why MegaMemory? (Benchmarks)

- **700x faster** queries when operations compound: 0.5ms vs 350ms for filtering
- **4.4x smaller** storage: 0.6MB vs 2.9MB for equivalent data
- **51–101x fewer** tool calls: Single query returns everything
- **O(1) semantic search**: Enables new capabilities beyond simple text search
- **Built-in graph traversal**: Edges, children, and relationships in one response

### Theoretical Benchmarks

> **Disclaimer:** The numbers below are theoretical estimates, not measured benchmarks. The starting hypothesis was that handling Markdown files is less efficient than querying a SQLite database — the analysis below explores where that holds and where it doesn't. Real-world performance will vary depending on hardware, embedding provider latency, project size, and caching.

#### Raw I/O Speed

| Operation | Markdown | MegaMemory | Factor | Winner |
|-----------|----------|------------|--------|--------|
| Get single document | 7 ms (read + parse) | 0.5 ms (SELECT) | 14x | MegaMemory |
| Filter N documents | 7 ms x N (scan + filter) | 0.5 ms (WHERE) | 14N–700x | MegaMemory |
| JOIN relationships | 7 ms x (1+M+N) | 1–2 ms (JOIN) | 56–112x | MegaMemory |
| Aggregate stats | ~300 ms (full scan) | ~1 ms (COUNT/SUM) | 300x | MegaMemory |
| Write N docs | 8 ms x N | 0.3 ms x N | 27x | MegaMemory |
| Semantic search | N/A (must grep) | 5–10 ms (vector) | — | MegaMemory |
| Create 15 plans | 120 ms | 807 ms | 0.15x | Markdown |
| New project (small) | 60 ms | 750 ms | 0.08x | Markdown |

Embedding generation (~50 ms per concept) is the main bottleneck for write-heavy operations — without it, SQL alone would be 10–300x faster across the board.

#### Tool-Call Reduction (LLM Agent Perspective)

For an LLM agent, each tool call carries context-switching overhead (~50–100 ms). Markdown requires an "enumerate then fetch" pattern — `O(N)` calls — while MegaMemory returns results in a single query — `O(1)` calls.

| Operation | Markdown Calls | MegaMemory Calls | Reduction |
|-----------|---------------|-----------------|-----------|
| Get 50 requirements | 51 | 1 | 51x |
| Filter 50 requirements | 51 | 1 | 51x |
| Get 5 plans + deps | 16 | 1 | 16x |
| Search 100 concepts | 101 | 1 | 101x |
| Aggregate stats (10 phases) | 60+ | 1 | 60x |
| Create 15 plans | 15 | 15 | Tie |

#### Key Takeaways

**MegaMemory's strengths:** filtering, joins, aggregations, semantic search, and any operation across many concepts — fewer tool calls and faster I/O.

**Markdown's strengths:** write-heavy workflows that create many concepts at once (embedding overhead dominates), and small projects where the difference is negligible.

---

## Command Reference

### CLI Commands

| Command | Description | Arguments |
|---------|-------------|-----------|
| `gsd-mm install` | Install commands and agents to OpenCode config | `--force` to overwrite |
| `gsd-mm migrate [dir]` | Migrate `.planning/` to MegaMemory | `--clean` to delete existing DB first |
| `gsd-mm export` | Export knowledge graph to `.planning/` files | `--project-dir <path>`, `--output-dir <path>`, `--overwrite`, `--dry-run`, `--debug`, `--verbose` |

### OpenCode Commands

#### Project Setup

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-new-project` | Initialize new GSD project | `["description"]` — optional milestone name |
| `/gsd-mm-map-codebase` | Map existing codebase structure | `[area]` — optional area to focus on |
| `/gsd-mm-import` | Import existing project | — |

#### Phase Workflow

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-discuss-phase` | Discuss phase details before planning | `<N>` — phase number |
| `/gsd-mm-plan-phase` | Create detailed phase plan | `<N>` `[--research \| --skip-research \| --skip-verify \| --mode <MODE>]` |
| `/gsd-mm-research-phase` | Research phase requirements | `<N>` — phase number |
| `/gsd-mm-execute-phase` | Execute phase tasks | `<N>` `[--mode <MODE>]` — phase number and optional mode override |
| `/gsd-mm-verify-work` | Verify phase completion | `<N>` — phase number |

#### Phase Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-add-phase` | Add new phase to current milestone | `<desc>` — phase description |
| `/gsd-mm-insert-phase` | Insert phase between existing phases | `<N> <desc>` — position and description |
| `/gsd-mm-remove-phase` | Remove phase from project | `<N>` — phase number |
| `/gsd-mm-list-phase-assumptions` | List assumptions for a phase | `<N>` — phase number |

#### Milestones

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-new-milestone` | Create new milestone | `"[name]"` — milestone name |
| `/gsd-mm-audit-milestone` | Audit milestone status | — |
| `/gsd-mm-complete-milestone` | Mark milestone complete | — |
| `/gsd-mm-plan-milestone-gaps` | Plan gaps between milestones | — |

#### Work Management

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-pause-work` | Pause current work, create checkpoint | — |
| `/gsd-mm-resume-work` | Resume from last checkpoint | — |
| `/gsd-mm-add-todo` | Add todo item | `[description]` — auto-extracts from conversation if omitted |
| `/gsd-mm-check-todos` | View all todos | — |
| `/gsd-mm-merge-worktrees` | Merge knowledge databases from git worktrees | `<branch1> [branch2...]` — worktree subdirectory names |

#### Status & Settings

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-do` | Execute unplanned tasks with mode-aware agent chain | `[mode] [description]` — mode: direct/quick/fast/balanced/thorough/standard |
| `/gsd-mm-progress` | Detailed progress with phase status | — |
| `/gsd-mm-settings` | Manage GSD settings interactively (profiles, workflow modes, git strategy) | — |
| `/gsd-mm-set-profile` | Switch model profile | `<quality \| balanced \| budget>` |
| `/gsd-mm-set-model` | Override model for a stage | `<stage> <model>` |
| `/gsd-mm-help` | Show all available commands | — |

#### Git Integration

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-git-message` | Generate GSD commit messages or regenerate for existing commits/ranges | `<commit-hash \| commit-range \| phase-X-plan-Y>` — commit, range (e.g., `HEAD~5..HEAD`), or phase-plan context |

**Modes:**

1. **Commit range mode:** Generate unified commit message for multiple commits (e.g., `HEAD~5..HEAD`, `abc123..def456`)
2. **Commit hash mode:** Replay existing commit's diff and regenerate message under current rules
3. **Working tree mode:** Generate commit message for uncommitted changes

**Examples:**
```bash
/gsd-mm-git-message HEAD~5..HEAD                    # Range mode - all commits in range
/gsd-mm-git-message abc123..def456 phase-02-plan-03  # Range with explicit phase-plan override
/gsd-mm-git-message abc123                          # Single commit replay
/gsd-mm-git-message abc123 phase-02-plan-01          # Single commit with phase-plan override
/gsd-mm-git-message phase-02-plan-01                # Working tree mode
```

**Features:**
- Auto-detects phase-plan from most recent commit (full format: `phase-02-plan-01`, short: `02-01`, phase-only: `phase-02`)
- Shows all original commit messages in range mode
- Validates commit range endpoints and checks for merges
- Phase-plan argument overrides auto-detection
- Safe in range mode (no working tree modifications)

#### Debug

| Command | Description | Arguments |
|---------|-------------|-----------|
| `/gsd-mm-debug` | Debug GSD issues | — |
| `/gsd-mm-export-md` | Export to Markdown | — |

---

## Glossary

| Term | Definition |
|------|-----------|
| **Atomic commit** | A small, self-contained code change that implements a single task from the plan |
| **Checkpoint** | A snapshot of in-progress work saved by `/gsd-mm-pause-work`, allowing you to resume later |
| **Concept** | A unit of knowledge in MegaMemory (e.g., a project, requirement, plan, or phase) |
| **Deviation** | When execution diverges from the planned tasks — handled automatically by the executor |
| **Executor** | The agent that implements plan tasks with atomic commits during the execution stage |
| **Goal-backward verification** | Checking whether code delivers what a phase *promised* (its goal and success criteria), not just whether tasks were completed |
| **Integration checker** | An agent that verifies external integrations (APIs, services) work correctly |
| **Milestone** | An optional grouping of phases into a release (e.g., "v1.0") |
| **Model profile** | A preset (quality/balanced/budget) that determines which AI model is used at each stage |
| **Must-have** | A requirement marked as essential — the phase cannot be considered complete without it |
| **Phase** | A work bucket grouping related requirements into a deliverable unit with a goal and success criteria |
| **Plan** | A detailed task list with dependencies, generated by the planner for a specific phase |
| **Plan checker** | An agent that validates a plan for completeness, correctness, and feasibility after planning |
| **Requirement** | A specific feature or behavior that needs to be built, assigned to a phase |
| **Researcher** | An agent that investigates technologies, patterns, and prior art during the planning stage |
| **Roadmap** | The overall structure of phases and milestones for a project, created during `/gsd-mm-new-project` |
| **Stage** | A category of work in the GSD workflow: planning, execution, or verification — each uses different agents |
| **Success criteria** | Observable behaviors that must be true when a phase completes — used for goal-backward verification |
| **Verifier** | An agent that performs goal-backward verification after phase execution |
| **Workflow mode** | A preconfigured combination of agents (Direct, Quick, Fast, Balanced, Thorough, Standard) that balances speed vs. quality for different development contexts |
| **Wave** | A group of tasks within a plan that can be executed in parallel (tasks in the same wave have no dependencies on each other) |
| **Worktree merge** | The process of merging independent `.megamemory/knowledge.db` files from git worktree feature branches back into the main worktree's database using `/gsd-mm-merge-worktrees` |

---

## Acknowledgments & License

This project builds upon the work of:

- [gsd-opencode](https://github.com/rokicool/gsd-opencode) — OpenCode integration for Get Shit Done
- [Get Shit Done](https://github.com/gsd-build/get-shit-done) — Original GSD framework and methodology
- [MegaMemory](https://github.com/0xK3vin/MegaMemory) — Persistent knowledge graph backend

Thank you to the creators and contributors of these projects.

**License:** MIT
