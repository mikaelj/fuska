---
name: fuska-remove-phase
description: Remove a future phase from roadmap using MegaMemory and renumber subsequent phases
argument-hint: <phase-number>
tools:
  - read
  - bash
  - question

  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:remove_concept
  - megamemory:list_roots
---

<objective>
Remove an unstarted future phase from the roadmap concept in MegaMemory and renumber all subsequent phases to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase removed from roadmap concept, all subsequent phases renumbered, historical record preserved via update_concept.
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

**`megamemory:remove_concept` returns:** `{message}` on success.

**`megamemory:list_roots` returns:** an array of root concepts.

</megamemory_guide>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 1. Parse Arguments

**Step 1.1: Extract phase number**

Parse the command arguments:
- Argument is the phase number to remove (integer or decimal)
- Example: `/fuska-remove-phase 17` → phase = 17
- Example: `/fuska-remove-phase 16.1` → phase = 16.1

If no argument provided:

```
ERROR: Phase number required
Usage: /fuska-remove-phase <phase-number>
Example: /fuska-remove-phase 17
```

Exit.

**Step 1.2: Normalize phase to slug**

The variable `input` contains the raw argument string provided by the user.

```
const phaseNumber = parseFloat(input)
const phaseSlug = `phase-${Math.floor(phaseNumber).toString().padStart(2, '0')}`
```

---

## 2. Validate Environment

**Step 2.1: Check MegaMemory availability**

```
megamemory_list_roots()
```

**Step 2.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

---

## 3. Load State and Roadmap

**Step 3.1: Query state concept**

```
megamemory_understand(query="state", top_k=5)
```

**Step 3.2: Check state exists**

If response.matches.length === 0:
→ Display: "State concept not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 3.3: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
const currentPhase = stateData.current_phase
const currentPhaseNumber = parseInt(currentPhase.replace('phase-', ''))
```

**Step 3.4: Query roadmap concept**

```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 3.5: Check roadmap exists**

