---
name: fuska-build
description: Execute all plans in a chapter with batch-based parallelization using MegaMemory
argument-hint: "<chapter-number> [--fixes-only]"
tools:
  - read
  - edit
  - bash
  - task
  - todowrite
  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
---

<objective>

Execute all plans in a chapter using batch-based parallel execution with MegaMemory concepts.

Orchestrator stays lean: discover plans, analyze dependencies, group into batches, spawn subagents, collect results. Each subagent loads full execute-plan context and handles its own plan.

Context budget: ~15% coordinator, 100% fresh per subagent.

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_chapter\":\"chapter-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>

Chapter: `$ARGUMENTS`

**Flags:**
- `--fixes-only` — Execute only fix plans (plans with specific is_fix marker in summary). Use after verify-work creates fix plans.
- `--mode MODE` — Override workflow mode for this chapter only (one-off, doesn't persist). Use to temporarily change mode.

## Context Loading (Single Pass)

Load all needed MegaMemory concepts upfront. All subsequent steps use these cached results — NO additional queries for data already loaded here.

```
// Parse arguments first
// input contains the raw argument string provided by the user
const chapterNumber = input.match(/\d+/)?.[0]
const chapterSlug = `chapter-${chapterNumber.padStart(2, '0')}`

// Extract --mode flag for one-off override
const modeMatch = input.match(/--mode\s+(\S+)/)
const modeOverride = modeMatch ? modeMatch[1] : null

// Load all context in sequence
const configResponse = megamemory_understand(query="config", top_k=5)
const stateResponse = megamemory_understand(query="state", top_k=5)
const chapterResponse = megamemory_understand(query=`chapter ${chapterNumber}`, top_k=5)
const plansResponse = megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)

// Parse results
const configData = configResponse.matches.length > 0
  ? JSON.parse(configResponse.matches[0].summary) : null
const stateData = stateResponse.matches.length > 0
  ? JSON.parse(stateResponse.matches[0].summary) : null
const chapterData = chapterResponse.matches.length > 0
  ? JSON.parse(chapterResponse.matches[0].summary) : null
const planConcepts = plansResponse.matches.map(m => ({
  id: m.id, name: m.name, ...JSON.parse(m.summary)
}))

// Derive computed values
const modelProfile = configData?.model_profile || "balanced"
const parallelization = configData?.parallelization !== false // default: true
const hasPlans = planConcepts.length > 0
const commitStrategy = configData?.git?.commit_strategy || 'per-chapter' // default: per-chapter
const branchingStrategy = configData?.git?.branching_strategy || 'none'
const chapterBranchTemplate = configData?.git?.chapter_branch_template || 'chapter-${chapterNumber}'
const milestoneBranchTemplate = configData?.git?.milestone_branch_template || 'milestone-v${chapterNumber}'
```

If config, state, or chapter not found, project may not be initialized — tell the user to run `fuska init`.

</context>

<process>

## 0. Handle Git Branching (if configured)

**Step 0.1: Check branching strategy**

If `branchingStrategy === "none"`:
→ Skip this step, proceed to step 1 (Preflight Check)

If `branchingStrategy === "chapter"` or `"milestone"`:
→ Continue to Step 0.2

---

**Step 0.2: Check current branch**

```
const currentBranch = bash("git rev-parse --abbrev-ref HEAD")
```

---

**Step 0.3: Create or checkout feature branch**

For `branchingStrategy === "chapter"`:

If currentBranch is not the chapter branch:
```
bash(`git checkout -b ${chapterBranchTemplate}`)
```

If currentBranch is the chapter branch:
→ Proceed to step 1 (already on correct branch)

For `branchingStrategy === "milestone"`:

If currentBranch is not the milestone branch:
```
bash(`git checkout -b ${milestoneBranchTemplate}`)
```

If currentBranch is the milestone branch:
→ Proceed to step 1 (already on correct branch)

---

## 2. Preflight Check

Follow MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

**Step 2.1: Resolve Model Profile**

**Step 0.1: Query config concept**

Call:
```
megamemory_understand(query="config", top_k=5)
```

**Step 0.2: Check for empty results**

If response.matches.length === 0:
→ Display: "Config concept not found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 0.3: Extract and parse config**

If response.matches.length > 0:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
```

**Step 0.4: Access model_profile field**

```
const modelProfile = configData.model_profile
if (!modelProfile || modelProfile === "") {
  modelProfile = "balanced"
}
```

**Model lookup table (uses aliases):**

First, extract model aliases from config (with defaults):
```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-executor | quality_model | balanced_model | balanced_model |
| fuska-verifier | balanced_model | balanced_model | budget_model |

```
const modelLookup = {
  quality: { executor: aliases.quality_model, verifier: aliases.balanced_model },
  balanced: { executor: aliases.balanced_model, verifier: aliases.balanced_model },
  budget: { executor: aliases.balanced_model, verifier: aliases.budget_model }
}
const models = modelLookup[modelProfile]
```

Store the resolved models (e.g., `executorModel` and `verifierModel`) for use in Task calls below.

---

## 3. Validate Chapter Exists in MegaMemory

**Step 3.1: Query chapter concept**

Parse chapter number from arguments and normalize to zero-padded format. The variable `input` contains the raw argument string.
```
const chapterNumber = input.match(/\d+/)?.[0]
const chapterSlug = `chapter-${chapterNumber.padStart(2, '0')}`
```

Call:
```
megamemory_understand(query=`chapter ${chapterNumber}`, top_k=5)
```

**Step 1.2: Check chapter exists**

If response.matches.length === 0:
→ Display: `Chapter ${chapterNumber} not found in MegaMemory`
→ Suggest: "Query available chapters using megamemory:understand(query='roadmap', top_k=10) to see all chapters"
→ Stop

**Step 1.3: Extract chapter data**

If response.matches.length > 0:
```
const chapterSummaryString = response.matches[0].summary
const chapterData = JSON.parse(chapterSummaryString)
const chapterName = chapterData.name
const chapterGoal = chapterData.goal
const chapterStatus = chapterData.status
```

**Step 1.4: Query plan concepts**

Call:
```
megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)
```

**Step 1.5: Check for plans**

If response.matches.length === 0:
→ Display: `No plans found for ${chapterSlug}`
→ Suggest: "Run /fuska-plan ${chapterNumber} to create plans"
→ Stop

**Step 1.6: Extract plan data**

If response.matches.length > 0:
```
const planConcepts = response.matches.map(match => {
  const summaryString = match.summary
  const planData = JSON.parse(summaryString)
  return {
    id: match.id,
    name: match.name,
    batch: planData.batch,
    dependsOn: planData.depends_on,
    objective: planData.objective,
    tasks: planData.tasks,
    mustHaves: planData.must_haves
  }
})
```

---

4. **Discover plans**

**Step 2.1: Check for summary concepts**

For each plan concept, check if a summary exists:
```
megamemory_understand(query=`${chapterSlug}-plan-${planNum}-summary`, top_k=1)
```

**Step 2.2: Identify incomplete plans**

```
const incompletePlans = planConcepts.filter(plan => {
  const summaryResponse = megamemory_understand(query=`${plan.name}-summary`, top_k=1)
  return summaryResponse.matches.length === 0
})
```

**Step 2.3: Filter for fix plans if flag set**

If `$ARGUMENTS` contains `--fixes-only`:
```
const fixPlans = incompletePlans.filter(plan => {
  const planData = JSON.parse(plan.summary)
  return planData.is_fix === true
})
const plansToExecute = fixPlans.length > 0 ? fixPlans : incompletePlans
```

Else:
```
const plansToExecute = incompletePlans
```

**Step 2.4: Report to user**

Display: `Found ${plansToExecute.length} incomplete plans to execute`

---

5. **Present Chapter Execution Plan**

**Step 5.1: Group plans by batch for display**

```
const batches = {}
for (const plan of plansToExecute) {
  const batchNum = plan.batch || 1
  if (!batches[batchNum]) batches[batchNum] = []
  batches[batchNum].push(plan)
}
const sortedBatchs = Object.keys(batches).sort((a, b) => a - b)
```

**Step 5.2: Display execution plan to user**

Output this markdown directly (not as a code block):

```
-----------------------------------------------------
  Fuska: Chapter {chapterNumber} Execution Plan
-----------------------------------------------------

**Chapter {chapterNumber}: {chapterName}**

Goal: {chapterGoal}

{plansToExecute.length} plan(s) to execute in {sortedBatchs.length} batch(s):

${sortedBatchs.map(w => `### Batch ${w}
${batches[w].map(p => `- **${p.name}**: ${p.objective || 'No objective'}`).join('\n')}`).join('\n\n')}

────────────────────────────────────────────────────
```

**Step 5.3: Check for auto mode**

```
const hasNoReviewFlag = input.includes("--no-review")
const configInteractiveReview = configData?.workflow?.interactive_review !== false
const isAutoMode = hasNoReviewFlag || !configInteractiveReview || modeOverride === "yolo"
```

**Step 5.4: Skip confirmation in auto mode, ask otherwise**

If `isAutoMode === true`:
→ Display: "Auto mode — proceeding with execution"
→ Continue to step 6

If `isAutoMode === false`:
→ Use question tool:
```
const proceedResponse = question(questions=[{
  header: "Proceed?",
  question: "Ready to execute these plans?",
  options: [
    {label: "Proceed", description: "Start execution now"},
    {label: "View details", description: "Show full plan details first"},
    {label: "Cancel", description: "Abort execution"}
  ]
}])
```

**Step 5.5: Handle user response (interactive mode only)**

If "View details":
→ For each plan, display: name, objective, tasks, must_haves
→ Re-offer confirmation

If "Cancel":
→ Display: "Execution cancelled"
→ Stop

If "Proceed":
→ Continue to step 6

---

6. **Group by batch**

**Step 3.1: Group plans by batch**

```
const batches = {}
for (const plan of plansToExecute) {
  const batchNum = plan.batch
  if (!batches[batchNum]) batches[batchNum] = []
  batches[batchNum].push(plan)
}
```

**Step 3.2: Sort and display batches**

```
const sortedBatchs = Object.keys(batches).sort((a, b) => a - b)
Display: `Executing ${sortedBatchs.length} batch(s)`
for (const batchNum of sortedBatchs) {
  Display: `Batch ${batchNum}: ${batches[batchNum].length} plan(s)`
}
```

---

7. **Execute batches**

**For each batch in sortedBatchs:**

**Step 4.1: Load current state for context**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 4.2: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

If response.matches.length === 0:
```
const stateData = { current_chapter: chapterSlug, current_plan: null, status: "in_progress" }
```

**Step 4.3: Load plan details for this batch**

For each plan in current batch:
```
megamemory_understand(query=`${plan.name}`, top_k=5)
```

Extract:
```
const planSummaryString = response.matches[0].summary
const planFullData = JSON.parse(planSummaryString)
```

**Step 4.4: Spawn executors (parallel or sequential based on config)**

If `parallelization === true` (default), spawn executors in parallel:

For each plan in current batch, call all Task calls in one message:
```
Task(
  variant="execute",
  description=`Execute ${plan.name}`,
  subagent_type="fuska-executor",
  model=executorModel,
  prompt=`Execute this plan:

Chapter: ${chapterSlug}
Plan: ${plan.name}
Commit Strategy: ${commitStrategy}

Plan Details:
${JSON.stringify(planFullData, null, 2)}

Project State:
${JSON.stringify(stateData, null, 2)}

Use plan's objective, tasks, and must_haves to guide implementation.
Git commit strategy is "${commitStrategy}". If "per-chapter", stage files but do NOT commit — the coordinator commits when the chapter completes. If "per-plan", stage files and commit once after all tasks complete. If "per-task", commit after each task.
When complete, create a summary concept named "${plan.name}-summary" using megamemory:create_concept with execution results.`
)
```

All Task calls in a batch should be sent in one message — they run in parallel. The Task tool blocks until all complete.

If `parallelization === false`, spawn executors sequentially:

For each plan in current batch, wait for previous Task to complete before calling the next:
```
// Execute plan 1, wait for completion
Task(description=`Execute ${plan1.name}`, ...)

// Only after plan 1 completes, execute plan 2
Task(description=`Execute ${plan2.name}`, ...)
```

**Step 4.5: Verify summary concepts created**

After batch completes, for each plan:
```
megamemory_understand(query=`${plan.name}-summary`, top_k=1)
```

If response.matches.length === 0:
→ Display: `Warning: ${plan.name} summary not found`
→ Continue to next plan

---

8. **Aggregate results**

**Step 5.1: Collect all summaries**

For each plan in plansToExecute:
```
megamemory_understand(query=`${plan.name}-summary`, top_k=1)
```

Extract summary data:
```
const summaryData = JSON.parse(response.matches[0].summary)
```

**Step 5.2: Report completion status**

Display:
```
-----------------------------------------------------
 Fuska: CHAPTER ${chapterNumber} EXECUTION COMPLETE
-----------------------------------------------------

Executed: ${plansToExecute.length} plan(s)
Status: All summaries created [OK]
```

---

9. **Commit chapter (if per-chapter strategy) and handle coordinator corrections**

**Step 6.1: Stage any coordinator corrections**

```bash
git status --porcelain
```

If git status shows unstaged modified files (not already staged by executors):
→ Stage them: `git add -u`

**Step 6.2: Commit based on strategy**

**If `commitStrategy === "per-chapter"`:**

All plan executors staged their files without committing. Now create the single chapter commit using `fuska-git-message`:

```
Task(
  variant="amend",
  description="Generate chapter commit message",
  subagent_type="fuska-git-message",
  prompt=`<commit_context>
**Mode:** chapter-commit
**Chapter:** ${chapterSlug}
**Chapter Goal:** ${chapterGoal}
**Commit Strategy:** ${commitStrategy}

**Plans completed:**
${planSummaries.map(s => `- ${s.name}: ${s.summary}`).join('\n')}

**Staged files:**
${stagedFiles.join('\n')}
</commit_context>`
)
```

The agent returns the commit message. Then execute:

```bash
git commit -m "${generatedMessage}"
```

**If `commitStrategy === "per-plan"` or `"per-task"`:**

Plans/tasks already committed by executors. Only commit if coordinator made its own corrections using the same Task tool pattern:

```
Task(
  variant="amend",
  description="Generate coordinator corrections commit",
  subagent_type="fuska-git-message",
  prompt=`<commit_context>
**Mode:** coordinator-corrections
**Chapter:** ${chapterSlug}
**Commit Strategy:** ${commitStrategy}

**Changes:**
Orchestrator corrections and metadata updates

**Staged files:**
${stagedFiles.join('\n')}
</commit_context>`
)
```

**If git status is clean:** Continue to step 7.

---

10. **Verify chapter goal**

**Step 7.1: Query config to check verifier setting**

Call:
```
megamemory_understand(query="config", top_k=5)
```

**Step 7.2: Extract workflow mode and derive verifier**

```
const configData = JSON.parse(response.matches[0].summary)

// Extract mode (with --mode flag override for one-off changes)
const mode = modeOverride || configData.workflow?.mode || "standard"

// Reviewer only runs in standard mode, or if explicitly requested
const shouldVerify = mode === "standard" || input.includes("--verify")
```

**Step 7.3: Skip if reviewer disabled**

If shouldVerify === false:
→ Display: "Reviewer disabled — treating chapter as passed"
→ Continue to step 8

**Step 7.4: Spawn reviewer**

If shouldVerify === true:
```
Task(
  variant="validate",
  description=`Verify chapter ${chapterNumber}`,
  subagent_type="fuska-verifier",
  model=verifierModel,
  prompt=`Verify Chapter ${chapterNumber}: ${chapterName}

Chapter Goal: ${chapterGoal}

Use megamemory:understand to:
1. Load the chapter concept (query "chapter ${chapterNumber}")
2. Load all plan summaries (query "${chapterSlug}-summary", top_k=20)
3. Check each plan's must_haves against the actual codebase

Use the Read tool to examine source files directly. Do NOT rely on summary claims.

Create a verification concept named "${chapterSlug}-verification" using megamemory:create_concept with:
- A detailed verification report
- Which must-haves passed/failed
- Status: "passed" | "human_needed" | "issues_found"
- If issues_found: list specific issues to fix

Return the verification concept's status and findings.`
)
```

**Step 7.5: Check verifier result**

If verifier returns `passed`:
→ Continue to step 8

If verifier returns `human_needed`:
→ Present checklist to user
→ Use question tool to get approval or feedback
→ If approved → continue to step 8
→ If changes needed → suggest re-planning

If verifier returns `issues_found`:
→ Present issues to user
→ Suggest: `/fuska-plan ${chapterNumber} --fixes`
→ Stop (let user run fix planning)

---

11. **Update Chapter and Requirements in MegaMemory**

**Step 8.1: Query chapter concept**

Call:
```
megamemory_understand(query=`chapter ${chapterNumber}`, top_k=5)
```

**Step 8.2: Update chapter status**

```
const chapterId = response.matches[0].id
const chapterData = JSON.parse(response.matches[0].summary)

