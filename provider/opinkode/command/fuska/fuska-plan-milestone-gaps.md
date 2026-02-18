---
name: fuska-plan-milestone-gaps
description: Create phases to close all gaps identified by milestone audit using MegaMemory
agent: @../../agents/fuska/fuska-planner.md
tools:
  - read
  - write
  - bash
  - glob
  - grep
  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Create all phases necessary to close gaps identified by `/fuska-audit-milestone` using MegaMemory.

Reads UAT concept (from audit), groups gaps into logical phases, creates phase concepts in MegaMemory, and offers to plan each phase.

One command creates all fix phases — no manual `/fuska-add-phase` per gap.
</objective>

<execution_context>
@../../fuska/references/preflight-check-project-exists.md
<!-- Spawns fuska-planner agent which has all planning expertise baked in -->
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
**Audit results:**
Query UAT concept: `megamemory_understand(query="uat", top_k=10)`

**Original intent (for prioritization):**
```
megamemory_understand(query="requirements", top_k=50)
```

**Current state:**
```
megamemory_understand(query="roadmap", top_k=5)
megamemory_understand(query="state", top_k=5)
```
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Load Audit Results from MegaMemory

**Step 1.1: Query UAT concept**
```
megamemory_understand(query="uat", top_k=10)
```

**Step 1.2: Check for UAT concept**

If response.matches.length === 0:
→ Display: "No UAT concept found in MegaMemory"
→ Suggest: "Run /fuska-audit-milestone first to create audit results"
→ Stop

**Step 1.3: Extract UAT data**
```
const uatSummaryString = response.matches[0].summary
const uatData = JSON.parse(uatSummaryString)

const gaps = uatData.gaps || {
  requirements: [],
  integration: [],
  flows: []
}
```

**Step 1.4: Check for gaps**

If gaps.requirements.length === 0 AND gaps.integration.length === 0 AND gaps.flows.length === 0:
→ Display: "No gaps found in UAT concept"
→ Suggest: "Run /fuska-audit-milestone first"
→ Stop

## 2. Load Prioritization Context

**Step 2.1: Query requirements**
```
megamemory_understand(query="requirements", top_k=50)
```

**Step 2.2: Extract requirement data**
```
const requirementConcepts = response.matches.map(match => {
  const summaryString = match.summary
  const reqData = JSON.parse(summaryString)
  return {
    id: match.id,
    description: reqData.description,
    priority: reqData.priority
  }
})
```

Build priority lookup map:
```
const priorityMap = requirementConcepts.reduce((map, req) => {
  map[req.id] = req.priority
  return map
}, {})
```

**Step 2.3: Query roadmap**
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 2.4: Extract roadmap data**
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)
const roadmapId = response.matches[0].id
```

## 3. Prioritize Gaps

Group gaps by priority from requirements:

| Priority | Action |
|----------|--------|
| `must` | Create phase, blocks milestone |
| `should` | Create phase, recommended |
| `nice` | Ask user: include or defer? |

**Step 3.1: Categorize gaps**

```
const mustGaps = []
const shouldGaps = []
const niceGaps = []

gaps.requirements.forEach(gap => {
  const priority = priorityMap[gap.id] || 'should'
  if (priority === 'must') mustGaps.push(gap)
  else if (priority === 'should') shouldGaps.push(gap)
  else niceGaps.push(gap)
})

// Integration and flow gaps inherit priority from affected requirements
gaps.integration.forEach(gap => {
  // Determine priority from affected phases/requirements
  const priority = inferPriority(gap, priorityMap)
  if (priority === 'must') mustGaps.push(gap)
  else if (priority === 'should') shouldGaps.push(gap)
  else niceGaps.push(gap)
})

gaps.flows.forEach(gap => {
  const priority = inferPriority(gap, priorityMap)
  if (priority === 'must') mustGaps.push(gap)
  else if (priority === 'should') shouldGaps.push(gap)
  else niceGaps.push(gap)
})
```

## 4. Group Gaps into Phases

Cluster related gaps into logical phases:

**Grouping rules:**
- Same affected phase → combine into one fix phase
- Same subsystem (auth, API, UI) → combine
- Dependency order (fix stubs before wiring)
- Keep phases focused: 2-4 tasks each

**Step 4.1: Build phase proposals**

```
const phaseProposals = []

