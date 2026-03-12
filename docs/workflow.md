# Workflow

> How to work with Fuska — modes, lifecycle, session continuity, and end-to-end scenarios.

**Audience:** Daily users, anyone wanting to see complete workflows
**Prerequisites:** [Key Concepts](concepts.md)

## Table of Contents

- [Workflow Modes](#workflow-modes)
  - [Planned](#planned)
  - [Checked](#checked)
  - [Researched](#researched)
  - [Verified](#verified)
  - [Override Behavior](#override-behavior)
- [Chapter Lifecycle](#chapter-lifecycle)
  - [Design](#design)
  - [Plan](#plan)
  - [Build](#build)
  - [Review](#review)
- [Ad-hoc Tasks with /fuska-do](#ad-hoc-tasks-with-fuska-do)
  - [Quick Mode vs /fuska-do](#quick-mode-vs-fuska-do)
  - [Decision Guide](#decision-guide)
- [Formalize as You Go](#formalize-as-you-go)
- [Session Continuity](#session-continuity)
  - [What's Tracked Automatically](#whats-tracked-automatically)
  - [Getting Back to Where You Were](#getting-back-to-where-you-were)
- [Scenarios](#scenarios)
  - [Building a Feature from Scratch](#building-a-feature-from-scratch)
  - [Resuming Across Sessions](#resuming-across-sessions)
  - [Discovering Unplanned Work](#discovering-unplanned-work)
  - [Verification Failure and Recovery](#verification-failure-and-recovery)
  - [Quick Fix for a Production Bug](#quick-fix-for-a-production-bug)
  - [Code Review Catching a Bug (Real-World Example)](#code-review-catching-a-bug-real-world-example)
  - [Chapter-Todo Iterative Loop](#chapter-todo-iterative-loop)
  - [Multiple Initiatives in One Codebase](#multiple-initiatives-in-one-codebase)
  - [Milestones and Releases](#milestones-and-releases)
  - [Merging Knowledge from Git Worktrees](#merging-knowledge-from-git-worktrees)
  - [Revisiting Old Initiatives](#revisiting-old-initiatives)
  - [Formalizing a Conversation into a Chapter](#formalizing-a-conversation-into-a-chapter)
- [See Also](#see-also)

---

## Workflow Modes

**Workflow modes** provide preconfigured combinations of agents that balance speed vs. quality. Choose a mode based on your needs.

### Planned

**Pipeline:** Planner -> Builder -> Code Reviewer
**Plan Review:** Skipped

Task breakdown, atomic commits, MegaMemory state. Code Reviewer validates the implementation against the plan, fixing stubs and wiring issues (up to 3 iterations). Use when you have a plan and just want to execute it. Small tasks, trusted patterns. Skip code review with `--no-code-review`.

### Checked

**Pipeline:** Planner -> Plan Checker -> Builder -> Code Reviewer
**Plan Review:** Prompted

Adds requirement coverage, task completeness, and dependency validation. Code Reviewer validates the implementation against the plan, fixing stubs and wiring issues (up to 3 iterations). Use when you want validated plans before execution. Familiar tech, need confidence. Skip code review with `--no-code-review`.

### Researched

**Pipeline:** Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer
**Plan Review:** Prompted

Adds ecosystem research, standard patterns, and pitfall avoidance. Code Reviewer validates the implementation against the plan, fixing stubs and wiring issues (up to 3 iterations). Use when you need research context. New libraries, unfamiliar domains, integration work. Skip code review with `--no-code-review`.

### Verified

**Pipeline:** Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer -> Reviewer
**Plan Review:** Skipped

Full pipeline with code review and code-level verification. Code Reviewer validates the implementation against the plan (up to 3 iterations), then Reviewer does deep goal-backward verification. Use for critical systems, production code, high stakes. Skip code review with `--no-code-review`.

### Override Behavior

- **Plan review** can be overridden per-invocation with `--review` (force) or `--no-review` (skip), or set permanently via `fuska config` → `interactive_review`
- **Code review** runs in all modes by default. Skip with `--no-code-review` or force with `--code-review`. If the working directory has uncommitted changes from before the task, Fuska warns you before code review starts and offers: commit existing changes first, stash them, skip code review, or proceed anyway. This prevents the reviewer from seeing (and "fixing") unrelated changes
- **Commit** always prompts by default regardless of mode — the generated message is shown and you choose: commit, edit, or skip. Override per-invocation with `--auto-commit` to commit without prompting. There is no persistent config for commit behavior.
- Use `fuska config` to change default workflow mode
- Per-chapter flags (`--research`, `--skip-verify`) augment your selected mode but never reduce it

---

## Chapter Lifecycle

### Design

```
/fuska-design
```

Optional. Use when requirements have gray areas (UI, UX, behavior). Asks targeted questions to clarify scope and saves decisions as chapter context.

### Plan

```
/fuska-plan
```

Always run. Creates a detailed task list with dependencies, grouped into batches for sequential execution. Plan checker validates the plan (unless skipped).

### Build

```
/fuska-build
```

> **Warning:** Parallel execution mode can cause database corruption under high load.
> Use sequential mode (now default) for production work. Parallel is only safe for
> small batches (≤3 tasks) in low-load scenarios.

Always run. Implements plan tasks with atomic commits. Handles deviations automatically. Updates state after every task commit. TDD plans follow a RED-GREEN-REFACTOR cycle instead of linear execution, producing 2-3 commits per plan. See [concepts.md](concepts.md#plan-types) for plan type details.

### Review

```
/fuska-review
```

Optional. Performs goal-backward verification — checks whether code delivers what the chapter *promised* (its goal and success criteria), not just whether tasks were completed.

---

## Ad-hoc Tasks with /fuska-do

```
/fuska-do [mode] [description]
```

Execute unplanned tasks outside the chapter structure. Uses the same agent chains as chapter workflow but creates standalone task concepts.

### Quick Mode vs /fuska-do

Both `--mode quick` (on `/fuska-plan`) and `/fuska-do` use a lightweight agent chain (Planner -> Builder), but they differ in **scope** and **state management**.

`--mode quick` is a [workflow mode](#workflow-modes) you can pass to `/fuska-plan`. It skips research and plan checking, running only Planner -> Builder. Useful when you're already in a chapter and want faster execution without giving up Fuska's guarantees (atomic commits, deviation handling, state tracking).

| Aspect | `--mode quick` (on `/fuska-plan`) | `/fuska-do` |
|--------|----------------------------------------|-------------|
| **Scope** | Work within an existing chapter | Standalone work outside chapter structure |
| **Agent flow** | Planner -> Builder | Planner -> Builder -> Code Reviewer |
| **Concept storage** | Chapter-based: `chapter-02-plan-003` | Standalone: `task-001-fix-typo` |
| **Roadmap ties** | Updates chapter status and roadmap | Separate from roadmap |
| **Commit strategy** | Follows project's git strategy | Per-task commits |
| **Example** | `/fuska-plan 2 --mode quick` | `/fuska-do planned fix footer alignment` |

### Decision Guide

**Use `--mode quick` when:**
- The work belongs to an existing chapter (e.g., "chapter 2: authentication")
- You want state tracking and atomic commits tied to your roadmap
- The solution is straightforward but still needs proper task breakdown

```bash
# You're in chapter 2 (auth) and need to add a simple endpoint
/fuska-plan 2 --mode quick
# -> Creates chapter-02-plan-003, tracks progress in roadmap
```

**Use `/fuska-do` when:**
- The task is unplanned and doesn't fit any chapter
- It's a one-off: bug fix, typo, minor refactoring, quick polish
- You don't want to expand the roadmap for minor work

```bash
# Ad-hoc task that doesn't belong to any chapter
/fuska-do planned fix the footer alignment on mobile
# -> Creates task-001-fix-footer-alignment, tracked separately
```

**Concept storage example:**

```yaml
# With --mode quick (tied to chapter 02):
chapter-02-plan-003:
  summary: "Add password reset endpoint"
  status: completed
  tasks: [done, done, done]

# With /fuska-do (standalone):
task-001-fix-footer-alignment:
  summary: "Fix footer alignment on mobile breakpoints"
  status: completed
```

The key difference: `--mode quick` keeps your work organized within the chapter structure, while `/fuska-do` creates isolated task concepts for unplanned work.

---

## Formalize as You Go

You don't need to decide upfront whether a conversation is "just chatting" or "real work." At any point, you can formalize what you've been discussing into Fuska's structured workflow.

**Three escalation paths:**

- **"Send this to the researcher"** — Spawns the researcher agent with your conversation context. It investigates the topic — ecosystem options, standard patterns, potential pitfalls — and stores findings in MegaMemory for later planning.

- **"Run this through the plan checker"** — The same expert panel (quality advocate + contextual reviewer + domain expert) evaluates your approach, with cross-validation and severity boosting. You get structured feedback — blockers, warnings, and suggestions — without entering the formal workflow. Just describe your plan or paste it into the conversation.

- **"Create a chapter of this"** — Creates a full chapter in MegaMemory from the conversation. Fuska derives requirements from what you discussed, generates plans with tasks, and marks the chapter ready to `/fuska-build`. You go from brainstorming to structured work in one phrase.

**Why this works:** The researcher, planner, and plan checker are standalone agents. The `/fuska-plan` command orchestrates them automatically, but each can be invoked directly from any conversation — they don't require the formal pipeline to have been started.

---

## Session Continuity

Fuska tracks your progress **continuously** — you don't need to explicitly save state before ending a session.

### What's Tracked Automatically

The executor updates the state concept after **every task commit**:

| Field | Example | Updated When |
|-------|---------|--------------|
| `current_chapter` | `chapter-02` | Chapter transitions |
| `current_plan` | `chapter-02-plan-03` | Plan starts/completes |
| `current_task` | `3` | After each task commit |
| `total_tasks` | `7` | When plan loads |
| `last_activity` | `Task 3/7: Add form validation` | After each task commit |
| `status` | `in_progress` | State changes |

### Getting Back to Where You Were

Run `/fuska` anytime — new session, mid-work, after a break. It reads your state from MegaMemory and shows your exact position:

```
Fuska: Meal Planner -- 1/4 chapters complete

Chapter 2 of 4: Shopping List Generation

    share your vision    done
    plan into tasks      done -- 6 tasks in 2 batches
  > build it             /fuska-build
    check it works       /fuska-review

Ready to build. Tasks run grouped by batch.
```

The `>` marks where you are. Each step shows its command. No manual saving, no resume command — your position is always current.

**Checkpoint** — A structured pause point during execution where user verification is required (e.g., visual review, decision input). Defined in plans with `type="checkpoint:human-verify"`. Task progress is tracked continuously.

---

## Scenarios

All examples use **RecipeVault** — an imaginary Next.js recipe-sharing app with users, recipes, search, and a Prisma/PostgreSQL backend.

### Building a Feature from Scratch

*You want to add a **Meal Planner** — weekly calendar, shopping lists, nutritional summaries. This is a big feature, so you use the full workflow.*

First, map the codebase so Fuska understands your architecture, then create the project:

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`/fuska-map-codebase`</nobr> | — | Scans `recipevault/`. Discovers Next.js 14 app router, Prisma schema with `User`, `Recipe`, `Ingredient` models, TailwindCSS, and a `/api` directory with REST endpoints. Creates codebase map in MegaMemory. |
| 2 | <nobr>`fuska init "Meal Planner"` then `/fuska-configure`</nobr> | *"Users can plan weekly meals, generate shopping lists from selected recipes, and see nutritional summaries per day."* | `fuska init` creates the "main" initiative with description. `/fuska-configure` asks clarifying questions about scope. You answer interactively. Configures the initiative with milestone "Meal Planner v1.0" and 4 chapters: (1) Calendar UI & Data Model, (2) Shopping List Generation, (3) Nutritional Summary, (4) Polish & Edge Cases. |
| 3 | <nobr>`/fuska`</nobr> | — | Shows chapter pipeline: Chapter 1 of 4, current position at "plan into tasks". You see what to do next. |
| 4 | <nobr>`/fuska-design`</nobr> | *"Calendar should be a weekly grid, Monday–Sunday. Users drag recipes from a sidebar into day slots. Mobile: vertical stack instead of grid."* | Identifies 6 open questions (drag-and-drop library? max recipes per slot? recurring meals?). You answer each. Saves decisions as chapter-1 context. |
| 5 | <nobr>`/fuska-plan --research`</nobr> | — | Researcher agent investigates `@dnd-kit` vs `react-beautiful-dnd`, checks Prisma relation patterns for calendar events. Planner creates 14 tasks across 3 batches: DB migration -> API routes -> UI components. Plan-checker validates task dependencies. |
| 6 | <nobr>`/fuska-build`</nobr> | — | Builder starts Batch 1: creates `MealSlot` model in Prisma, runs migration, adds API routes. Batch 2: builds `<WeekGrid>`, `<DayColumn>`, `<RecipeDragCard>` components. Batch 3: wires drag-and-drop, adds optimistic updates. 14 atomic commits total. |
| 7 | <nobr>`/fuska-review`</nobr> | — | Reviewer checks success criteria: "Users can drag recipes onto a weekly calendar" -> **PASS**. "Calendar persists across page reloads" -> **PASS**. "Mobile layout stacks vertically" -> **PASS**. Chapter 1 marked complete. |
| 8 | <nobr>`/fuska`</nobr> | — | Shows: 1/4 chapters complete. Chapter 2 pipeline at "plan into tasks". |
| 9 | <nobr>`/fuska-plan`</nobr> | — | Plans the Shopping List chapter. 11 tasks across 2 batches: ingredient aggregation logic -> shopping list UI with grouping by aisle. |
| 10 | <nobr>`/fuska-build`</nobr> | — | Builds shopping list. Aggregates ingredients across selected meals, deduplicates, groups by category. Adds print-friendly view. |

### Resuming Across Sessions

*You're midway through executing Chapter 2 (Shopping List) when you need to stop for the day.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`/fuska-build`</nobr> | — | Builder starts. Completes Batch 1 (ingredient aggregation logic, 5 tasks). Begins Batch 2 (shopping list UI)... |
| 2 | *(close editor)* | — | Task position already tracked in state (Task 3 of 6). Nothing to do — just close. |

*Next morning, new session:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 3 | <nobr>`/fuska`</nobr> | — | Shows: Chapter 2, pipeline at "build it" with `/fuska-build`. You see exactly where you left off. |
| 4 | <nobr>`/fuska-build`</nobr> | — | Continues from task 3 of 6. Remaining 3 tasks complete. 4 more atomic commits. Chapter 2 execution finished. |
| 5 | <nobr>`/fuska-add-todo Look into Instacart API for direct-to-cart shopping list export`</nobr> | — | Creates todo tagged `integration`: "Investigate Instacart API for shopping list export." Doesn't interrupt current work. |
| 6 | <nobr>`/fuska-review`</nobr> | — | "Shopping list aggregates ingredients from weekly plan" -> **PASS**. "Items grouped by aisle" -> **PASS**. "Print view renders cleanly" -> **PASS**. Chapter 2 complete. |

### Discovering Unplanned Work

*While building Chapter 3 (Nutritional Summary), you realize the USDA FoodData API needs OAuth2 — something nobody planned for.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`/fuska-build`</nobr> | — | Builder starts Batch 1. While implementing the nutrition data fetcher, flags a deviation: "USDA FoodData Central API requires API key registration and OAuth2 token flow. This was not in the plan." |
| 2 | <nobr>`/fuska-add-chapter USDA API OAuth2 integration`</nobr> | — | Creates Chapter 5: "USDA API OAuth2 Integration" with auto-generated requirements: token management, refresh flow, secure key storage. Added after Chapter 4 in the roadmap. |
| 3 | <nobr>`/fuska-insert-chapter 3 USDA API OAuth2 integration`</nobr> | — | Inserts the OAuth2 chapter *before* Chapter 3 (now renumbered to Chapter 4) so the auth is ready before the nutritional summary needs it. Existing chapters renumber automatically. |
| 4 | <nobr>`/fuska-plan`</nobr> | — | Plans the new OAuth2 chapter: 6 tasks — environment variable setup, token fetcher service, refresh middleware, Prisma model for token storage, integration tests. |
| 5 | <nobr>`/fuska-build`</nobr> | — | Builds the OAuth2 integration. 6 atomic commits. Token refresh tested against USDA sandbox. Now Chapter 4 (Nutritional Summary) can proceed with auth in place. |

### Verification Failure and Recovery

*You built a **Recipe Import** feature (paste a URL, scrape the recipe). Verification catches a gap.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`fuska init "Recipe Import"` then `/fuska-configure`</nobr> | *"Users paste a recipe URL, the app scrapes the title, ingredients, and steps, and creates a new Recipe."* | `fuska init` creates the "main" initiative with description. `/fuska-configure` configures it with milestone "Recipe Import v1.0" and 2 chapters: (1) URL Scraper & Parser, (2) Import UI & Error Handling. |
| 2 | <nobr>`/fuska-plan`</nobr> | — | Plans 8 tasks: URL validator, HTML fetcher, Cheerio-based parser for common recipe sites, ingredient normalizer, step extractor, Prisma integration, tests. |
| 3 | <nobr>`/fuska-build`</nobr> | — | Builds the scraper. Handles AllRecipes, Epicurious, and Food Network formats. 8 atomic commits. |
| 4 | <nobr>`/fuska-review`</nobr> | — | "Scraper extracts title from AllRecipes" -> **PASS**. "Scraper extracts ingredients" -> **PASS**. "Scraper handles JSON-LD structured data" -> **FAIL** — the scraper only parses HTML microdata, but many sites embed recipes as JSON-LD `<script>` tags. |
| 5 | <nobr>`/fuska-build`</nobr> | — | Re-executes with verification feedback. Adds JSON-LD parser that extracts `Recipe` schema from `<script type="application/ld+json">` tags. Falls back to HTML scraping when JSON-LD is absent. 2 additional commits. |
| 6 | <nobr>`/fuska-review`</nobr> | — | Re-verifies. "JSON-LD structured data" -> **PASS**. "Fallback to HTML scraping" -> **PASS**. All criteria met. Chapter 1 complete. |

### Quick Fix for a Production Bug

*A week after shipping Recipe Import, users report the scraper crashes on URLs with query parameters.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | *(see command below)* | — | Spawns planner + executor directly. Plans 2 tasks: fix URL validator regex to allow query strings, add test cases for URLs with `?`, `#`, and `&`. Executes immediately. 1 atomic commit. Task logged separately from the roadmap. |

Command for step 1:
```
/fuska-do planned The recipe scraper crashes when the URL contains query parameters like ?ref=share. The URL validator rejects anything after ?. Need to strip or preserve query params before validation.
```
| 2 | <nobr>`/fuska-check-todos`</nobr> | — | Shows 1 open todo: "Investigate Instacart API for shopping list export" (from earlier). No new todos from the fix. |

### Transforming Large Plans

When planning sessions grow beyond 5 tasks, chapterize them for better context management.

#### Auto-Suggestion from /fuska-do

```bash
/fuska-do checked implement complex authentication system

# Planner creates plan with 8 tasks
# Review loop displays:
#
# ? Review plan:
#   > Execute now
#     Ask a question
#     Chapterize this plan        ← Auto-appears for large plans
#     Modify the plan
#     Save and exit

# Select "Chapterize this plan"
# → fuska-do suggests: "Run /fuska-chapterize task-029-large-auth"

/new
/fuska-chapterize task-029-large-auth
# Interactive prompts:
# ? Chapter name: User Authentication System
# ? Chapter goal: Secure user authentication with OAuth and JWT
# ? Research domain? [Yes/No]

# Creates: chapter-03 with 3 subplans (3-3-2 task split)
# Result: chapter-03-plan-01, chapter-03-plan-02, chapter-03-plan-03
# → Automatically added to roadmap
```

#### Manual Trigger from Planning Discussion

```bash
# Long planning conversation with AI...
# "We need to handle rate limiting, caching, retries, backoff, monitoring, alerts..."
# (discussion continues with 7-8 tasks emerging)

# User: "This is getting complex. Let's break this into a chapter."

/fuska-chapterize
# Context mode: extracts tasks from current conversation
# Interactive prompts:
# ? Chapter name: API Rate Limiting & Resilience
# ? Chapter goal: Robust API with rate limiting, caching, and monitoring
# ? Research domain? [Yes/No]

# Creates chapter structure from current context
# Each subplan gets 2-3 tasks (vertical slices)
# → Automatically added to roadmap
```

#### Context Mode: From Conversation to Chapter

Use context mode when a planning discussion has evolved into actionable work.

**Trigger:**
```bash
/fuska-chapterize
```

**What happens:**
1. Agent extracts objective, purpose, and tasks from conversation
2. Prompts for chapter name and goal
3. Asks whether to research domain
4. Groups tasks into subplans (2-3 tasks each, vertical slices)
5. Creates chapter concept in MegaMemory
6. Creates subplan concepts with proper dependencies

**Example workflow:**
```bash
# Long conversation about API rate limiting...
# User: "This is getting complex. Let's break this into a chapter."
/fuska-chapterize

# ? Chapter name: API Rate Limiting & Resilience
# ? Chapter goal: Robust API with rate limiting, caching, and monitoring
# ? Research domain? No

# Creates: chapter-03 with 3 subplans
# Result: chapter-03-plan-01, chapter-03-plan-02, chapter-03-plan-03
# → Automatically added to roadmap
```

**When to use context mode:**
- Planning discussion grew beyond 5-6 tasks
- You've been brainstorming and want to formalize
- After saying "create a chapter of this"
- When you want to preserve conversation context as structured work

**Explicit mode vs Context mode:**

| Aspect | Explicit mode | Context mode |
|--------|---------------|--------------|
| **Input** | Plan ID from MegaMemory | Current conversation |
| **Best for** | Known large plan | Evolved discussions |
| **Example** | `/fuska-chapterize task-015` | `/fuska-chapterize` |
| **Extraction** | Loads existing plan | Extracts from chat |
| **Research** | Optional (flag or prompt) | Optional (prompt) |

**Troubleshooting:**
- **No clear tasks?** Agent prompts for clarification if conversation lacks actionable items
- **Cancel mid-prompts?** Safe to cancel — no partial state created in MegaMemory
- **Next steps?** After chapterization, run `/fuska-plan 03` to plan first subplan

#### Plain-Language Trigger

In any planning conversation, you can trigger chapterization with natural language:

```
"Chapterize this plan"
"Break this into chapters"
"Transform this into a chapter structure"
"Let's make this a chapter with subplans"
```

The AI recognizes these phrases and runs `/fuska-chapterize` in context mode.

#### With Research Phase

```bash
/fuska-chapterize task-015-payment-system --research

# Explicit mode with research enabled
# Queries MegaMemory for payment processing patterns:
# - Standard stack (Stripe, Braintree, PayPal)
# - Architecture patterns (idempotency, webhooks, retries)
# - Common pitfalls (race conditions, duplicate charges)

# Creates research concept: chapter-05-research
# Subplans informed by domain patterns
# Each plan includes research-backed verification steps
```

#### After Chapterization

The chapter is automatically added to the roadmap. Next steps:

```bash
# Plan the first subplan
/fuska-plan 03

# Or plan all subplans sequentially
/fuska-plan 03
# After completion...
/fuska-plan 03
# (auto-detects next subplan)
```

### Code Review Catching a Bug (Real-World Example)

*You run `/fuska-do checked` to improve the config mode display — replacing misleading percentages with actual agent pipelines. The code reviewer catches a typo that would have broken the display. See [fuska-do-session-distilled.md](fuska-do-session-distilled.md) for the full annotated walkthrough.*

**Builder completes the task.** Modifies `src/commands/config.ts` — replaces percentage-based mode descriptions (like "Standard (90%)") with agent pipeline descriptions (like "Researcher → Planner → Checker → Executor → Verifier") across 4 display locations.

**Code reviewer (iteration 1) — ISSUES FOUND:**

```
ISSUES FOUND
Task: Improve config mode display - Replace misleading percentages with actual agent pipelines
Files reviewed: 1
Issues: 1 blocker

Blockers (must fix)
1. [Anti-Patterns] Typo in property access path
- File: src/commands/config.ts
- Line: 542
- Fix: Change this.config.workflow.workflow.mode to this.config.workflow.mode
The second display location has a typo that causes nested property access which will
result in undefined, making the mode description fail to display.

Structured Issues
issues:
  - dimension: "anti_patterns"
    severity: "blocker"
    file: "src/commands/config.ts"
    description: "Typo: 'this.config.workflow.workflow.mode' should be 'this.config.workflow.mode'"
    fix_hint: "Remove the duplicate 'workflow' property reference on line 542"

Recommendation
1 blocker requires revision. Returning to builder with feedback.

▣  Fuska-Code-Reviewer · glm-4.7 · 47.2s
```

**Builder revises.** Fixes the typo on line 542: `this.config.workflow.workflow.mode` → `this.config.workflow.mode`.

**Code reviewer (iteration 2) — REVIEW PASSED:**

```
REVIEW PASSED
Task: Improve config mode display - Replace misleading percentages with actual agent pipelines
Files reviewed: 1 (src/commands/config.ts)
Status: All checks passed

Review Summary
| Dimension          | Status | Notes                                                |
|--------------------|--------|------------------------------------------------------|
| Plan Fulfillment   | PASS   | All 5 display locations updated from % to pipelines  |
| Completeness       | PASS   | No stubs detected                                    |
| Wiring             | PASS   | MODE_DESCRIPTIONS used consistently across locations |
| Anti-Patterns      | PASS   | No issues found                                      |
| Research Compliance| PASS   | N/A — no research context                            |

Detailed Verification
1. Plan Fulfillment
   ✓ MODE_DESCRIPTIONS constant with pipeline notation
   ✓ displayTreeView() — shows "Workflow: <mode> - <pipeline>"
   ✓ displayState() — pipeline description instead of percentage
   ✓ setWorkflowMode() — choices show "standard - Researcher → Planner → ..."
   ✓ displaySettingsBanner() — pipeline with proper padding

2. Completeness
   ✓ No TODO/FIXME/HACK/PLACEHOLDER comments
   ✓ All functions have complete implementations
   ✓ Note: "placeholder values" on line 224 is user-facing messaging, not a stub

3. Wiring
   ✓ MODE_DESCRIPTIONS used in 4 functions, no orphaned code

4. Anti-Patterns
   ✓ No empty catches, debug logs, hardcoded values, or unused imports

5. Edge Cases
   ✓ Fallback to mode name if not in MODE_DESCRIPTIONS
   ✓ Optional chaining used correctly (this.config.workflow?.mode)

Ready for Commit
Code review passed. Changes are ready to commit.

▣  Fuska-Code-Reviewer · glm-4.7 · 2m 9s
```

> **Note:** The code reviewer was configured to use `glm-4.7` (fast and cost-effective) while the builder used a different model. Model assignment is per-agent — configure it via `fuska config` profile stages.

### Chapter-Todo Iterative Loop

*While building a chapter, the executor discovers additional work that wasn't in the plan. Chapter-todos capture this and trigger an iterative planning loop.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`/fuska-build`</nobr> | — | Builder starts Chapter 3 (Nutritional Summary). While implementing, discovers the USDA API requires OAuth2 — this wasn't anticipated. Creates chapter-todo: `chapter-03-todo-1: "Add USDA API OAuth2 integration"`. |
| 2 | *(execution completes)* | — | Chapter 3 tasks complete, but chapter-todos exist. `/fuska-do` detects this and enters the Chapter-Todo Loop (max 3 iterations). |
| 3 | *(loop iteration 1)* | — | Planner loads chapter-todo `chapter-03-todo-1`. Creates a plan for OAuth2 integration: 4 tasks (env vars, token service, refresh middleware, tests). Checker validates. Executor builds all 4 tasks. |
| 4 | *(loop check)* | — | No new chapter-todos created. Loop exits. |
| 5 | <nobr>`/fuska-review`</nobr> | — | Reviews Chapter 3 with OAuth2 now in place. All criteria pass. |

**Manually adding a chapter-todo:**

```bash
/fuska-add-chapter-todo 3 Add rate limiting for USDA API calls
```

Creates `chapter-03-todo-2` scoped to Chapter 3. Next `/fuska-build` will pick it up in the todo loop.

**Key points:**
- Chapter-todos are scoped to a single chapter (not global)
- Executor creates them automatically when discovering unplanned work
- Planner loads them as additional requirements for the next iteration
- Loop runs until all chapter-todos are addressed (max 3 iterations to prevent infinite loops)

### Multiple Initiatives in One Codebase

*You're working on **Meal Planner** and **Recipe Import** in the same codebase, switching between them.*

Fuska prevents cross-initiative pollution by scoping all MegaMemory queries to the current initiative. When you run `/fuska-plan`, it only sees chapters from the current initiative, never accidentally mixing data from Meal Planner with Recipe Import. Commands load the initiative slug from config, filter by parent_id, and validate parent chains.

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`fuska initiative list`</nobr> | — | Lists all initiatives with current marker: `> meal-planner` (active), `  recipe-import`, `  user-profiles`. Shows status and chapter progress for each. |
| 2 | <nobr>`fuska initiative switch recipe-import`</nobr> | — | Switches to recipe-import. The pointer in config updates: `current_initiative: "recipe-import"`. |
| 3 | <nobr>`/fuska`</nobr> | — | Shows: Chapter 2 of 2 for Recipe Import, pipeline at "plan into tasks". |
| 4 | <nobr>`/fuska-plan`</nobr> | — | Plans Chapter 2 for Recipe Import: import modal UI, URL input with preview, error states, loading skeleton. 9 tasks. |
| 5 | <nobr>`/fuska-build`</nobr> | — | Builds the import UI for recipe-import. Modal with URL paste, live preview of scraped recipe, confirm/edit before saving. 9 commits. |
| 6 | <nobr>`/fuska-review`</nobr> | — | Recipe Import Chapter 2 verified. All criteria pass. |
| 7 | <nobr>`fuska initiative switch meal-planner`</nobr> | — | Switches back to Meal Planner. The pointer updates: `current_initiative: "meal-planner"`. |
| 8 | <nobr>`/fuska`</nobr> | — | Shows: 3/4 chapters complete for Meal Planner. Chapter 4 pipeline at "plan into tasks". |
| 9 | <nobr>`/fuska-plan`</nobr> | — | Plans Chapter 4 (Polish & Edge Cases): empty states, error boundaries, loading skeletons, keyboard navigation. 7 tasks. |
| 10 | <nobr>`/fuska-build`</nobr> | — | Builds polish chapter for meal-planner. 7 commits. Project continues independently from recipe-import. |

### Milestones and Releases

*Meal Planner v1.0 shipped. Now you're starting v1.1 with two new features: meal sharing and dietary presets.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`/fuska-complete`</nobr> | *Selects project: meal-planner* | Marks "Meal Planner v1.0" as complete. Summary: 4 chapters completed, 45 tasks executed, 45 atomic commits. |
| 2 | <nobr>`/fuska-new-milestone Meal Planner v1.1`</nobr> | *"Two features: (1) share weekly meal plans with other users, (2) dietary preset filters (vegetarian, keto, gluten-free) that restrict recipe suggestions."* | Creates milestone "Meal Planner v1.1" with 3 chapters: (1) Sharing Backend & Permissions, (2) Dietary Presets & Filtering, (3) Integration & Polish. |
| 3 | <nobr>`/fuska-plan`</nobr> | — | Plans the sharing chapter: permission model, share-link generation, recipient view, Prisma relations for shared plans. 12 tasks. |
| 4 | <nobr>`/fuska-build`</nobr> | — | Builds sharing backend. 12 commits. |
| 5 | <nobr>`/fuska-audit`</nobr> | — | Audit shows: Chapter 1 complete, Chapters 2-3 pending. Estimates ~20 tasks remaining. No blockers detected. |
| 6 | <nobr>`/fuska-complete`</nobr> | — | *(After completing all chapters)* Marks "Meal Planner v1.1" complete. Summary: 3 chapters, 28 tasks, 28 commits. Both milestones visible in project history. |

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
| 1 | <nobr>`fuska git worktree merge feature-sharing` then `fuska git worktree merge feature-dietary`</nobr> | — | Verifies all three databases exist. Creates backup: `knowledge.db.backup-20250211-143022`. Starts merge session. |
| 2 | *(merge 1/2: feature-sharing)* | — | Runs `megamemory merge` with main + feature-sharing. 48 clean merges, 2 conflicts detected. |
| 3 | *(conflict: chapter-01 context)* | *Selects "AI verify"* | AI reads referenced files. `src/lib/sharing/permissions.ts` exists, `src/lib/auth/sharing-middleware.ts` was renamed to `src/middleware/sharing.ts`. Resolves with updated file refs. |
| 4 | *(conflict: req-SOCIAL-01)* | *Selects "Keep right"* | Keeps the feature-sharing version of the social requirement (more detailed after implementation). |
| 5 | *(merge 2/2: feature-dietary)* | — | Merges feature-dietary into the already-merged database. 39 clean merges, 0 conflicts. |
| 6 | *(post-merge validation)* | — | Final conflict check: 0 remaining. Database readable. Displays summary: 2 branches merged, 2 conflicts detected, 2 resolved. Backup preserved. |

### Revisiting Old Initiatives

*Recipe Import shipped months ago. You want to pick it back up for a v2.0.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | <nobr>`fuska initiative list`</nobr> | — | Shows all initiatives sorted by last activity: `> meal-planner (current)  2 hours ago`, `  user-profiles  3 days ago`, `  recipe-import  2 months ago`. Least-active initiatives naturally sink to the bottom. |
| 2 | <nobr>`fuska initiative switch recipe-import`</nobr> | — | Switches to recipe-import. The pointer updates. |
| 3 | <nobr>`/fuska-new-milestone Recipe Import v2.0`</nobr> | — | Continues work on recipe-import with new milestone for v2.0 features. |
| 4 | <nobr>`fuska initiative list`</nobr> | — | recipe-import is now at the top (most recent activity), with `(current)` marker. |

**Key points:**
- No archiving needed — inactive initiatives naturally sort to the bottom by last activity
- All knowledge (chapters, summaries, decisions) is always preserved
- Switch to any initiative at any time

### Formalizing a Conversation into a Chapter

*You've been chatting with the AI about whether RecipeVault should support meal prep timers — how long each step takes, when to start the next dish so everything's ready at the same time. Partway through, you realize this is a real feature.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | *(conversation)* | *"What if we added prep timers? Like, you're making lasagna and it tells you when to start the salad so both are ready at 6pm."* | You're just chatting — brainstorming the idea, discussing edge cases (parallel steps, variable prep times, oven preheat). No Fuska commands yet. |
| 2 | *(conversation)* | *"Actually, create a chapter of this."* | Fuska formalizes the conversation into a new chapter: "Meal Prep Timers." Derives requirements from your discussion (parallel step scheduling, countdown timers, "everything ready at X" target time). Creates the chapter in MegaMemory with goal and success criteria. |
| 3 | <nobr>`/fuska-plan`</nobr> | — | Plans the chapter: 8 tasks across 2 batches — timer data model, scheduling algorithm, countdown UI, notification system. The planner has the full conversation context as requirements. |
| 4 | <nobr>`/fuska-build`</nobr> | — | Builds the timers. The conversation context means the builder knows about edge cases you discussed (parallel steps, preheat time) without them needing to be formally written as requirements. |

---

## See Also

- [configuration.md](configuration.md) — Workflow mode settings and model profiles
- [commands.md](commands.md) — Full command reference
- [concepts.md](concepts.md) — Mental model behind these workflows
- [fuska-do-session-distilled.md](fuska-do-session-distilled.md) — Full annotated walkthrough of a `/fuska-do checked` session showing the plan-checker and code-reviewer in action
- [tutorial.md](tutorial.md) — Hands-on tutorial covering the full chapter lifecycle with real session output