const updatedChapterData = {
  ...chapterData,
  status: "complete",
  completed_at: new Date().toISOString()
}

megamemory_update_concept(
  id=chapterId,
  changes={
    summary: JSON.stringify(updatedChapterData)
  }
)
```

**Step 8.3: Update requirements (if any)**

If chapterData has requirements or requirement links:
```
const requirements = chapterData.requirements || []
for (const reqId of requirements) {
  megamemory_understand(query=reqId, top_k=1)
  if (response.matches.length > 0) {
    const reqData = JSON.parse(response.matches[0].summary)
    const updatedReqData = {
      ...reqData,
      status: "complete"
    }
    megamemory_update_concept(
      id=response.matches[0].id,
      changes={ summary: JSON.stringify(updatedReqData) }
    )
  }
}
```

---

12. **Update State Concept**

**Step 9.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 9.2: Parse and update state**

```
const stateId = response.matches[0].id
const stateData = JSON.parse(response.matches[0].summary)

// Query roadmap to get chapters and milestones arrays
const roadmapResponse = megamemory_understand(query="roadmap", top_k=5)
const roadmapData = JSON.parse(roadmapResponse.matches[0].summary)
const chapters = roadmapData.chapters || []
const milestones = roadmapData.milestones || []

// Get current chapter number
const currentChapterNum = parseInt(stateData.current_chapter?.replace('chapter-', '') || chapterNumber)

