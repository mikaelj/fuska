---
name: fuska-plan-milestone-fixes
description: Create chapters to close all gaps identified by milestone audit using MegaMemory
agent: "fuska-planner"
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
Create all chapters necessary to close gaps identified by `/fuska-audit-milestone` using MegaMemory.

Reads verification concept (from audit), groups gaps into logical chapters, creates chapter concepts in MegaMemory, and offers to plan each chapter.

One command creates all fix chapters — no manual `/fuska-add-chapter` per gap.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md
<!-- Spawns fuska-planner agent which has all planning expertise baked in -->
</execution_context>

<context>
**Audit results:**
Query verification concept: `megamemory_understand(query="verification", top_k=10)`

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

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Load Audit Results from MegaMemory

**Step 1.1: Query verification concept**
```
megamemory_understand(query="verification", top_k=10)
```

**Step 1.2: Check for verification concept**

If response.matches.length === 0:
→ Display: "No verification concept found in MegaMemory"
→ Suggest: "Run /fuska-audit-milestone first to create audit results"
→ Stop

**Step 1.3: Extract verification data**
```
const verificationSummaryString = response.matches[0].summary
const verificationData = JSON.parse(verificationSummaryString)

const gaps = verificationData.gaps || {
  requirements: [],
  integration: [],
  flows: []
}
```

**Step 1.4: Check for gaps**

If gaps.requirements.length === 0 AND gaps.integration.length === 0 AND gaps.flows.length === 0:
→ Display: "No gaps found in verification concept"
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
| `must` | Create chapter, blocks milestone |
| `should` | Create chapter, recommended |
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
  // Determine priority from affected chapters/requirements
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

## 4. Group Gaps into Chapters

Cluster related gaps into logical chapters:

**Grouping rules:**
- Same affected chapter → combine into one fix chapter
- Same subsystem (auth, API, UI) → combine
- Dependency order (fix stubs before wiring)
- Keep chapters focused: 2-4 tasks each

**Step 4.1: Build chapter proposals**

```
const chapterProposals = []

// Group must gaps
const mustChapters = clusterGaps(mustGaps, "must")
chapterProposals.push(...mustChapters)

// Group should gaps
const shouldChapters = clusterGaps(shouldGaps, "should")
chapterProposals.push(...shouldChapters)

// Group nice gaps
const niceChapters = clusterGaps(niceGaps, "nice")
chapterProposals.push(...niceChapters)
```

**Example grouping:**
```
Gap: DASH-01 unsatisfied (Dashboard doesn't fetch)
Gap: Integration Chapter 1→3 (Auth not passed to API calls)
Gap: Flow "View dashboard" broken at data fetch

→ Chapter: "Wire Dashboard to API"
  - Gap: DASH-01 (requirement)
  - Gap: Chapter 1→3 (integration)
  - Gap: "View dashboard" (flow)
  - Tasks:
    - Add fetch to Dashboard.tsx
    - Include auth header in fetch
    - Handle response, update state
    - Render user data
```

## 5. Determine Chapter Numbers

Find highest existing chapter in roadmap:
```
const highestChapterNumber = roadmapData.chapters.reduce((max, chapter) => {
  const chapterNum = parseFloat(chapter.number)
  return chapterNum > max ? chapterNum : max
}, 0)
```

New chapters continue from there:
- If Chapter 5 is highest, gaps become Chapter 6, 7, 8...

## 6. Present Gap Closure Plan

```
## Gap Closure Plan

**Milestone:** ${uatData.version || 'current'}
**Gaps to close:** ${gaps.requirements.length} requirements, ${gaps.integration.length} integration, ${gaps.flows.length} flows

### Proposed Chapters

${chapterProposals.filter(p => p.priority !== 'nice').map(chapter => `
**Chapter ${chapter.number}: ${chapter.name}** (${chapter.priority.toUpperCase()})
Priority: ${chapter.priority.toUpperCase()}
Closes:
${chapter.gaps.map(g => `- ${gapDescription(g)}`).join('\n')}
Estimated tasks: ${chapter.taskCount}
`).join('\n')}

${niceGaps.length > 0 ? `
### Deferred (nice-to-have)

These gaps are optional. Include them?

