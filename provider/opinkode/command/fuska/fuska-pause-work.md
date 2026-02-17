---
name: fuska-pause-work
description: Create context handoff when pausing work mid-phase using MegaMemory
tools:
  - read
  - bash
  - task
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>
Create handoff concept to preserve complete work state across sessions using MegaMemory.

Enables seamless resumption in fresh session with full context restoration.
</objective>

<execution_context>
@../../fuska/references/preflight-check-project-exists.md
</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "phase-01", "name": "phase-01", "kind": "feature", "summary": "{\"name\":\"Foundation\",\"goal\":\"...\",\"status\":\"in_progress\"}", "children": [...], "edges": [...] } ] }
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

**Follow this process to create handoff concept:**

## 1. Detect Current Position

**Step 1.1: Query state concept**

```
megamemory_understand(query="state", top_k=5)
```

**Step 1.2: Check state exists**

If response.matches.length === 0:
→ Display: "State concept not found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 1.3: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const currentPhase = stateData.current_phase
const currentPlan = stateData.current_plan
const status = stateData.status
```

**Step 1.4: Validate work in progress**

If status === "phase_complete" OR status === "ready_to_plan":
→ Display: "No work in progress to pause"
→ Suggest: "Run /fuska-resume-work to see current status"
→ Stop

## 2. Extract Position from State

**Step 2.1: Get position from state (no calculation needed)**

From stateData extracted in step 1.3:
```
const currentTask = stateData.current_task || 1
const totalTasks = stateData.total_tasks || 0
const currentPhase = stateData.current_phase
const currentPlan = stateData.current_plan
```

**Step 2.2: Fallback if position missing (legacy)**

If current_task is undefined:
```
megamemory_understand(query=`${currentPhase}-summary`, top_k=20)
const completedCount = response.matches.length
const currentTask = completedCount + 1
```

**Step 2.3: Get phase/plan names**

If currentPhase exists:
```
megamemory_understand(query=currentPhase, top_k=5)
```

If response.matches.length > 0:
```
const phaseSummaryString = response.matches[0].summary
const phaseData = JSON.parse(phaseSummaryString)
const phaseName = phaseData.name
```

If currentPlan exists:
```
megamemory_understand(query=currentPlan, top_k=5)
```

If response.matches.length > 0:
```
const planSummaryString = response.matches[0].summary
const planData = JSON.parse(planSummaryString)
const planObjective = planData.objective
```

## 3. Capture Mental Context

**Step 3.1: Gather mental context**

Use question tool to capture mental state:
```
const contextResponse = question(questions=[{
  header: "Context Capture",
  question: "What's the current mental context? (approach, next steps, any important context)",
  options: []
}])
```

Store response from contextResponse[0] as `mentalContext`.

**Step 3.2: Check modified files**

```bash
git status --porcelain 2>/dev/null || echo ""
```

Parse output to extract modified files:
```
const modifiedFiles = gitStatusOutput
  .split('\n')
  .filter(line => line.trim())
  .map(line => line.trim().substring(3))
  .filter(file => file && !file.startsWith('.'))
```

## 4. Create Handoff Concept

**Step 4.1: Build handoff data**

```
const handoffData = {
  phase: currentPhase,
  plan: currentPlan,
  task: currentTask,
  total_tasks: totalTasks,
  status: "paused",
  paused_at: new Date().toISOString(),

  context: mentalContext,

  modified_files: modifiedFiles,

  next_action: mentalContext.includes("next")
    ? mentalContext.match(/next[:\s]+([^.\n]+)/i)?.[1]?.trim()
    : `Continue from task ${currentTask}`
}
```

**Step 4.2: Create handoff concept**

```
megamemory_create_concept(
  name=`${currentPhase}-handoff`,
  kind="config",
  summary=JSON.stringify(handoffData),
  why="Preserve work state for seamless session resumption",
  parent_id=null
)
```

**Step 4.3: Store concept ID**

Store returned concept ID for later reference.

## 5. Update State Concept

**Step 5.1: Update state with session continuity**

Re-use stateId and stateData from step 1.3:
```
const updatedStateData = {
  ...stateData,
  session_continuity: {
    handoff_concept: handoffConceptId,
    paused_at: new Date().toISOString(),
    phase: currentPhase,
    plan: currentPlan,
    task: currentTask
  }
}
```

**Step 5.2: Update state concept**

```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

Note: The `changes` parameter only accepts these fields: `summary`, `name`, `kind`, `why`, `file_refs`. Pass the full updated JSON as the `summary` string.

## 6. Confirm Handoff

```
----------------------------------------------------
  Fuska: Work paused
----------------------------------------------------

**Phase:** {phaseName}
**Plan:** {currentPlan}
**Task:** {currentTask} of {totalTasks}
**Status:** {status}

────────────────────────────────────────────────────────────

**Context:** {mentalContext}

────────────────────────────────────────────────────────────

**Next Action:** {nextAction}

────────────────────────────────────────────────────────────

Handoff concept created: {currentPhase}-handoff

To resume: /fuska-resume-work

-----------------------------------------------------
```

## 7. Optional Git Commit

If user has modified files and wants to commit:

**Step 7.1: Commit if files modified using fuska-git-message**

If modifiedFiles.length > 0:

```
Task(
  description="Generate WIP commit message",
  subagent_type="fuska-git-message",
  prompt=`<commit_context>
**Mode:** handoff-commit
**Phase:** ${currentPhase}
**Plan:** ${currentPlan}
**Task:** ${currentTask}/${totalTasks}
**Commit Strategy:** per-phase

**Context:**
Work paused at task ${currentTask} of ${totalTasks}

**Next Action:** ${nextAction}

**Staged files:**
${modifiedFiles.join('\n')}
</commit_context>`
)
```

The agent returns the commit message. Then execute:

```bash
git add .
git commit -m "${generatedMessage}"
```

**Step 7.2: Get commit hash**

```bash
commit_hash=$(git rev-parse --short HEAD)
```

Update confirmation message:
```
-----------------------------------------------------
 Fuska: Work paused
-----------------------------------------------------

**Phase:** {phaseName}
**Plan:** {currentPlan}
**Task:** {currentTask} of {totalTasks}
**Status:** {status}

────────────────────────────────────────────────────

**Context:** {mentalContext}

────────────────────────────────────────────────────

**Next Action:** {nextAction}

────────────────────────────────────────────────────

Handoff concept created: {currentPhase}-handoff
Committed as WIP: {commit_hash}

To resume: /fuska-resume-work

-----------------------------------------------------
```

</process>

<success_criteria>

- [ ] Current phase and plan detected from state concept
- [ ] Handoff concept created with all sections filled
- [ ] State concept updated with session continuity
- [ ] User knows location and how to resume
- [ ] Optional git commit completed if enabled

</success_criteria>
