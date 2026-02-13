---
name: fuska-plan-phase
description: Create detailed execution plan for a phase with MegaMemory and verification loop
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: fuska-planner
tools:
  - read
  - bash

  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>

Create executable phase concepts (plan concepts) for a roadmap phase with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped or exists), spawn fuska-planner agent, verify plans with fuska-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees flow between agents in main context.

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

Phase number: `$ARGUMENTS` (optional - auto-detects next unplanned phase if not provided)

**Flags:**
- `--research` — Force re-research even if research concept exists
- `--skip-research` — Skip research entirely, go straight to planning
- `--gaps` — Gap closure mode (uses UAT concept for gaps, skips research)
- `--skip-verify` — Skip planner → checker verification loop

Normalize phase input in step 2 before any MegaMemory lookups.

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Validate Environment and Resolve Model Profile

**Step 1.1: Check MegaMemory availability**

Call:
```
megamemory_list_roots()
```

**Step 1.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 1.3: Query config concept**

Call:
```
megamemory_understand(query="config", top_k=5)
```

**Step 1.4: Check config exists**

If response.matches.length === 0:
→ Display: "Config concept not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 1.5: Extract and parse config**

If response.matches.length > 0:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
```

**Step 1.6: Access model_profile field**

```
const modelProfile = configData.model_profile
if (!modelProfile || modelProfile === "") {
  modelProfile = "balanced"
}
```

**Step 1.7: Extract checker_panel configuration**

```
const checkerPanel = configData.checker_panel || {
  base: 'quality-advocate',
  contextual: null,
  expert: 'dynamic'
}

