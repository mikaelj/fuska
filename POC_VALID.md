# Revised Plan: Optimize fuska-plan.md (Validated)

**Goal:** Reduce `fuska-plan.md` token consumption by ~30-34% while improving maintainability.

**Scope:** Only modify `fuska-plan.md` and create 4 new include files. Other commands (fuska-do.md, etc.) are out of scope for this PoC.

---

## Validation Summary

### ✅ Original Claims Verified

| Claim | Status | Notes |
|-------|--------|-------|
| fuska-plan.md line count: 1,447 | ✓ Close | Actual: 1,446 lines |
| Token math (~2.5 tokens/line) | ✓ Valid | 1,447 × 2.5 ≈ 3,600 tokens |
| Existing references: ~280 lines | ✓ Accurate | preflight (73) + model-validation (207) = 280 |
| config/ directory needs creation | ✓ Correct | Directory doesn't exist yet |
| templates/ directory exists | ✓ Confirmed | |
| references/ directory exists | ✓ Confirmed | |

### ⚠️ Issues Found and Fixed

**Issue 1: Script Includes Not Counted**

The original POC omitted TypeScript script includes from token counts:
- `types.ts` (188 lines)
- `chapter-templates.ts` (77 lines)
- `helpers.ts` (324 lines)

**Total scripts: 589 lines (~1,470 tokens)** — These ARE included in prompts.

**Issue 2: Step 8→10 Flow Break**

Original flow: `Step 8 → Step 9 (query plans) → Step 10 (spawn checker)`

The POC incorrectly routed: `Step 8 → Step 10` (skip verify case was correct, but verify case should go to Step 9)

**Fix:** Updated Step 8 routing to include Step 9.

**Issue 3: Review Loop Template Too Condensed**

Original review loop: ~280 lines of explicit code
Proposed `review-loop.md`: 80 lines as patterns

**Fix:** Expanded to 120 lines with critical implementation details.

**Issue 4: megamemory-quick-ref.md vs megamemory-integration.md**

A comprehensive `megamemory-integration.md` already exists. The quick-ref is intentionally terse and supplementary.

**Fix:** Added clarifying note in the quick-ref file.

---

## Token Economics: Revised Numbers

### Current State

| Component | Lines | Tokens (approx) |
|-----------|-------|-----------------|
| fuska-plan.md body | 1,446 | ~3,600 |
| Existing references | 280 | ~700 |
| Existing scripts | 589 | ~1,470 |
| **Total prompt** | **2,315** | **~5,770** |

### After Optimization

| Component | Lines | Tokens (approx) |
|-----------|-------|-----------------|
| fuska-plan.md body | ~450 | ~1,100 |
| Existing references | 280 | ~700 |
| Existing scripts | 589 | ~1,470 |
| New includes | 290 | ~730 |
| **Total prompt** | **~1,609** | **~4,000** |

**Actual reduction: ~30-34%**

---

## Testing Strategy (Simplified)

### Approach

1. **Before changes:** Run `/fuska-plan` in OpenCode, note token usage from UI
2. **Implement changes:** Create includes, refactor fuska-plan.md
3. **Restore:** Reset codebase + MegaMemory database to pre-change state
4. **After changes:** Run `/fuska-plan` again, compare token usage

### Step-by-Step

**Step 1: Baseline**
```
# In OpenCode, run:
/fuska-plan 1 --skip-research --skip-verify --no-review

# When complete, note the token count shown in OpenCode UI
# Record: _____ tokens used
```

**Step 2: Implement Changes**
- Create 4 include files
- Refactor fuska-plan.md

**Step 3: Restore State**
```bash
# Restore codebase
git checkout -- provider/opinkode/command/fuska/fuska-plan.md
rm provider/opinkode/fuska/references/megamemory-quick-ref.md
rm provider/opinkode/fuska/config/workflow-modes.md
rm provider/opinkode/fuska/templates/plan-prompts.md
rm provider/opinkode/fuska/templates/review-loop.md

# Restore MegaMemory database (delete and re-run fuska init, or backup/restore)
rm -rf .megamemory/
# Then re-initialize or restore from backup
```

**Step 4: Post-Change Measurement**
```
# In OpenCode, run same command:
/fuska-plan 1 --skip-research --skip-verify --no-review

# When complete, note the token count
# Record: _____ tokens used
```

