---
name: fuska-do
description: Execute unplanned tasks with mode-aware agent chain using MegaMemory
argument-hint: "[mode] [description]"
tools:
  - read
  - write
  - edit
  - glob
  - grep
  - bash

  - question
  - task
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>

Execute unplanned, ad-hoc tasks with Fuska guarantees (atomic commits, state tracking) using a mode-aware agent chain.

- Flexible mode selection: planned | checked | researched | verified
- Auto-executes for planned/verified; asks before executing for checked/researched
- Override auto-execute behavior with --ask or --auto flag
- Suggests project creation if no project exists

</objective>

<execution_context>

@../../fuska/references/preflight-check-project-exists.md

Orchestration is inline. Mode determines which agents spawn.

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\",\"tasks_completed\":[...]}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>
Arguments: `$ARGUMENTS`
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

---

## 0.5. Help Check

If `$ARGUMENTS` starts with "help" (case-insensitive):

```
const input = "$ARGUMENTS" || ""
if (input.trim().toLowerCase().startsWith("help")) {
  Display:
  Help for /fuska-do:

  Execute unplanned tasks with mode-aware agent chain.

  Usage: /fuska-do [mode] [description]

  Modes:
    planned    - Planner → Executor | Auto | You have a plan, just execute it
    checked    - Planner → Plan Checker → Executor | Ask | Plan gets validated, you review before execution
    researched - Researcher → Planner → Plan Checker → Executor | Ask | Research adds context, review before committing
    verified   - Researcher → Planner → Plan Checker → Executor → Verifier | Auto | Full pipeline with post-execution verification

  Flags:
    --ask      Override to ask before executing (any mode)
    --auto     Override to auto-execute (any mode)

  -> Stop
}
```

---

## 1. Load All Context (Single Pass)

Query MegaMemory for all needed concepts upfront. All subsequent steps use these cached results — NO additional queries for data already loaded here.

**Step 1.1: Query config**

```
megamemory_understand(query="config", top_k=5)
```

If response.matches.length === 0:
-> Display: "No initiative found. Run `fuska init` first."
-> If DESCRIPTION available from arguments, add: "When prompted, describe: {DESCRIPTION}"
-> Stop

Extract:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
const modelProfile = configData.model_profile || "balanced"
```

**Step 1.1a: Check for debug context**

Check if prompt contains `<debug_findings>`:
```
const hasDebugContext = prompt.includes('<debug_findings>')
```

If debug context present:
- Extract from `<debug_findings>`: root_cause, evidence, fix_complexity, suggested_fix, files_involved, session_id
- Set DESCRIPTION = suggested_fix (unless provided in arguments)
- Store debug_session_id for linking

**Step 1.2: Query state**

```
megamemory_understand(query="state", top_k=5)
```

If response.matches.length === 0:
-> Display: "State concept not found. Run `fuska init` to initialize initiative."
-> Stop

Extract:
```
const stateId = response.matches[0].id
const stateData = JSON.parse(response.matches[0].summary)
```

**Step 1.3: Query existing tasks**

```
megamemory_understand(query="task", top_k=50)
```

Extract existing task numbers for incrementing.

All context now cached. No re-querying in later steps.

---

## 2. Parse Arguments and Resolve Mode

**Step 2.1: Parse arguments**

```
const input = "$ARGUMENTS" || ""
const validModes = ["planned", "checked", "researched", "verified"]
const words = input.trim().split(/\s+/)

let MODE = null
let DESCRIPTION = null

const hasNoReviewFlag = input.includes("--no-review")
const hasAskFlag = input.includes("--ask")
const hasAutoFlag = input.includes("--auto")
const flagPattern = /--(?:no-review|ask|auto)/gi

