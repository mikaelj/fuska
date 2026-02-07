---
name: gsd-mm-add-phase
description: Add phase to end of current milestone in roadmap using MegaMemory
argument-hint: <description>
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Add a new integer phase to the end of the current milestone in the roadmap using MegaMemory.

This command appends sequential phases to the current milestone's phase list, automatically calculating the next phase number based on existing phases.

Purpose: Add planned work discovered during execution that belongs at the end of current milestone.
</objective>

<execution_context>
@~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
@~/.config/opencode/gsd-mm/scripts/types.ts
@~/.config/opencode/gsd-mm/scripts/phase-templates.ts
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
Phase description: `$ARGUMENTS` (required)
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Validate Environment

**Step 1.1: Check MegaMemory availability**

Call:
```
megamemory_list_roots()
```

**Step 1.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /gsd-mm-new-project to initialize project"
→ Stop

---

## 2. Parse Arguments

**Step 2.1: Extract phase description**

```
const description = $ARGUMENTS.trim()
```

If description is empty:
```
ERROR: Phase description required
Usage: /gsd-mm-add-phase <description>
Example: /gsd-mm-add-phase Add authentication system
```

Stop.

---

## 3. Load Roadmap from MegaMemory

**Step 3.1: Query roadmap concept**

Call:
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 3.2: Check roadmap exists**

If response.matches.length === 0:
→ Display: "Roadmap concept not found in MegaMemory"
→ Suggest: "Run /gsd-mm-new-project to initialize project"
→ Stop

**Step 3.3: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapId = response.matches[0].id
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)

const phases = roadmapData.phases || []
const currentMilestone = roadmapData.current_milestone
```

---

## 4. Find Current Milestone

**Step 4.1: Identify current milestone**

```
const milestonePhases = phases.filter(p => p.milestone === currentMilestone)
```

If milestonePhases.length === 0:
→ Display: "No phases found in current milestone"
→ Stop

---

## 5. Calculate Next Phase Number

**Step 5.1: Extract all phase numbers**

```
const phaseNumbers = milestonePhases.map(p => p.number).filter(n => Number.isInteger(n))
```

**Step 5.2: Find maximum and increment**

```
const maxPhaseNumber = phaseNumbers.length > 0 ? Math.max(...phaseNumbers) : 0
const nextPhaseNumber = maxPhaseNumber + 1
```

Format as two-digit:
```
const phaseNum = nextPhaseNumber.toString().padStart(2, '0')
```

---

## 6. Generate Phase Slug

**Step 6.1: Convert description to kebab-case slug**

```
const slug = description.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
```

Phase ID: `phase-${phaseNum}`

---

## 7. Create Phase Concept

**Step 7.1: Create phase concept in MegaMemory**

Call:
```
megamemory_create_concept(
  name=`phase-${phaseNum}`,
  kind="feature",
  summary=JSON.stringify({
    number: nextPhaseNumber,
    name: description,
    slug: slug,
    milestone: currentMilestone,
    goal: "To be planned",
    depends_on: [maxPhaseNumber > 0 ? `phase-${maxPhaseNumber.toString().padStart(2, '0')}` : null],
    plans: 0,
    status: "not_planned"
  }),
  parent_id=roadmapId,
  edges=[],
  why=`Phase ${nextPhaseNumber} added to ${currentMilestone}: ${description}`,
  created_by_task="gsd-mm-add-phase"
)
```

Display: "Created phase concept: phase-${phaseNum}"

---

## 8. Update Roadmap Concept

**Step 8.1: Build updated roadmap data**

```
const newPhase = {
  number: nextPhaseNumber,
  name: description,
  slug: slug,
  milestone: currentMilestone,
  goal: "To be planned",
  depends_on: maxPhaseNumber > 0 ? `phase-${maxPhaseNumber.toString().padStart(2, '0')}` : null,
  plans: 0,
  status: "not_planned"
}

const updatedRoadmapData = {
  ...roadmapData,
  phases: [...phases, newPhase]
}
```

**Step 8.2: Update roadmap concept**

Call:
```
megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData)
  }
)
```

Display: "Roadmap updated"

---

## 9. Update State Concept

**Step 9.1: Query state concept**

Call:
```
megamemory_understand(query="state", top_k=5)
```

**Step 9.2: Check state exists**

If response.matches.length > 0:
```
const stateId = response.matches[0].id
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

**Step 9.3: Add roadmap evolution entry**

```
const roadmapEvolution = stateData.roadmap_evolution || []
roadmapEvolution.push({
  timestamp: new Date().toISOString(),
  action: `Phase ${nextPhaseNumber} added`,
  description: description
})

const updatedStateData = {
  ...stateData,
  next_phase: `phase-${phaseNum}`,
  roadmap_evolution: roadmapEvolution
}
```

**Step 9.4: Update state concept**

Call:
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

---

## 10. Present Completion Summary

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {N} ADDED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {description}**

- Status: Not planned yet
- Depends on: Phase {N-1}

──────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan Phase {N}**

/gsd-mm-plan-phase {N}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /gsd-mm-add-phase <description> — add another phase
- /gsd-mm-discuss-phase {N} — gather context first

──────────────────────────────────────────────────────────────
```

</offer_next>

<anti_patterns>

- Don't modify phases outside current milestone
- Don't renumber existing phases
- Don't use decimal numbering (that's for insert-phase)
- Don't create plans yet (that's /gsd-mm-plan-phase)
- Don't commit changes (MegaMemory auto-persists)
</anti_patterns>

<success_criteria>

- [ ] Phase concept created in MegaMemory
- [ ] Roadmap concept updated with new phase
- [ ] State concept updated with roadmap evolution
- [ ] Next phase number calculated correctly (ignoring decimals)
- [ ] User informed of next steps

</success_criteria>