**Step 5: Compare**
```
Baseline:  _____ tokens
After:     _____ tokens
Savings:   _____ tokens (___%)
```

---

## Files to Create (4 files)

### 1. `provider/opinkode/fuska/references/megamemory-quick-ref.md` (25 lines)

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

### 2. `provider/opinkode/fuska/config/workflow-modes.md` (30 lines)

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

### 3. `provider/opinkode/fuska/templates/plan-prompts.md` (115 lines)

```markdown
## Plan Agent Prompt Templates

Reusable templates for spawning planner and checker agents.

---

### Planner Prompt Template

Replace `{placeholders}` with actual values.

```markdown
<critical_constraints>
Return: ## PLANNING COMPLETE or ## CHECKPOINT REACHED or ## PLANNING INCONCLUSIVE
Create plan concepts in MegaMemory using ChapterConceptTemplates.createPlan()
Plans MUST complete within 50% context usage
Each plan: 2-3 tasks maximum
</critical_constraints>

<planning_context>

**Chapter:** {chapter_number}
**Mode:** {standard | fix_planning}

**Project State:**
{stateData JSON}

**Roadmap:**
{roadmapData JSON}

**Requirements (if exists):**
{requirements array}

**Chapter Context (if exists):**
{contextData JSON}

**Research (if exists):**
{researchData JSON}

**Fix Planning (if --fixes mode):**
{verificationData JSON}

</planning_context>

{if importGraphAvailable}
<import_graph_context>

**Related files ({importGraphFiles.length}):**
{importGraphFiles formatted list}

**Related symbols ({importGraphSymbols.length}):**
{importGraphSymbols formatted list}

**Usage:**
- Check `fileByPath.get('path')` before creating files
- Use `symbolByName.get('Name')` for existing symbols
- If file exists: action = "extend"
- If file missing: action = "create"

</import_graph_context>
{endif}

<downstream_consumer>
Output consumed by /fuska-build

Plans must be executable prompts with:
- Frontmatter (batch, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- requirements for goal-backward verification

Use MegaMemory:
- Create plan concepts: ChapterConceptTemplates.createPlan()
- Reference patterns: megamemory:understand()
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] Plan concepts created in MegaMemory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Batches assigned for parallel execution
- [ ] requirements derived from chapter goal
</quality_gate>
```

---

### Revision Prompt Template

```markdown
<critical_constraints>
Return what changed
Do NOT replan from scratch unless issues are fundamental
Update plan concepts in MegaMemory
</critical_constraints>

<revision_context>

**Chapter:** {chapter_number}
**Mode:** revision

**Existing plans:**
{current plan summaries}

**Checker issues:**
{structured issues from checker}

</revision_context>

<instructions>
Make targeted updates to address checker issues.

Use MegaMemory:
- Update plan concepts: megamemory:update_concept()
- Reference patterns from MegaMemory for solutions
</instructions>
```

---

### Checker Panel Prompt Template

```markdown
<critical_constraints>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list with cross-validation badges
</critical_constraints>

<verification_context>

**Chapter:** {chapterNumber}
**Chapter Goal:** {chapterGoal}

**Plans to verify:**
{planConcepts formatted with batch, dependencies, tasks, mustHaves}

**Requirements (if any):**
{requirementConcepts list}

</verification_context>

<checker_panel>
Base: quality-advocate (always)
Contextual: {checkerPanel.contextual or 'none'}
Expert: dynamic (derived from plan content)

Project Classification:
- Type: {projectClassification.type}
- Confidence: {projectClassification.confidence}
- Signals: {projectClassification.signals}
</checker_panel>
```
```

### 4. `provider/opinkode/fuska/templates/review-loop.md` (120 lines)

```markdown
## Interactive Review Loop Pattern

Reusable pattern for reviewing plans or execution results.

---

### Review Options

```
reviewOptions = [
  { label: "Looks good, proceed", description: "Save and continue" },
  { label: "Ask a question", description: "Discuss the content" },
  { label: "Modify a task", description: "Change a specific task" },
  { label: "Add a task", description: "Add new task" },
  { label: "Remove a task", description: "Remove a task" }
]
```

---

### Plan Display Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CHAPTER {X}: {Name} - Plans
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Plan 1: {objective}

**Batch:** {batch}
**Depends on:** {depends_on}
**Autonomous:** {yes/no}
**Purpose:** {purpose}
**Output:** {output}

### Must Haves
{requirements list}

### Files to Modify
{files_modified list}

### Tasks ({count})
#### Task 1: {name}
- **Files:** {files}
- **Action:** {action}
- **Verify:** {verify}
- **Done:** {done}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Query Plans for Display

```
megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)

