---
name: fuska-progress
description: Check project progress, show context, and route to next action (execute or plan) using MegaMemory
argument-hint: "[phase] [--verify]"
tools:
  - read
  - bash

  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>

Check project progress using MegaMemory knowledge graph, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.

</objective>

<execution_context>

@./opencode/fuska/references/preflight-check-project-exists.md
@./opencode/fuska/scripts/types.ts
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

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Validate MegaMemory Environment

**Step 1.1: Call list_roots**

```
megamemory_list_roots()
```

**Step 1.2: Check for roots**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /fuska-new-project to start a new project"
→ Stop

---

## 2. Load All Context (Single Pass)

Query MegaMemory for all needed concepts in sequence, store results. All subsequent steps use these cached results — NO additional queries for data already loaded.

**Step 2.1: Query all project concepts**

```
const stateResponse = megamemory_understand(query="state", top_k=5)
const roadmapResponse = megamemory_understand(query="roadmap", top_k=5)
const reqResponse = megamemory_understand(query="requirements", top_k=50)
const configResponse = megamemory_understand(query="config", top_k=5)
```

**Step 2.2: Check essential data exists**

If stateResponse.matches.length === 0:
→ Display: "Project state not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to start a new project"
→ Stop

If roadmapResponse.matches.length === 0:
→ Display: "Project roadmap not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to start a new project"
→ Stop

**Step 2.3: Parse all results**

```
const stateData = JSON.parse(stateResponse.matches[0].summary)
const currentPhase = stateData.current_phase
const currentPlan = stateData.current_plan
const status = stateData.status
const progress = stateData.progress
const lastActivity = stateData.last_activity
const projectId = stateResponse.matches[0].id

const roadmapData = JSON.parse(roadmapResponse.matches[0].summary)
const phases = roadmapData.phases
const currentMilestone = roadmapData.current_milestone

const requirements = reqResponse.matches.map(match => {
  const reqData = JSON.parse(match.summary)
  return { id: match.id, description: reqData.description, status: reqData.status }
})

const configData = configResponse.matches.length > 0
  ? JSON.parse(configResponse.matches[0].summary) : null
const modelProfile = configData?.model_profile || "balanced"
```

All data is now cached. Subsequent steps reference these variables — no re-querying.

---

## 3. Gather Recent Work Context

**Step 3.1: Query summary concepts**

Query for summary concepts across all phases to get recent work:
```
megamemory_understand(query="summary", top_k=10)
```

**Step 3.2: Extract recent summaries**

If response.matches.length > 0:
```
const recentSummaries = response.matches.slice(0, 3).map(match => {
  const summaryString = match.summary
  const summaryData = JSON.parse(summaryString)
  return {
    id: match.id,
    phase: summaryData.phase,
    plan: summaryData.plan,
    accomplishments: summaryData.accomplishments || [],
    decisions: summaryData.decisions || [],
    issues: summaryData.issues || [],
    timestamp: summaryData.timestamp
  }
})
```

---

## 4. Parse Current Position

**Step 4.1: Calculate progress metrics**

From stateData and roadmapData:
```
const totalPhases = phases.length
const completedPhases = phases.filter(p => p.status === "complete").length
const currentPhaseNumber = currentPhase ? parseInt(currentPhase.replace('phase-', '')) : 0

// Count pending todos (query todos module)
megamemory_understand(query="todos", top_k=50)
if (response.matches.length > 0) {
  const pendingTodos = response.matches.filter(m => {
    const data = JSON.parse(m.summary)
    return data.status === "pending"
  }).length
}

// Check for active debug sessions
megamemory_understand(query="debug", top_k=10)
if (response.matches.length > 0) {
  const activeDebugSessions = response.matches.filter(m => {
    const data = JSON.parse(m.summary)
    return data.status !== "resolved"
  }).length
}
```

**Step 4.2: Check for CONTEXT.md equivalent**

Query for phase context:
```
if (currentPhase) {
  megamemory_understand(query=`${currentPhase}-context`, top_k=1)
  if (response.matches.length > 0) {
    const contextExists = true
  }
}
```