// Group must gaps
const mustPhases = clusterGaps(mustGaps, "must")
phaseProposals.push(...mustPhases)

// Group should gaps
const shouldPhases = clusterGaps(shouldGaps, "should")
phaseProposals.push(...shouldPhases)

// Group nice gaps
const nicePhases = clusterGaps(niceGaps, "nice")
phaseProposals.push(...nicePhases)
```

**Example grouping:**
```
Gap: DASH-01 unsatisfied (Dashboard doesn't fetch)
Gap: Integration Phase 1→3 (Auth not passed to API calls)
Gap: Flow "View dashboard" broken at data fetch

→ Phase: "Wire Dashboard to API"
  - Gap: DASH-01 (requirement)
  - Gap: Phase 1→3 (integration)
  - Gap: "View dashboard" (flow)
  - Tasks:
    - Add fetch to Dashboard.tsx
    - Include auth header in fetch
    - Handle response, update state
    - Render user data
```

## 5. Determine Phase Numbers

Find highest existing phase in roadmap:
```
const highestPhaseNumber = roadmapData.phases.reduce((max, phase) => {
  const phaseNum = parseFloat(phase.number)
  return phaseNum > max ? phaseNum : max
}, 0)
```

New phases continue from there:
- If Phase 5 is highest, gaps become Phase 6, 7, 8...

## 6. Present Gap Closure Plan

```
## Gap Closure Plan

**Milestone:** ${uatData.version || 'current'}
**Gaps to close:** ${gaps.requirements.length} requirements, ${gaps.integration.length} integration, ${gaps.flows.length} flows

### Proposed Phases

${phaseProposals.filter(p => p.priority !== 'nice').map(phase => `
**Phase ${phase.number}: ${phase.name}** (${phase.priority.toUpperCase()})
Priority: ${phase.priority.toUpperCase()}
Closes:
${phase.gaps.map(g => `- ${gapDescription(g)}`).join('\n')}
Estimated tasks: ${phase.taskCount}
`).join('\n')}

${niceGaps.length > 0 ? `
### Deferred (nice-to-have)

These gaps are optional. Include them?

${nicePhases.map(phase => `
**Phase ${phase.number}: ${phase.name}**
${phase.gaps.map(g => `- ${gapDescription(g)}`).join('\n')}
`).join('\n')}

---

Create these ${phaseProposals.filter(p => p.priority !== 'nice').length + (nicePhases.length || 0)} phases? (yes / adjust / defer all optional)
` : `
---

Create these ${phaseProposals.length} phases? (yes / adjust)
`}
```

Use question tool to get user confirmation:
```
const gapResponse = question(questions=[{
  header: "Gap Closure Plan",
  question: "How would you like to proceed?",
  options: [
    {label: "Create phases", description: "Create all proposed phases in MegaMemory"},
    {label: "Adjust plan", description: "Modify phase groupings or priorities"},
    {label: "Defer nice-to-have", description: "Skip nice-to-have gaps for now"}
  ]
}])
```

## 7. Update Roadmap in MegaMemory

**Step 7.1: Build new phase entries**

```
const newPhases = phaseProposals.filter(phase => includePhase(phase)).map(phase => ({
  number: phase.number.toString(),
  name: phase.name + " (Gap Closure)",
  goal: `Close gaps: ${phase.gaps.map(g => gapDescription(g)).join(', ')}`,
  depends_on: [], // Will be calculated based on existing phases
  plans: [],
  status: "not_planned",
  priority: phase.priority,
  gap_closure: true
}))
```

**Step 7.2: Append to roadmap phases**
```
const updatedPhasesArray = [...roadmapData.phases, ...newPhases]
```

**Step 7.3: Update roadmap concept**
```
const updatedRoadmapData = {
  ...roadmapData,
  phases: updatedPhasesArray
}

megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData)
  }
)
```

## 8. Create Phase Concepts

**Step 8.1: For each new phase, create phase concept**

```
newPhases.forEach(phase => {
  const phaseSlug = `phase-${phase.number.toString().padStart(2, '0')}`

  const phaseData = {
    number: phase.number.toString(),
    name: phase.name,
    goal: phase.goal,
    depends_on: phase.depends_on || [],
    status: "not_planned",
    plans: [],
    priority: phase.priority,
    gap_closure: true,
    gaps: phase.gaps
  }

  megamemory_create_concept(
    name=phaseSlug,
    kind="feature",
    summary=JSON.stringify(phaseData),
    why=`Gap closure phase created from milestone audit`
  )
})
```

## 9. Update State Concept

**Step 9.1: Query state concept**
```
megamemory_understand(query="state", top_k=5)
```

**Step 9.2: Extract state data**
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

**Step 9.3: Build updated state data**
```
const updatedStateData = {
  ...stateData,
  gap_closure_phases_created: true,
  gap_closure_phase_count: newPhases.length
}
```

**Step 9.4: Update state concept**
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

## 10. Offer Next Steps

```
## [OK] Gap Closure Phases Created