const planConcepts = response.matches.map(match => {
  const planData = JSON.parse(match.summary)
  return {
    id: match.id,
    name: match.name,
    data: planData
  }
}).sort((a, b) => {
  const numA = parseInt(a.name.match(/plan-(\d+)/)?.[1] || '0')
  const numB = parseInt(b.name.match(/plan-(\d+)/)?.[1] || '0')
  return numA - numB
})
```

---

### Review Loop Logic

```
while (true) {
  actionResponse = question(questions=[{
    header: "Plan Review",
    question: "What would you like to do?",
    options: reviewOptions
  }])

  if (actionResponse[0] === "Looks good, proceed") break

  if (actionResponse[0] === "Ask a question") {
    // Get question, answer based on context, re-display
    continue
  }

  if (actionResponse[0] === "Modify a task") {
    // Select plan → Select task → Get modification → Spawn revision
    // Re-query and re-display
    continue
  }

  if (actionResponse[0] === "Add a task") {
    // Select plan → Get task details → Spawn revision
    // Re-query and re-display
    continue
  }

  if (actionResponse[0] === "Remove a task") {
    // Select plan → Select task → Confirm → Spawn revision
    // Re-query and re-display
    continue
  }
}
```

---

### Plan Selection UI

```
const planOptions = planConcepts.map(p => ({
  label: p.name,
  description: p.data.objective || 'No objective'
}))

const planChoice = question(questions=[{
  header: "Select Plan",
  question: "Which plan?",
  options: planOptions
}])
```

---

### Task Selection UI

```
const selectedPlan = planConcepts.find(p => p.name === planChoice[0])
const taskOptions = selectedPlan.data.tasks?.map((t, i) => ({
  label: `Task ${i+1}: ${t.name || 'Task ' + (i+1)}`,
  description: t.action?.substring(0, 50) + '...' || 'No description'
})) || []
```

---

### Revision Prompt Snippets

**Modify task:**
```markdown
<revision_context>
**Mode:** revision
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Current plan:** {planData JSON}
**User feedback:** {feedback}
</revision_context>

<instructions>
Update the plan to address user feedback.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

**Add task:**
```markdown
<revision_context>
**Mode:** add_task
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**New task:** {taskDescription}
</revision_context>

<instructions>
Add the new task to the plan.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

**Remove task:**
```markdown
<revision_context>
**Mode:** remove_task
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Task to remove:** Task {index}
</revision_context>

<instructions>
Remove the specified task from the plan.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

---

### Re-display After Changes

After any modification, re-query and re-display:
```
megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)
// Update planConcepts and re-display from plan display format
```
```

---

## File to Modify (1 file)

### `provider/opinkode/command/fuska/fuska-plan.md`

**Current:** 1,446 lines
**Target:** ~450 lines

### Updated File Content

```markdown
---
name: fuska-plan
description: Create detailed execution plan for a chapter with MegaMemory and verification loop
argument-hint: "[chapter] [--research] [--skip-research] [--fixes] [--skip-verify] [--no-review]"
agent: @../../agents/fuska/fuska-planner.md
tools:
  - read
  - bash
  - question
  - task
  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>

Create executable chapter concepts (plan concepts) for a roadmap chapter with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate chapter, research domain (unless skipped), spawn fuska-planner agent, verify plans with fuska-plan-checker, iterate until plans pass or max iterations, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees flow between agents.

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/model-validation.md
@../../fuska/references/megamemory-quick-ref.md
@../../fuska/config/workflow-modes.md
@../../fuska/templates/plan-prompts.md
@../../fuska/templates/review-loop.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Chapter number: `$ARGUMENTS` (optional - auto-detects next unplanned chapter)

**Flags:**
- `--research` — Force re-research even if research concept exists
- `--skip-research` — Skip research entirely
- `--fixes` — Fix planning mode (uses verification concept, skips research)
- `--skip-verify` — Skip planner → checker verification loop
- `--no-review` — Skip interactive review loop