If response.matches.length === 0:
→ Display: "Roadmap concept not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 3.6: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapId = response.matches[0].id
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)
```

---

## 4. Validate Phase Exists

**Step 4.1: Find phase in roadmap**

Search for phase in roadmapData.phases array:

```
const targetPhase = roadmapData.phases.find(p => p.number === phaseNumber)
```

**Step 4.2: Check if phase exists**

If targetPhase is undefined:

```
ERROR: Phase {phaseNumber} not found in roadmap
Available phases: [list phase numbers]
```

Exit.

---

## 5. Validate Future Phase

**Step 5.1: Compare to current phase**

Compare target phase to current phase from stateData:

```
if (phaseNumber <= currentPhaseNumber) {
```

Display:
```
ERROR: Cannot remove Phase {phaseNumber}

Only future phases can be removed:
- Current phase: {currentPhaseNumber}
- Phase {phaseNumber} is current or completed

To abandon current work, use /fuska-pause-work instead.
```

Exit.

**Step 5.2: Check for completed work**

Query plan concepts for this phase:

```
megamemory_understand(query=`${phaseSlug}-plan`, top_k=20)
```

If response.matches.length > 0:

Query summary concepts for this phase:

```
megamemory_understand(query=`${phaseSlug}-summary`, top_k=20)
```

If summary concepts exist:

```
ERROR: Phase {phaseNumber} has completed work

Found executed plans:
- {list of summaries}

Cannot remove phases with completed work.
```

Exit.

---

## 6. Gather Phase Info and Subsequent Phases

**Step 6.1: Extract phase info**

```
const phaseName = targetPhase.name
const phaseGoal = targetPhase.goal
const phaseStatus = targetPhase.status
```

**Step 6.2: Find subsequent phases**

For integer phase removal (e.g., 17):
- Find all phases with number > 17 (integers: 18, 19, 20...)
- Find all decimal phases >= 17.0 and < 18.0 (17.1, 17.2...) → these become 16.x
- Find all decimal phases for subsequent integers (18.1, 19.1...) → renumber with their parent

For decimal phase removal (e.g., 17.1):
- Find all decimal phases > 17.1 and < 18 (17.2, 17.3...) → renumber down
- Integer phases unchanged

```
const subsequentPhases = roadmapData.phases.filter(p => p.number > phaseNumber)
// Apply decimal phase logic based on integer vs decimal removal
```

List all phases that will be renumbered.

---

## 7. Confirm Removal

Present removal summary and confirm:

```
Removing Phase {phaseNumber}: {phaseName}

This will:
- Remove from roadmap concept
- Renumber {N} subsequent phases:
  - Phase 18 → Phase 17
  - Phase 18.1 → Phase 17.1
  - Phase 19 → Phase 18
  [etc.]

Proceed? (y/n)
```

Wait for confirmation.

---

## 8. Update Roadmap Concept

**Step 8.1: Build updated phases array**

```
const updatedPhases = roadmapData.phases
  .filter(p => p.number !== phaseNumber)  // Remove target phase
  .map(p => {
    if (p.number > phaseNumber) {
      // Renumber phase and update slug
      const newNumber = p.number - 1
      const newSlug = `phase-${Math.floor(newNumber).toString().padStart(2, '0')}`
      return { ...p, number: newNumber, slug: newSlug }
    }
    // Handle decimal phase renumbering logic here
    return p
  })
```

**Step 8.2: Update roadmap concept**

```
const updatedRoadmapData = {
  ...roadmapData,
  phases: updatedPhases,
  total_phases: updatedPhases.length
}

megamemory_update_concept(
  id=roadmapId,
  changes={
    summary: JSON.stringify(updatedRoadmapData),
    why: `Removed Phase ${phaseNumber} (${phaseName}) and renumbered subsequent phases`
  }
)
```

---

## 9. Update State Concept

**Step 9.1: Build updated state data**

```
const updatedStateData = {
  ...stateData,
  total_phases: updatedPhases.length,
  last_activity: `Removed Phase ${phaseNumber}`
}

// Recalculate progress percentage if needed
```

**Step 9.2: Update state concept**

```
const stateId = response.matches[0].id  // From step 3.3

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData),
    why: `Updated phase count after removing Phase ${phaseNumber}`
  }
)
```

---

## 10. Present Completion Summary

```
Phase {phaseNumber} ({phaseName}) removed.

Changes:
- Removed from roadmap concept
- Renumbered: Phases {first-renumbered}-{last-old} → {first-renumbered-1}-{last-new}
- Updated: Roadmap and State concepts

Current roadmap: {total-remaining} phases
Current position: Phase {currentPhaseNumber} of {new-total}

---

## What's Next

Would you like to:
- /fuska-progress — see updated roadmap status
- Continue with current phase
- Review roadmap

---
```

</process>

<anti_patterns>

- Don't remove completed phases (have summary concepts)
- Don't remove current or past phases
- Don't leave gaps in numbering - always renumber
- Don't add "removed phase" notes to state - update_concept why field is the record
- Don't ask about each decimal phase - just renumber them
- Don't modify completed phase concepts
</anti_patterns>

<edge_cases>

**Removing a decimal phase (e.g., 17.1):**
- Only affects other decimals in same series (17.2 → 17.1, 17.3 → 17.2)
- Integer phases unchanged
- Simpler operation

**No subsequent phases to renumber:**
- Removing the last phase (e.g., Phase 20 when that's the end)
- Just remove from roadmap, no renumbering needed

**Decimal phases under removed integer:**
- Removing Phase 17 when 17.1, 17.2 exist
- 17.1 → 16.1, 17.2 → 16.2
- They maintain their position in execution order (after current last integer)

</edge_cases>

<success_criteria>
Phase removal is complete when:

- [ ] MegaMemory validated (roots exist)
- [ ] State concept loaded
- [ ] Roadmap concept loaded
- [ ] Target phase validated as future/unstarted
- [ ] No completed work found (no summary concepts)
- [ ] User confirmed removal
- [ ] Phase removed from roadmap concept
- [ ] All subsequent phases renumbered in roadmap
- [ ] State concept updated (phase count, last activity)
- [ ] No gaps in phase numbering
- [ ] User informed of changes
</success_criteria>
