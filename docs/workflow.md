# Workflow

> How to work with Fuska — modes, lifecycle, session continuity, and end-to-end scenarios.

**Audience:** Daily users, anyone wanting to see complete workflows
**Prerequisites:** [Key Concepts](concepts.md)

---

## Workflow Modes

**Workflow modes** provide preconfigured combinations of agents that balance speed vs. quality. Choose a mode based on your needs.

### Planned

**Pipeline:** Planner -> Builder
**Plan Review:** Skipped

Task breakdown, atomic commits, MegaMemory state. Use when you have a plan and just want to execute it. Small tasks, trusted patterns.

### Checked

**Pipeline:** Planner -> Plan Checker -> Builder
**Plan Review:** Prompted

Adds requirement coverage, task completeness, and dependency validation. Use when you want validated plans before execution. Familiar tech, need confidence.

### Researched

**Pipeline:** Researcher -> Planner -> Plan Checker -> Builder
**Plan Review:** Prompted

Adds ecosystem research, standard patterns, and pitfall avoidance. Use when you need research context. New libraries, unfamiliar domains, integration work.

### Verified

**Pipeline:** Researcher -> Planner -> Plan Checker -> Builder -> Reviewer
**Plan Review:** Skipped

Full pipeline with code-level verification and gap detection. Use for critical systems, production code, high stakes.

### Override Behavior

- **Plan review** can be overridden per-invocation with `--review` (force) or `--no-review` (skip), or set permanently via `fuska config` → `interactive_review`
- **Commit** always prompts by default regardless of mode — the generated message is shown and you choose: commit, edit, or skip. Override per-invocation with `--auto-commit` to commit without prompting. There is no persistent config for commit behavior.
- Use `fuska config` to change default workflow mode
- Per-phase flags (`--research`, `--skip-verify`) augment your selected mode but never reduce it

---

## Phase Lifecycle

### Design

```
/fuska design
```

Optional. Use when requirements have gray areas (UI, UX, behavior). Asks targeted questions to clarify scope and saves decisions as phase context.

### Plan

```
/fuska plan
```

Always run. Creates a detailed task list with dependencies, grouped into waves for parallel execution. Plan checker validates the plan (unless skipped).

### Build

```
/fuska build
```

Always run. Implements plan tasks with atomic commits. Handles deviations automatically. Updates state after every task commit.

### Review

```
/fuska review
```

Optional. Performs goal-backward verification — checks whether code delivers what the phase *promised* (its goal and success criteria), not just whether tasks were completed.

---

## Ad-hoc Tasks with /fuska-do

```
/fuska-do [mode] [description]
```

Execute unplanned tasks outside the phase structure. Uses the same agent chains as phase workflow but creates standalone task concepts.

### Quick Mode vs /fuska-do

Both `--mode quick` (on `/fuska plan`) and `/fuska-do` use a lightweight agent chain (Planner -> Builder), but they differ in **scope** and **state management**.

