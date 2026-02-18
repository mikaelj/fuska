---
name: fuska-resume-work
description: Resume work from previous session with full context restoration using MegaMemory
argument-hint: "[optional: project name or path]"
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:update_concept
  - megamemory:list_roots
---

<objective>

Restore complete project context and resume work seamlessly from previous session using MegaMemory knowledge graph.

Routes to resume-project workflow which handles:
- State concept loading
- Phase context detection
- Incomplete work detection (plan without summary)
- Status presentation
- Context-aware next action routing
- Session continuity updates

</objective>

<execution_context>
@../../fuska/references/preflight-check-project-exists.md

@../../fuska/scripts/types.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<megamemory_guide>

## How to read MegaMemory responses

All project data lives in MegaMemory. If a MegaMemory query returns no results, tell the user the data wasn't found.

**`megamemory:understand` returns:**
```json
{ "matches": [ { "id": "project/state", "name": "state", "kind": "config", "summary": "{\"current_phase\":\"phase-01\", ...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:list_roots` returns:** an array of root concepts with `id`, `name`, `kind`, `summary`.

</megamemory_guide>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

**Follow this process to restore context from MegaMemory:**

## 1. Query MegaMemory Roots

**Step 1.1: Call list_roots**

```
megamemory_list_roots()
```

**Step 1.2: Check for roots**

If response.roots.length === 0:
→ Display: "No initiatives found in MegaMemory"
→ Suggest: "fuska init to start a new initiative"
→ Stop

**Step 1.3: Check for multiple roots and no project specified**

If response.roots.length > 1 AND no project name provided in `$ARGUMENTS`:
→ Display available projects:
```
const projects = response.roots.map(root => {
  const summaryString = root.summary
  const rootData = JSON.parse(summaryString)
  return { id: root.id, name: root.name, description: rootData.what_this_is || root.name }
})

Display: "Available projects:"
for (const project of projects) {
  Display: `- ${project.name}: ${project.description}`
}
```

→ Use question tool:
```
const projectResponse = question(questions=[{
  header: "Select Project",
  question: "Which project would you like to work on?",
  options: projects.map(p => ({label: p.name, description: p.description}))
}])
```

**Step 1.4: Store selected project**

After user selection, store `initiativeId` and `initiativeName` for use in subsequent steps.

---

## 2. Load Project State

**Step 2.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 2.2: Check state exists**

If response.matches.length === 0:
→ Display: "Initiative state not found. Initiative may not be properly initialized."
→ Suggest: "Reinitialize with fuska init or select different initiative"
→ Stop

**Step 2.3: Extract state data**

If response.matches.length > 0:
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const currentPhase = stateData.current_phase
const currentPlan = stateData.current_plan
const status = stateData.status
const progress = stateData.progress

const currentTask = stateData.current_task
const totalTasks = stateData.total_tasks
```

**Step 2.4: Display formatted status**

```
----------------------------------------------------
 Fuska: PROJECT STATE
----------------------------------------------------

 **${initiativeName || 'Initiative'}**

Current Phase: ${currentPhase || 'None'}
Current Plan: ${currentPlan || 'None'}
Status: ${status || 'Unknown'}
Progress: ${progress || 0}%
Last Activity: ${lastActivity || 'Never'}

─────────────────────────────────────────────────────────────
```

---

## 3. Detect Incomplete Work

**Step 3.1: Query phase concept**

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

**Step 3.2: Query plan concepts**

```
megamemory_understand(query=`${currentPhase}-plan`, top_k=20)
```

If response.matches.length > 0:
```
const planConcepts = response.matches.map(match => {
  const planSummaryString = match.summary
  const planData = JSON.parse(planSummaryString)
  return {
    id: match.id,
    slug: match.name,
    objective: planData.objective,
    wave: planData.wave
  }
})
```

**Step 3.3: Query summary concepts**

```
megamemory_understand(query=`${currentPhase}-summary`, top_k=20)
```

If response.matches.length > 0:
```
const summarySlugs = new Set(response.matches.map(match => match.name))
```

**Step 3.4: Detect incomplete work**

```
const incompletePlans = planConcepts.filter(plan => !summarySlugs.has(plan.slug))