---

## 5. Present Rich Status Report

```
----------------------------------------------------
 Fuska ► PROJECT PROGRESS
----------------------------------------------------

**[Project Name]**

**Progress:** [████████░░] ${completedPhases}/${totalPhases} phases complete
**Profile:** ${modelProfile}

## Recent Work
${recentSummaries.map(s => `- [${s.phase}, ${s.plan}]: ${s.accomplishments[0] || 'No summary'}`).join('\n')}

## Current Position
Phase ${currentPhaseNumber} of ${totalPhases}: ${currentPhaseName || 'Unknown'}
Plan ${currentPlanNumber || '?'}
Status: ${status}
Context: ${contextExists ? '✓' : '-'}

## Key Decisions Made
${stateData.decisions ? stateData.decisions.map(d => `- ${d}`).join('\n') : 'None'}

## Blockers/Concerns
${stateData.blockers ? stateData.blockers.map(b => `- ${b}`).join('\n') : 'None'}

${pendingTodos > 0 ? `## Pending Todos\n- ${pendingTodos} pending — /fuska-check-todos to review` : ''}

${activeDebugSessions > 0 ? `## Active Debug Sessions\n- ${activeDebugSessions} active — /fuska-debug to continue` : ''}

## What's Next
${nextPhaseGoal || 'No next phase defined'}

────────────────────────────────────────────────────────────
```

---

## 6. Route to Next Action

**Step 6.1: Query plan concepts for current phase**

If currentPhase exists:
```
megamemory_understand(query=`${currentPhase}-plan`, top_k=20)
if (response.matches.length > 0) {
  const planConcepts = response.matches.map(match => {
    const planData = JSON.parse(match.summary)
    return {
      id: match.id,
      name: match.name,
      wave: planData.wave,
      objective: planData.objective
    }
  })
  const totalPlans = planConcepts.length
}
```

**Step 6.2: Query summary concepts for current phase**

If currentPhase exists:
```
megamemory_understand(query=`${currentPhase}-summary`, top_k=20)
if (response.matches.length > 0) {
  const completedSummaries = response.matches.length
}
```

**Step 6.3: Query UAT concepts**

```
megamemory_understand(query=`${currentPhase}-uat`, top_k=1)
if (response.matches.length > 0) {
  const uatSummaryString = response.matches[0].summary
  const uatData = JSON.parse(uatSummaryString)
  const uatWithGaps = uatData.status === "diagnosed" && uatData.gaps && uatData.gaps.length > 0
}
```

**Step 6.4: Route based on counts**

| Condition | Meaning | Action |
|-----------|---------|--------|
| uatWithGaps === true | UAT gaps need fix plans | Go to **Route E** |
| completedSummaries < totalPlans | Unexecuted plans exist | Go to **Route A** |
| completedSummaries === totalPlans AND totalPlans > 0 | Phase complete | Go to **Step 6.5** |
| totalPlans === 0 | Phase not yet planned | Go to **Route B** |

---

### Route A: Unexecuted plan exists

Find the first plan without matching summary:
```
const incompletePlan = planConcepts.find(plan => {
  const planSlug = plan.name.replace(`${currentPhase}-`, '')
  return !completedSummaries.some(summary => summary.includes(planSlug))
})
```

If incompletePlan found:
```
────────────────────────────────────────────────────────────

## ▶ Next Up

**${incompletePlan.name}** — ${incompletePlan.objective}

/fuska-execute-phase ${currentPhaseNumber}

*/new first → fresh context window*

────────────────────────────────────────────────────────────
```

---

### Route B: Phase needs planning

Check for phase context (from step 4.2):

**If contextExists === true:**

```
────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase ${currentPhaseNumber}: ${currentPhaseName}** — ${currentPhaseGoal}
*✓ Context gathered, ready to plan*

/fuska-plan-phase ${currentPhaseNumber}

*/new first → fresh context window*