const projectClassification = configData.project_classification || {
  type: 'generic',
  confidence: 'low',
  signals: []
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
| fuska-phase-researcher | quality_model | balanced_model | budget_model |
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |

```
const modelLookup = {
  quality: { researcher: aliases.quality_model, planner: aliases.quality_model, checker: aliases.balanced_model },
  balanced: { researcher: aliases.balanced_model, planner: aliases.quality_model, checker: aliases.balanced_model },
  budget: { researcher: aliases.budget_model, planner: aliases.balanced_model, checker: aliases.budget_model }
}
const models = modelLookup[modelProfile]
```

Store the resolved models (e.g., `researcherModel`, `plannerModel`, `checkerModel`) for use in Task calls below.

---

## 2. Parse and Normalize Arguments

**Step 2.1: Extract flags from arguments**

The variable `input` contains the raw argument string provided by the user.

```
const hasResearchFlag = input.includes("--research")
const hasSkipResearchFlag = input.includes("--skip-research")
const hasGapsFlag = input.includes("--gaps")
const hasSkipVerifyFlag = input.includes("--skip-verify")

// Extract --mode flag for one-off override
const modeMatch = input.match(/--mode\s+(\S+)/)
const modeOverride = modeMatch ? modeMatch[1] : null

// Extract phase number
const phaseMatch = input.match(/\d+/)
let phaseNumber = phaseMatch ? parseInt(phaseMatch[0]) : null
```

**Step 2.2: Auto-detect phase if not provided**

If phaseNumber === null:
```
// Query roadmap to find next unplanned phase
megamemory_understand(query="roadmap", top_k=5)
if (response.matches.length > 0) {
  const roadmapData = JSON.parse(response.matches[0].summary)
  // Find phases with status != "complete"
  const incompletePhases = roadmapData.phases.filter(p => p.status !== "complete")
  if (incompletePhases.length > 0) {
    phaseNumber = incompletePhases[0].number
  }
}
```

If still no phase found:
→ Display: "Could not determine phase. Please specify a phase number."
→ Stop

**Step 2.3: Normalize phase to slug**

```
const phaseSlug = `phase-${phaseNumber.toString().padStart(2, '0')}`
```

**Step 2.4: Check for existing research**

Call:
```
megamemory_understand(query=`${phaseSlug}-research`, top_k=1)
```

If response.matches.length > 0:
```
const researchExists = true
```
Else:
```
const researchExists = false
```

**Step 2.5: Check for existing plans**

Call:
```
megamemory_understand(query=`${phaseSlug}-plan`, top_k=20)
```

If response.matches.length > 0:
```
const existingPlansCount = response.matches.length
```
Else:
```
const existingPlansCount = 0
```

---

## 3. Validate Phase

**Step 3.1: Query phase concept**

Call:
```
megamemory_understand(query=`phase ${phaseNumber}`, top_k=5)
```

**Step 3.2: Check phase exists**

If response.matches.length === 0:
→ Display: `Phase ${phaseNumber} not found in MegaMemory`
→ Suggest: "Query available phases using megamemory:understand(query='roadmap', top_k=10)"
→ Stop

**Step 3.3: Extract phase data**

If response.matches.length > 0:
```
const phaseSummaryString = response.matches[0].summary
const phaseData = JSON.parse(phaseSummaryString)

const phaseName = phaseData.name
const phaseGoal = phaseData.goal
const phaseStatus = phaseData.status
const phaseId = response.matches[0].id
```

---

## 4. Handle Research

**Step 4.1: Check for --gaps flag**

If hasGapsFlag === true:
→ Skip to step 5 (research not needed for gap closure)

**Step 4.2: Check for --skip-research flag**

If hasSkipResearchFlag === true:
→ Skip to step 5

**Step 4.3: Extract workflow mode and derive research**

Re-use configData from step 1.5:
```
// Extract mode (with --mode flag override for one-off changes)
const mode = modeOverride || configData.workflow?.mode || "standard"

const modeConfig = {
  direct: { research: false, planCheck: false },
  quick: { research: false, planCheck: false },
  fast: { research: false, planCheck: true },
  balanced: { research: true, planCheck: false },
  thorough: { research: true, planCheck: true },
  standard: { research: true, planCheck: true }
}[mode] || { research: true, planCheck: true };  // Default to standard

// Allow per-phase flags to augment (never reduce)
const shouldResearch = modeConfig.research || hasResearchFlag
const shouldPlanCheck = modeConfig.planCheck && !hasSkipVerifyFlag
```

**Step 4.4: Skip if research disabled**

If shouldResearch === false:
→ Skip to step 5

**Step 4.5: Check for existing research**

If researchExists === true AND hasResearchFlag === false:
→ Display: `Using existing research: ${phaseSlug}-research concept`
→ Skip to step 5

**Step 4.6: Spawning researcher (if needed)**

If (researchExists === false OR hasResearchFlag === true) AND hasGapsFlag === false AND shouldResearch === true:

Display:
```
----------------------------------------------------
 Fuska ► RESEARCHING PHASE ${phaseNumber}
----------------------------------------------------

 ◆ Spawning researcher...
```

### Spawn fuska-phase-researcher

**Step 4.7: Gather research context**

**Gather phase description:**
```
// Reuse phaseData from step 3.3
const phaseDesc = { name: phaseName, goal: phaseGoal }
```

**Gather requirements:**
```
megamemory_understand(query="requirements", top_k=50)
if (response.matches.length > 0) {
  const requirements = response.matches.map(match => {
    const summaryString = match.summary
    const reqData = JSON.parse(summaryString)
    return { id: match.id, description: reqData.description, status: reqData.status }
  })
}
```

**Gather phase context (if exists):**
```
megamemory_understand(query=`${phaseSlug}-context`, top_k=1)
if (response.matches.length > 0) {
  const contextSummaryString = response.matches[0].summary
  const contextData = JSON.parse(contextSummaryString)
  // Use contextData.gathered, contextData.status, contextData.phase_boundary, etc.
}
```

**Gather prior decisions:**
```
megamemory_understand(query="state", top_k=1)
if (response.matches.length > 0) {
  const stateSummaryString = response.matches[0].summary
  const stateData = JSON.parse(stateSummaryString)
  // Use stateData.current_phase, stateData.last_activity, etc.
}
```

**Step 4.8: Build and spawn researcher**

```
const researchPrompt = `<objective>
Research how to implement Phase ${phaseNumber}: ${phaseName}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<context>
**Phase description:**
Name: ${phaseName}
Goal: ${phaseGoal}

**Requirements (if any):**
${requirements.map(r => `- ${r.description} (${r.status})`).join('\n') || 'No requirements found'}

**Phase context (if any):**
${contextData ? JSON.stringify(contextData, null, 2) : 'No context found'}

**Prior decisions:**
${stateData ? JSON.stringify(stateData, null, 2) : 'No state data'}
</context>

<output>
Create/update research concept: ${phaseSlug}-research
Use: PhaseConceptTemplates.createResearch()
</output>`

Task(
  description=`Research Phase ${phaseNumber}`,
  subagent_type="fuska-phase-researcher",
  model=researcherModel,
  prompt=researchPrompt
)
```

### Handle Researcher Return

**If researcher returns "## RESEARCH COMPLETE":**
→ Display: "Research complete. Proceeding to planning..."
→ Continue to step 5

**If researcher returns "## RESEARCH BLOCKED":**
→ Display blocker information from researcher output
→ Use question tool:
  - header: "Research Blocked"
  - question: "How would you like to proceed?"
  - options:
    - "Provide more context" - I'll gather more information
    - "Skip research" - Proceed to planning anyway
    - "Abort" - Cancel this operation

Wait for user response and handle accordingly.

---

## 5. Check Existing Plans

**Step 5.1: Check if plans exist**

If existingPlansCount > 0:
→ Use question tool:
```
const plansResponse = question(questions=[{
  header: "Existing Plans",
  question: "Plans already exist for this phase (${existingPlansCount} plan(s)). What would you like to do?",
  options: [
    {label: "Continue planning", description: "Add more plans to existing ones"},
    {label: "View existing", description: "Show current plans"},
    {label: "Replan from scratch", description: "Delete and recreate all plans"}
  ]
}])
```

**Step 5.2: Handle user response**

If user chooses "Continue planning":
→ Continue to step 6

If user chooses "View existing":
→ Display existing plans (query `${phaseSlug}-plan` and show summaries)
→ Re-prompt question

If user chooses "Replan from scratch":
→ Ask confirmation
→ If confirmed, delete all plan concepts and continue to step 6

---

## 6. Load All Context (Single Pass)

Query MegaMemory for all needed concepts in sequence, store results. All subsequent steps use these cached results — NO additional queries for data already loaded.

**Step 6.1: Query project state**

```
const stateResponse = megamemory_understand(query="state", top_k=5)
const stateData = stateResponse.matches.length > 0
  ? JSON.parse(stateResponse.matches[0].summary)
  : null
```

**Step 6.2: Query roadmap**

```
const roadmapResponse = megamemory_understand(query="roadmap", top_k=5)
const roadmapData = roadmapResponse.matches.length > 0
  ? JSON.parse(roadmapResponse.matches[0].summary)
  : null
```

**Step 6.3: Query requirements**

```
const reqResponse = megamemory_understand(query="requirements", top_k=50)
const requirements = reqResponse.matches.map(match => {
  const reqData = JSON.parse(match.summary)
  return { id: match.id, description: reqData.description, status: reqData.status }
})
```

**Step 6.4: Query phase context**

```
const contextResponse = megamemory_understand(query=`${phaseSlug}-context`, top_k=1)
const contextData = contextResponse.matches.length > 0
  ? JSON.parse(contextResponse.matches[0].summary)
  : null
const hasContext = contextResponse.matches.length > 0
```

**Step 6.5: Query research**

```
const researchResponse = megamemory_understand(query=`${phaseSlug}-research`, top_k=1)
const researchData = researchResponse.matches.length > 0
  ? JSON.parse(researchResponse.matches[0].summary)
  : null
const hasResearch = researchResponse.matches.length > 0
```

**Step 6.6: Query UAT (if --gaps mode)**

```
let uatData = null
if (hasGapsFlag) {
  const uatResponse = megamemory_understand(query=`${phaseSlug}-uat`, top_k=1)
  uatData = uatResponse.matches.length > 0
    ? JSON.parse(uatResponse.matches[0].summary)
    : null
}
```

**Step 6.7: Derive computed values**

```
const modelProfile = configData?.model_profile || "balanced"
```

All data is now cached. Subsequent steps reference these variables — no re-querying.

## 7. Spawn fuska-planner Agent

Display stage banner:

```
-----------------------------------------------------
 Fuska ► PLANNING PHASE {X}
-----------------------------------------------------

◆ Spawning planner...
```

Build the planner prompt by inlining the concept data gathered in step 6. Replace each section below with the actual summary content from the corresponding MegaMemory query:

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
Include the state concept's summary here — the JSON with current_phase, status, progress, and last_activity so the planner knows where the project stands.

**Roadmap:**
Include the roadmap concept's summary here so the planner understands the overall project structure and phase sequence.

**Requirements (if exists):**
Include all requirement concept summaries here (each has description and status). Omit this section if no requirements were found.

**Phase Context (if exists):**
Include the context concept's summary here (gathered items, decisions, deferred items, phase_boundary). Omit if none found.

**Research (if exists):**
Include the research concept's summary here (domain-specific findings). Omit if research was skipped or not found.

**Gap Closure (if --gaps mode):**
Include the UAT concept's summary here (gaps and findings). Omit entirely if not in --gaps mode.

</planning_context>

<downstream_consumer>
Output consumed by /fuska-execute-phase

Plans must be executable prompts with:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification

Use MegaMemory:
- Create plan concepts: PhaseConceptTemplates.createPlan()
- Reference patterns from MegaMemory: megamemory:understand()
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] Plan concepts created in MegaMemory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
- [ ] Patterns referenced from MegaMemory (if found)
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Plan Phase {phase} with MegaMemory"
)
```

## 8. Handle Planner Return

Parse planner output:

**`## PLANNING COMPLETE`:**
- Display: `Planner created {N} plan(s). Concepts created in MegaMemory.`
- If `--skip-verify`: Skip to step 13
- If `shouldPlanCheck` is `false`: Skip to step 13
- Otherwise: Proceed to step 10

