---
name: gsd-mm-pause-work
description: Create context handoff when pausing work mid-phase using MegaMemory
tools:
  - read
  - bash

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
@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
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
→ Suggest: "Run /gsd-mm-new-project to initialize project"
→ Stop

**Step 1.3: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const currentPhase = stateData.current_phase
const currentPlan = stateData.current_plan
const status = stateData.status
const lastActivity = stateData.last_activity
```

**Step 1.4: Validate work in progress**

If status === "phase_complete" OR status === "ready_to_plan":
→ Display: "No work in progress to pause"
→ Suggest: "Run /gsd-mm-resume-work to see current status"
→ Stop

## 2. Load Phase Context

**Step 2.1: Query phase concept**

If currentPhase exists:
```
megamemory_understand(query=currentPhase, top_k=5)
```

If response.matches.length > 0:
```
const phaseSummaryString = response.matches[0].summary
const phaseData = JSON.parse(phaseSummaryString)

const phaseName = phaseData.name
const phaseGoal = phaseData.goal
```

**Step 2.2: Query current plan concept**

If currentPlan exists:
```
megamemory_understand(query=currentPlan, top_k=5)
```

If response.matches.length > 0:
```
const planSummaryString = response.matches[0].summary
const planData = JSON.parse(planSummaryString)

const planObjective = planData.objective
const planTasks = planData.tasks || []
const totalTasks = planTasks.length
```

**Step 2.3: Query completed tasks**

```
megamemory_understand(query=`${currentPhase}-summary`, top_k=20)
```

If response.matches.length > 0:
```
const completedTaskIds = new Set(response.matches.map(match => match.id))
```

**Step 2.4: Calculate current position**

```
const completedCount = planTasks.filter(task => completedTaskIds.has(task.id)).length
const currentTaskIndex = completedCount
const currentTask = planTasks[currentTaskIndex] || null
```

## 3. Gather Complete State

**Step 3.1: Collect work completed**

From summary concepts and plan data:
```
const completedWork = planTasks.slice(0, completedCount).map(task => ({
  id: task.id,
  name: task.name,
  status: "completed"
}))
```

**Step 3.2: Collect work remaining**

From plan data:
```
const remainingWork = planTasks.slice(completedCount).map(task => ({
  id: task.id,
  name: task.name,
  status: task === currentTask ? "in_progress" : "not_started"
}))
```

**Step 3.3: Query decisions**

```
megamemory_understand(query="decision", top_k=20)
```

Extract decisions related to current phase:
```
const phaseDecisions = response.matches
  .filter(match => {
    const summaryString = match.summary
    const decData = JSON.parse(summaryString)
    return decData.phase === currentPhase
  })
  .map(match => {
    const summaryString = match.summary
    const decData = JSON.parse(summaryString)
    return {
      decision: decData.decision,
      rationale: decData.rationale,
      madeAt: decData.made_at
    }
  })
```

**Step 3.4: Query blockers**

From state concept:
```
const blockers = stateData.blockers || []
```

**Step 3.5: Gather mental context**

Use question tool to capture mental state:
```
question(
  header="Context Capture",
  question="What's the current mental context? (approach, next steps, any important context)",
  followUp: null
)
```

Store response as `mentalContext`.

**Step 3.6: Check modified files**

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
  phase_name: phaseName,
  plan: currentPlan,
  task: currentTaskIndex + 1,
  total_tasks: totalTasks,
  status: "in_progress",
  last_updated: new Date().toISOString(),

  current_position: {
    phase: currentPhase,
    phase_name: phaseName,
    plan: currentPlan,
    task: currentTaskIndex + 1,
    objective: planObjective,
    total_tasks: totalTasks
  },

  completed_work: completedWork,

  remaining_work: remainingWork,

  decisions_made: phaseDecisions,

  blockers: blockers,

  context: mentalContext,

  modified_files: modifiedFiles,

  next_action: mentalContext.includes("next") ?
    mentalContext.match(/next[:\s]+([^.\n]+)/i)?.[1]?.trim() || "Continue from task " + (currentTaskIndex + 1) :
    "Continue from task " + (currentTaskIndex + 1)
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
    task: currentTaskIndex + 1
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► WORK PAUSED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase:** {phaseName}
**Plan:** {currentPlan}
**Task:** {currentTaskIndex + 1} of {totalTasks}
**Status:** {status}

────────────────────────────────────────────────────────────

**Completed:** {completedCount} tasks
**Remaining:** {remainingWork.length} tasks

────────────────────────────────────────────────────────────

**Next Action:** {nextAction}

────────────────────────────────────────────────────────────

Handoff concept created: {currentPhase}-handoff

To resume: /gsd-mm-resume-work

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 7. Optional Git Commit

If user has modified files and wants to commit:

**Step 7.1: Commit if files modified**

If modifiedFiles.length > 0:
```
git add .
git commit -m "wip: {phaseName} paused at task {currentTaskIndex + 1}/{totalTasks}"
```

**Step 7.2: Get commit hash**

```bash
commit_hash=$(git rev-parse --short HEAD)
```

Update confirmation message:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► WORK PAUSED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase:** {phaseName}
**Plan:** {currentPlan}
**Task:** {currentTaskIndex + 1} of {totalTasks}
**Status:** {status}

────────────────────────────────────────────────────────────

**Completed:** {completedCount} tasks
**Remaining:** {remainingWork.length} tasks

────────────────────────────────────────────────────────────

**Next Action:** {nextAction}

────────────────────────────────────────────────────────────

Handoff concept created: {currentPhase}-handoff
Committed as WIP: {commit_hash}

To resume: /gsd-mm-resume-work

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<success_criteria>

- [ ] Current phase and plan detected from state concept
- [ ] Handoff concept created with all sections filled
- [ ] State concept updated with session continuity
- [ ] User knows location and how to resume
- [ ] Optional git commit completed if enabled

</success_criteria>
