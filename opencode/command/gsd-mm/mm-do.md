---
name: gsd-mm-do
description: Execute unplanned tasks with mode-aware agent chain using MegaMemory (replaces /gsd-mm-quick)
argument-hint: "[mode] [description]"
tools:
  - read
  - write
  - edit
  - glob
  - grep
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>

Execute unplanned, ad-hoc tasks with GSD-MM guarantees (atomic commits, state tracking) using a mode-aware agent chain.

- Replaces `/gsd-mm-quick` with flexible mode selection
- Respects workflow modes: direct | quick | fast | balanced | thorough | standard
- Auto-executes for quick/fast/standard; asks before executing for direct/balanced/thorough
- Suggests project creation if no project exists

</objective>

<execution_context>

@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md

Orchestration is inline. Mode determines which agents spawn.

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\",\"quick_tasks_completed\":[...]}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>
```
megamemory_understand(query="state", top_k=5)
```
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

---

## 1. Load All Context (Single Pass)

Query MegaMemory for all needed concepts upfront. All subsequent steps use these cached results — NO additional queries for data already loaded here.

**Step 1.1: Query config**

```
megamemory_understand(query="config", top_k=5)
```

If response.matches.length === 0:
-> Display: "No project found. Run `/gsd-mm-new-project` first."
-> If DESCRIPTION available from arguments, add: "When prompted, describe: {DESCRIPTION}"
-> Stop

Extract:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
const modelProfile = configData.model_profile || "balanced"
```

**Step 1.2: Query state**

```
megamemory_understand(query="state", top_k=5)
```

If response.matches.length === 0:
-> Display: "State concept not found. Run `/gsd-mm-new-project` to initialize project."
-> Stop

Extract:
```
const stateId = response.matches[0].id
const stateData = JSON.parse(response.matches[0].summary)
```

**Step 1.3: Query existing quick tasks**

```
megamemory_understand(query="quick task", top_k=50)
```

Extract existing task numbers for incrementing.

All context now cached. No re-querying in later steps.

---

## 2. Parse Arguments and Resolve Mode

**Step 2.1: Parse $ARGUMENTS**

```
const validModes = ["direct", "quick", "fast", "balanced", "thorough", "standard"]
const words = $ARGUMENTS.trim().split(/\s+/)

let MODE = null
let DESCRIPTION = null

if (validModes.includes(words[0]?.toLowerCase())) {
  MODE = words[0].toLowerCase()
  DESCRIPTION = words.slice(1).join(" ") || null
} else {
  // No mode specified - entire argument is description
  DESCRIPTION = $ARGUMENTS.trim() || null
}
```

**Step 2.2: Resolve mode**

```
if (!MODE) {
  MODE = configData.workflow?.mode || "quick"
}
```

**Step 2.3: Get description if missing**

If DESCRIPTION is null or empty:
```
question(
  header: "Task",
  question: "What do you want to do?"
)
DESCRIPTION = response
```

**Step 2.4: Derive mode config**

```
const modeConfig = {
  direct:   { research: false, planCheck: false, verifier: false, autoExecute: false },
  quick:    { research: false, planCheck: false, verifier: false, autoExecute: true },
  fast:     { research: false, planCheck: true,  verifier: false, autoExecute: true },
  balanced: { research: true,  planCheck: false, verifier: false, autoExecute: false },
  thorough: { research: true,  planCheck: true,  verifier: false, autoExecute: false },
  standard: { research: true,  planCheck: true,  verifier: true,  autoExecute: true }
}[MODE]
```

**Step 2.5: Resolve models from lookup table**

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-mm-phase-researcher | opus | sonnet | haiku |
| gsd-mm-planner | opus | opus | sonnet |
| gsd-mm-plan-checker | sonnet | sonnet | haiku |
| gsd-mm-executor | opus | sonnet | sonnet |
| gsd-mm-verifier | sonnet | sonnet | haiku |

```
const models = modelLookup[modelProfile]  // { researcher, planner, checker, executor, verifier }
```

Display: `Mode: ${MODE} | Profile: ${modelProfile}`

---

## 3. Generate Slug and Task Number

**Step 3.1: Generate slug**

```
slug = DESCRIPTION lowercase, replace non-alphanumeric with hyphens, collapse doubles, trim leading/trailing hyphens, max 40 chars
```

**Step 3.2: Calculate next number**

```
const existingNumbers = existingQuickTasks
  .filter(match => match.name.match(/^quick-\d+-/))
  .map(match => {
    const matchResult = match.name.match(/^quick-(\d+)-/)
    return matchResult ? parseInt(matchResult[1]) : 0
  })
  .sort((a, b) => b - a)