**`## CHECKPOINT REACHED`:**
- Present to user, get response, spawn continuation (see step 12)

**`## PLANNING INCONCLUSIVE`:**
- Show what was attempted
- Offer: Add context, Retry, Manual
- Wait for user response

## 9. Query Plans for Verification

**Step 9.1: Query all plans for this phase**

Call:
```
megamemory_understand(query=`${phaseSlug}-plan`, top_k=20)
```

**Step 9.2: Check for plans**

If response.matches.length === 0:
→ Display: "No plan concepts found for verification"
→ Suggest: "Plans may not have been created. Check previous step output."
→ Stop

**Step 9.3: Extract plan summaries**

If response.matches.length > 0:
```
const planConcepts = response.matches.map(match => {
  const planSummaryString = match.summary
  const planData = JSON.parse(planSummaryString)
  return {
    id: match.id,
    name: match.name,
    wave: planData.wave,
    dependsOn: planData.depends_on,
    filesModified: planData.files_modified,
    autonomous: planData.autonomous,
    objective: planData.objective,
    tasks: planData.tasks,
    mustHaves: planData.must_haves
  }
})
```

**Step 9.4: Query requirements**

Call:
```
megamemory_understand(query="requirements", top_k=50)
```

**Step 9.5: Extract requirement summaries**

