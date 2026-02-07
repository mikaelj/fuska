---
name: gsd-mm-quick
description: Execute a quick task with GSD-MM guarantees (atomic commits, state tracking) but skip optional agents using MegaMemory
argument-hint: ""
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
Execute small, ad-hoc tasks with GSD-MM guarantees (atomic commits, state tracking) while skipping optional agents (research, plan-checker, verifier).

Quick mode is the same system with a shorter path:
- Spawns gsd-mm-planner (quick mode) + gsd-mm-executor(s)
- Skips gsd-mm-phase-researcher, gsd-mm-plan-checker, gsd-mm-verifier
- Quick tasks live as separate concepts from planned phases
- Updates state concept "Quick Tasks Completed" table (NOT roadmap concept)

Use when: You know exactly what to do and the task is small enough to not need research or verification.
</objective>

<execution_context>
@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
Orchestration is inline - no separate workflow file. Quick mode is deliberately simpler than full GSD-MM.
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

**Follow this process to execute quick tasks:**

## 0. Resolve Model Profile

**Step 0.1: Query config concept**

```
megamemory_understand(query="config", top_k=5)
```

**Step 0.2: Extract and parse config**

If response.matches.length > 0:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
const modelProfile = configData.model_profile || "balanced"
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-mm-planner | opus | opus | sonnet |
| gsd-mm-executor | opus | sonnet | sonnet |

Store resolved models for use in Task calls below.

---

## 1. Pre-flight Validation

**Step 1.1: Check MegaMemory has projects**

```
megamemory_list_roots()
```

If response.roots.length === 0:
→ Display: "Quick mode requires an active project"
→ Suggest: "Run /gsd-mm-new-project first"
→ Stop

**Step 1.2: Check for state concept**

```
megamemory_understand(query="state", top_k=5)
```

If response.matches.length === 0:
→ Display: "State concept not found"
→ Suggest: "Run /gsd-mm-new-project to initialize project"
→ Stop

**Step 1.3: Query roadmap concept**

```
megamemory_understand(query="roadmap", top_k=5)
```

If response.matches.length === 0:
→ Display: "Quick mode requires an active project with roadmap"
→ Suggest: "Run /gsd-mm-new-project first"
→ Stop

If validation fails, stop immediately with the error message.

Quick tasks can run mid-phase - validation only checks roadmap concept exists, not phase status.

---

## 2. Get Task Description

**Step 2.1: Prompt user interactively**

```
question(
  header: "Quick Task",
  question: "What do you want to do?",
  followUp: null
)
```

Store response as `$DESCRIPTION`.

If empty, re-prompt: "Please provide a task description."

**Step 2.2: Generate slug**

```bash
slug=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
```

---

## 3. Calculate Next Quick Task Number

**Step 3.1: Query existing quick task concepts**

```
megamemory_understand(query="quick task", top_k=50)
```

**Step 3.2: Extract existing numbers**

If response.matches.length > 0:
```
const existingNumbers = response.matches
  .filter(match => match.name.match(/^quick-\d+-/))
  .map(match => {
    const matchResult = match.name.match(/^quick-(\d+)-/)
    return matchResult ? parseInt(matchResult[1]) : 0
  })
  .sort((a, b) => b - a)

const lastNumber = existingNumbers[0] || 0
const nextNum = (lastNumber + 1).toString().padStart(3, '0')
```

If no existing quick tasks:
```
const nextNum = "001"
```

---

## 4. Create Quick Task Plan Concept

**Step 4.1: Query state concept for project context**

```
megamemory_understand(query="state", top_k=5)
if (response.matches.length > 0) {
  const stateSummaryString = response.matches[0].summary
  const stateData = JSON.parse(stateSummaryString)
}
```

**Step 4.2: Initialize plan data**

```
const planData = {
  task_number: nextNum,
  slug: slug,
  description: DESCRIPTION,
  mode: "quick",
  status: "planning",
  created_at: new Date().toISOString(),

  project_context: {
    current_phase: stateData?.current_phase,
    last_activity: stateData?.last_activity
  },

  tasks: [],  // Will be filled by planner
  wave: 1,
  depends_on: [],
  files_modified: [],
  autonomous: false
}
```

**Step 4.3: Create plan concept**

```
const planConceptResult = megamemory_create_concept(
  name=`quick-${nextNum}-${slug}`,
  kind="feature",
  summary=JSON.stringify(planData),
  why="Quick task plan",
  parent_id=null
)

const planConceptId = planConceptResult.id
```

**Step 4.4: Report to user**

```
Creating quick task ${nextNum}: ${DESCRIPTION}
Plan concept: quick-${nextNum}-${slug}
```

---

## 5. Spawn Planner (Quick Mode)

**Step 5.1: Query state concept**

