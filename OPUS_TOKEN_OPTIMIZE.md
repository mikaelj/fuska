# Fuska Prompt Token Reduction Plan

## Context

Fuska's 7 core orchestration files total 8,307 lines. Many contain verbose examples, repeated patterns (e.g., identical `<megamemory_guide>` blocks in 3 command files), and inline logic that could be extracted to shared includes. This plan reduces total line count by ~31% through condensation and extraction, improving both token efficiency and maintainability.

---

## Phase 1: fuska-plan.md Thin Orchestrator (1,446 → ~450 lines)

**File:** `provider/opinkode/command/fuska/fuska-plan.md`

### 1.1 Create `provider/opinkode/fuska/config/` directory

New directory (does not exist yet).

### 1.2 Create `provider/opinkode/fuska/references/megamemory-quick-ref.md` (25 lines)

Replaces the identical `<megamemory_guide>` block found in fuska-plan.md (lines 41-60), fuska-do.md (lines 42-61), and fuska-build.md (lines 36-55).

```markdown
## MegaMemory Quick Reference

Supplementary quick reference. Full API: `megamemory-integration.md`.

All project data lives in MegaMemory. Empty results = concept doesn't exist.

### Tool Responses

**megamemory:understand** returns `{concepts: [{id, name, kind, summary, children, edges, incoming_edges}]}`
- Parse `summary` with `JSON.parse()` to extract data
- Use `top_k` to limit results (default: 10)

**megamemory:create_concept** returns `{id, message}`

**megamemory:update_concept** accepts `{summary?, name?, kind?, why?, file_refs?}` only
- Pass full JSON string as `summary`
- Cannot update `parent_id` or `edges` — use `megamemory:link`

**megamemory:list_roots** returns root concepts (no parent_id)

**megamemory:link** creates relationship between existing concepts

### Error Handling

- `MEGAMEMORY_ERROR:` → MCP server issue. Stop and inform user.
- Empty `concepts` array → Concept doesn't exist. Handle gracefully.
```

### 1.3 Create `provider/opinkode/fuska/config/workflow-modes.md` (30 lines)

Extracts mode resolution logic from fuska-plan.md lines 386-402. Note: fuska-do.md uses a different mode system (planned/checked/researched/verified) and should NOT reference this file.

```markdown
## Workflow Mode Configuration

Defines behavior flags for each workflow mode.

### Mode Flags

| Mode | Research | Plan Check |
|------|----------|------------|
| direct | false | false |
| quick | false | false |
| fast | false | true |
| balanced | true | false |
| thorough | true | true |
| standard | true | true |

### Resolution Logic

```
mode = modeOverride || configData.workflow?.mode || "standard"

modeConfig = {
  direct: { research: false, planCheck: false },
  quick: { research: false, planCheck: false },
  fast: { research: false, planCheck: true },
  balanced: { research: true, planCheck: false },
  thorough: { research: true, planCheck: true },
  standard: { research: true, planCheck: true }
}[mode]

// Flags augment (never reduce) mode defaults
shouldResearch = modeConfig.research || hasResearchFlag
shouldPlanCheck = modeConfig.planCheck && !hasSkipVerifyFlag
```

### Checker Panel Defaults

```
checkerPanel: { base: 'quality-advocate', contextual: null, expert: 'dynamic' }
projectClassification: { type: 'generic', confidence: 'low', signals: [] }
```
```

### 1.4 Create `provider/opinkode/fuska/templates/plan-prompts.md` (115 lines)

Extracts the planner prompt (fuska-plan.md lines 733-812), revision prompt (lines 994-1023), and checker prompt (lines 919-956) into reusable templates. Content is the full prompt templates with `{placeholder}` syntax, as specified in POC_VALID.md lines 216-373. Include all three templates: Planner Prompt Template, Revision Prompt Template, and Checker Panel Prompt Template.

### 1.5 Create `provider/opinkode/fuska/templates/review-loop.md` (120 lines)

Extracts the interactive review loop from fuska-plan.md lines 1051-1332. Content includes: review options array, plan display format, query plans for display logic, review loop logic (while loop with action handling), plan selection UI, task selection UI, revision prompt snippets (modify/add/remove task), and re-display after changes pattern. As specified in POC_VALID.md lines 375-580.