if (validModes.includes(words[0]?.toLowerCase())) {
  MODE = words[0].toLowerCase()
  DESCRIPTION = words.slice(1).join(" ").replace(flagPattern, '').trim() || null
} else {
  // No mode specified - entire argument is description
  DESCRIPTION = input.replace(flagPattern, '').trim() || null
}
```

**Step 2.2: Resolve mode**

If MODE is not set, ALWAYS ask the user to select one:

```
if (!MODE) {
  const modeResponse = question(questions=[{
    header: "Mode",
    question: "Select workflow mode:",
    options: [
      { label: "Planned", description: "Planner → Executor. Auto-execute. You have a plan, just execute it." },
      { label: "Checked", description: "Planner → Plan Checker → Executor. Ask first. Plan gets validated before execution." },
      { label: "Researched", description: "Researcher → Planner → Plan Checker → Executor. Ask first. Research adds context." },
      { label: "Verified", description: "Full pipeline with Verifier. Auto-execute. Critical systems, production code." }
    ]
  }])
  MODE = modeResponse[0].toLowerCase()
}
```

**Step 2.3: Get description if missing**

If DESCRIPTION is null or empty:
```
const taskResponse = question(questions=[{
  header: "Task",
  question: "What do you want to do?",
  options: []
}])
DESCRIPTION = taskResponse[0]
```

**Step 2.4: Derive mode config**

```
let modeConfig = {
  planned:    { research: false, planCheck: false, verifier: false, autoExecute: true },
  checked:    { research: false, planCheck: true,  verifier: false, autoExecute: false },
  researched: { research: true,  planCheck: true,  verifier: false, autoExecute: false },
  verified:   { research: true,  planCheck: true,  verifier: true,  autoExecute: true }
}[MODE]

// Override autoExecute if --ask or --auto flag provided
if (hasAskFlag) {
  modeConfig.autoExecute = false
} else if (hasAutoFlag) {
  modeConfig.autoExecute = true
}

// Override if debug context present (investigation already done)
if (hasDebugContext) {
  modeConfig.research = false
}
```

**Step 2.5: Resolve models from lookup table**

First, extract model aliases from config (with defaults):

```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}
```

**Model lookup table (uses aliases):**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-phase-researcher | quality_model | balanced_model | budget_model |
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |
| fuska-executor | quality_model | balanced_model | balanced_model |
| fuska-verifier | balanced_model | balanced_model | budget_model |

```
const modelLookup = {
  quality: {
    researcher: aliases.quality_model,
    planner: aliases.quality_model,
    checker: aliases.balanced_model,
    executor: aliases.quality_model,
    verifier: aliases.balanced_model
  },
  balanced: {
    researcher: aliases.balanced_model,
    planner: aliases.quality_model,
    checker: aliases.balanced_model,
    executor: aliases.balanced_model,
    verifier: aliases.balanced_model
  },
  budget: {
    researcher: aliases.budget_model,
    planner: aliases.balanced_model,
    checker: aliases.budget_model,
    executor: aliases.balanced_model,
    verifier: aliases.budget_model
  }
}

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
  .filter(match => match.name.match(/^task-\d+-/))
  .map(match => {
    const matchResult = match.name.match(/^task-(\d+)-/)
    return matchResult ? parseInt(matchResult[1]) : 0
  })
  .sort((a, b) => b - a)

const lastNumber = existingNumbers[0] || 0
const nextNum = (lastNumber + 1).toString().padStart(3, '0')
```

If no existing tasks: `nextNum = "001"`

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
    current_phase: stateData?.current_phase
  },
  tasks: [],
  wave: 1,
  depends_on: [],
  files_modified: [],
  autonomous: false,
  debug_context: hasDebugContext ? {
    session_id: debug_session_id,
    root_cause: root_cause,
    complexity: fix_complexity
  } : null
}
```

**Step 4.2: Create plan concept**

```
const planResult = megamemory_create_concept(
  name=`task-${nextNum}-${slug}`,
  kind="feature",
  summary=JSON.stringify(planData),
  why="Task plan",
  parent_id=null
)
const planConceptId = planResult.id

**Step 4.3: Display**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK ${nextNum}: ${DESCRIPTION}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mode: ${MODE} | Plan: task-${nextNum}-${slug}
```

