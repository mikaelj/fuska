---
name: fuska-complete-milestone
description: Archive completed milestone and prepare for next version using MegaMemory
argument-hint: "<version>"
tools:
  - read
  - write
  - bash
  - task
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:remove_concept
  - megamemory:list_roots
---

<objective>

Mark milestone {{version}} complete, archive to MegaMemory milestones section, and update roadmap and requirements concepts.

Purpose: Create historical record of shipped version, archive milestone artifacts (roadmap + requirements), and prepare for next milestone.
Output: Milestone archived in MegaMemory, requirements archived, state concept updated, git tagged.

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
{ "matches": [ { "id": "project/roadmap", "name": "roadmap", "kind": "module", "summary": "{\"phases\":[...],\"current_milestone\":\"v1.0\",...}", "children": [...], "edges": [...] } ] }
```

The important field is **`summary`** — it's a JSON string containing the concept's data. Parse it to extract the fields you need. If `matches` is empty, the concept doesn't exist.

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

**`megamemory:remove_concept` accepts:** `{id, reason}`. Soft-deletes with history preserved.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<context>

**User input:**

- Version: {{version}} (e.g., "1.0", "1.1", "2.0")

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 0. Check for Audit

**Step 0.1: Query audit concept**

```
megamemory_understand(query=`v${{version}}-milestone-audit`, top_k=1)
```

**Step 0.2: Check audit status**

If response.matches.length === 0:
```
────────────────────────────────────────────────────────────

## Pre-flight Check

[WARN] No milestone audit found. Run /fuska-audit-milestone first to verify
requirements coverage, cross-phase integration, and E2E flows.

────────────────────────────────────────────────────────────
```

Suggest: "Run /fuska-audit-milestone first" → Stop

If audit exists and has gaps:
```
────────────────────────────────────────────────────────────

## Pre-flight Check

[WARN] Milestone audit found gaps. Run /fuska-plan-milestone-gaps to create
phases that close the gaps, or proceed anyway to accept as tech debt.

────────────────────────────────────────────────────────────
```

Suggest: "Run /fuska-plan-milestone-gaps first" or offer "Proceed anyway" option

If audit exists and status is "passed":
→ Display: "[OK] Milestone audit passed. Proceeding with completion."
→ Continue to step 1

---

## 1. Validate MegaMemory Environment

**Step 1.1: Call list_roots**

```
megamemory_list_roots()
```

**Step 1.2: Check for roots**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Stop

---

## 2. Load Milestone Context

**Step 2.1: Query roadmap concept**

```
megamemory_understand(query="roadmap", top_k=5)
```

If response.matches.length === 0:
→ Display: "Project roadmap not found in MegaMemory"
→ Stop

**Step 2.2: Extract roadmap data**

```
const roadmapId = response.matches[0].id
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)
const currentMilestone = roadmapData.current_milestone
const phases = roadmapData.phases
```

**Step 2.3: Verify version matches current milestone**

If currentMilestone !== `v${{version}}`:
→ Display: `Warning: Current milestone is ${currentMilestone}, but you're trying to complete v${{version}}`
→ Ask confirmation

**Step 2.4: Extract milestone phases**

```
const milestonePhases = phases.filter(phase => phase.milestone === currentMilestone)
const milestonePhaseNumbers = milestonePhases.map(p => parseInt(p.number || p.name.replace('phase-', '')))
```

**Step 2.5: Query requirements concept**

```
megamemory_understand(query="requirements", top_k=50)
```

If response.matches.length > 0:
```
const requirements = response.matches.map(match => {
  const reqSummaryString = match.summary
  const reqData = JSON.parse(reqSummaryString)
  return {
    id: match.id,
    description: reqData.description,
    status: reqData.status,
    outcome: reqData.outcome || null
  }
})
```

---

## 3. Verify Milestone Readiness

**Step 3.1: Check all phases completed**