// VALIDATE: Check if next chapter exists
const nextChapterNum = currentChapterNum + 1
const nextChapterSlug = `chapter-${nextChapterNum.toString().padStart(2, '0')}`

// Check if next chapter exists in chapters array
const chapterExists = chapters.some(p => p.slug === nextChapterSlug)

// Check milestone status
const currentMilestone = milestones.find(m => m.status === "in_progress")
const maxChapterInMilestone = currentMilestone
  ? Math.max(...(currentMilestone.chapters || [currentChapterNum]))
  : Math.max(...chapters.map(p => p.number))

const isLastChapterInMilestone = currentChapterNum >= maxChapterInMilestone
const isLastChapterInProject = !chapterExists && !isLastChapterInMilestone

// DETERMINE NEXT STATE
let updatedStateData

if (isLastChapterInProject) {
  // All chapters complete
  updatedStateData = {
    ...stateData,
    current_chapter: null,
    current_plan: null,
    status: "milestone_complete",
    progress: 100
  }
} else if (chapterExists) {
  // More chapters available
  updatedStateData = {
    ...stateData,
    current_chapter: nextChapterSlug,
    current_plan: null,
    status: "chapter_complete",
    progress: calculateProgress(chapters)
  }
} else if (isLastChapterInMilestone) {
  // Milestone complete but more chapters in next milestone
  updatedStateData = {
    ...stateData,
    current_chapter: null,
    current_plan: null,
    status: "milestone_complete",
    progress: calculateProgress(chapters)
  }
} else {
  // Fallback: keep current state, just mark as chapter_complete
  updatedStateData = {
    ...stateData,
    status: "chapter_complete",
    progress: calculateProgress(chapters)
  }
}

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

