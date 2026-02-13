---
name: fuska-execute-phase
description: Execute all plans in a phase with wave-based parallelization using MegaMemory
argument-hint: "<phase-number> [--gaps-only]"
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

Execute all plans in a phase using wave-based parallel execution with MegaMemory concepts.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.

</objective>

<execution_context>

@./opencode/fuska/references/preflight-check-project-exists.md
@./opencode/fuska/scripts/types.ts
@./opencode/fuska/scripts/phase-templates.ts
@./opencode/fuska/scripts/helpers.ts

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>

Phase: `$ARGUMENTS`

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with specific gap_closure marker in summary). Use after verify-work creates fix plans.
- `--mode MODE` — Override workflow mode for this phase only (one-off, doesn't persist). Use to temporarily change mode.

## Context Loading (Single Pass)

Load all needed MegaMemory concepts upfront. All subsequent steps use these cached results — NO additional queries for data already loaded here.

```
// Parse arguments first
// input contains the raw argument string provided by the user
const phaseNumber = input.match(/\d+/)?.[0]
const phaseSlug = `phase-${phaseNumber.padStart(2, '0')}`

// Extract --mode flag for one-off override
const modeMatch = input.match(/--mode\s+(\S+)/)
const modeOverride = modeMatch ? modeMatch[1] : null

// Load all context in sequence
const configResponse = megamemory_understand(query="config", top_k=5)
const stateResponse = megamemory_understand(query="state", top_k=5)
const phaseResponse = megamemory_understand(query=`phase ${phaseNumber}`, top_k=5)
const plansResponse = megamemory_understand(query=`${phaseSlug}-plan`, top_k=20)

// Parse results
const configData = configResponse.matches.length > 0
  ? JSON.parse(configResponse.matches[0].summary) : null
const stateData = stateResponse.matches.length > 0
  ? JSON.parse(stateResponse.matches[0].summary) : null
const phaseData = phaseResponse.matches.length > 0
  ? JSON.parse(phaseResponse.matches[0].summary) : null
const planConcepts = plansResponse.matches.map(m => ({
  id: m.id, name: m.name, ...JSON.parse(m.summary)
}))

// Derive computed values
const modelProfile = configData?.model_profile || "balanced"
const parallelization = configData?.parallelization !== false // default: true
const hasPlans = planConcepts.length > 0
const commitStrategy = configData?.git?.commit_strategy || 'per-phase' // default: per-phase
const branchingStrategy = configData?.git?.branching_strategy || 'none'
const phaseBranchTemplate = configData?.git?.phase_branch_template || 'phase-${phaseNumber}'
const milestoneBranchTemplate = configData?.git?.milestone_branch_template || 'milestone-v${phaseNumber}'
```

If config, state, or phase not found, project may not be initialized — tell the user to run `/fuska-new-project`.

</context>

<process>

## 0. Handle Git Branching (if configured)

**Step 0.1: Check branching strategy**

If `branchingStrategy === "none"`:
→ Skip this step, proceed to step 1 (Preflight Check)

If `branchingStrategy === "phase"` or `"milestone"`:
→ Continue to Step 0.2

---

**Step 0.2: Check current branch**

```
const currentBranch = bash("git rev-parse --abbrev-ref HEAD")
```

---

**Step 0.3: Create or checkout feature branch**

For `branchingStrategy === "phase"`:

If currentBranch is not the phase branch:
```
bash(`git checkout -b ${phaseBranchTemplate}`)
```

If currentBranch is the phase branch:
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

Follow MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

**Step 2.1: Resolve Model Profile**

**Step 0.1: Query config concept**

Call:
```
megamemory_understand(query="config", top_k=5)
```

**Step 0.2: Check for empty results**

If response.matches.length === 0:
→ Display: "Config concept not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
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

## 3. Validate Phase Exists in MegaMemory

**Step 3.1: Query phase concept**

Parse phase number from arguments and normalize to zero-padded format. The variable `input` contains the raw argument string.
```
const phaseNumber = input.match(/\d+/)?.[0]
const phaseSlug = `phase-${phaseNumber.padStart(2, '0')}`
```

Call:
```
megamemory_understand(query=`phase ${phaseNumber}`, top_k=5)
```

**Step 1.2: Check phase exists**

If response.matches.length === 0:
→ Display: `Phase ${phaseNumber} not found in MegaMemory`
→ Suggest: "Query available phases using megamemory:understand(query='roadmap', top_k=10) to see all phases"
→ Stop

**Step 1.3: Extract phase data**

If response.matches.length > 0:
```
const phaseSummaryString = response.matches[0].summary
const phaseData = JSON.parse(phaseSummaryString)
const phaseName = phaseData.name
const phaseGoal = phaseData.goal
const phaseStatus = phaseData.status
```

**Step 1.4: Query plan concepts**

Call:
```
megamemory_understand(query=`${phaseSlug}-plan`, top_k=20)
```

**Step 1.5: Check for plans**

If response.matches.length === 0:
→ Display: `No plans found for ${phaseSlug}`
→ Suggest: "Run /fuska-plan-phase ${phaseNumber} to create plans"
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
    wave: planData.wave,
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
megamemory_understand(query=`${phaseSlug}-plan-${planNum}-summary`, top_k=1)
```

**Step 2.2: Identify incomplete plans**

```
const incompletePlans = planConcepts.filter(plan => {
  const summaryResponse = megamemory_understand(query=`${plan.name}-summary`, top_k=1)
  return summaryResponse.matches.length === 0
})
```

**Step 2.3: Filter for gap closure if flag set**

If `$ARGUMENTS` contains `--gaps-only`:
```
const gapPlans = incompletePlans.filter(plan => {
  const planData = JSON.parse(plan.summary)
  return planData.gap_closure === true
})
const plansToExecute = gapPlans.length > 0 ? gapPlans : incompletePlans
```

Else:
```
const plansToExecute = incompletePlans
```

**Step 2.4: Report to user**

Display: `Found ${plansToExecute.length} incomplete plans to execute`

---

5. **Group by wave**

**Step 3.1: Group plans by wave**

```
const waves = {}
for (const plan of plansToExecute) {
  const waveNum = plan.wave
  if (!waves[waveNum]) waves[waveNum] = []
  waves[waveNum].push(plan)
}
```

**Step 3.2: Sort and display waves**

```
const sortedWaves = Object.keys(waves).sort((a, b) => a - b)
Display: `Executing ${sortedWaves.length} wave(s)`
for (const waveNum of sortedWaves) {
  Display: `Wave ${waveNum}: ${waves[waveNum].length} plan(s)`
}
```

---

6. **Execute waves**

**For each wave in sortedWaves:**

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
const stateData = { current_phase: phaseSlug, current_plan: null, status: "in_progress" }
```

**Step 4.3: Load plan details for this wave**

For each plan in current wave:
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

For each plan in current wave, call all Task calls in one message:
```
Task(
  description=`Execute ${plan.name}`,
  subagent_type="fuska-executor",
  model=executorModel,
  prompt=`Execute this plan:

Phase: ${phaseSlug}
Plan: ${plan.name}
Commit Strategy: ${commitStrategy}

Plan Details:
${JSON.stringify(planFullData, null, 2)}

Project State:
${JSON.stringify(stateData, null, 2)}

Use plan's objective, tasks, and must_haves to guide implementation.
Git commit strategy is "${commitStrategy}". If "per-phase", stage files but do NOT commit — the orchestrator commits when the phase completes. If "per-plan", stage files and commit once after all tasks complete. If "per-task", commit after each task.
When complete, create a summary concept named "${plan.name}-summary" using megamemory:create_concept with execution results.`
)
```

All Task calls in a wave should be sent in one message — they run in parallel. The Task tool blocks until all complete.

If `parallelization === false`, spawn executors sequentially:

For each plan in current wave, wait for previous Task to complete before calling the next:
```
// Execute plan 1, wait for completion
Task(description=`Execute ${plan1.name}`, ...)

// Only after plan 1 completes, execute plan 2
Task(description=`Execute ${plan2.name}`, ...)
```

**Step 4.5: Verify summary concepts created**

After wave completes, for each plan:
```
megamemory_understand(query=`${plan.name}-summary`, top_k=1)
```

If response.matches.length === 0:
→ Display: `Warning: ${plan.name} summary not found`
→ Continue to next plan

---

7. **Aggregate results**

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
 Fuska: PHASE ${phaseNumber} EXECUTION COMPLETE
-----------------------------------------------------

Executed: ${plansToExecute.length} plan(s)
Status: All summaries created [OK]
```

---

8. **Commit phase (if per-phase strategy) and handle orchestrator corrections**

**Step 6.1: Stage any orchestrator corrections**

```bash
git status --porcelain
```

If git status shows unstaged modified files (not already staged by executors):
→ Stage them: `git add -u`

**Step 6.2: Commit based on strategy**

**If `commitStrategy === "per-phase"`:**

All plan executors staged their files without committing. Now create the single phase commit using `fuska-git-message`:

```
Task(
  description="Generate phase commit message",
  subagent_type="fuska-git-message",
  prompt=`<commit_context>
**Mode:** phase-commit
**Phase:** ${phaseSlug}
**Phase Goal:** ${phaseGoal}
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

Plans/tasks already committed by executors. Only commit if orchestrator made its own corrections using the same Task tool pattern:

```
Task(
  description="Generate orchestrator corrections commit",
  subagent_type="fuska-git-message",
  prompt=`<commit_context>
**Mode:** orchestrator-corrections
**Phase:** ${phaseSlug}
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

9. **Verify phase goal**

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

// Verifier only runs in standard mode, or if explicitly requested
const shouldVerify = mode === "standard" || input.includes("--verify")
```

**Step 7.3: Skip if verifier disabled**

If shouldVerify === false:
→ Display: "Verifier disabled — treating phase as passed"
→ Continue to step 8

**Step 7.4: Spawn verifier**

If shouldVerify === true:
```
Task(
  description=`Verify phase ${phaseNumber}`,
  subagent_type="fuska-verifier",
  model=verifierModel,
  prompt=`Verify Phase ${phaseNumber}: ${phaseName}

Phase Goal: ${phaseGoal}

Use megamemory:understand to:
1. Load the phase concept (query "phase ${phaseNumber}")
2. Load all plan summaries (query "${phaseSlug}-summary", top_k=20)
3. Check each plan's must_haves against the actual codebase

Use the Read tool to examine source files directly. Do NOT rely on summary claims.

Create a UAT concept named "${phaseSlug}-uat" using megamemory:create_concept with:
- A detailed verification report
- Which must-haves passed/failed
- Status: "passed" | "human_needed" | "gaps_found"
- If gaps_found: list specific gaps to close

Return the UAT concept's status and findings.`
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

If verifier returns `gaps_found`:
→ Present gaps to user
→ Suggest: `/fuska-plan-phase ${phaseNumber} --gaps`
→ Stop (let user run gap closure planning)

---

10. **Update Phase and Requirements in MegaMemory**

**Step 8.1: Query phase concept**

Call:
```
megamemory_understand(query=`phase ${phaseNumber}`, top_k=5)
```

**Step 8.2: Update phase status**

```
const phaseId = response.matches[0].id
const phaseData = JSON.parse(response.matches[0].summary)

const updatedPhaseData = {
  ...phaseData,
  status: "complete",
  completed_at: new Date().toISOString()
}

megamemory_update_concept(
  id=phaseId,
  changes={
    summary: JSON.stringify(updatedPhaseData)
  }
)
```

**Step 8.3: Update requirements (if any)**

If phaseData has requirements or requirement links:
```
const requirements = phaseData.requirements || []
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

11. **Update State Concept**

**Step 9.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 9.2: Parse and update state**

```
const stateId = response.matches[0].id
const stateData = JSON.parse(response.matches[0].summary)

// Query roadmap to get phases and milestones arrays
const roadmapResponse = megamemory_understand(query="roadmap", top_k=5)
const roadmapData = JSON.parse(roadmapResponse.matches[0].summary)
const phases = roadmapData.phases || []
const milestones = roadmapData.milestones || []

// Get current phase number
const currentPhaseNum = parseInt(stateData.current_phase?.replace('phase-', '') || phaseNumber)

// VALIDATE: Check if next phase exists
const nextPhaseNum = currentPhaseNum + 1
const nextPhaseSlug = `phase-${nextPhaseNum.toString().padStart(2, '0')}`

// Check if next phase exists in phases array
const phaseExists = phases.some(p => p.slug === nextPhaseSlug)

// Check milestone status
const currentMilestone = milestones.find(m => m.status === "in_progress")
const maxPhaseInMilestone = currentMilestone
  ? Math.max(...(currentMilestone.phases || [currentPhaseNum]))
  : Math.max(...phases.map(p => p.number))

const isLastPhaseInMilestone = currentPhaseNum >= maxPhaseInMilestone
const isLastPhaseInProject = !phaseExists && !isLastPhaseInMilestone

// DETERMINE NEXT STATE
let updatedStateData

if (isLastPhaseInProject) {
  // All phases complete
  updatedStateData = {
    ...stateData,
    current_phase: null,
    current_plan: null,
    status: "milestone_complete",
    last_activity: `All phases complete - milestone ready for completion`,
    progress: 100
  }
} else if (phaseExists) {
  // More phases available
  updatedStateData = {
    ...stateData,
    current_phase: nextPhaseSlug,
    current_plan: null,
    status: "phase_complete",
    last_activity: `Phase ${phaseNumber} completed and verified`,
    progress: calculateProgress(phases)
  }
} else if (isLastPhaseInMilestone) {
  // Milestone complete but more phases in next milestone
  updatedStateData = {
    ...stateData,
    current_phase: null,
    current_plan: null,
    status: "milestone_complete",
    last_activity: `Milestone complete - ${currentMilestone.version}`,
    progress: calculateProgress(phases)
  }
} else {
  // Fallback: keep current state, just mark as phase_complete
  updatedStateData = {
    ...stateData,
    status: "phase_complete",
    last_activity: `Phase ${phaseNumber} completed and verified`,
    progress: calculateProgress(phases)
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

12. **Offer next steps**

Route to next action (see `<offer_next>`)

</process>

<offer_next>

Output this markdown directly (not as a code block). Route based on status:

| State Status | Route |
|--------------|--------|
| All phases complete (current_phase=null, status=milestone_complete) | Route C (all complete) |
| Milestone complete (status=milestone_complete) | Route B (milestone complete) |
| `gaps_found` | Route D (gap closure) |
| `human_needed` | Present checklist, then re-route based on approval |
| `passed` + more phases | Route A (next phase) |
| `passed` + last phase | Route B (milestone complete) |

---

**Route A: Phase verified, more phases remain**

```
-----------------------------------------------------
  Fuska: Phase {Z} complete
-----------------------------------------------------

**Phase {Z}: {Name}**

{Y} plans executed
Goal verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Phase {Z+1}: {Name}** — {Goal from phase concept}
/fuska-discuss-phase {Z+1} — gather context and clarify approach

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-plan-phase {Z+1} — skip discussion, plan directly
- /fuska-verify-work {Z} — manual acceptance testing before continuing
──────────────────────────────────────────────────────────────
```

---

**Route B: Phase verified, milestone complete**

```
-----------------------------------------------------
  Fuska: Milestone complete
-----------------------------------------------------

**v1.0**

{N} phases completed
All phase goals verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Audit milestone** — verify requirements, cross-phase integration, E2E flows
/fuska-audit-milestone

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-verify-work — manual acceptance testing
- /fuska-complete-milestone — skip audit, archive directly
──────────────────────────────────────────────────────────────
```

---

**Route C: All Phases Complete**

```
══════════════════════════════════════════════════════
  Fuska: All phases complete
══════════════════════════════════════════════════════

**{ProjectName}**

All {totalPhases} phases finished!
All phase goals verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Complete Milestone** — verify all requirements, cross-phase integration

/fuska-complete-milestone

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-verify-work — manual acceptance testing before completing milestone
──────────────────────────────────────────────────────────────
```

---

**Route D: Gaps found — need additional planning**

```
-----------------------------------------------------
  Fuska: Phase {Z} gaps found
-----------------------------------------------------

**Phase {Z}: {Name}**

Score: {N}/{M} must-haves verified
Report: UAT concept {phase}-uat

### What's Missing

{Extract gap summaries from UAT concept}

──────────────────────────────────────────────────────────────

## > Next Up

**Plan gap closure** — create additional plans to complete phase
/fuska-plan-phase {Z} --gaps

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Query UAT details: use megamemory:understand to search for the phase's UAT concept
- /fuska-verify-work {Z} — manual testing before planning
──────────────────────────────────────────────────────────────
```

After user runs `/fuska-plan-phase {Z} --gaps`:
1. Planner reads UAT concept gaps
2. Creates additional plans (04, 05, etc.) to close gaps
3. User runs `/fuska-execute-phase {Z}` again
4. Execute-phase runs incomplete plans (04, 05...)
5. Verifier runs again → loop until passed

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

- [ ] All incomplete plan concepts in phase executed
- [ ] Each plan has summary concept created
- [ ] Phase goal verified (must_haves checked against codebase)
- [ ] UAT concept created with verification report
- [ ] State concept updated to reflect completion
- [ ] Phase concept status updated to 'complete'
- [ ] Requirements updated (phase requirements marked 'complete')
- [ ] User informed of next steps

</success_criteria>