const checkpointPlans = planConcepts.filter(plan => plan.slug.includes('checkpoint'))
```

**Step 3.5: Report findings**

If incompletePlans.length > 0:
```
Display: "You have incomplete work in ${currentPhase}"
Display incomplete plans:
for (const plan of incompletePlans) {
  Display: `- ${plan.slug}: ${plan.objective}`
}
```

If checkpointPlans.length > 0:
```
Display: "Checkpoint detected in ${currentPhase}"
```

If incompletePlans.length === 0 AND checkpointPlans.length === 0:
```
Display: "No incomplete work detected"
```

**Step 3.6: Show task-level position**

If currentTask exists:
```
Display: "Task ${currentTask} of ${totalTasks}"
```

**Step 3.7: Legacy fallback**

If currentTask is undefined:
```
megamemory_understand(query=`${currentPhase}-summary`, top_k=20)
const completedCount = response.matches.length
const inferredTask = completedCount + 1
Display: "Task ${inferredTask} (inferred) - legacy project, run build to update tracking"
```

---

## 4. Detect Phase Context

**Step 4.1: Query phase context**

```
megamemory_understand(query=`${currentPhase}-context`, top_k=5)
```

**Step 4.2: Check for context**

If response.matches.length > 0:
```
const contextSummaryString = response.matches[0].summary
const contextData = JSON.parse(contextSummaryString)
const contextExists = true
```
Else:
```
const contextExists = false
```

**Step 4.3: Apply to routing**

If contextExists === true:
→ Mark: "Context available — can plan directly"

If contextExists === false:
→ Mark: "Context missing — should design phase first"

## 5. Present Context-Aware Next Actions

**Step 5.1: Handle status ready_to_plan**

If status === "ready_to_plan":

→ Display options:
```
### Status: ready_to_plan

**Options:**
1. Discuss phase first — Gather context, clarify approach
   /fuska-design-phase {currentPhase}

2. Plan directly — Skip discussion, create plans
   /fuska-plan-phase {currentPhase}
```

${contextExists === true ? '**If context exists, option 2 is recommended.**' : ''}
```

**Step 5.2: Handle status ready_to_execute**

If status === "ready_to_execute":

→ Display options:
```
### Status: ready_to_execute

**Options:**
1. Execute phase — Run all plans for this phase
   /fuska-build-phase {currentPhase}

2. Review plans — See what's planned before executing
   (Query plan concepts and display)
```

${checkpointPlans.length > 0 ? '**If checkpoint exists, offer "Resume from checkpoint" option.**' : ''}

**Step 5.3: Handle status in_progress**

If status === "in_progress":

→ Display incomplete work details from step 3.5:
```
### Status: in_progress

**Incomplete Plans:**
${incompletePlans.map(p => `- ${p.slug}: ${p.objective}`).join('\n') || 'None'}

${checkpointPlans.length > 0 ? `Checkpoint detected: ${checkpointPlans.map(p => p.slug).join(', ')}` : ''}
```

→ Display options:
```
1. Resume execution — Continue where left off
   /fuska-build-phase {currentPhase}

2. Verify work — Manual acceptance testing
   /fuska-review-phase {currentPhase}

3. View status — See detailed status of current work
   (Display phase concepts in detail)
```

**Step 5.4: Handle status phase_complete**

If status === "phase_complete":

→ Display options:
```
### Status: phase_complete

**Options:**
1. Next phase — Move to next phase in roadmap
   /fuska-design-phase {next_phase}

2. Verify phase — Manual acceptance testing before proceeding
   /fuska-review-phase {currentPhase}

3. Audit milestone — If this was last phase
   /fuska-audit-milestone
```

## 6. Update Session Continuity

**Step 6.1: Update state concept for session restoration**

Re-use stateId and stateData from step 2.3:
```
// No state changes needed - state already reflects current position
```

Call (optional - only if state needs update):
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

Note: The `changes` parameter only accepts these fields: `summary`, `name`, `kind`, `why`, `file_refs`. Pass the full updated JSON as the `summary` string.

---

## 7. Present Overall Status

**Step 7.1: Display session restored banner**

```
-------------------------------------------------
  Fuska: Session restored
-----------------------------------------------

 **${initiativeName || 'Initiative'}**

 ${status === 'ready_to_plan' ? 'Ready to plan next phase' : ''}
${status === 'ready_to_execute' ? 'Plans ready to build' : ''}
${status === 'in_progress' ? 'Work in progress' : ''}
${status === 'phase_complete' ? 'Phase complete, ready for next' : ''}
${incompletePlans.length > 0 ? `${incompletePlans.length} incomplete plan(s) remaining` : ''}
${checkpointPlans.length > 0 ? 'Checkpoint available' : ''}
```

**Step 7.2: Present recommended next step**