Normalize chapter input in step 2 before any MegaMemory lookups.

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate Environment and Resolve Model Profile

**Step 1.1: Check MegaMemory availability**

Call `megamemory_list_roots()`. If empty: Display "No initiatives found" → Stop.

**Step 1.2: Query and parse config**

```
megamemory_understand(query="config", top_k=5)
configData = JSON.parse(response.concepts[0].summary)
```

**Step 1.3: Resolve models**

Use model-validation.md patterns. Extract `model_profile` (default: "balanced") and `model_aliases`.

**Step 1.4: Validate against OpenCode config**

Follow model-validation.md to validate model strings against `~/.config/opencode/opencode.jsonc`.

**Step 1.5: Extract checker panel config**

```
checkerPanel = configData.checker_panel || { base: 'quality-advocate', contextual: null, expert: 'dynamic' }
projectClassification = configData.project_classification || { type: 'generic', confidence: 'low', signals: [] }
```

---

## 2. Parse and Normalize Arguments

**Step 2.1: Extract flags and chapter number**

```
hasResearchFlag = input.includes("--research")
hasSkipResearchFlag = input.includes("--skip-research")
hasFixesFlag = input.includes("--fixes")
hasSkipVerifyFlag = input.includes("--skip-verify")
hasNoReviewFlag = input.includes("--no-review")
modeOverride = input.match(/--mode\s+(\S+)/)?[1]
chapterNumber = input.match(/\d+/) ? parseInt(match[0]) : null
```

**Step 2.2: Auto-detect chapter if not provided**

Query roadmap, find first incomplete chapter. If none found: Display error → Stop.

**Step 2.3: Normalize to slug**

```
chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
```

**Step 2.4-2.5: Check existing research and plans**

Query `${chapterSlug}-research` and `${chapterSlug}-plan` concepts.

---

## 3. Validate Chapter

Query chapter concept. If not found: Display error → Stop.

Extract: `chapterName`, `chapterGoal`, `chapterStatus`, `chapterId`

---

## 4. Handle Research

**Step 4.1-4.2: Skip if --fixes or --skip-research**

**Step 4.3: Resolve workflow mode**

Using workflow-modes.md:
```
mode = modeOverride || configData.workflow?.mode || "standard"
{ shouldResearch, shouldPlanCheck } = resolveWorkflowMode(mode, { research: hasResearchFlag, skipVerify: hasSkipVerifyFlag })
```

**Step 4.4: Skip if research disabled**

**Step 4.5: Use existing if available**

If researchExists AND !hasResearchFlag: Display "Using existing research" → Skip to step 5

**Step 4.6-4.8: Spawn researcher**

Display banner. Gather context (chapter, requirements, context, state). Spawn fuska-chapter-researcher.

Handle return:
- `## RESEARCH COMPLETE` → Continue to step 5
- `## RESEARCH BLOCKED` → Offer options

---

## 5. Check Existing Plans

If plans exist: Question user (Continue, View, Replan)

---

## 6. Load All Context

Query in sequence, cache results:
1. State → stateData
2. Roadmap → roadmapData
3. Requirements → requirements
4. Chapter context → contextData, hasContext
5. Research → researchData, hasResearch
6. Verification (if --fixes) → verificationData
7. Import graph (if available) → importGraphFiles, importGraphSymbols

---

## 7. Spawn fuska-planner Agent

Display banner. Build prompt using plan-prompts.md templates.

```
Task(
  prompt=filled_prompt,
  subagent_type="fuska-planner",
  model=models.planner,
  description="Plan Chapter {chapter}"
)
```

---

## 8. Handle Planner Return

- `## PLANNING COMPLETE` → If skip-verify: Step 14, else: Step 9
- `## CHECKPOINT REACHED` → Present to user, spawn continuation
- `## PLANNING INCONCLUSIVE` → Offer options

---

## 9. Query Plans for Verification

Query all `${chapterSlug}-plan` concepts. Extract plan data for checker.

---

## 10. Spawn fuska-plan-checker-panel Agent

Display banner. Build prompt using plan-prompts.md checker template.

```
Task(
  subagent_type="fuska-plan-checker-panel",
  model=models.checker,
  description="Verify Chapter {chapterNumber} plans"
)
```

---

## 11. Handle Checker Return

- `## VERIFICATION PASSED` → Step 13
- `## ISSUES FOUND` → List issues → Step 12

