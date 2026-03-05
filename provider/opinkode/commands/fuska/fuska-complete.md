---
name: fuska-complete
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

@../../fuska/references/megamemory-quick-ref.md
 @../../fuska/references/preflight-check-initiative-exists.md
 @../../fuska/scripts/types.ts
 @../../fuska/scripts/helpers.ts
 
 </execution_context>

<context>

**User input:**

- Version: {{version}} (e.g., "1.0", "1.1", "2.0")

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

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

[WARN] No milestone audit found. Run /fuska-audit first to verify
requirements coverage, cross-chapter integration, and E2E flows.

────────────────────────────────────────────────────────────
```

Suggest: "Run /fuska-audit first" → Stop

If audit exists and has gaps:
```
────────────────────────────────────────────────────────────

## Pre-flight Check

[WARN] Milestone audit found gaps. Run /fuska-plan-milestone-fixes to create
chapters that close the gaps, or proceed anyway to accept as tech debt.

────────────────────────────────────────────────────────────
```

Suggest: "Run /fuska-plan-milestone-fixes first" or offer "Proceed anyway" option

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
→ Display: "No initiatives found in MegaMemory"
→ Stop

---

## 2. Load Initiative Context and Milestone Data

**Step 2.1: Load current initiative**

```
megamemory_understand(query="config concepts", top_k=10000)

const configNode = allConcepts.matches?.find(n => n.name === 'config' && n.kind === 'config')
const currentInitiative = configNode ? JSON.parse(configNode.summary).current_initiative : null

const initiativeRoot = allConcepts.matches?.find(n =>
  n.name === currentInitiative && n.kind === 'feature' && !n.parent_id
)
const initiativeId = initiativeRoot?.id
```

**Step 2.2: Query roadmap concept scoped by initiative**

```
const roadmapNode = allConcepts.matches?.find(n =>
  n.name === 'roadmap' && n.kind === 'module' && n.parent_id === initiativeId
)
```

If roadmapNode does not exist:
→ Display: "Project roadmap not found for current initiative"
→ Stop

**Step 2.3: Extract roadmap data**

```
const roadmapId = roadmapNode.id
const roadmapSummaryString = roadmapNode.summary
const roadmapData = JSON.parse(roadmapSummaryString)
const currentMilestone = roadmapData.current_milestone
const chapters = roadmapData.chapters
```

**Step 2.3: Verify version matches current milestone**

If currentMilestone !== `v${{version}}`:
→ Display: `Warning: Current milestone is ${currentMilestone}, but you're trying to complete v${{version}}`
→ Ask confirmation

**Step 2.4: Extract milestone chapters**

```
const milestoneChapters = chapters.filter(chapter => chapter.milestone === currentMilestone)
const milestoneChapterNumbers = milestoneChapters.map(p => parseInt(p.number || p.name.replace('chapter-', '')))
```

**Step 2.5: Query requirements concept scoped by initiative**

```
const requirementConcepts = allConcepts.matches?.filter(n =>
  n.name.startsWith('req-') && n.kind === 'feature' && n.parent_id === initiativeId
)
```

If requirementConcepts.length > 0:
```
const requirements = requirementConcepts.map(match => {
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

**Step 3.1: Check all chapters completed**

For each chapter in milestoneChapters:
```
const chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`

const chapterNode = allConcepts.matches?.find(n => n.name === chapterSlug && n.parent_id === initiativeId)

if (chapterNode) {
  const chapterSummaryString = chapterNode.summary
  const chapterData = JSON.parse(chapterSummaryString)
  const chapterStatus = chapterData.status
}

const planConcepts = allConcepts.matches?.filter(n =>
  n.name.startsWith(`${chapterSlug}-plan-`) && !n.name.endsWith('-summary') && n.parent_id === initiativeId
)
const totalPlans = planConcepts?.length || 0

const summaryConcepts = allConcepts.matches?.filter(n =>
  n.name.startsWith(`${chapterSlug}-plan-`) && n.name.endsWith('-summary') && n.parent_id === initiativeId
)
const completedSummaries = summaryConcepts?.length || 0
```

**Step 3.2: Verify each chapter has completed plans**

For each chapter:
```
if (chapterStatus !== "complete" || completedSummaries < totalPlans) {
  incompleteChapters.push(chapterSlug)
}
```

**Step 3.3: Present verification results**

```
────────────────────────────────────────────────────────────

## Milestone Readiness Check

**Milestone:** v${{version}}

**Chapters in milestone:** ${milestoneChapters.length}
**Chapters completed:** ${milestoneChapters.length - incompleteChapters.length}

${incompleteChapters.length > 0 ? `Incomplete chapters:\n${incompleteChapters.map(p => `- ${p}`).join('\n')}` : 'All chapters complete [OK]'}

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
const totalChapters = milestoneChapters.length
const totalPlans = milestoneChapters.reduce((sum, chapter) => sum + chapter.planCount, 0)
const totalTasks = milestoneChapters.reduce((sum, chapter) => sum + chapter.taskCount, 0)
```