**Phases added:** ${newPhases.map(p => p.number).join(', ')}
**Gaps addressed:** ${gaps.requirements.length} requirements, ${gaps.integration.length} integration, ${gaps.flows.length} flows

---

## > Next Up

**Plan first gap closure phase**

/fuska-plan-phase ${newPhases[0].number}

*/new first → fresh context window*

---

**Also available:**
- /fuska-build-phase ${newPhases[0].number} — if plans already exist
- Query roadmap: megamemory:understand(query='roadmap') — see updated roadmap

---

**After all gap phases complete:**

/fuska-audit-milestone — re-audit to verify gaps closed
/fuska-complete-milestone {version} — archive when audit passes
```

</process>

<gap_to_phase_mapping>

## How Gaps Become Tasks

**Requirement gap → Tasks:**
```yaml
gap:
  id: DASH-01
  description: "User sees their data"
  reason: "Dashboard exists but doesn't fetch from API"
  missing:
    - "useEffect with fetch to /api/user/data"
    - "State for user data"
    - "Render user data in JSX"

becomes:

phase: "Wire Dashboard Data"
phaseData.gaps: [gap]
tasks:
  - name: "Add data fetching"
    files: [src/components/Dashboard.tsx]
    action: "Add useEffect that fetches /api/user/data on mount"

  - name: "Add state management"
    files: [src/components/Dashboard.tsx]
    action: "Add useState for userData, loading, error states"

  - name: "Render user data"
    files: [src/components/Dashboard.tsx]
    action: "Replace placeholder with userData.map rendering"
```

**Integration gap → Tasks:**
```yaml
gap:
  from_phase: 1
  to_phase: 3
  connection: "Auth token → API calls"
  reason: "Dashboard API calls don't include auth header"
  missing:
    - "Auth header in fetch calls"
    - "Token refresh on 401"

becomes:

phase: "Add Auth to Dashboard API Calls"
phaseData.gaps: [gap]
tasks:
  - name: "Add auth header to fetches"
    files: [src/components/Dashboard.tsx, src/lib/api.ts]
    action: "Include Authorization header with token in all API calls"

  - name: "Handle 401 responses"
    files: [src/lib/api.ts]
    action: "Add interceptor to refresh token or redirect to login on 401"
```

**Flow gap → Tasks:**
```yaml
gap:
  name: "User views dashboard after login"
  broken_at: "Dashboard data load"
  reason: "No fetch call"
  missing:
    - "Fetch user data on mount"
    - "Display loading state"
    - "Render user data"

becomes:

# Usually same phase as requirement/integration gap
# Flow gaps often overlap with other gap types
```

</gap_to_phase_mapping>

<success_criteria>
- [ ] UAT concept loaded and gaps parsed
- [ ] Requirements queried for prioritization
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into logical phases
- [ ] User confirmed phase plan
- [ ] Roadmap concept updated with new phases
- [ ] Phase concepts created in MegaMemory
- [ ] State concept updated with gap closure status
- [ ] User knows to run `/fuska-plan-phase` next
</success_criteria>