---

13. **Offer next steps**

Route to next action (see `<offer_next>`)

</process>

<offer_next>

Output this markdown directly (not as a code block). Route based on status:

| State Status | Route |
|--------------|--------|
| All chapters complete (current_chapter=null, status=milestone_complete) | Route C (all complete) |
| Milestone complete (status=milestone_complete) | Route B (milestone complete) |
| `issues_found` | Route D (fix planning) |
| `human_needed` | Present checklist, then re-route based on approval |
| `passed` + more chapters | Route A (next chapter) |
| `passed` + last chapter | Route B (milestone complete) |

---

**Route A: Chapter verified, more chapters remain**

```
-----------------------------------------------------
  Fuska: Chapter {Z} complete
-----------------------------------------------------

**Chapter {Z}: {Name}**

{Y} plans executed
Goal verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Chapter {Z+1}: {Name}** — {Goal from chapter concept}
/fuska-design-chapter {Z+1} — gather context and clarify approach

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-plan {Z+1} — skip design, plan directly
- /fuska-review-chapter {Z} — manual acceptance testing before continuing
──────────────────────────────────────────────────────────────
```

---

**Route B: Chapter verified, milestone complete**

```
-----------------------------------------------------
  Fuska: Milestone complete
-----------------------------------------------------

**v1.0**

{N} chapters completed
All chapter goals verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Audit milestone** — verify requirements, cross-chapter integration, E2E flows
/fuska-audit-milestone

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-review-chapter — manual acceptance testing
- /fuska-complete-milestone — skip audit, archive directly
──────────────────────────────────────────────────────────────
```