If response.matches.length > 0:
```
const requirementConcepts = response.matches.map(match => {
  const reqSummaryString = match.summary
  const reqData = JSON.parse(reqSummaryString)
  return {
    id: match.id,
    description: reqData.description,
    status: reqData.status
  }
})
```

All extracted data is used to build the checker prompt in step 10.

## 10. Spawn fuska-plan-checker-panel Agent

**Step 10.1: Display stage banner**

```
-----------------------------------------------------
 Fuska ► VERIFYING PLANS
-----------------------------------------------------

 ◆ Spawning plan checker panel...
```

**Step 10.2: Build panel prompt**

Use the data extracted in step 9 (planConcepts and requirementConcepts), phaseData from step 3, and checker_panel from step 1:

```markdown
<verification_context>

**Phase:** ${phaseNumber}
**Phase Goal:** ${phaseGoal}

**Plans to verify:**
${planConcepts.map(plan => `### ${plan.name}
- Wave: ${plan.wave}
- Depends on: ${plan.dependsOn.join(', ') || 'None'}
- Files: ${plan.filesModified.join(', ')}
- Autonomous: ${plan.autonomous}
- Objective: ${plan.objective}
- Tasks: ${plan.tasks ? plan.tasks.map(t => `- ${t}`).join('\n') : 'No tasks'}
- Must haves: ${JSON.stringify(plan.mustHaves, null, 2)}\n`).join('\n')}

**Requirements (if any):**
${requirementConcepts.map(req => `- ${req.description} (${req.status})`).join('\n') || 'No requirements'}

</verification_context>

<checker_panel>
Base: quality-advocate (always)
Contextual: ${checkerPanel.contextual || 'none'}
Expert: dynamic (derived from plan content)

Project Classification:
- Type: ${projectClassification.type}
- Confidence: ${projectClassification.confidence}
- Signals: ${projectClassification.signals.join(', ')}
</checker_panel>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list with cross-validation badges
</expected_output>
```