### 1.6 Refactor fuska-plan.md

Replace inline content with `@` includes. The refactored file keeps:
- Frontmatter (lines 1-17, unchanged)
- `<objective>` (lines 19-29, unchanged)
- `<execution_context>` block — ADD new includes:
  ```
  @../../fuska/references/megamemory-quick-ref.md
  @../../fuska/config/workflow-modes.md
  @../../fuska/templates/plan-prompts.md
  @../../fuska/templates/review-loop.md
  ```
- DELETE `<megamemory_guide>` block (lines 41-60)
- `<context>` (lines 62-74) — add `--no-review` flag documentation
- `<process>` — compress all steps to ~300 lines by:
  - Step 1: Remove verbose code blocks for config parsing (lines 86-253 → ~50 lines). Keep step descriptions with essential code patterns, reference model-validation.md.
  - Step 2: Keep argument parsing, slightly compress (lines 258-337 → ~40 lines)
  - Step 3: Keep chapter validation (lines 340-367 → ~20 lines)
  - Step 4: Compress research handling (lines 370-528 → ~50 lines). Remove verbose prompt building (now in plan-prompts.md).
  - Step 5: Keep existing plan check (lines 530-562 → ~20 lines)
  - Step 6: Compress context loading (lines 565-717 → ~15 lines). Remove verbose code — just list: "Query state, roadmap, requirements, context, research, verification (if --fixes), import graph in sequence. Cache all results."
  - Step 7: Reference plan-prompts.md template (lines 719-822 → ~20 lines)
  - Step 8: Keep planner return handling (lines 824-840 → ~15 lines). Fix routing: PLANNING COMPLETE → if skip-verify: Step 14, else: Step 9.
  - Step 9: Keep plan query (lines 842-901 → ~15 lines)
  - Step 10: Reference plan-prompts.md checker template (lines 903-968 → ~15 lines)
  - Step 11: Keep checker return handling (lines 970-980 → ~10 lines)
  - Step 12: Compress revision loop (lines 982-1049 → ~45 lines). Reference plan-prompts.md revision template.
  - Step 13: Reference review-loop.md (lines 1051-1332 → ~40 lines). Keep skip check, delegate to review-loop.md for display and interaction.
  - Steps 14-15: Keep state update and final status (lines 1334-1387 → ~35 lines)
- `<offer_next>` (lines 1389-1425, unchanged)
- `<success_criteria>` (lines 1427-1446, unchanged)

**Target:** ~450 lines in fuska-plan.md body. Net savings with includes (~290 new lines): ~706 lines.

---

## Phase 2: Agent Prompt Condensation (4 files, ~995 lines saved)

Inline condensation only. Agent files do NOT use `@` includes — we do not introduce that pattern. Each file is independently committable.

### 2.1 fuska-executor.md (979 → ~780 lines, ~199 saved)

**File:** `provider/opinkode/agents/fuska/fuska-executor.md`

**A. Deviation rules (lines 232-376, 144 lines → ~55 lines)**

Current structure: Each rule has separate Trigger, Action, Examples (bulleted list), Process (numbered steps), and Permission statement. Rules 1-3 share identical Process and Permission.

Condensation:
- Compress each rule's Examples from bulleted list to single comma-separated line
- Remove per-rule "Action:" lines (redundant with rule name)
- Remove per-rule "Process:" sections for Rules 1-3. Add ONE shared process block after Rule 3: "Shared process for Rules 1-3: Fix inline → add/update tests if applicable → verify fix → continue task → track as `[Rule N - Type] description` → Update MegaMemory. No user permission needed."
- Keep Rule 4 distinct (different process: STOP and checkpoint)
- Keep edge case guidance and rule priority (lines 358-376) but compress to ~10 lines

**B. Authentication gates (lines 378-440, 62 lines → ~25 lines)**

Current structure: Explanation + error indicators (bulleted) + protocol (numbered) + 37-line example checkpoint block.

Condensation:
- Opening line: "Auth errors during `type=\"auto\"` execution are gates, not failures."
- Compress indicators to single line: `"Not authenticated", "Not logged in", "Unauthorized", "401", "403", "Please run {tool} login", "Set {ENV_VAR}"`
- Keep protocol as 5 numbered steps (same text, just tighter)
- DELETE the 37-line example checkpoint block (lines 399-437) — the `<checkpoint_return_format>` section (lines 593-632) already shows the exact structure
- Keep final line about Summary documentation