const lastNumber = existingNumbers[0] || 0
const nextNum = (lastNumber + 1).toString().padStart(3, '0')
```

If no existing quick tasks: `nextNum = "001"`

---

## 4. Create Plan Concept

**Step 4.1: Initialize plan data**

```
const planData = {
  task_number: nextNum,
  slug: slug,
  description: DESCRIPTION,
  mode: MODE,
  status: "planning",
  created_at: new Date().toISOString(),
  project_context: {
    current_phase: stateData?.current_phase,
    last_activity: stateData?.last_activity
  },
  tasks: [],
  wave: 1,
  depends_on: [],
  files_modified: [],
  autonomous: false
}
```

**Step 4.2: Create plan concept**

```
const planResult = megamemory_create_concept(
  name=`quick-${nextNum}-${slug}`,
  kind="feature",
  summary=JSON.stringify(planData),
  why="Quick task plan",
  parent_id=null
)
const planConceptId = planResult.id
```

**Step 4.3: Display**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > TASK ${nextNum}: ${DESCRIPTION}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mode: ${MODE} | Plan: quick-${nextNum}-${slug}
```

---

## 5. Spawn Researcher (if modeConfig.research)

Only for balanced, thorough, standard modes.

Display: `Researching...`

**Step 5.1: Build researcher prompt (adapted for quick tasks)**

```
const researcherPrompt = `<objective>
Research how to implement: ${DESCRIPTION}

Answer: "What do I need to know to PLAN this task well?"
This is a quick task, not a full phase. Focus on:
- Relevant patterns in the existing codebase
- Key libraries or APIs needed
- Common pitfalls for this type of task
Keep research focused and concise.
</objective>

<context>
**Task:** ${DESCRIPTION}
**Project State:** ${JSON.stringify(stateData, null, 2)}
</context>

<output>
Create research concept:
megamemory_create_concept(
  name="quick-${nextNum}-${slug}-research",
  kind="pattern",
  summary=JSON.stringify(researchFindings),
  why="Research for quick task ${nextNum}",
  parent_id=null
)
Return: ## RESEARCH COMPLETE with key findings
</output>`
```

**Step 5.2: Spawn researcher**

```
Task(
  prompt=researcherPrompt,
  subagent_type="gsd-mm-phase-researcher",
  model=models.researcher,
  description="Research: ${DESCRIPTION}"
)
```

**Step 5.3: Handle researcher return**

If `## RESEARCH COMPLETE`:
-> Query research concept:
```
megamemory_understand(query=`quick-${nextNum}-${slug}-research`, top_k=1)
const researchData = JSON.parse(response.matches[0].summary)
```
-> Continue to Step 6

If `## RESEARCH BLOCKED`:
-> Display blocker information
-> Use question tool:
  - header: "Research Blocked"
  - question: "How would you like to proceed?"
  - options: "Skip research" / "Provide context" / "Abort"
-> Handle accordingly

---

## 6. Spawn Planner

Display: `Planning...`

**Step 6.1: Build planner prompt**

```
const plannerPrompt = `<planning_context>

**Mode:** ${MODE}
**Task Number:** ${nextNum}
**Description:** ${DESCRIPTION}
**Plan Concept ID:** ${planConceptId}

**Project State:**
${JSON.stringify(stateData, null, 2)}

${researchData ? `**Research Findings:**\n${JSON.stringify(researchData, null, 2)}` : ''}

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
- Target ~30% context usage (simple, focused)
- Each task needs: files, action, verify, done
</constraints>

<output>
Update plan concept: ${planConceptId}
Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlanData)})
Return: ## PLANNING COMPLETE with task list
</output>`
```

**Step 6.2: Spawn planner**

```
Task(
  prompt=plannerPrompt,
  subagent_type="gsd-mm-planner",
  model=models.planner,
  description="Plan: ${DESCRIPTION}"
)
```

**Step 6.3: Handle planner return**