**Step 4.3: Display**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK ${nextNum}: ${DESCRIPTION}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mode: ${MODE} | Plan: task-${nextNum}-${slug}
```

---

## 5. Spawn Researcher (if modeConfig.research)

Only for researched, verified modes.

Display: `Researching...`

**Step 5.1: Build researcher prompt (adapted for quick tasks)**

```
const researcherPrompt = `<critical_constraints>
Return: ## RESEARCH COMPLETE with key findings
Create concept with name="task-${nextNum}-${slug}-research", kind="pattern"
Keep research focused and concise — this is a standalone task, not a full phase
</critical_constraints>

<objective>
Research how to implement: ${DESCRIPTION}

Answer: "What do I need to know to PLAN this task well?"
This is a standalone task, not a full phase. Focus on:
- Relevant patterns in the existing codebase
- Key libraries or APIs needed
- Common pitfalls for this type of task
</objective>

<context>
**Task:** ${DESCRIPTION}
**Project State:** ${JSON.stringify(stateData, null, 2)}
</context>

<output>
Create research concept:
megamemory_create_concept(
  name="task-${nextNum}-${slug}-research",
  kind="pattern",
  summary=JSON.stringify(researchFindings),
  why="Research for task ${nextNum}",
  parent_id=null
)
</output>`
```

**Step 5.2: Spawn researcher**

```
Task(
  prompt=researcherPrompt,
  subagent_type="fuska-phase-researcher",
  model=models.researcher,
  description="Research: ${DESCRIPTION}"
)
```

**Step 5.3: Handle researcher return**

If `## RESEARCH COMPLETE`:
-> Query research concept:
```
megamemory_understand(query=`task-${nextNum}-${slug}-research`, top_k=1)
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
const plannerPrompt = `<critical_constraints>
Create a SINGLE plan with 1-3 focused tasks
Quick tasks MUST be atomic and self-contained
Target ~30% context usage (simple, focused)
Each task needs: files, action, verify, done
Return: ## PLANNING COMPLETE with task list
</critical_constraints>

<planning_context>

**Mode:** ${MODE}
**Task Number:** ${nextNum}
**Description:** ${DESCRIPTION}
**Plan Concept ID:** ${planConceptId}

**Project State:**
${JSON.stringify(stateData, null, 2)}

${researchData ? `**Research Findings:**\n${JSON.stringify(researchData, null, 2)}` : ''}

${hasDebugContext ? `<debug_findings>
**Root Cause:** ${root_cause}
**Evidence:** ${evidence}
**Fix Complexity:** ${fix_complexity}
**Suggested Fix:** ${suggested_fix}
**Files Involved:** ${files_involved}
**Debug Session ID:** ${debug_session_id}
</debug_findings>

<instruction>
Research is complete (debug investigation done). Use these findings directly - no additional research needed.
</instruction>` : ''}

</planning_context>

<output>
Update plan concept: ${planConceptId}
Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlanData)})
</output>`
```

**Step 6.2: Spawn planner**

```
Task(
  prompt=plannerPrompt,
  subagent_type="fuska-planner",
  model=models.planner,
  description="Plan: ${DESCRIPTION}"
)
```

**Step 6.3: Handle planner return**

If `## PLANNING COMPLETE`:
-> Display: "Plan created: task-${nextNum}-${slug}"
-> Continue to Step 7

If error:
-> Display: "Planner failed to create plan"
-> Stop

---

## 7. Spawn Plan-Checker + Revision Loop (if modeConfig.planCheck)

Only for checked, researched, verified modes.

Display: `Validating plan...`

**Step 7.1: Query updated plan concept**

```
megamemory_understand(query=`task-${nextNum}-${slug}`, top_k=5)
const planData = JSON.parse(response.matches[0].summary)
```

**Step 7.2: Build checker prompt (simplified for standalone tasks)**

```
const checkerPrompt = `<critical_constraints>
Return one of:
- ## VERIFICATION PASSED -- plan is ready
- ## ISSUES FOUND -- structured issue list with fix hints
Skip phase-specific checks (requirement coverage, dependency graph, must_haves derivation, context compliance). This is a standalone task, not a phase plan.
</critical_constraints>

<verification_context>

**Task:** ${DESCRIPTION}
**Plan Data:** ${JSON.stringify(planData, null, 2)}

Verify this task plan. Focus on:
1. Task completeness: Does every task have files, action, verify, done?
2. Scope sanity: Are there 1-3 tasks? Would they complete in ~30% context?

</verification_context>`
```

**Step 7.3: Spawn checker**

```
Task(
  prompt=checkerPrompt,
  subagent_type="fuska-plan-checker",
  model=models.checker,
  description="Check: ${DESCRIPTION}"
)
```

**Step 7.4: Handle checker return + revision loop**

Track: `iterationCount = 1`
Track: `issuesHistory = []`