`--mode quick` is a [workflow mode](#workflow-modes) you can pass to `/fuska plan`. It skips research and plan checking, running only Planner -> Builder. Useful when you're already in a phase and want faster execution without giving up Fuska's guarantees (atomic commits, deviation handling, state tracking).

| Aspect | `--mode quick` (on `/fuska plan`) | `/fuska do` |
|--------|----------------------------------------|-------------|
| **Scope** | Work within an existing phase | Standalone work outside phase structure |
| **Agent flow** | Planner -> Builder | Planner -> Builder |
| **Concept storage** | Phase-based: `phase-02-plan-003` | Standalone: `task-001-fix-typo` |
| **Roadmap ties** | Updates phase status and roadmap | Separate from roadmap |
| **Commit strategy** | Follows project's git strategy | Per-task commits |
| **Example** | `/fuska plan 2 --mode quick` | `/fuska do planned fix footer alignment` |

### Decision Guide

**Use `--mode quick` when:**
- The work belongs to an existing phase (e.g., "phase 2: authentication")
- You want state tracking and atomic commits tied to your roadmap
- The solution is straightforward but still needs proper task breakdown

```bash
# You're in phase 2 (auth) and need to add a simple endpoint
/fuska plan 2 --mode quick
# -> Creates phase-02-plan-003, tracks progress in roadmap
```

**Use `/fuska do` when:**
- The task is unplanned and doesn't fit any phase
- It's a one-off: bug fix, typo, minor refactoring, quick polish
- You don't want to expand the roadmap for minor work

```bash
# Ad-hoc task that doesn't belong to any phase
/fuska do planned fix the footer alignment on mobile
# -> Creates task-001-fix-footer-alignment, tracked separately
```

**Concept storage example:**

```yaml
# With --mode quick (tied to phase 02):
phase-02-plan-003:
  summary: "Add password reset endpoint"
  status: completed
  tasks: [done, done, done]

# With /fuska do (standalone):
task-001-fix-footer-alignment:
  summary: "Fix footer alignment on mobile breakpoints"
  status: completed
```

The key difference: `--mode quick` keeps your work organized within the phase structure, while `/fuska do` creates isolated task concepts for unplanned work.

---

## Session Continuity

Fuska tracks your progress **continuously** — you don't need to explicitly save state before ending a session.

### What's Tracked Automatically

The executor updates the state concept after **every task commit**:

| Field | Example | Updated When |
|-------|---------|--------------|
| `current_phase` | `phase-02` | Phase transitions |
| `current_plan` | `phase-02-plan-03` | Plan starts/completes |
| `current_task` | `3` | After each task commit |
| `total_tasks` | `7` | When plan loads |
| `last_activity` | `Task 3/7: Add form validation` | After each task commit |
| `status` | `in_progress` | State changes |

This means `/fuska resume` always knows exactly where you are — **even if you never paused**.

### When to Use /fuska pause

Since progress is tracked automatically, pause is now **optional**. Use it only when you want to capture **mental context**:

```
/fuska pause
```

**Captures:**
- Your mental context ("Was about to refactor to use a Map for O(1) lookups")
- Modified files (optional WIP commit)

**Does NOT need to capture:**
- Task position (already in state)
- Completed work (already in summaries)
- Decisions (already in decision concepts)

### Resume Without Pause

```bash
# End session mid-execution (no pause)
# ... next day ...

/fuska resume
# -> "Phase 2 — Shopping List. Task 3 of 7."
# -> "No mental context (no pause recorded)"
# -> Continues from task 3
```

Resume always works because task position is tracked continuously.

You can also run `/fuska` (bare) at any time to see where you are in the phase pipeline — it always knows your current position and shows you the exact command to continue.

### Resume With Context

```bash
# Pause with mental context
/fuska pause
# -> "What's the context?" -> "Was about to refactor grouping logic to use Map"

# ... next day ...

/fuska resume
# -> "Phase 2 — Shopping List. Task 3 of 7."
# -> "Context: Was about to refactor grouping logic to use Map"
# -> Continues from task 3 with your notes
```

### Checkpoint vs Pause

- **Checkpoint** — A structured pause point during execution where user verification is required (e.g., visual review, decision input). Defined in plans with `type="checkpoint:human-verify"`.
- **Pause** — Optional command to capture mental context before ending a session. Task progress is already saved.

You can run `/fuska resume` (or just `/fuska`) at any time — it will show your exact position whether or not you paused.

---

## Scenarios

All examples use **RecipeVault** — an imaginary Next.js recipe-sharing app with users, recipes, search, and a Prisma/PostgreSQL backend.

### Building a Feature from Scratch

*You want to add a **Meal Planner** — weekly calendar, shopping lists, nutritional summaries. This is a big feature, so you use the full workflow.*

First, map the codebase so Fuska understands your architecture, then create the project:

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska map` | — | Scans `recipevault/`. Discovers Next.js 14 app router, Prisma schema with `User`, `Recipe`, `Ingredient` models, TailwindCSS, and a `/api` directory with REST endpoints. Creates codebase map in MegaMemory. |
| 2 | `fuska init "Meal Planner"` then `/fuska-configure-initiative` | *"Users can plan weekly meals, generate shopping lists from selected recipes, and see nutritional summaries per day."* | `fuska init` creates the "main" initiative with description. `/fuska-configure-initiative` asks clarifying questions about scope. You answer interactively. Configures the initiative with milestone "Meal Planner v1.0" and 4 phases: (1) Calendar UI & Data Model, (2) Shopping List Generation, (3) Nutritional Summary, (4) Polish & Edge Cases. |
| 3 | `/fuska` | — | Shows phase pipeline: Phase 1 of 4, current position at "plan into tasks". You see what to do next. |
| 4 | `/fuska design` | *"Calendar should be a weekly grid, Monday–Sunday. Users drag recipes from a sidebar into day slots. Mobile: vertical stack instead of grid."* | Identifies 6 open questions (drag-and-drop library? max recipes per slot? recurring meals?). You answer each. Saves decisions as phase-1 context. |
| 5 | `/fuska plan --research` | — | Researcher agent investigates `@dnd-kit` vs `react-beautiful-dnd`, checks Prisma relation patterns for calendar events. Planner creates 14 tasks across 3 waves: DB migration -> API routes -> UI components. Plan-checker validates task dependencies. |
| 6 | `/fuska build` | — | Builder starts Wave 1: creates `MealSlot` model in Prisma, runs migration, adds API routes. Wave 2: builds `<WeekGrid>`, `<DayColumn>`, `<RecipeDragCard>` components. Wave 3: wires drag-and-drop, adds optimistic updates. 14 atomic commits total. |
| 7 | `/fuska review` | — | Reviewer checks success criteria: "Users can drag recipes onto a weekly calendar" -> **PASS**. "Calendar persists across page reloads" -> **PASS**. "Mobile layout stacks vertically" -> **PASS**. Phase 1 marked complete. |
| 8 | `/fuska` | — | Shows: 1/4 phases complete. Phase 2 pipeline at "plan into tasks". |
| 9 | `/fuska plan` | — | Plans the Shopping List phase. 11 tasks across 2 waves: ingredient aggregation logic -> shopping list UI with grouping by aisle. |
| 10 | `/fuska build` | — | Builds shopping list. Aggregates ingredients across selected meals, deduplicates, groups by category. Adds print-friendly view. |

### Pausing and Resuming Across Sessions

*You're midway through executing Phase 2 (Shopping List) when you need to stop for the day.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska build` | — | Builder starts. Completes Wave 1 (ingredient aggregation logic, 5 tasks). Begins Wave 2 (shopping list UI)... |
| 2 | `/fuska pause` | *"Was about to refactor the grouping logic to use a Map instead of object for O(1) lookups"* | Captures mental context. Task position already tracked in state (Task 3 of 6). Saves handoff with context. |

*Next morning, new session:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 3 | `/fuska` | — | Shows: "Fuska: Meal Planner — paused. You left off at Phase 2: Shopping List Generation." Points to `/fuska resume`. |
| 4 | `/fuska resume` | — | Shows: "Phase 2 — Shopping List Generation. Task 3 of 6." Displays your context: "Was about to refactor grouping logic to use Map." Continues from task 3. |
| 5 | `/fuska todo` | *"Look into Instacart API for direct-to-cart shopping list export"* | Creates todo tagged `integration`: "Investigate Instacart API for shopping list export." Doesn't interrupt current work. |
| 6 | *(execution completes)* | — | Remaining 3 tasks complete. 4 more atomic commits. Phase 2 execution finished. |
| 7 | `/fuska review` | — | "Shopping list aggregates ingredients from weekly plan" -> **PASS**. "Items grouped by aisle" -> **PASS**. "Print view renders cleanly" -> **PASS**. Phase 2 complete. |

### Discovering Unplanned Work

*While building Phase 3 (Nutritional Summary), you realize the USDA FoodData API needs OAuth2 — something nobody planned for.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska build` | — | Builder starts Wave 1. While implementing the nutrition data fetcher, flags a deviation: "USDA FoodData Central API requires API key registration and OAuth2 token flow. This was not in the plan." |
| 2 | `/fuska add "USDA API OAuth2 integration"` | — | Creates Phase 5: "USDA API OAuth2 Integration" with auto-generated requirements: token management, refresh flow, secure key storage. Added after Phase 4 in the roadmap. |
| 3 | `/fuska insert 3 "USDA API OAuth2 integration"` | — | Inserts the OAuth2 phase *before* Phase 3 (now renumbered to Phase 4) so the auth is ready before the nutritional summary needs it. Existing phases renumber automatically. |
| 4 | `/fuska plan` | — | Plans the new OAuth2 phase: 6 tasks — environment variable setup, token fetcher service, refresh middleware, Prisma model for token storage, integration tests. |
| 5 | `/fuska build` | — | Builds the OAuth2 integration. 6 atomic commits. Token refresh tested against USDA sandbox. Now Phase 4 (Nutritional Summary) can proceed with auth in place. |

### Verification Failure and Recovery

*You built a **Recipe Import** feature (paste a URL, scrape the recipe). Verification catches a gap.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska init "Recipe Import"` then `/fuska-configure-initiative` | *"Users paste a recipe URL, the app scrapes the title, ingredients, and steps, and creates a new Recipe."* | `fuska init` creates the "main" initiative with description. `/fuska-configure-initiative` configures it with milestone "Recipe Import v1.0" and 2 phases: (1) URL Scraper & Parser, (2) Import UI & Error Handling. |
| 2 | `/fuska plan` | — | Plans 8 tasks: URL validator, HTML fetcher, Cheerio-based parser for common recipe sites, ingredient normalizer, step extractor, Prisma integration, tests. |
| 3 | `/fuska build` | — | Builds the scraper. Handles AllRecipes, Epicurious, and Food Network formats. 8 atomic commits. |
| 4 | `/fuska review` | — | "Scraper extracts title from AllRecipes" -> **PASS**. "Scraper extracts ingredients" -> **PASS**. "Scraper handles JSON-LD structured data" -> **FAIL** — the scraper only parses HTML microdata, but many sites embed recipes as JSON-LD `<script>` tags. |
| 5 | `/fuska build` | — | Re-executes with verification feedback. Adds JSON-LD parser that extracts `Recipe` schema from `<script type="application/ld+json">` tags. Falls back to HTML scraping when JSON-LD is absent. 2 additional commits. |
| 6 | `/fuska review` | — | Re-verifies. "JSON-LD structured data" -> **PASS**. "Fallback to HTML scraping" -> **PASS**. All criteria met. Phase 1 complete. |

### Quick Fix for a Production Bug

*A week after shipping Recipe Import, users report the scraper crashes on URLs with query parameters.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska do planned "The recipe scraper crashes when the URL contains query parameters like ?ref=share. The URL validator rejects anything after ?. Need to strip or preserve query params before validation."` | — | Spawns planner + executor directly. Plans 2 tasks: fix URL validator regex to allow query strings, add test cases for URLs with `?`, `#`, and `&`. Executes immediately. 1 atomic commit. Task logged separately from the roadmap. |
| 2 | `/fuska todos` | — | Shows 1 open todo: "Investigate Instacart API for shopping list export" (from earlier). No new todos from the fix. |

### Multiple Initiatives in One Codebase

*You're working on **Meal Planner** and **Recipe Import** in the same codebase, switching between them.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska initiatives` | — | Lists all initiatives with current marker: `> meal-planner` (active), `  recipe-import`, `  user-profiles`. Shows status and phase progress for each. |
| 2 | `fuska initiative-switch recipe-import` | — | Switches to recipe-import. The pointer in config updates: `current_initiative: "recipe-import"`. |
| 3 | `/fuska` | — | Shows: Phase 2 of 2 for Recipe Import, pipeline at "plan into tasks". |
| 4 | `/fuska plan` | — | Plans Phase 2 for Recipe Import: import modal UI, URL input with preview, error states, loading skeleton. 9 tasks. |
| 5 | `/fuska build` | — | Builds the import UI for recipe-import. Modal with URL paste, live preview of scraped recipe, confirm/edit before saving. 9 commits. |
| 6 | `/fuska review` | — | Recipe Import Phase 2 verified. All criteria pass. |
| 7 | `fuska initiative-switch meal-planner` | — | Switches back to Meal Planner. The pointer updates: `current_initiative: "meal-planner"`. |
| 8 | `/fuska` | — | Shows: 3/4 phases complete for Meal Planner. Phase 4 pipeline at "plan into tasks". |
| 9 | `/fuska plan` | — | Plans Phase 4 (Polish & Edge Cases): empty states, error boundaries, loading skeletons, keyboard navigation. 7 tasks. |
| 10 | `/fuska build` | — | Builds polish phase for meal-planner. 7 commits. Project continues independently from recipe-import. |

### Milestones and Releases

*Meal Planner v1.0 shipped. Now you're starting v1.1 with two new features: meal sharing and dietary presets.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska complete` | *Selects project: meal-planner* | Marks "Meal Planner v1.0" as complete. Summary: 4 phases completed, 45 tasks executed, 45 atomic commits. |
| 2 | `/fuska milestone "Meal Planner v1.1"` | *"Two features: (1) share weekly meal plans with other users, (2) dietary preset filters (vegetarian, keto, gluten-free) that restrict recipe suggestions."* | Creates milestone "Meal Planner v1.1" with 3 phases: (1) Sharing Backend & Permissions, (2) Dietary Presets & Filtering, (3) Integration & Polish. |
| 3 | `/fuska plan` | — | Plans the sharing phase: permission model, share-link generation, recipient view, Prisma relations for shared plans. 12 tasks. |
| 4 | `/fuska build` | — | Builds sharing backend. 12 commits. |
| 5 | `/fuska audit` | — | Audit shows: Phase 1 complete, Phases 2-3 pending. Estimates ~20 tasks remaining. No blockers detected. |
| 6 | `/fuska complete` | — | *(After completing all phases)* Marks "Meal Planner v1.1" complete. Summary: 3 phases, 28 tasks, 28 commits. Both milestones visible in project history. |

### Merging Knowledge from Git Worktrees

*You're building Meal Planner v1.1 using git worktrees. Two developers (you + AI) work in parallel on separate branches, each with its own knowledge database. After merging code, you need to merge the knowledge graphs.*

**Setup:**
```
recipevault/                          # Main worktree (main branch)
  .megamemory/knowledge.db           <- 85 concepts (base project)

recipevault/feature-sharing/          # Worktree for sharing feature
  .megamemory/knowledge.db           <- 52 concepts (sharing plans, research, summaries)

recipevault/feature-dietary/          # Worktree for dietary presets
  .megamemory/knowledge.db           <- 41 concepts (dietary plans, research, summaries)
```

*After `git merge feature-sharing` and `git merge feature-dietary` complete, you merge the knowledge:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska worktree-merge feature-sharing feature-dietary` | — | Verifies all three databases exist. Creates backup: `knowledge.db.backup-20250211-143022`. Starts merge session. |
| 2 | *(merge 1/2: feature-sharing)* | — | Runs `megamemory merge` with main + feature-sharing. 48 clean merges, 2 conflicts detected. |
| 3 | *(conflict: phase-01 context)* | *Selects "AI verify"* | AI reads referenced files. `src/lib/sharing/permissions.ts` exists, `src/lib/auth/sharing-middleware.ts` was renamed to `src/middleware/sharing.ts`. Resolves with updated file refs. |
| 4 | *(conflict: req-SOCIAL-01)* | *Selects "Keep right"* | Keeps the feature-sharing version of the social requirement (more detailed after implementation). |
| 5 | *(merge 2/2: feature-dietary)* | — | Merges feature-dietary into the already-merged database. 39 clean merges, 0 conflicts. |
| 6 | *(post-merge validation)* | — | Final conflict check: 0 remaining. Database readable. Displays summary: 2 branches merged, 2 conflicts detected, 2 resolved. Backup preserved. |

### Revisiting Old Initiatives

*Recipe Import shipped months ago. You want to pick it back up for a v2.0.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska initiatives` | — | Shows all initiatives sorted by last activity: `> meal-planner (current)  2 hours ago`, `  user-profiles  3 days ago`, `  recipe-import  2 months ago`. Least-active initiatives naturally sink to the bottom. |
| 2 | `fuska initiative-switch recipe-import` | — | Switches to recipe-import. The pointer updates. |
| 3 | `/fuska milestone "Recipe Import v2.0"` | — | Continues work on recipe-import with new milestone for v2.0 features. |
| 4 | `fuska initiatives` | — | recipe-import is now at the top (most recent activity), with `(current)` marker. |

**Key points:**
- No archiving needed — inactive initiatives naturally sort to the bottom by last activity
- All knowledge (phases, summaries, decisions) is always preserved
- Switch to any initiative at any time

---

## See Also

- [configuration.md](configuration.md) — Workflow mode settings and model profiles
- [commands.md](commands.md) — Full command reference
- [concepts.md](concepts.md) — Mental model behind these workflows