Based on status and context detection from steps 3-5:

```
## Recommended Next Step

${status === 'ready_to_plan' && contextExists === true
  ? 'Plan Phase ' + currentPhase + ' (context available, ready to create plans)'
  : status === 'ready_to_plan' && contextExists === false
  ? 'Discuss Phase ' + currentPhase + ' (context missing, gather information first)'
  : status === 'ready_to_execute' && incompletePlans.length === 0 && checkpointPlans.length === 0
  ? 'Execute Phase ' + currentPhase + ' (all plans complete, ready to run)'
  : status === 'ready_to_execute' && incompletePlans.length > 0
  ? 'Execute Phase ' + currentPhase + ' (resuming incomplete work, ' + incompletePlans.length + ' plan(s) remaining)'
  : status === 'in_progress'
  ? 'Execute Phase ' + currentPhase + ' (continue from ' + (checkpointPlans.length > 0 ? 'checkpoint' : 'current position'))
  : status === 'phase_complete'
  ? 'Move to next phase or review milestone'
  : 'Check status and determine next action'}
```

**Step 7.3: Display all available commands**

```
─────────────────────────────────────────────────────────────

All Available Commands:

- fuska progress — View detailed project progress
- /fuska-design-phase {N} — Discuss a phase
- /fuska-plan-phase {N} — Plan a phase
- /fuska-build-phase {N} — Execute a phase
- /fuska-review-phase {N} — Verify work
- /fuska-audit-milestone — Audit milestone
- /fuska-complete-milestone — Complete milestone
─────────────────────────────────────────────────────────────
```

```
-----------------------------------------------------
  Fuska: Session restored
-----------------------------------------------------

**{Project Name}**

{Overall status summary}

──────────────────────────────────────────────────────────────

## Recommended Next Step

{Context-aware recommendation based on above analysis}

──────────────────────────────────────────────────────────────

**All Available Commands:**

- fuska progress — View detailed project progress
- /fuska-design-phase {N} — Discuss a phase
- /fuska-plan-phase {N} — Plan a phase
- /fuska-build-phase {N} — Execute a phase
- /fuska-review-phase {N} — Verify work
- /fuska-audit-milestone — Audit milestone
- /fuska-complete-milestone — Complete milestone
──────────────────────────────────────────────────────────────
```

</process>

<offer_next>

Based on the status and detection results from step 5, output the appropriate route from the following:

### Route: ready_to_plan, context available

```
-----------------------------------------------------
 Fuska: READY TO PLAN
-----------------------------------------------------

**Phase {X}: {Name}** — Context available [OK]

──────────────────────────────────────────────────────────────

## > Next Up (Recommended)

**Plan Phase {X}** — Create execution plans
/fuska-plan-phase {X}

──────────────────────────────────────────────────────────────

**Or design first:**
/fuska-design-phase {X}
──────────────────────────────────────────────────────────────
```

### Route: ready_to_execute

```
-----------------------------------------------------
 Fuska: READY TO EXECUTE
-----------------------------------------------------

**Phase {X}: {Name}** — Plans ready [OK]

{N} plans in {M} wave(s)

──────────────────────────────────────────────────────────────

## > Next Up

**Execute Phase {X}**
/fuska-build-phase {X}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────
```

### Route: in_progress, incomplete work

```
-----------------------------------------------------
 Fuska: INCOMPLETE WORK DETECTED
-----------------------------------------------------

**Phase {X}: {Name}**

Incomplete:
- {plan 1} — {objective}
- {plan 2} — {objective}

──────────────────────────────────────────────────────────────

## > Next Up

**Resume Execution**
/fuska-build-phase {X}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Or review first:**
/fuska-review-phase {X}
──────────────────────────────────────────────────────────────
```

### Route: phase_complete

```
-----------------------------------------------------
 Fuska: PHASE COMPLETE
-----------------------------------------------------

**Phase {X}: {Name}** — Verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Next Phase**
/fuska-design-phase {X+1}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Or review first:**
/fuska-review-phase {X}
──────────────────────────────────────────────────────────────

**Or audit milestone:**
/fuska-audit-milestone
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] MegaMemory queried successfully
- [ ] Project identified (from roots or argument)
- [ ] State concept loaded
- [ ] Current phase and status extracted
- [ ] Incomplete work detected (plans without summaries, checkpoints)
- [ ] Phase context checked
- [ ] Context-aware next actions presented
- [ ] User knows where to resume
- [ ] Session continuity updated in state concept

</success_criteria>