────────────────────────────────────────────────────────────
```

**If contextExists === false:**

```
────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase ${currentPhaseNumber}: ${currentPhaseName}** — ${currentPhaseGoal}

/fuska-discuss-phase ${currentPhaseNumber} — gather context and clarify approach

*/new first → fresh context window*

────────────────────────────────────────────────────────────

**Also available:**
- /fuska-plan-phase ${currentPhaseNumber} — skip discussion, plan directly
────────────────────────────────────────────────────────────
```

---

### Route E: UAT gaps need fix plans

```
────────────────────────────────────────────────────────────

## ⚠ UAT Gaps Found

**${currentPhase}-UAT** has ${uatData.gaps.length} gaps requiring fixes.

/fuska-plan-phase ${currentPhaseNumber} --gaps

*/new first → fresh context window*

────────────────────────────────────────────────────────────

**Also available:**
- /fuska-execute-phase ${currentPhaseNumber} — execute phase plans
- /fuska-verify-work ${currentPhaseNumber} — run more UAT testing
────────────────────────────────────────────────────────────
```

---

**Step 6.5: Check milestone status (only when phase complete)**

From roadmapData:
```
const currentMilestonePhases = phases.filter(p => p.milestone === currentMilestone)
const currentMilestonePhasesNumbers = currentMilestonePhases.map(p => parseInt(p.number || p.name.replace('phase-', '')))
const maxPhaseNumber = Math.max(...currentMilestonePhasesNumbers)
```

**Route based on milestone status:**

| Condition | Meaning | Action |
|-----------|---------|--------|
| currentPhaseNumber < maxPhaseNumber | More phases remain | Go to **Route C** |
| currentPhaseNumber === maxPhaseNumber | Milestone complete | Go to **Route D** |

---

### Route C: Phase complete, more phases remain

From roadmapData, get next phase:
```
const nextPhase = phases.find(p => {
  const phaseNum = parseInt(p.number || p.name.replace('phase-', ''))
  return phaseNum === currentPhaseNumber + 1
})
```

```
────────────────────────────────────────────────────────────

## ✓ Phase ${currentPhaseNumber} Complete

## ▶ Next Up

**Phase ${nextPhase.number}: ${nextPhase.name}** — ${nextPhase.goal}

/fuska-discuss-phase ${nextPhase.number} — gather context and clarify approach

*/new first → fresh context window*

────────────────────────────────────────────────────────────

**Also available:**
- /fuska-plan-phase ${nextPhase.number} — skip discussion, plan directly
- /fuska-verify-work ${currentPhaseNumber} — user acceptance test before continuing
────────────────────────────────────────────────────────────
```

---

### Route D: Milestone complete

```
────────────────────────────────────────────────────────────

## 🎉 Milestone Complete

All ${currentMilestonePhases.length} phases finished!

## ▶ Next Up

**Complete Milestone** — archive and prepare for next

/fuska-complete-milestone

*/new first → fresh context window*

────────────────────────────────────────────────────────────

**Also available:**
- /fuska-verify-work — user acceptance test before completing milestone
────────────────────────────────────────────────────────────
```

---

### Route F: Between milestones (no roadmap concept, project-root concept exists)

A milestone was completed and archived. Ready to start the next milestone cycle.

```
────────────────────────────────────────────────────────────

## ✓ Milestone v${lastCompletedVersion} Complete

Ready to plan the next milestone.

## ▶ Next Up

**Start Next Milestone** — questioning → research → requirements → roadmap

/fuska-new-milestone

*/new first → fresh context window*

────────────────────────────────────────────────────────────
```

---

## 7. Handle Edge Cases

- Phase complete but next phase not planned → offer `/fuska-plan-phase [next]`
- All work complete → offer milestone completion
- Blockers present → highlight before offering to continue
- Handoff checkpoint exists → mention it, offer `/fuska-resume-work`

</process>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Rich context provided (recent work, decisions, issues)
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /fuska-execute-phase if plans exist, /fuska-plan-phase if not
- [ ] User confirms before any action
- [ ] Seamless handoff to appropriate fuska command

</success_criteria>