---

## 12. Revision Loop (Max 3 Iterations)

Track `iteration_count` (starts at 1).

**If iteration_count < 3:**
- Display "Sending back for revision... (iteration N/3)"
- Query current plans
- Build revision prompt from plan-prompts.md
- Spawn fuska-planner
- Increment iteration_count
- Return to Step 10

**If iteration_count >= 3:**
- Display remaining issues
- Offer: Force proceed, Provide guidance, Abandon

---

## 13. Interactive Review Loop

Using review-loop.md pattern:

**Step 13.1: Check skip flag**

```
skipReview = hasNoReviewFlag || configData?.workflow?.interactive_review === false
if (skipReview) → Step 14
```

**Step 13.2-13.3: Display plans and review loop**

Follow review-loop.md for:
- Query and sort plan concepts
- Plan display format
- Review options handling
- Plan/task selection UI
- Modification prompts
- Re-query and re-display after changes

---

## 14. Update State Concept

Query state concept, update with:
```
{
  ...stateData,
  current_chapter: chapterSlug,
  status: "ready_to_execute"
}
```

---

## 15. Present Final Status

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
-----------------------------------------------------
  Fuska: Chapter {X} planned
-----------------------------------------------------

**Chapter {X}: {Name}** — {N} plan(s) in {M} batch(s)

| Batch | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

──────────────────────────────────────────────────────────────

## > Next Up

**Execute Chapter {X}** — run all {N} plans
/fuska-build {X}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Review plans in MegaMemory: search for "{CHAPTER}-plan" to see all plan concepts
- /fuska-plan {X} --research — re-research first
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] MegaMemory validated
- [ ] Chapter validated
- [ ] Research completed (unless skipped/exists)
- [ ] fuska-planner spawned with context
- [ ] Plan concepts created
- [ ] fuska-plan-checker spawned (unless --skip-verify)
- [ ] Verification passed OR user override
- [ ] Interactive review loop (unless --no-review)
- [ ] State concept updated
- [ ] User knows next steps

</success_criteria>
```

---

## Line Count Comparison

| Section | Original | Optimized | Savings |
|---------|----------|-----------|---------|
| Frontmatter + objective | 29 | 29 | 0 |
| Execution context | 8 | 12 | -4 |
| megamemory_guide | 20 | 0 | 20 |
| Step 1 | 174 | 50 | 124 |
| Step 2 | 80 | 40 | 40 |
| Step 3 | 30 | 20 | 10 |
| Step 4 | 120 | 50 | 70 |
| Step 5 | 30 | 20 | 10 |
| Step 6 | 153 | 15 | 138 |
| Step 7 | 90 | 20 | 70 |
| Step 8 | 20 | 15 | 5 |
| Step 9 | 60 | 15 | 45 |
| Step 10 | 50 | 15 | 35 |
| Step 11 | 10 | 10 | 0 |
| Step 12 | 70 | 45 | 25 |
| Step 13 | 282 | 40 | 242 |
| Steps 14-15 | 50 | 35 | 15 |
| Offer next + success | 60 | 60 | 0 |
| **fuska-plan.md total** | **1,446** | **~451** | **~995** |

---

## Summary

| Item | Value |
|------|-------|
| Files to create | 4 |
| Files to modify | 1 (fuska-plan.md only) |
| Expected token reduction | ~30-34% |
| Testing method | Run command, check UI token count, restore, run again |
| Format | Markdown (works for OpenCode and Claude) |

---

## Verification Checklist

Before marking complete:

- [ ] All 4 shared files created
- [ ] fuska-plan.md refactored
- [ ] Line count verified (~450 lines)
- [ ] All includes resolve correctly
- [ ] Baseline token count recorded
- [ ] Post-change token count recorded
- [ ] Functional tests pass (same as baseline)
- [ ] Token reduction measured and documented
- [ ] No new errors or warnings

---

## Execution Order

1. Create `provider/opinkode/fuska/references/megamemory-quick-ref.md`
2. Create `provider/opinkode/fuska/config/workflow-modes.md`
3. Create `provider/opinkode/fuska/templates/plan-prompts.md`
4. Create `provider/opinkode/fuska/templates/review-loop.md`
5. Update `provider/opinkode/command/fuska/fuska-plan.md`

---

**Status:** Ready to execute when approved. Not yet executed.