```
megamemory_understand(query="state", top_k=5)
if (response.matches.length > 0) {
  const stateSummaryString = response.matches[0].summary
  const stateData = JSON.parse(stateSummaryString)
}
```

**Step 5.2: Build planner prompt**

```
const plannerPrompt = `<planning_context>

**Mode:** quick
**Task Number:** ${nextNum}
**Description:** ${DESCRIPTION}
**Plan Concept ID:** ${planConceptId}

**Project State:**
Include the state concept's summary here - the JSON with current_phase, status, progress, and last_activity so the planner knows where the project stands.

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
- No research phase, no checker phase
- Target ~30% context usage (simple, focused)
</constraints>

<output>
Update plan concept: ${planConceptId}
Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlanData)})
Return: ## PLANNING COMPLETE with plan details
</output>`
```

**Step 5.3: Spawn planner**

```
Task(
  prompt=plannerPrompt,
  subagent_type="gsd-mm-planner",
  model=plannerModel,
  description="Quick plan: ${DESCRIPTION}"
)
```

**Step 5.4: Handle planner return**

If planner returns "## PLANNING COMPLETE":
→ Display: "Plan created: quick-${nextNum}-${slug}"
→ Continue to step 6

If planner returns error:
→ Display: "Planner failed to create plan"
→ Stop

---

## 6. Spawn Executor

**Step 6.1: Query plan concept**

```
megamemory_understand(query=`quick-${nextNum}-${slug}`, top_k=5)
if (response.matches.length > 0) {
  const planSummaryString = response.matches[0].summary
  const planData = JSON.parse(planSummaryString)
  const planId = response.matches[0].id
}
```

**Step 6.2: Query state concept**

```
megamemory_understand(query="state", top_k=5)
if (response.matches.length > 0) {
  const stateSummaryString = response.matches[0].summary
  const stateData = JSON.parse(stateSummaryString)
}
```

**Step 6.3: Build executor prompt**

```
const executorPrompt = `Execute quick task ${nextNum}.

Plan concept: quick-${nextNum}-${slug}
Plan data: ${JSON.stringify(planData, null, 2)}
Project state: ${JSON.stringify(stateData, null, 2)}

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary concept: quick-${nextNum}-${slug}-summary
- Do NOT update roadmap concept (quick tasks are separate from planned phases)
</constraints>

<output>
Create summary concept with:
megamemory_create_concept(
  name="quick-${nextNum}-${slug}-summary",
  kind="config",
  summary=JSON.stringify(summaryData),
  why="Quick task summary"
)
Return: ## EXECUTION COMPLETE with commit hash
</output>`
```

**Step 6.4: Spawn executor**

```
Task(
  prompt=executorPrompt,
  subagent_type="gsd-mm-executor",
  model=executorModel,
  description="Execute: ${DESCRIPTION}"
)
```

**Step 6.5: Handle executor return**

If executor returns "## EXECUTION COMPLETE":
→ Extract commit hash from output
→ Display completion status
→ Continue to step 7

If executor returns error:
→ Display: "Executor failed"
→ Stop

---

## 7. Update State Concept

**Step 7.1: Query state concept**

```
megamemory_understand(query="state", top_k=5)
if (response.matches.length > 0) {
  const stateId = response.matches[0].id
  const stateSummaryString = response.matches[0].summary
  const stateData = JSON.parse(stateSummaryString)
}
```

**Step 7.2: Initialize quick tasks array if missing**

If !stateData.quick_tasks_completed:
```
stateData.quick_tasks_completed = []
```

**Step 7.3: Append new quick task entry**

```
stateData.quick_tasks_completed.push({
  number: nextNum,
  description: DESCRIPTION,
  date: new Date().toISOString().split('T')[0],
  commit: commitHash,
  plan_concept: `quick-${nextNum}-${slug}`
})
```

**Step 7.4: Update last activity**

```
stateData.last_activity = `Quick task ${nextNum} completed: ${DESCRIPTION}`
```

**Step 7.5: Update state concept**

```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(stateData)
  }
)
```

---

## 8. Display Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD-MM > QUICK TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quick Task ${nextNum}: ${DESCRIPTION}

Summary concept: quick-${nextNum}-${slug}-summary
Commit: ${commitHash}

────────────────────────────────────────────────────────

Ready for next task: /gsd-mm-quick

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<success_criteria>

- [ ] MegaMemory validation passes (roots exist)
- [ ] User provides task description
- [ ] Slug generated (lowercase, hyphens, max 40 chars)
- [ ] Next number calculated (001, 002, 003...)
- [ ] Plan concept created
- [ ] Planner creates plan tasks
- [ ] Executor executes tasks
- [ ] Summary concept created
- [ ] State concept updated with quick task entry
- [ ] Commit hash captured
- [ ] User knows completion status

</success_criteria>