If `## PLANNING COMPLETE`:
-> Display: "Plan created: quick-${nextNum}-${slug}"
-> Continue to Step 7

If error:
-> Display: "Planner failed to create plan"
-> Stop

---

## 7. Spawn Plan-Checker + Revision Loop (if modeConfig.planCheck)

Only for fast, thorough, standard modes.

Display: `Validating plan...`

**Step 7.1: Query updated plan concept**

```
megamemory_understand(query=`quick-${nextNum}-${slug}`, top_k=5)
const planData = JSON.parse(response.matches[0].summary)
```

**Step 7.2: Build checker prompt (simplified for quick tasks)**

```
const checkerPrompt = `<verification_context>

**Task:** ${DESCRIPTION}
**Plan Data:** ${JSON.stringify(planData, null, 2)}

Verify this quick task plan. Focus on:
1. Task completeness: Does every task have files, action, verify, done?
2. Scope sanity: Are there 1-3 tasks? Would they complete in ~30% context?

Skip phase-specific checks (requirement coverage, dependency graph, must_haves derivation, context compliance). This is a quick task, not a phase plan.

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED -- plan is ready
- ## ISSUES FOUND -- structured issue list with fix hints
</expected_output>`
```

**Step 7.3: Spawn checker**

```
Task(
  prompt=checkerPrompt,
  subagent_type="gsd-mm-plan-checker",
  model=models.checker,
  description="Check: ${DESCRIPTION}"
)
```

**Step 7.4: Handle checker return + revision loop**

Track: `iterationCount = 1`

If `## VERIFICATION PASSED`:
-> Continue to Step 8

If `## ISSUES FOUND`:

```
while iterationCount < 3:
  Display: `Checker found issues. Revising... (${iterationCount}/3)`

  // Build revision prompt
  const revisionPrompt = `<revision_context>
  **Mode:** revision
  **Task:** ${DESCRIPTION}
  **Plan Concept ID:** ${planConceptId}
  **Current plan:** ${JSON.stringify(planData, null, 2)}
  **Checker issues:** [include checker output]
  </revision_context>

  <instructions>
  Make targeted updates to address checker issues.
  Do NOT replan from scratch.
  Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlan)})
  Return: ## REVISION COMPLETE
  </instructions>`

  Task(
    prompt=revisionPrompt,
    subagent_type="gsd-mm-planner",
    model=models.planner,
    description="Revise: ${DESCRIPTION}"
  )

  // Re-run checker (repeat step 7.2-7.3)
  iterationCount++
```

If iterationCount >= 3 and still issues:
```
Display: "Max iterations reached. Issues remain:"
List remaining issues

question(
  header: "Plan Issues",
  question: "How to proceed?",
  options: [
    { label: "Proceed anyway", description: "Execute despite remaining issues" },
    { label: "Provide guidance", description: "I'll give direction for another attempt" },
    { label: "Abort", description: "Cancel this task" }
  ]
)
```

---

## 8. Determine Execution

**Step 8.1: Branch by mode**

If `modeConfig.autoExecute` (quick, fast, standard):
-> Continue to Step 9

If `!modeConfig.autoExecute` (direct, balanced, thorough):
```
question(
  header: "Plan Ready",
  question: "Plan created. Execute now?",
  options: [
    { label: "Yes", description: "Execute the plan now" },
    { label: "No", description: "I'll review first" }
  ]
)
```

If "Yes" -> Continue to Step 9
If "No" -> Display: "Plan saved as quick-${nextNum}-${slug}. Run `/gsd-mm-execute-phase quick-${nextNum}` to execute later." -> Skip to Step 12 (display only, no state update)

---

## 9. Spawn Executor

Display: `Executing...`

