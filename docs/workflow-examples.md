# Workflow Examples

> **Back to:** [README.md](../README.md)

The following scenarios show what Fuska looks like in practice. All examples use **RecipeVault** — an imaginary Next.js recipe-sharing app with users, recipes, search, and a Prisma/PostgreSQL backend.

---

## Scenario 1: Building a Feature from Scratch

*You want to add a **Meal Planner** — weekly calendar, shopping lists, nutritional summaries. This is a big feature, so you use the full workflow.*

First, map the codebase so Fuska understands your architecture, then create the project:

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-map-codebase` | — | Scans `recipevault/`. Discovers Next.js 14 app router, Prisma schema with `User`, `Recipe`, `Ingredient` models, TailwindCSS, and a `/api` directory with REST endpoints. Creates codebase map in MegaMemory. |
| 2 | `/fuska-new-project "Meal Planner"` | *"Users can plan weekly meals, generate shopping lists from selected recipes, and see nutritional summaries per day."* | Asks clarifying questions about scope. You answer interactively. Creates project **meal-planner** with milestone "Meal Planner v1.0" and 4 phases: (1) Calendar UI & Data Model, (2) Shopping List Generation, (3) Nutritional Summary, (4) Polish & Edge Cases. |
| 3 | `/fuska-discuss-phase 1` | *"Calendar should be a weekly grid, Monday–Sunday. Users drag recipes from a sidebar into day slots. Mobile: vertical stack instead of grid."* | Identifies 6 open questions (drag-and-drop library? max recipes per slot? recurring meals?). You answer each. Saves decisions as phase-1 context. |
| 4 | `/fuska-plan-phase 1 --research` | — | Researcher agent investigates `@dnd-kit` vs `react-beautiful-dnd`, checks Prisma relation patterns for calendar events. Planner creates 14 tasks across 3 waves: DB migration → API routes → UI components. Plan-checker validates task dependencies. |
| 5 | `/fuska-execute-phase 1` | — | Executor starts Wave 1: creates `MealSlot` model in Prisma, runs migration, adds API routes. Wave 2: builds `<WeekGrid>`, `<DayColumn>`, `<RecipeDragCard>` components. Wave 3: wires drag-and-drop, adds optimistic updates. 14 atomic commits total. |
| 6 | `/fuska-verify-work 1` | — | Verifier checks success criteria: "Users can drag recipes onto a weekly calendar" → **PASS**. "Calendar persists across page reloads" → **PASS**. "Mobile layout stacks vertically" → **PASS**. Phase 1 marked complete. |
| 7 | `/fuska-plan-phase 2` | — | Plans the Shopping List phase. 11 tasks across 2 waves: ingredient aggregation logic → shopping list UI with grouping by aisle. |
| 8 | `/fuska-execute-phase 2` | — | Builds shopping list. Aggregates ingredients across selected meals, deduplicates, groups by category. Adds print-friendly view. |

---

## Scenario 2: Pausing and Resuming Across Sessions

*You're midway through executing Phase 2 (Shopping List) when you need to stop for the day.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-execute-phase 2` | — | Executor starts. Completes Wave 1 (ingredient aggregation logic, 5 tasks). Begins Wave 2 (shopping list UI)… |
| 2 | `/fuska-pause-work` | *"Was about to refactor the grouping logic to use a Map instead of object for O(1) lookups"* | Captures mental context. Task position already tracked in state (Task 3 of 6). Saves handoff with context. |

*Next morning, new session:*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 3 | `/fuska-resume-work` | — | Shows: "Phase 2 — Shopping List Generation. Task 3 of 6." Displays your context: "Was about to refactor grouping logic to use Map." Continues from task 3. |
| 4 | `/fuska-add-todo` | *"Look into Instacart API for direct-to-cart shopping list export"* | Creates todo tagged `integration`: "Investigate Instacart API for shopping list export." Doesn't interrupt current work. |
| 5 | *(execution completes)* | — | Remaining 3 tasks complete. 4 more atomic commits. Phase 2 execution finished. |
| 6 | `/fuska-verify-work 2` | — | "Shopping list aggregates ingredients from weekly plan" → **PASS**. "Items grouped by aisle" → **PASS**. "Print view renders cleanly" → **PASS**. Phase 2 complete. |

---

## Scenario 3: Discovering Unplanned Work