${niceChapters.map(chapter => `
**Chapter ${chapter.number}: ${chapter.name}**
${chapter.gaps.map(g => `- ${gapDescription(g)}`).join('\n')}
`).join('\n')}

---

Create these ${chapterProposals.filter(p => p.priority !== 'nice').length + (niceChapters.length || 0)} chapters? (yes / adjust / defer all optional)
` : `
---

Create these ${chapterProposals.length} chapters? (yes / adjust)
`}
```

Use question tool to get user confirmation:
```
const gapResponse = question(questions=[{
  header: "Gap Closure Plan",
  question: "How would you like to proceed?",
  options: [
    {label: "Create chapters", description: "Create all proposed chapters in MegaMemory"},
    {label: "Adjust plan", description: "Modify chapter groupings or priorities"},
    {label: "Defer nice-to-have", description: "Skip nice-to-have gaps for now"}
  ]
}])
```

## 7. Update Roadmap in MegaMemory

**Step 7.1: Build new chapter entries**

```
const newChapters = chapterProposals.filter(chapter => includeChapter(chapter)).map(chapter => ({
  number: chapter.number.toString(),
  name: chapter.name + " (Gap Closure)",
  goal: `Close gaps: ${chapter.gaps.map(g => gapDescription(g)).join(', ')}`,
  depends_on: [], // Will be calculated based on existing chapters
  plans: [],
  status: "pending",
  priority: chapter.priority,
  is_fix: true
}))
```

**Step 7.2: Append to roadmap chapters**
```
const updatedChaptersArray = [...roadmapData.chapters, ...newChapters]
```

**Step 7.3: Update roadmap concept**
```
const updatedRoadmapData = {
  ...roadmapData,
  chapters: updatedChaptersArray
}

megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData)
  }
)
```

## 8. Create Chapter Concepts

**Step 8.1: For each new chapter, create chapter concept**

```
newChapters.forEach(chapter => {
  const chapterSlug = `chapter-${chapter.number.toString().padStart(2, '0')}`

  const chapterData = {
    number: chapter.number.toString(),
    name: chapter.name,
    goal: chapter.goal,
    depends_on: chapter.depends_on || [],
    status: "pending",
    plans: [],
    priority: chapter.priority,
    is_fix: true,
    gaps: chapter.gaps
  }

  megamemory_create_concept(
    name=chapterSlug,
    kind="feature",
    summary=JSON.stringify(chapterData),
    why=`Gap closure chapter created from milestone audit`
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
  fix_chapters_created: true,
  fix_chapter_count: newChapters.length
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
## [OK] Gap Closure Chapters Created

**Chapters added:** ${newChapters.map(p => p.number).join(', ')}
**Gaps addressed:** ${gaps.requirements.length} requirements, ${gaps.integration.length} integration, ${gaps.flows.length} flows

---

## > Next Up

**Plan first gap closure chapter**

/fuska-plan ${newChapters[0].number}

*/new first → fresh context window*

---

**Also available:**
- /fuska-build ${newChapters[0].number} — if plans already exist
- Query roadmap: megamemory:understand(query='roadmap') — see updated roadmap

---

**After all gap chapters complete:**

/fuska-audit-milestone — re-audit to verify gaps closed
/fuska-complete-milestone {version} — archive when audit passes
```

</process>

<gap_to_chapter_mapping>

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

chapter: "Wire Dashboard Data"
chapterData.gaps: [gap]
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
  from_chapter: 1
  to_chapter: 3
  connection: "Auth token → API calls"
  reason: "Dashboard API calls don't include auth header"
  missing:
    - "Auth header in fetch calls"
    - "Token refresh on 401"

becomes:

chapter: "Add Auth to Dashboard API Calls"
chapterData.gaps: [gap]
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

# Usually same chapter as requirement/integration gap
# Flow gaps often overlap with other gap types
```

</gap_to_chapter_mapping>

<success_criteria>
- [ ] Verification concept loaded and issues parsed
- [ ] Requirements queried for prioritization
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into logical chapters
- [ ] User confirmed chapter plan
- [ ] Roadmap concept updated with new chapters
- [ ] Chapter concepts created in MegaMemory
- [ ] State concept updated with gap closure status
- [ ] User knows to run `/fuska-plan` next
</success_criteria>