For each phase in milestonePhases:
```
const phaseSlug = `phase-${phaseNumber.toString().padStart(2, '0')}`

// Query phase concept
megamemory_understand(query=phaseSlug, top_k=1)
if (response.matches.length > 0) {
  const phaseSummaryString = response.matches[0].summary
  const phaseData = JSON.parse(phaseSummaryString)
  const phaseStatus = phaseData.status
}

// Query all plan concepts for this phase
megamemory_understand(query=`${phaseSlug}-plan`, top_k=20)
if (response.matches.length > 0) {
  const totalPlans = response.matches.length
}

// Query all summary concepts for this phase
megamemory_understand(query=`${phaseSlug}-summary`, top_k=20)
if (response.matches.length > 0) {
  const completedSummaries = response.matches.length
}
```

**Step 3.2: Verify each phase has completed plans**

For each phase:
```
if (phaseStatus !== "complete" || completedSummaries < totalPlans) {
  incompletePhases.push(phaseSlug)
}
```

**Step 3.3: Present verification results**

```
────────────────────────────────────────────────────────────

## Milestone Readiness Check

**Milestone:** v${{version}}

**Phases in milestone:** ${milestonePhases.length}
**Phases completed:** ${milestonePhases.length - incompletePhases.length}

${incompletePhases.length > 0 ? `Incomplete phases:\n${incompletePhases.map(p => `- ${p}`).join('\n')}` : 'All phases complete [OK]'}

────────────────────────────────────────────────────────────

Would you like to proceed?
1. Yes, complete milestone
2. No, cancel
```

Wait for user confirmation. If "No", stop.

---

## 4. Gather Milestone Stats

**Step 4.1: Count total metrics**

```
const totalPhases = milestonePhases.length
const totalPlans = milestonePhases.reduce((sum, phase) => sum + phase.planCount, 0)
const totalTasks = milestonePhases.reduce((sum, phase) => sum + phase.taskCount, 0)
```

**Step 4.2: Query all summary concepts for accomplishments**

```
megamemory_understand(query="summary", top_k=50)
const allSummaries = response.matches.map(match => {
  const summaryString = match.summary
  const summaryData = JSON.parse(summaryString)
  return {
    id: match.id,
    phase: summaryData.phase,
    plan: summaryData.plan,
    accomplishments: summaryData.accomplishments || [],
    decisions: summaryData.decisions || []
  }
}).filter(s => milestonePhases.some(p => p.number.toString() === s.phase || p.name === s.phase))
```

**Step 4.3: Calculate git stats**

```
// Get git range (assuming first commit of milestone to HEAD)
const gitRange = bash("git log --format='%H' | tail -1")
const stats = bash(`git diff --stat ${gitRange} HEAD`)
const fileChanges = parseGitStats(stats)
const locChanges = bash(`git diff --shortstat ${gitRange} HEAD`)
```

**Step 4.4: Extract timeline**

```
const timeline = bash("git log --format='%ai %s' --date=short | head -20")
```

**Step 4.5: Present milestone summary**

```
────────────────────────────────────────────────────────────

## Milestone Summary

**Milestone:** v${{version}}

### Scope
- Phases: ${totalPhases}
- Plans: ${totalPlans}
- Tasks: ${totalTasks}

### Changes
- Files modified: ${fileChanges.count}
- LOC changed: ${locChanges}

### Timeline
${timeline.split('\n').slice(0, 5).join('\n')}

────────────────────────────────────────────────────────────

Proceed with completion?
1. Yes
2. No
```

Wait for user confirmation. If "No", stop.

---

## 5. Extract Accomplishments

**Step 5.1: Extract 4-6 key accomplishments**

From allSummaries:
```
const keyAccomplishments = allSummaries
  .flatMap(s => s.accomplishments)
  .slice(0, 6)
```

**Step 5.2: Extract key decisions**

```
const keyDecisions = allSummaries
  .flatMap(s => s.decisions)
  .slice(0, 6)
```

**Step 5.3: Present for approval**

```
────────────────────────────────────────────────────────────

## Key Accomplishments

${keyAccomplishments.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Key Decisions

${keyDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

────────────────────────────────────────────────────────────

Approve these accomplishments?
1. Yes
2. Edit
3. No, cancel
```

Wait for user response.

---

## 6. Archive Milestone

**Step 6.1: Create milestone archive concept**