**C. MegaMemory update protocol (lines 442-497, 55 lines → ~25 lines)**

Current structure: 3 code blocks showing create_concept for features, decisions, patterns + state update + protocol rules.

Condensation:
- Remove the 3 verbose code blocks (lines 453-489). The agent already knows the megamemory:create_concept API from `<megamemory_context>`.
- Keep as concise bullets: "After each task: create concepts for features built (kind: feature), decisions made (kind: decision), patterns discovered (kind: pattern). Include file_refs, edges, and why. Update state concept with chapter progress."

**D. Checkpoint protocol (lines 499-591, 92 lines → ~40 lines)**

Current structure: Quick reference + 3 checkpoint type blocks with markdown example templates.

Condensation:
- Keep critical "Automation before verification" note and quick reference (lines 500-512)
- Compress checkpoint types to single-line descriptions with inline "provide:" guidance:
  - `checkpoint:human-verify (90%)` — Visual/functional verification. Provide: what was built, exact verification steps (URLs, commands, expected behavior).
  - `checkpoint:decision (9%)` — Implementation choice needed. Provide: decision context, options table (pros/cons), selection prompt.
  - `checkpoint:human-action (1%)` — Unavoidable manual step. Provide: what automation was attempted, single manual step, verification command.
- DELETE the markdown example blocks within each type (lines 527-542, 548-567, 573-588) — `<checkpoint_return_format>` shows the format

### 2.2 fuska-planner.md (1,594 → ~1,200 lines, ~394 saved)

**File:** `provider/opinkode/agents/fuska/fuska-planner.md`

**A. Philosophy section (lines 71-122, 52 lines → ~25 lines)**

- "Solo Developer" (lines 72-80): Compress to 3 lines. "Planning for ONE user + ONE implementer (OpenCode). No teams, stakeholders, ceremonies. Estimate in OpenCode execution time."
- "Plans Are Concepts" (lines 82-90): Compress to 2 lines. "Plan concepts in MegaMemory contain: objective, context (file refs, deps), tasks (with verification), success criteria."
- "Quality Degradation Curve" (lines 92-104): Keep table, remove explanation prose. Compress to ~8 lines.
- "Ship Fast" (lines 106-121): Compress anti-patterns to single line. "No enterprise process: no team structures, RACI, sprints, human time estimates, change management."

**B. Discovery levels (lines 124-159, 36 lines → ~20 lines)**

- Convert from verbose descriptions to compact table format:
  | Level | When | Action | Time |
  |-------|------|--------|------|
  | 0 Skip | Pure internal, existing patterns | None | 0 |
  | 1 Quick | Single known library, low risk | Context7 query | 2-5 min |
  | 2 Standard | 2-3 options, new integration | Discovery workflow | 15-30 min |
  | 3 Deep | Architectural, novel problem | Full research | 1+ hour |
- Keep depth indicators as 2 bullets

**C. Task breakdown (lines 161-273, 113 lines → ~60 lines)**

- "Task Anatomy" (lines 162-181): Keep but compress examples. Remove "Bad:" examples — keep only "Good:" inline with field definitions.
- "Task Types" (lines 183-193): Keep table unchanged.
- "Task Sizing" (lines 195-213): Keep table, compress signals to 2 bullets each.
- "Specificity Examples" (lines 215-227): Compress table from 5 rows to 3. Remove most obvious ones.
- "TDD Detection Heuristic" (lines 229-252): Compress candidate/standard lists to comma-separated lines. Remove "Why TDD gets its own plan" explanation paragraph.
- "User Setup Detection" (lines 254-271): Compress to ~8 lines. Remove verbose indicator bullets.

**D. Scope estimation (lines 354-421, 67 lines → ~35 lines)**

- "Context Budget Rules" (lines 354-373): Keep table, compress "Why 50%" from 4 bullets to 1 line.
- "Split Signals" (lines 374-388): Compress "ALWAYS split" and "CONSIDER splitting" to single bulleted lists.
- "Depth Calibration" (lines 389-404): Keep table, remove "Key principle" explanation paragraph.
- "Estimating Context Per Task" (lines 406-421): Keep tables, remove surrounding prose.