**Step 4.2: Query all summary concepts scoped by initiative**

```
const nodeMap = new Map(allConcepts.matches?.map(n => [n.id, n]))

const belongsToInitiative = (nodeId) => {
  let current = nodeId
  let depth = 0
  while (current && depth < 20) {
    const node = nodeMap.get(current)
    if (!node) break
    if (node.parent_id === initiativeId) return true
    current = node.parent_id
    depth++
  }
  return false
}

const allSummaries = allConcepts.matches?.filter(n =>
  n.name.endsWith('-summary') && n.kind === 'component' && belongsToInitiative(n.id)
).map(match => {
  const summaryString = match.summary
  const summaryData = JSON.parse(summaryString)
  return {
    id: match.id,
    chapter: summaryData.chapter,
    plan: summaryData.plan,
    accomplishments: summaryData.accomplishments || [],
    decisions: summaryData.decisions || []
  }
}).filter(s => milestoneChapters.some(p => p.number.toString() === s.chapter || p.name === s.chapter))
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
- Chapters: ${totalChapters}
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
  chapters: milestoneChapters.map(p => ({
    number: p.number,
    name: p.name,
    goal: p.goal,
    status: p.status
  })),
  accomplishments: keyAccomplishments,
  decisions: keyDecisions,
  stats: {
    totalChapters,
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
  why="Archive completed milestone v${{version}} with all chapter data, accomplishments, and requirements",
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

Collapse milestone chapters to one-line summary:
```
const updatedRoadmapChapters = chapters.map(chapter => {
  if (chapter.milestone === currentMilestone) {
    return {
      ...chapter,
      archived: true,
      archiveReference: `milestone-v${{version}}`
    }
  }
  return chapter
})

const updatedRoadmapData = {
  ...roadmapData,
  chapters: updatedRoadmapChapters,
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

**Step 7.1: Query state concept scoped by initiative**

```
const stateNode = allConcepts.matches?.find(n =>
  n.name === 'state' && n.kind === 'config' && n.parent_id === initiativeId
)
```

**Step 7.2: Update state with milestone completion**

If stateNode exists:
```
const stateId = stateNode.id
const stateSummaryString = stateNode.summary
const stateData = JSON.parse(stateSummaryString)

const updatedStateData = {
  ...stateData,
  current_chapter: null,
  current_plan: null,
  status: "milestone_complete",
  last_completed_milestone: `v${{version}}`,
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
const configData = configNode ? JSON.parse(configNode.summary) : {}
const branchingStrategy = configData.git?.branching_strategy
const aliases = configData.model_aliases || {}
const gitMessageModel = aliases.explore_model || aliases.budget_model
```

If `branchingStrategy` is not set or is `"none"`:
→ Skip this step, proceed to step 9 (Git Tag)

---

**Step 8.2: Check for feature/chapter branches**

For `branching_strategy === "chapter"` or `"milestone"`:

```
// List branches
const branches = bash("git branch --list")
const currentBranch = bash("git rev-parse --abbrev-ref HEAD")

// Find feature/chapter branches for this milestone
const featureBranches = branches.filter(branch =>
  branch.includes('chapter-') || branch.includes('feature-')
)
```

If no feature branches exist:
→ Display: "No feature/chapter branches found for this milestone"
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
    model=gitMessageModel,
    subagent_type="fuska-git-message",
    variant="amend",
    prompt=`<commit_context>
**Mode:** branch-merge
**Milestone:** v${{version}}
**Branch:** ${branch}
**Commit Strategy:** per-chapter

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
    model=gitMessageModel,
    subagent_type="fuska-git-message",
    variant="amend",
    prompt=`<commit_context>
**Mode:** branch-merge
**Milestone:** v${{version}}
**Branch:** ${branch}
**Commit Strategy:** per-chapter

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
- ${totalChapters} chapters archived
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
- fuska progress — View detailed project progress
- /fuska-review — Verify work before starting next milestone
────────────────────────────────────────────────────────────
```

---

## 11. Handle Edge Cases

- Audit missing → recommend /fuska-audit
- Audit has gaps → recommend /fuska-plan-milestone-fixes or offer to proceed as tech debt
- Incomplete chapters → list incomplete chapters, ask to complete first
- Git tag already exists → ask to force update or use different tag
- Push fails → show error, suggest manual push

</process>

<success_criteria>

- [ ] Milestone audit checked (passed or user override)
- [ ] MegaMemory validated (roots exist)
- [ ] Milestone readiness verified (all chapters complete)
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
- **Verify completion:** All chapters must have completed plans (summary concepts exist)
- **User confirmation:** Wait for approval at verification gates
- **Archive before modifying:** Always create archive concept before updating/deleting originals
- **Context efficiency:** Archive keeps roadmap and requirements concepts clean per milestone
- **Fresh requirements:** Next milestone starts with /fuska-new-milestone which includes requirements definition

</critical_rules>