**Step 9.1: Query plan concept (get planner's updates)**

```
megamemory_understand(query=`quick-${nextNum}-${slug}`, top_k=5)
const planData = JSON.parse(response.matches[0].summary)
```

**Step 9.2: Build executor prompt**

```
const executorPrompt = `Execute quick task ${nextNum}: ${DESCRIPTION}

Plan concept: quick-${nextNum}-${slug}
Plan data: ${JSON.stringify(planData, null, 2)}
Project state: ${JSON.stringify(stateData, null, 2)}

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary concept named exactly: quick-${nextNum}-${slug}-summary (kind: "config")
- Do NOT update roadmap concept (quick tasks are separate from phases)
</constraints>

<output>
Create summary concept:
megamemory_create_concept(
  name="quick-${nextNum}-${slug}-summary",
  kind="config",
  summary=JSON.stringify(summaryData),
  why="Quick task ${nextNum} execution summary"
)
Return: ## EXECUTION COMPLETE
Include: Commit: <hash>
</output>`
```

**Step 9.3: Spawn executor**

```
Task(
  prompt=executorPrompt,
  subagent_type="gsd-mm-executor",
  model=models.executor,
  description="Execute: ${DESCRIPTION}"
)
```

**Step 9.4: Handle executor return**

If `## EXECUTION COMPLETE`:
```
const commitMatch = executorOutput.match(/Commit:\s*([a-f0-9]+)/i)
const commitHash = commitMatch ? commitMatch[1] : "unknown"
```
-> Continue to Step 10

If error:
-> Display: "Execution failed"
-> Stop

---

## 10. Spawn Verifier (if modeConfig.verifier)

Only for standard mode.

Display: `Verifying...`

**Step 10.1: Build verifier prompt (adapted for quick task)**

```
const verifierPrompt = `<verification_context>
Verify quick task ${nextNum}: ${DESCRIPTION}

**Plan concept:** quick-${nextNum}-${slug}
**Summary concept:** quick-${nextNum}-${slug}-summary

Verify the task achieved its goal:
1. Check that committed files exist and are substantive (not stubs)
2. Check that the task description was fulfilled
3. Create a verification record

Create concept:
megamemory_create_concept(
  name="quick-${nextNum}-${slug}-verification",
  kind="component",
  summary=JSON.stringify(verificationData),
  why="Verification for quick task ${nextNum}"
)

Return: ## Verification Complete with status: passed | gaps_found
</verification_context>`
```

**Step 10.2: Spawn verifier**

```
Task(
  prompt=verifierPrompt,
  subagent_type="gsd-mm-verifier",
  model=models.verifier,
  description="Verify: ${DESCRIPTION}"
)
```

**Step 10.3: Handle verifier return**

If "passed" -> continue to Step 11
If "gaps_found" -> display gaps, continue to Step 11 (don't block completion for quick tasks)

---

## 11. Update State Concept

Skip if user chose "No" at Step 8 and no execution happened.

```
stateData.quick_tasks_completed = stateData.quick_tasks_completed || []
stateData.quick_tasks_completed.push({
  number: nextNum,
  description: DESCRIPTION,
  date: new Date().toISOString().split('T')[0],
  commit: commitHash,
  plan_concept: `quick-${nextNum}-${slug}`,
  mode: MODE
})
stateData.last_activity = `Quick task ${nextNum} completed: ${DESCRIPTION}`

megamemory_update_concept(
  id=stateId,
  changes={ summary: JSON.stringify(stateData) }
)
```

---

## 12. Display Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Quick Task ${nextNum}: ${DESCRIPTION}
 Mode: ${MODE}
 Plan: quick-${nextNum}-${slug}
 Commit: ${commitHash}
 ${verification ? `Verification: ${verificationStatus}` : ''}

────────────────────────────────────────────────────
 Ready for next task: /gsd-mm-do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<success_criteria>

- [ ] Preflight check passes (MegaMemory connectivity + project exists)
- [ ] Mode resolved (from argument, config, or default)
- [ ] Description obtained (from argument or prompted)
- [ ] Slug generated (lowercase, hyphens, max 40 chars)
- [ ] Task number calculated (001, 002, ...)
- [ ] Plan concept created with mode
- [ ] Researcher spawned for research modes (balanced/thorough/standard)
- [ ] Research concept created (kind: pattern) if researched
- [ ] Planner spawns with mode-appropriate constraints
- [ ] Plan-checker spawned for check modes (fast/thorough/standard)
- [ ] Revision loop works (max 3 iterations)
- [ ] Auto-execute for quick/fast/standard modes
- [ ] Ask-before-execute for direct/balanced/thorough modes
- [ ] Executor spawns and creates summary concept
- [ ] Commit hash captured from executor output
- [ ] Verifier spawned for standard mode
- [ ] State concept updated with quick task entry
- [ ] Completion banner displayed with all details

</success_criteria>