*While building Phase 3 (Nutritional Summary), you realize the USDA FoodData API needs OAuth2 — something nobody planned for.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-execute-phase 3` | — | Executor starts Wave 1. While implementing the nutrition data fetcher, flags a deviation: "USDA FoodData Central API requires API key registration and OAuth2 token flow. This was not in the plan." |
| 2 | `/fuska-add-phase "USDA API OAuth2 integration"` | — | Creates Phase 5: "USDA API OAuth2 Integration" with auto-generated requirements: token management, refresh flow, secure key storage. Added after Phase 4 in the roadmap. |
| 3 | `/fuska-insert-phase 3 "USDA API OAuth2 integration"` | — | Inserts the OAuth2 phase *before* Phase 3 (now renumbered to Phase 4) so the auth is ready before the nutritional summary needs it. Existing phases renumber automatically. |
| 4 | `/fuska-plan-phase 3` | — | Plans the new OAuth2 phase: 6 tasks — environment variable setup, token fetcher service, refresh middleware, Prisma model for token storage, integration tests. |
| 5 | `/fuska-execute-phase 3` | — | Builds the OAuth2 integration. 6 atomic commits. Token refresh tested against USDA sandbox. Now Phase 4 (Nutritional Summary) can proceed with auth in place. |

---

## Scenario 4: Verification Failure and Recovery

*You built a **Recipe Import** feature (paste a URL, scrape the recipe). Verification catches a gap.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-new-project "Recipe Import"` | *"Users paste a recipe URL, the app scrapes the title, ingredients, and steps, and creates a new Recipe."* | Creates project **recipe-import** with milestone "Recipe Import v1.0" and 2 phases: (1) URL Scraper & Parser, (2) Import UI & Error Handling. |
| 2 | `/fuska-plan-phase 1` | — | Plans 8 tasks: URL validator, HTML fetcher, Cheerio-based parser for common recipe sites, ingredient normalizer, step extractor, Prisma integration, tests. |
| 3 | `/fuska-execute-phase 1` | — | Builds the scraper. Handles AllRecipes, Epicurious, and Food Network formats. 8 atomic commits. |
| 4 | `/fuska-verify-work 1` | — | "Scraper extracts title from AllRecipes" → **PASS**. "Scraper extracts ingredients" → **PASS**. "Scraper handles JSON-LD structured data" → **FAIL** — the scraper only parses HTML microdata, but many sites embed recipes as JSON-LD `<script>` tags. |
| 5 | `/fuska-execute-phase 1` | — | Re-executes with verification feedback. Adds JSON-LD parser that extracts `Recipe` schema from `<script type="application/ld+json">` tags. Falls back to HTML scraping when JSON-LD is absent. 2 additional commits. |
| 6 | `/fuska-verify-work 1` | — | Re-verifies. "JSON-LD structured data" → **PASS**. "Fallback to HTML scraping" → **PASS**. All criteria met. Phase 1 complete. |

---

## Scenario 5: Quick Fix for a Production Bug

*A week after shipping Recipe Import, users report the scraper crashes on URLs with query parameters.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-do quick "The recipe scraper crashes when the URL contains query parameters like ?ref=share. The URL validator rejects anything after ?. Need to strip or preserve query params before validation."` | — | Spawns planner + executor directly. Plans 2 tasks: fix URL validator regex to allow query strings, add test cases for URLs with `?`, `#`, and `&`. Executes immediately. 1 atomic commit. Quick task logged separately from the roadmap. |
| 2 | `/fuska-check-todos` | — | Shows 1 open todo: "Investigate Instacart API for shopping list export" (from Scenario 2). No new todos from the quick fix. |

---

## Scenario 6: Multiple Projects in One Codebase

*You're working on **Meal Planner** and **Recipe Import** in the same codebase, switching between them.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-progress` | — | Shows both projects: **meal-planner** — Phase 2 of 4 complete (Shopping List done, Nutritional Summary next). **recipe-import** — Phase 1 of 2 complete (Scraper done, Import UI next). |
| 2 | `/fuska-plan-phase 2` | *Selects project: recipe-import* | Plans Phase 2 for Recipe Import: import modal UI, URL input with preview, error states, loading skeleton. 9 tasks. |
| 3 | `/fuska-execute-phase 2` | — | Builds the import UI for recipe-import. Modal with URL paste, live preview of scraped recipe, confirm/edit before saving. 9 commits. |
| 4 | `/fuska-verify-work 2` | — | Recipe Import Phase 2 verified. All criteria pass. |
| 5 | `/fuska-plan-phase 4` | *Selects project: meal-planner* | Switches to Meal Planner. Plans Phase 4 (Polish & Edge Cases): empty states, error boundaries, loading skeletons, keyboard navigation. 7 tasks. |
| 6 | `/fuska-execute-phase 4` | — | Builds polish phase for meal-planner. 7 commits. Project continues independently from recipe-import. |

---

## Scenario 7: Milestones and Releases

*Meal Planner v1.0 shipped. Now you're starting v1.1 with two new features: meal sharing and dietary presets.*

| # | Command | You Say | What Happens |
|---|---------|---------|--------------|
| 1 | `/fuska-complete-milestone` | *Selects project: meal-planner* | Marks "Meal Planner v1.0" as complete. Summary: 4 phases completed, 45 tasks executed, 45 atomic commits. |
| 2 | `/fuska-new-milestone "Meal Planner v1.1"` | *"Two features: (1) share weekly meal plans with other users, (2) dietary preset filters (vegetarian, keto, gluten-free) that restrict recipe suggestions."* | Creates milestone "Meal Planner v1.1" with 3 phases: (1) Sharing Backend & Permissions, (2) Dietary Presets & Filtering, (3) Integration & Polish. |
| 3 | `/fuska-plan-phase 1` | — | Plans the sharing phase: permission model, share-link generation, recipient view, Prisma relations for shared plans. 12 tasks. |
| 4 | `/fuska-execute-phase 1` | — | Builds sharing backend. 12 commits. |
| 5 | `/fuska-audit-milestone` | — | Audit shows: Phase 1 complete, Phases 2–3 pending. Estimates ~20 tasks remaining. No blockers detected. |
| 6 | `/fuska-complete-milestone` | — | *(After completing all phases)* Marks "Meal Planner v1.1" complete. Summary: 3 phases, 28 tasks, 28 commits. Both milestones visible in project history. |

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