---

**Route C: All Chapters Complete**

```
══════════════════════════════════════════════════════
  Fuska: All chapters complete
══════════════════════════════════════════════════════

**{ProjectName}**

All {totalChapters} chapters finished!
All chapter goals verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Complete Milestone** — verify all requirements, cross-chapter integration

/fuska-complete-milestone

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-review-chapter — manual acceptance testing before completing milestone
──────────────────────────────────────────────────────────────
```

---

**Route D: Gaps found — need additional planning**

```
-----------------------------------------------------
  Fuska: Chapter {Z} gaps found
-----------------------------------------------------

**Chapter {Z}: {Name}**

Score: {N}/{M} must-haves verified
Report: Verification concept {chapter}-verification

### What's Missing

{Extract gap summaries from verification concept}

──────────────────────────────────────────────────────────────

## > Next Up

**Plan fixes** — create additional plans to complete chapter
/fuska-plan {Z} --fixes

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Query verification details: use megamemory:understand to search for the chapter's verification concept
- /fuska-review-chapter {Z} — manual testing before planning
──────────────────────────────────────────────────────────────
```

After user runs `/fuska-plan {Z} --fixes`:
1. Planner reads verification concept issues
2. Creates additional plans (04, 05, etc.) to fix issues
3. User runs `/fuska-build {Z}` again
4. Build runs incomplete plans (04, 05...)
5. Reviewer runs again → loop until passed

</offer_next>

<deviation_rules>

During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in summary concept
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user

Only rule 4 requires user intervention.

**Use MegaMemory for all updates:**

When auto-fixing, find the plan's summary concept using `megamemory:understand` and update it with `megamemory:update_concept` — append the new issue to `issues_encountered` and add fix details to `decisions_made` in the JSON summary.

</deviation_rules>

<success_criteria>

- [ ] All incomplete plan concepts in chapter executed
- [ ] Each plan has summary concept created
- [ ] Chapter goal verified (must_haves checked against codebase)
- [ ] Verification concept created with verification report
- [ ] State concept updated to reflect completion
- [ ] Chapter concept status updated to 'complete'
- [ ] Requirements updated (chapter requirements marked 'complete')
- [ ] User informed of next steps

</success_criteria>
