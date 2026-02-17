# Workflow Examples

> Fuska in practice — end-to-end scenarios.

**Audience:** New users, anyone wanting to see complete workflows
**Prerequisites:** [Key Concepts](concepts.md)

---

All examples use **RecipeVault** — an imaginary Next.js recipe-sharing app with users, recipes, search, and a Prisma/PostgreSQL backend.

## Scenarios

| # | Scenario | Demonstrates |
|---|----------|-------------|
| 1 | [Building a Feature from Scratch](#scenario-1-building-a-feature-from-scratch) | Full workflow: map -> init -> configure -> plan -> execute -> verify |
| 2 | [Pausing and Resuming Across Sessions](#scenario-2-pausing-and-resuming-across-sessions) | Session continuity, /fuska pause, /fuska resume |
| 3 | [Discovering Unplanned Work](#scenario-3-discovering-unplanned-work) | Adding/inserting phases mid-project |
| 4 | [Verification Failure and Recovery](#scenario-4-verification-failure-and-recovery) | Verifier catches gaps, re-execute with feedback |
| 5 | [Quick Fix for a Production Bug](#scenario-5-quick-fix-for-a-production-bug) | /fuska do planned for one-off tasks |
| 6 | [Multiple Projects in One Codebase](#scenario-6-multiple-projects-in-one-codebase) | Initiative switching |
| 7 | [Milestones and Releases](#scenario-7-milestones-and-releases) | Milestone lifecycle |
| 8 | [Merging Knowledge from Git Worktrees](#scenario-8-merging-knowledge-from-git-worktrees) | Worktree merge with conflict resolution |
| 9 | [Archiving and Reactivating Initiatives](#scenario-9-archiving-and-reactivating-initiatives) | Initiative lifecycle |

---

## Scenario 1: Building a Feature from Scratch

*You want to add a **Meal Planner** — weekly calendar, shopping lists, nutritional summaries. This is a big feature, so you use the full workflow.*

First, map the codebase so Fuska understands your architecture, then create the project:

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska map` | — | Scans `recipevault/`. Discovers Next.js 14 app router, Prisma schema with `User`, `Recipe`, `Ingredient` models, TailwindCSS, and a `/api` directory with REST endpoints. Creates codebase map in MegaMemory. |
| 2 | `fuska init "Meal Planner"` then `/fuska configure` | *"Users can plan weekly meals, generate shopping lists from selected recipes, and see nutritional summaries per day."* | Asks clarifying questions about scope. You answer interactively. Creates project **meal-planner** with milestone "Meal Planner v1.0" and 4 phases: (1) Calendar UI & Data Model, (2) Shopping List Generation, (3) Nutritional Summary, (4) Polish & Edge Cases. |
| 3 | `/fuska` | — | Shows phase pipeline: Phase 1 of 4, current position at "plan into tasks". You see what to do next. |
| 4 | `/fuska discuss` | *"Calendar should be a weekly grid, Monday–Sunday. Users drag recipes from a sidebar into day slots. Mobile: vertical stack instead of grid."* | Identifies 6 open questions (drag-and-drop library? max recipes per slot? recurring meals?). You answer each. Saves decisions as phase-1 context. |
| 5 | `/fuska plan --research` | — | Researcher agent investigates `@dnd-kit` vs `react-beautiful-dnd`, checks Prisma relation patterns for calendar events. Planner creates 14 tasks across 3 waves: DB migration → API routes → UI components. Plan-checker validates task dependencies. |
| 6 | `/fuska execute` | — | Executor starts Wave 1: creates `MealSlot` model in Prisma, runs migration, adds API routes. Wave 2: builds `<WeekGrid>`, `<DayColumn>`, `<RecipeDragCard>` components. Wave 3: wires drag-and-drop, adds optimistic updates. 14 atomic commits total. |
| 7 | `/fuska verify` | — | Verifier checks success criteria: "Users can drag recipes onto a weekly calendar" → **PASS**. "Calendar persists across page reloads" → **PASS**. "Mobile layout stacks vertically" → **PASS**. Phase 1 marked complete. |
| 8 | `/fuska` | — | Shows: 1/4 phases complete. Phase 2 pipeline at "plan into tasks". |
| 9 | `/fuska plan` | — | Plans the Shopping List phase. 11 tasks across 2 waves: ingredient aggregation logic → shopping list UI with grouping by aisle. |
| 10 | `/fuska execute` | — | Builds shopping list. Aggregates ingredients across selected meals, deduplicates, groups by category. Adds print-friendly view. |

---

## Scenario 2: Pausing and Resuming Across Sessions

*You're midway through executing Phase 2 (Shopping List) when you need to stop for the day.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska execute` | — | Executor starts. Completes Wave 1 (ingredient aggregation logic, 5 tasks). Begins Wave 2 (shopping list UI)… |
| 2 | `/fuska pause` | *"Was about to refactor the grouping logic to use a Map instead of object for O(1) lookups"* | Captures mental context. Task position already tracked in state (Task 3 of 6). Saves handoff with context. |

*Next morning, new session:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 3 | `/fuska` | — | Shows: "Fuska: Meal Planner — paused. You left off at Phase 2: Shopping List Generation." Points to `/fuska resume`. |
| 4 | `/fuska resume` | — | Shows: "Phase 2 — Shopping List Generation. Task 3 of 6." Displays your context: "Was about to refactor grouping logic to use Map." Continues from task 3. |
| 5 | `/fuska todo` | *"Look into Instacart API for direct-to-cart shopping list export"* | Creates todo tagged `integration`: "Investigate Instacart API for shopping list export." Doesn't interrupt current work. |
| 6 | *(execution completes)* | — | Remaining 3 tasks complete. 4 more atomic commits. Phase 2 execution finished. |
| 7 | `/fuska verify` | — | "Shopping list aggregates ingredients from weekly plan" → **PASS**. "Items grouped by aisle" → **PASS**. "Print view renders cleanly" → **PASS**. Phase 2 complete. |

---

## Scenario 3: Discovering Unplanned Work

*While building Phase 3 (Nutritional Summary), you realize the USDA FoodData API needs OAuth2 — something nobody planned for.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska execute` | — | Executor starts Wave 1. While implementing the nutrition data fetcher, flags a deviation: "USDA FoodData Central API requires API key registration and OAuth2 token flow. This was not in the plan." |
| 2 | `/fuska add "USDA API OAuth2 integration"` | — | Creates Phase 5: "USDA API OAuth2 Integration" with auto-generated requirements: token management, refresh flow, secure key storage. Added after Phase 4 in the roadmap. |
| 3 | `/fuska insert 3 "USDA API OAuth2 integration"` | — | Inserts the OAuth2 phase *before* Phase 3 (now renumbered to Phase 4) so the auth is ready before the nutritional summary needs it. Existing phases renumber automatically. |
| 4 | `/fuska plan` | — | Plans the new OAuth2 phase: 6 tasks — environment variable setup, token fetcher service, refresh middleware, Prisma model for token storage, integration tests. |
| 5 | `/fuska execute` | — | Builds the OAuth2 integration. 6 atomic commits. Token refresh tested against USDA sandbox. Now Phase 4 (Nutritional Summary) can proceed with auth in place. |

---

## Scenario 4: Verification Failure and Recovery

*You built a **Recipe Import** feature (paste a URL, scrape the recipe). Verification catches a gap.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska init "Recipe Import"` then `/fuska configure` | *"Users paste a recipe URL, the app scrapes the title, ingredients, and steps, and creates a new Recipe."* | Creates project **recipe-import** with milestone "Recipe Import v1.0" and 2 phases: (1) URL Scraper & Parser, (2) Import UI & Error Handling. |
| 2 | `/fuska plan` | — | Plans 8 tasks: URL validator, HTML fetcher, Cheerio-based parser for common recipe sites, ingredient normalizer, step extractor, Prisma integration, tests. |
| 3 | `/fuska execute` | — | Builds the scraper. Handles AllRecipes, Epicurious, and Food Network formats. 8 atomic commits. |
| 4 | `/fuska verify` | — | "Scraper extracts title from AllRecipes" → **PASS**. "Scraper extracts ingredients" → **PASS**. "Scraper handles JSON-LD structured data" → **FAIL** — the scraper only parses HTML microdata, but many sites embed recipes as JSON-LD `<script>` tags. |
| 5 | `/fuska execute` | — | Re-executes with verification feedback. Adds JSON-LD parser that extracts `Recipe` schema from `<script type="application/ld+json">` tags. Falls back to HTML scraping when JSON-LD is absent. 2 additional commits. |
| 6 | `/fuska verify` | — | Re-verifies. "JSON-LD structured data" → **PASS**. "Fallback to HTML scraping" → **PASS**. All criteria met. Phase 1 complete. |

---

## Scenario 5: Quick Fix for a Production Bug

*A week after shipping Recipe Import, users report the scraper crashes on URLs with query parameters.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska do planned "The recipe scraper crashes when the URL contains query parameters like ?ref=share. The URL validator rejects anything after ?. Need to strip or preserve query params before validation."` | — | Spawns planner + executor directly. Plans 2 tasks: fix URL validator regex to allow query strings, add test cases for URLs with `?`, `#`, and `&`. Executes immediately. 1 atomic commit. Task logged separately from the roadmap. |
| 2 | `/fuska todos` | — | Shows 1 open todo: "Investigate Instacart API for shopping list export" (from Scenario 2). No new todos from the fix. |

---

## Scenario 6: Multiple Projects in One Codebase

*You're working on **Meal Planner** and **Recipe Import** in the same codebase, switching between them.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska initiatives` | — | Lists all initiatives with current marker: `▶ meal-planner` (active), `  recipe-import`, `  user-profiles`. Shows status and phase progress for each. |
| 2 | `fuska initiative-switch recipe-import` | — | Switches to recipe-import. The pointer in config updates: `current_initiative: "recipe-import"`. |
| 3 | `/fuska` | — | Shows: Phase 2 of 2 for Recipe Import, pipeline at "plan into tasks". |
| 4 | `/fuska plan` | — | Plans Phase 2 for Recipe Import: import modal UI, URL input with preview, error states, loading skeleton. 9 tasks. |
| 5 | `/fuska execute` | — | Builds the import UI for recipe-import. Modal with URL paste, live preview of scraped recipe, confirm/edit before saving. 9 commits. |
| 6 | `/fuska verify` | — | Recipe Import Phase 2 verified. All criteria pass. |
| 7 | `fuska initiative-switch meal-planner` | — | Switches back to Meal Planner. The pointer updates: `current_initiative: "meal-planner"`. |
| 8 | `/fuska` | — | Shows: 3/4 phases complete for Meal Planner. Phase 4 pipeline at "plan into tasks". |
| 9 | `/fuska plan` | — | Plans Phase 4 (Polish & Edge Cases): empty states, error boundaries, loading skeletons, keyboard navigation. 7 tasks. |
| 10 | `/fuska execute` | — | Builds polish phase for meal-planner. 7 commits. Project continues independently from recipe-import. |

---

## Scenario 7: Milestones and Releases

*Meal Planner v1.0 shipped. Now you're starting v1.1 with two new features: meal sharing and dietary presets.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska complete` | *Selects project: meal-planner* | Marks "Meal Planner v1.0" as complete. Summary: 4 phases completed, 45 tasks executed, 45 atomic commits. |
| 2 | `/fuska milestone "Meal Planner v1.1"` | *"Two features: (1) share weekly meal plans with other users, (2) dietary preset filters (vegetarian, keto, gluten-free) that restrict recipe suggestions."* | Creates milestone "Meal Planner v1.1" with 3 phases: (1) Sharing Backend & Permissions, (2) Dietary Presets & Filtering, (3) Integration & Polish. |
| 3 | `/fuska plan` | — | Plans the sharing phase: permission model, share-link generation, recipient view, Prisma relations for shared plans. 12 tasks. |
| 4 | `/fuska execute` | — | Builds sharing backend. 12 commits. |
| 5 | `/fuska audit` | — | Audit shows: Phase 1 complete, Phases 2–3 pending. Estimates ~20 tasks remaining. No blockers detected. |
| 6 | `/fuska complete` | — | *(After completing all phases)* Marks "Meal Planner v1.1" complete. Summary: 3 phases, 28 tasks, 28 commits. Both milestones visible in project history. |

---

## Scenario 8: Merging Knowledge from Git Worktrees

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
| 1 | `/fuska-merge-worktrees feature-sharing feature-dietary` | — | Verifies all three databases exist. Creates backup: `knowledge.db.backup-20250211-143022`. Starts merge session. |
| 2 | *(merge 1/2: feature-sharing)* | — | Runs `megamemory merge` with main + feature-sharing. 48 clean merges, 2 conflicts detected. |
| 3 | *(conflict: phase-01 context)* | *Selects "AI verify"* | AI reads referenced files. `src/lib/sharing/permissions.ts` exists, `src/lib/auth/sharing-middleware.ts` was renamed to `src/middleware/sharing.ts`. Resolves with updated file refs. |
| 4 | *(conflict: req-SOCIAL-01)* | *Selects "Keep right"* | Keeps the feature-sharing version of the social requirement (more detailed after implementation). |
| 5 | *(merge 2/2: feature-dietary)* | — | Merges feature-dietary into the already-merged database. 39 clean merges, 0 conflicts. |
| 6 | *(post-merge validation)* | — | Final conflict check: 0 remaining. Database readable. Displays summary: 2 branches merged, 2 conflicts detected, 2 resolved. Backup preserved. |

---

## Scenario 9: Archiving and Reactivating Initiatives

*Recipe Import shipped and is stable. You want to archive it to clean up your initiative list, then later reactivate it for a v2.0.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `fuska initiatives` | — | Shows all initiatives: `▶ meal-planner` (active, Phase 4/4), `  recipe-import` (Phase 2/2 complete), `  user-profiles` (Phase 1/3). |
| 2 | `fuska initiative-switch recipe-import` | — | Switches to recipe-import. |
| 3 | `fuska initiative-archive` | — | Archives recipe-import. Sets `archived_at: 2026-02-15T10:30:00Z` on the initiative concept. Initiative no longer appears in `fuska projects` output but remains in database. |
| 4 | `fuska initiatives` | — | Now shows: `▶ meal-planner` (active), `  user-profiles` (Phase 1/3). Recipe-import is hidden from active list. |
| 5 | `fuska initiatives --all` | — | Shows all including archived: `▶ meal-planner`, `  user-profiles`, `  recipe-import [archived]`. |
| 6 | `fuska initiative-switch recipe-import` | — | Reactivates recipe-import by clearing `archived_at`. Initiative is now active again. |
| 7 | `/fuska milestone "Recipe Import v2.0"` | — | Continues work on recipe-import with new milestone for v2.0 features. |

**Key points:**
- Archived initiatives keep their stable slug names — no renaming needed
- All knowledge (phases, summaries, decisions) is preserved
- Reactivate anytime by switching to the archived initiative

---

## See Also

- [configuration.md](configuration.md) — Workflow mode settings and model profiles
- [commands.md](commands.md) — Full command reference
- [concepts.md](concepts.md) — Mental model behind these workflows