**Step 10.3: Spawn panel orchestrator**

```
Task(
  description="Verify Phase ${phaseNumber} plans (panel)",
  subagent_type="fuska-plan-checker-panel",
  model=checkerModel,
  prompt=panelPrompt
)
```

## 11. Handle Checker Return

**If `## VERIFICATION PASSED`:**
- Display: `Plans verified. Ready for execution.`
- Proceed to step 13

**If `## ISSUES FOUND`:**
- Display: `Checker found issues:`
- List issues from checker output
- Check iteration count
- Proceed to step 12

## 12. Revision Loop (Max 3 Iterations)

Track: `iteration_count` (starts at 1 after initial plan + check)

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Retrieve the current plans for revision context using `megamemory:understand` — query "{PHASE}-plan", top_k=20.
Each plan concept summary has: `wave`, `depends_on`, `files_modified`, `autonomous`, `objective`, `tasks`, `must_haves`.
Collect all plan summaries so the planner can see what needs revision.

Build the revision prompt by inlining the plans and checker issues:

```markdown
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

**Existing plans:**
Include all current plan concept summaries here so the planner can see the plans that need revision.

**Checker issues:**
Include the structured issues from the checker's output here so the planner knows exactly what to fix.

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.

Use MegaMemory:
- Update plan concepts: megamemory:update_concept()
- Reference patterns from MegaMemory for solutions

Return what changed.
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

- After planner returns → spawn checker again (step 10)
- Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:`

List remaining issues.

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit planning)

Wait for user response.

## 13. Update State Concept

**Step 13.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 13.2: Check state exists**

If response.matches.length === 0:
→ Display: "State concept not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 13.3: Extract state data**

If response.matches.length > 0:
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

**Step 13.4: Build updated state data**

```
const updatedStateData = {
  ...stateData,
  current_phase: phaseSlug,
  status: "ready_to_execute",
  last_activity: `Phase ${phaseNumber} planned`
}
```

**Step 13.5: Update state concept**

Call:
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

Note: The `changes` parameter only accepts these fields: `summary`, `name`, `kind`, `why`, `file_refs` — do NOT pass `parent_id` or `edges`.

## 14. Present Final Status

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
-----------------------------------------------------
  Fuska: Phase {X} planned
-----------------------------------------------------

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

──────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase {X}** — run all {N} plans
/fuska-execute-phase {X}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Review plans in MegaMemory: search for "{PHASE}-plan" to see all plan concepts
- /fuska-plan-phase {X} --research — re-research first
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Phase validated against roadmap (phase concept exists)
- [ ] Research completed (unless --skip-research or --gaps or exists)
- [ ] Research concept created if needed
- [ ] Existing plan concepts checked
- [ ] fuska-planner spawned with MegaMemory context
- [ ] Plan concepts created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] fuska-plan-checker spawned (unless --skip-verify)
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] User sees status between agent spawns
- [ ] State concept updated with planning status
- [ ] User knows next steps (execute or review)

</success_criteria>