```
const milestoneArchiveData = {
  version: `v${{version}}`,
  archivedAt: new Date().toISOString(),
  phases: milestonePhases.map(p => ({
    number: p.number,
    name: p.name,
    goal: p.goal,
    status: p.status
  })),
  accomplishments: keyAccomplishments,
  decisions: keyDecisions,
  stats: {
    totalPhases,
    totalPlans,
    totalTasks,
    fileChanges,
    locChanges
  },
  requirements: requirements.map(r => ({
    id: r.id,
    description: r.description,
    status: r.status,
    outcome: r.outcome || (r.status === "complete" ? "validated" : null)
  }))
}

megamemory_create_concept(
  name=`milestone-v${{version}}`,
  kind="config",
  summary=JSON.stringify(milestoneArchiveData),
  why="Archive completed milestone v${{version}} with all phase data, accomplishments, and requirements",
  parent_id="project",
  edges=[
    {
      to: "project/roadmap",
      relation: "depends_on",
      description="Archive contains milestone roadmap data"
    },
    {
      to: "project/requirements",
      relation: "depends_on",
      description="Archive contains milestone requirements data"
    }
  ]
)
```

**Step 6.2: Update roadmap concept**

Collapse milestone phases to one-line summary:
```
const updatedRoadmapPhases = phases.map(phase => {
  if (phase.milestone === currentMilestone) {
    return {
      ...phase,
      archived: true,
      archiveReference: `milestone-v${{version}}`
    }
  }
  return phase
})

const updatedRoadmapData = {
  ...roadmapData,
  phases: updatedRoadmapPhases,
  current_milestone: null, // Milestone completed
  last_completed_milestone: currentMilestone
}

megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData)
  }
)
```

**Step 6.3: Update requirements concepts**

Mark all milestone requirements as complete:
```
for (const req of requirements) {
  const updatedReqData = {
    ...req,
    status: "complete",
    outcome: req.outcome || "validated",
    completedInMilestone: `v${{version}}`,
    completedAt: new Date().toISOString()
  }

  megamemory_update_concept(
    id=req.id,
    changes={
      summary: JSON.stringify(updatedReqData)
    }
  )
}
```

---

## 7. Update State Concept

**Step 7.1: Query state concept**

```
megamemory_understand(query="state", top_k=5)
```

**Step 7.2: Update state with milestone completion**

If response.matches.length > 0:
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)

const updatedStateData = {
  ...stateData,
  current_phase: null,
  current_plan: null,
  status: "milestone_complete",
  last_completed_milestone: `v${{version}}`,
  last_activity: `Milestone v${{version}} completed`,
  progress: 100
}

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

---

## 8. Handle Git Branches (if branching_strategy enabled)

**Step 8.1: Query config for branching strategy**

```
megamemory_understand(query="config", top_k=5)
```

If response.matches.length > 0:
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)
const branchingStrategy = configData.git?.branching_strategy
```

If `branchingStrategy` is not set or is `"none"`:
→ Skip this step, proceed to step 9 (Git Tag)

---

**Step 8.2: Check for feature/phase branches**

For `branching_strategy === "phase"` or `"milestone"`:

```
// List branches
const branches = bash("git branch --list")
const currentBranch = bash("git rev-parse --abbrev-ref HEAD")

// Find feature/phase branches for this milestone
const featureBranches = branches.filter(branch =>
  branch.includes('phase-') || branch.includes('feature-')
)
```

If no feature branches exist:
→ Display: "No feature/phase branches found for this milestone"
→ Proceed to step 9 (Git Tag)

---

**Step 8.3: Offer branch merge options**

If feature branches exist:

```
────────────────────────────────────────────────────

## Git Branches Found

The following branches exist for milestone v{{version}}:

${featureBranches.map(b => `- ${b}`).join('\n')}

Choose an option:
1. Squash merge (recommended) — Single commit, clean history
2. Merge with history — Preserve all branch commits
3. Delete branches without merging — Keep current state
4. Keep branches — Do nothing, branches remain