If `## VERIFICATION PASSED`:
-> Output the checker's full response (contains verified plans JSON)
-> Append orchestrator summary:
   - **Iterations:** {iterationCount}
   - **What Was Fixed:** {1 paragraph summary of issues raised and addressed, if iterations > 1}
-> Continue to Step 8

If `## ISSUES FOUND`:

```
Store issues in issuesHistory for summary generation

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
    subagent_type="fuska-planner",
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

const proceedResponse = question(questions=[{
  header: "Plan Issues",
  question: "How to proceed?",
  options: [
    { label: "Proceed anyway", description: "Execute despite remaining issues" },
    { label: "Provide guidance", description: "I'll give direction for another attempt" },
    { label: "Abort", description: "Cancel this task" }
  ]
}])
```

---

## 8. Plan Review

**Step 8.1: Query and display plan (ALWAYS)**

```
megamemory_understand(query=`task-${nextNum}-${slug}`, top_k=5)
const planData = JSON.parse(response.matches[0].summary)
```

Display format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TASK ${nextNum}: ${DESCRIPTION}
 Mode: ${MODE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Objective
${planData.objective || DESCRIPTION}

## Purpose
${planData.purpose || 'N/A'}

## Output
${planData.output || 'N/A'}

## Files to Modify
${planData.files_modified?.map(f => `- ${f}`).join('\n') || 'TBD'}

## Tasks (${planData.tasks?.length || 0})

${planData.tasks?.map((t, i) => `
### Task ${i+1}: ${t.name || 'Task ' + (i+1)}

**Files:**
- ${(Array.isArray(t.files) ? t.files : [t.files]).join('\n- ') || 'TBD'}

**Action:**
${t.action || t.description || 'N/A'}

**Verify:**
${t.verify || 'N/A'}

**Done:**
${t.done || 'N/A'}
`).join('\n') || 'No tasks defined'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Step 8.2: Check review mode**

```
const skipReview = hasNoReviewFlag || configData?.workflow?.interactive_review === false

if (skipReview) {
  // Skip to Step 9 (execution)
  Continue to Step 9
}
```

**Step 8.3: Review Loop**

```
const reviewOptions = [
  { label: "Execute now", description: "Run the plan immediately" },
  { label: "Ask a question", description: "Discuss the plan before executing" },
  { label: "Modify the plan", description: "Make changes to tasks" },
  { label: "Save and exit", description: "Save for later execution" }
]

while (true) {
  const actionResponse = question(questions=[{
    header: "Plan Review",
    question: "What would you like to do with this plan?",
    options: reviewOptions
  }])

  if (actionResponse[0] === "Execute now") {
    break  // Continue to Step 9
  }

  if (actionResponse[0] === "Ask a question") {
    const questionResponse = question(questions=[{
      header: "Question",
      question: "What would you like to know about this plan?",
      options: []
    }])
    
    // Answer based on planData context
    // The LLM should answer the question using planData context
    
    // Re-display plan and re-enter loop
    continue
  }

  if (actionResponse[0] === "Modify the plan") {
    const modResponse = question(questions=[{
      header: "Modify",
      question: "What changes do you want to make?",
      options: []
    }])
    
    const feedback = modResponse[0]
    
    // Spawn planner with revision context
    const revisionPrompt = `<revision_context>
**Mode:** revision
**Task:** ${DESCRIPTION}
**Plan Concept ID:** ${planConceptId}
**Current plan:** ${JSON.stringify(planData, null, 2)}
**User feedback:** ${feedback}
</revision_context>

<instructions>
Update the plan to address user feedback.
Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>`

    Task(
      prompt=revisionPrompt,
      subagent_type="fuska-planner",
      model=models.planner,
      description="Revise: ${DESCRIPTION}"
    )
    
    // Re-query and re-display updated plan
    megamemory_understand(query=`task-${nextNum}-${slug}`, top_k=5)
    planData = JSON.parse(response.matches[0].summary)
    Re-display plan from Step 8.1
    continue
  }

  if (actionResponse[0] === "Save and exit") {
    Display: "Plan saved as task-${nextNum}-${slug}"
    Display: "Run `/fuska-do task-${nextNum}` to execute later."
    Skip to Step 12 (display only, no execution)
    return  // Exit process
  }
}

// After loop exits, continue to Step 9
```

---

## 9. Spawn Executor

Display: `Executing...`

**Step 9.1: Query plan concept (get planner's updates)**

```
megamemory_understand(query=`task-${nextNum}-${slug}`, top_k=5)
const planData = JSON.parse(response.matches[0].summary)
```

**Step 9.2: Build executor prompt**

```
const executorPrompt = `<critical_constraints>
Execute all tasks in the plan
Do NOT commit (commit happens at end of fuska-do, not during execution)
Create summary concept named exactly: task-${nextNum}-${slug}-summary (kind: "config")
Do NOT update roadmap concept (standalone tasks are separate from phases)
Return: ## EXECUTION COMPLETE
</critical_constraints>

Execute task ${nextNum}: ${DESCRIPTION}

Plan concept: task-${nextNum}-${slug}
Plan data: ${JSON.stringify(planData, null, 2)}
Project state: ${JSON.stringify(stateData, null, 2)}

<output>
Create summary concept:
megamemory_create_concept(
  name="task-${nextNum}-${slug}-summary",
  kind="config",
  summary=JSON.stringify(summaryData),
  why="Task ${nextNum} execution summary"
)
</output>`
```

**Step 9.3: Spawn executor**

```
Task(
  prompt=executorPrompt,
  subagent_type="fuska-executor",
  model=models.executor,
  description="Execute: ${DESCRIPTION}"
)
```

**Step 9.4: Handle executor return**

If `## EXECUTION COMPLETE`:
-> Continue to Step 9.5

If error:
-> Display: "Execution failed"
-> Stop

---

## 9.5. Generate Commit Message

**Step 9.5.1: Get staged changes**

```
bash("git diff HEAD", description="Get all changes for commit message")
const diffOutput = result
```

If diff is empty:
-> Display: "No changes detected. Skipping commit."
-> Set `generatedCommitMessage = null`
-> Skip to Step 10

**Step 9.5.2: Spawn git-message agent**

```
const gitMessagePrompt = `<task_context>
**Task Number:** task-${nextNum}
**Description:** ${DESCRIPTION}
**Mode:** ${MODE}
**Plan:** ${JSON.stringify(planData, null, 2)}
</task_context>

<diff>
${diffOutput}
</diff>

<trailer_format>
Trailer: task-${nextNum}
</trailer_format>

Generate a commit message following Fuska format:
- type(scope): description
- 2-4 bullet points
- Trailer line: task-${nextNum}

Return ONLY the commit message, nothing else.`

Task(
  prompt=gitMessagePrompt,
  subagent_type="fuska-git-message",
  description="Generate commit message"
)
```

**Step 9.5.3: Store generated message**

```
generatedCommitMessage = agentOutput.trim()
```

-> Continue to Step 10

---

## 10. Spawn Verifier (if modeConfig.verifier)

Only for verified mode.

Display: `Verifying...`

**Step 10.1: Build verifier prompt (adapted for quick task)**

```
const verifierPrompt = `<critical_constraints>
Return: ## Verification Complete with status: passed | gaps_found
Create concept named: task-${nextNum}-${slug}-verification
</critical_constraints>

<verification_context>
Verify task ${nextNum}: ${DESCRIPTION}

**Plan concept:** task-${nextNum}-${slug}
**Summary concept:** task-${nextNum}-${slug}-summary

Verify the task achieved its goal:
1. Check that committed files exist and are substantive (not stubs)
2. Check that the task description was fulfilled
3. Create a verification record

Create concept:
megamemory_create_concept(
  name="task-${nextNum}-${slug}-verification",
  kind="component",
  summary=JSON.stringify(verificationData),
  why="Verification for task ${nextNum}"
)

</verification_context>`
```

**Step 10.2: Spawn verifier**

```
Task(
  prompt=verifierPrompt,
  subagent_type="fuska-verifier",
  model=models.verifier,
  description="Verify: ${DESCRIPTION}"
)
```

**Step 10.3: Handle verifier return**

If "passed" -> continue to Step 11
If "gaps_found" -> display gaps, continue to Step 11 (don't block completion for quick tasks)

---

## 11. Update State Concept

Skip if user chose "Save and exit" at Step 8 and no execution happened.

```
stateData.tasks_completed = stateData.tasks_completed || []
stateData.tasks_completed.push({
  number: nextNum,
  description: DESCRIPTION,
  date: new Date().toISOString().split('T')[0],
  commit: finalCommitHash || null,
  plan_concept: `task-${nextNum}-${slug}`,
  mode: MODE
})

megamemory_update_concept(
  id=stateId,
  changes={ summary: JSON.stringify(stateData) }
)
```

---

## 11.5. Commit Confirmation

Skip if `generatedCommitMessage` is null (no changes to commit).

**Step 11.5.1: Display generated commit message**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Generated Commit Message:
───────────────────────────────────────────────────
${generatedCommitMessage}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Step 11.5.2: Prompt user for action**

```
const commitResponse = question(questions=[{
  header: "Commit",
  question: "How would you like to proceed with this commit?",
  options: [
    { label: "Commit now", description: "Commit with the generated message" },
    { label: "Edit first", description: "Edit the message before committing" },
    { label: "Skip", description: "Leave changes uncommitted" }
  }
}])
```

**Step 11.5.3: Handle response**

If "Commit now":
```
bash("git add -A && git commit -m '${generatedCommitMessage}'", description="Commit all changes")
const commitOutput = result
const commitMatch = commitOutput.match(/\[[\w-]+ ([a-f0-9]+)\]/) || commitOutput.match(/([a-f0-9]{7,})/)
finalCommitHash = commitMatch ? commitMatch[1] : "committed"
```

If "Edit first":
```
const editResponse = question(questions=[{
  header: "Edit Message",
  question: "Enter your commit message (or leave blank to cancel):",
  options: []
}])
if (editResponse[0]?.trim()) {
  bash("git add -A && git commit -m '${editResponse[0]}'", description="Commit with edited message")
  finalCommitHash = "committed"
} else {
  finalCommitHash = null
}
```

If "Skip":
```
finalCommitHash = null
```

---

## 12. Display Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Task ${nextNum}: ${DESCRIPTION}
 Mode: ${MODE}
 Plan: task-${nextNum}-${slug}
 Commit: ${finalCommitHash || "(uncommitted)"}
 ${verification ? `Verification: ${verificationStatus}` : ''}
 ${!finalCommitHash ? '\n Note: Changes staged but not committed. Run: git commit' : ''}

───────────────────────────────────────────────────
 Ready for next task: /fuska-do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
stateData.tasks_completed = stateData.tasks_completed || []
stateData.tasks_completed.push({
  number: nextNum,
  description: DESCRIPTION,
  date: new Date().toISOString().split('T')[0],
  commit: commitHash,
  plan_concept: `task-${nextNum}-${slug}`,
  mode: MODE
})

megamemory_update_concept(
  id=stateId,
  changes={ summary: JSON.stringify(stateData) }
)
```

---

## 12. Display Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Task ${nextNum}: ${DESCRIPTION}
 Mode: ${MODE}
 Plan: task-${nextNum}-${slug}
 Commit: ${commitHash}
 ${verification ? `Verification: ${verificationStatus}` : ''}

───────────────────────────────────────────────────
 Ready for next task: /fuska-do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Task ${nextNum}: ${DESCRIPTION}
 Mode: ${MODE}
 Plan: task-${nextNum}-${slug}
 Commit: ${commitHash}
 ${verification ? `Verification: ${verificationStatus}` : ''}

────────────────────────────────────────────────────
 Ready for next task: /fuska-do
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
- [ ] Researcher spawned for research modes (researched/verified)
- [ ] Research concept created (kind: pattern) if researched
- [ ] Planner spawns with mode-appropriate constraints
- [ ] Plan-checker spawned for check modes (checked/researched/verified)
- [ ] Revision loop works (max 3 iterations)
- [ ] Auto-execute for planned/verified modes (overridable with --ask)
- [ ] Ask-before-execute for checked/researched modes (overridable with --auto)
- [ ] Plan displayed before asking for execution decision
- [ ] Change plan option: feedback collected, planner re-spawned, plan re-displayed
- [ ] Save and exit option: plan saved with execution command shown
- [ ] Executor spawns and creates summary concept (no commit during execution)
- [ ] Git-message agent spawned to generate commit message
- [ ] Commit message displayed with Commit now / Edit first / Skip options
- [ ] Commit executed only on user confirmation
- [ ] Verifier spawned for verified mode
- [ ] State concept updated with task entry (including commit hash if committed)
- [ ] Completion banner displayed with commit status

</success_criteria>