**E. MegaMemory guide (lines 423-520, 97 lines → ~40 lines)**

- "Creating Plan Concepts" (lines 429-456): Remove verbose TypeScript comment block. Keep essential: name pattern, kind, summary format, parent_id, edges.
- "Plan Concept Summary Content" (lines 458-489): Keep JSON example, remove markdown example (it's the same information).
- "Querying Existing Concepts" (lines 491-520): Compress to 3 essential query patterns (list plans, get specific plan, load chapter context). Remove verbose code blocks.

### 2.3 fuska-verifier.md (805 → ~650 lines, ~155 saved)

**File:** `provider/opinkode/agents/fuska/fuska-verifier.md`

**A. MegaMemory guide (lines 46-114, 68 lines → ~30 lines)**

- "Load Context" (lines 53-64): Keep 3 essential queries, remove code block formatting (planner knows the API).
- "Create Verification Concept" (lines 66-99): Compress. Keep name pattern, kind, summary structure, edges. Remove verbose TypeScript block.
- "Load Previous Verification" (lines 101-112): Compress to 3 lines of description.

**B. Verification levels - Step 4 (lines 228-348, 120 lines → ~80 lines)**

- Level 1 Existence (lines 236-250): Compress bash function to 3-line description.
- Level 2 Substantive (lines 252-307): Keep minimum lines table. Compress bash functions to descriptions. Keep the "Combine level 2 results" summary.
- Level 3 Wired (lines 309-348): Compress bash functions to descriptions. Keep the "Combine level 3 results" summary and final status table.

**C. Wiring patterns - Step 5 (lines 350-457, 108 lines → ~70 lines)**

- Component→API (lines 356-377): Compress bash to description + key grep patterns.
- API→Database (lines 379-401): Same approach.
- Form→Handler (lines 403-431): Same approach.
- State→Render (lines 433-457): Same approach.

### 2.4 fuska-debugger.md (1,297 → ~1,050 lines, ~247 saved)

**File:** `provider/opinkode/agents/fuska/fuska-debugger.md`

**A. MegaMemory guide (lines 39-82, 43 lines → ~20 lines)**

- Remove verbose code blocks for querying and creating/updating sessions. Keep as concise description: name pattern, kind, parent, summary format.

**B. Investigation techniques (lines 279-485, 207 lines → ~130 lines)**

For each of the 8 techniques, keep: When (1 line), How (2-3 lines), Example (compress or remove verbose multi-line examples). Target:
- Binary Search (lines 281-297, 17 lines → 10 lines): Keep example as 5-line trace, remove explanation.
- Rubber Duck (lines 299-313, 15 lines → 8 lines): Compress 6-step list to 3 essential questions.
- Minimal Reproduction (lines 315-341, 27 lines → 10 lines): Remove 14-line JSX example. Keep the 5-step process.
- Working Backwards (lines 343-365, 23 lines → 12 lines): Compress example from 8 to 5 lines.
- Differential Debugging (lines 367-396, 30 lines → 15 lines): Merge time-based and environment-based lists. Remove verbose example.
- Observability First (lines 398-423, 26 lines → 10 lines): Remove verbose code blocks. Keep 1-line summary per pattern type.
- Comment Out Everything (lines 425-443, 19 lines → 8 lines): Compress example.
- Git Bisect (lines 445-460, 16 lines → 8 lines): Keep 4-line command sequence.
- Technique Selection table (lines 462-472): Keep unchanged.
- Combining Techniques (lines 474-485): Compress to 3 lines.

**C. Verification patterns (lines 487-662, ~175 lines → ~130 lines)**

- "What Verified Means" (lines 489-499): Keep 5-point checklist, compress prose.
- Reproduction Verification (lines 501-513): Compress to 5 lines.
- Regression/Environment/Stability Testing (lines 515-573): Remove verbose code examples. Keep checklist items.
- Test-First Debugging (lines 575-606): Remove 20-line code example. Keep 5-step process description.
- Verification Checklist (lines 608-635): Keep markdown checklist unchanged.
- Red Flags (lines 637-660): Compress to essential bullets.

---

## Phase 3: Thin Orchestrator for fuska-do.md and fuska-build.md

Depends on Phase 1 (reuses `megamemory-quick-ref.md`).

### 3.1 fuska-do.md (1,163 → ~750 lines, ~413 saved)

**File:** `provider/opinkode/command/fuska/fuska-do.md`

**A. Replace megamemory_guide (lines 42-61) with `@` include**

In `<execution_context>`, add: `@../../fuska/references/megamemory-quick-ref.md`
Delete the `<megamemory_guide>` block (20 lines → 1 line include).

**B. Compress agent spawning patterns**

fuska-do.md spawns up to 4 agents in sequence (researcher, planner, checker, builder). Each spawn follows the same verbose pattern: display banner → build prompt (30-50 lines of template) → Task() call → handle return codes. Compress by:
- Reduce prompt building to essential context injection (remove verbose comments)
- Compress return handling to essential branching
- Keep the agent chain flow logic intact

**C. Compress mode config and model resolution**

The mode lookup table and model resolution code can be tightened by removing verbose comments and explanations.

**D. Compress commit confirmation flow**

The commit confirmation logic (end of file) has verbose branching for auto-commit vs prompted commit. Compress redundant branches.

### 3.2 fuska-build.md (1,023 → ~650 lines, ~373 saved)

**File:** `provider/opinkode/command/fuska/fuska-build.md`

**A. Replace megamemory_guide (lines 36-55) with `@` include**

In `<execution_context>`, add: `@../../fuska/references/megamemory-quick-ref.md`
Delete the `<megamemory_guide>` block (20 lines → 1 line include).

**B. Compress batch execution logic**

The plan discovery, dependency analysis, and batch grouping code can be tightened by removing verbose inline comments and explanations.

**C. Compress result collection and state updates**

The patterns for collecting subagent results and updating chapter/roadmap state have verbose code blocks that can be compressed.

---

## Dependency Graph

```
Phase 1 (fuska-plan.md + 4 new files)  ──>  Phase 3 (fuska-do, fuska-build)
                                              [needs megamemory-quick-ref.md]

Phase 2 (4 agent files)  ── fully independent, no cross-dependencies ──
```

Phase 1 and 2 can run in parallel. Phase 3 requires Phase 1 (for megamemory-quick-ref.md).

---

## Summary

| Phase | Files Modified | Current Lines | Target Lines | Net Savings |
|-------|---------------|---------------|--------------|-------------|
| 1: fuska-plan.md | 1 + 4 new | 1,446 | ~450 (+290 includes) | ~706 |
| 2: Agent condensation | 4 | 4,675 | ~3,680 | ~995 |
| 3: Thin orchestrator | 2 | 2,186 | ~1,400 | ~786 |
| **Total** | **7 + 4 new** | **8,307** | **~5,530 (+290)** | **~2,487** |

**Overall reduction: ~30%**

---

## Verification

Per phase:
1. Record line counts before/after (`wc -l`)
2. Run the relevant command in OpenCode and verify identical behavior:
   - Phase 1: `/fuska-plan 1 --skip-research --skip-verify --no-review`
   - Phase 2: Run parent commands that spawn each agent
   - Phase 3: `/fuska-do checked "test task"`, `/fuska-build 1`
3. Commit each phase independently
4. Each phase is independently rollbackable via `git checkout -- <files>`

## Execution Order

1. Create `provider/opinkode/fuska/references/megamemory-quick-ref.md`
2. Create `provider/opinkode/fuska/config/workflow-modes.md`
3. Create `provider/opinkode/fuska/templates/plan-prompts.md`
4. Create `provider/opinkode/fuska/templates/review-loop.md`
5. Refactor `provider/opinkode/command/fuska/fuska-plan.md`
6. Condense `provider/opinkode/agents/fuska/fuska-executor.md`
7. Condense `provider/opinkode/agents/fuska/fuska-planner.md`
8. Condense `provider/opinkode/agents/fuska/fuska-verifier.md`
9. Condense `provider/opinkode/agents/fuska/fuska-debugger.md`
10. Refactor `provider/opinkode/command/fuska/fuska-do.md`
11. Refactor `provider/opinkode/command/fuska/fuska-build.md`