────────────────────────────────────────────────────
```

Wait for user selection.

---

**Step 8.4: Execute selected action**

If option 1 (squash merge):
```
for (const branch of featureBranches) {
  // Generate commit message for squash merge
  Task(
    description="Generate merge commit message",
    subagent_type="fuska-git-message",
    prompt=`<commit_context>
**Mode:** branch-merge
**Milestone:** v${{version}}
**Branch:** ${branch}
**Commit Strategy:** per-phase

**Merge Type:** Squash merge
</commit_context>`
  )
  
  bash(`git merge --squash ${branch}`)
  bash(`git commit -m "${generatedMessage}"`)
  bash(`git branch -d ${branch}`)
}
```

If option 2 (merge with history):
```
for (const branch of featureBranches) {
  // Generate commit message for merge
  Task(
    description="Generate merge commit message",
    subagent_type="fuska-git-message",
    prompt=`<commit_context>
**Mode:** branch-merge
**Milestone:** v${{version}}
**Branch:** ${branch}
**Commit Strategy:** per-phase

**Merge Type:** Merge with history
</commit_context>`
  )
  
  bash(`git merge --no-ff ${branch} -m "${generatedMessage}"`)
  bash(`git branch -d ${branch}`)
}
```

If option 3 (delete without merging):
```
for (const branch of featureBranches) {
  bash(`git branch -D ${branch}`)
}
```

If option 4 (keep branches):
→ Do nothing, proceed to next step

---

## 9. Git Tag

Milestone data is stored in MegaMemory — no file staging needed.

**Step 9.1: Create git tag**

```
git tag -a v${{version}} -m "Milestone v${{version}}: ${keyAccomplishments[0]}"
```

**Step 9.5: Ask about pushing tag**

```
────────────────────────────────────────────────────────────

Git tag v${{version}} created.

Push tag to remote?
1. Yes, push now
2. No, push later
```

Wait for user response.

If "Yes":
```
git push origin v${{version}}
```

---

## 9. Present Completion Summary

```
----------------------------------------------------
 Fuska: Milestone complete
----------------------------------------------------

**Milestone v${{version}}** — ${keyAccomplishments[0]}

### Archive Created
- MegaMemory concept: milestone-v${{version}}
- ${totalPhases} phases archived
- ${requirements.length} requirements marked complete
- Git tag: v${{version}}

────────────────────────────────────────────────────────────

## > Next Up

**Start Next Milestone** — questioning → research → requirements → roadmap
/fuska-new-milestone

*/new first → fresh context window*

────────────────────────────────────────────────────────────
```

---

## 10. Offer Next Steps

**Step 10.1: Present all available commands**

```
**Also available:**
- /fuska-progress — View detailed project progress
- /fuska-verify-work — Verify work before starting next milestone
────────────────────────────────────────────────────────────
```

---

## 11. Handle Edge Cases

- Audit missing → recommend /fuska-audit-milestone
- Audit has gaps → recommend /fuska-plan-milestone-gaps or offer to proceed as tech debt
- Incomplete phases → list incomplete phases, ask to complete first
- Git tag already exists → ask to force update or use different tag
- Push fails → show error, suggest manual push

</process>

<success_criteria>

- [ ] Milestone audit checked (passed or user override)
- [ ] MegaMemory validated (roots exist)
- [ ] Milestone readiness verified (all phases complete)
- [ ] Milestone stats gathered and presented
- [ ] Key accomplishments extracted and approved
- [ ] Milestone archive concept created in MegaMemory
- [ ] Roadmap concept updated (milestone collapsed)
- [ ] Requirements concepts marked complete
- [ ] State concept updated with milestone completion
- [ ] Git commit created (if configured)
- [ ] Git tag v${{version}} created
- [ ] User knows next steps (including need for fresh requirements)

</success_criteria>

<critical_rules>

- **Load workflow first:** read complete-milestone.md before executing
- **Verify completion:** All phases must have completed plans (summary concepts exist)
- **User confirmation:** Wait for approval at verification gates
- **Archive before modifying:** Always create archive concept before updating/deleting originals
- **Context efficiency:** Archive keeps roadmap and requirements concepts clean per milestone
- **Fresh requirements:** Next milestone starts with /fuska-new-milestone which includes requirements definition

</critical_rules>
