---
name: fuska-insert-phase
description: Insert urgent work (e.g., "72.1 quick fix" - immediately after 72.1 phase) using MegaMemory
argument-hint: <after> <description>
agent: fuska-planner
tools:
  - read
  - write
  - bash
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases using MegaMemory.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.
</objective>

<execution_context>
@./opencode/fuska/references/preflight-check-project-exists.md
@./opencode/fuska/scripts/types.ts
@./opencode/fuska/scripts/phase-templates.ts
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

<step name="validate_megamemory">
Check MegaMemory availability and load project state.

**Step 1: Call list_roots**
```
megamemory_list_roots()
```

**Step 2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 3: Query state concept**
```
megamemory_understand(query="state", top_k=5)
```

**Step 4: Check state exists**

If response.matches.length === 0:
→ Display: "Project state not found in MegaMemory"
→ Suggest: "Run /fuska-new-project to initialize project"
→ Stop

**Step 5: Extract state data**

If response.matches.length > 0:
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```
</step>

<step name="parse_arguments">
Parse the command arguments:
- First argument: integer phase number to insert after
- Remaining arguments: phase description

Example: `/fuska-insert-phase 72 Fix critical auth bug`
→ after = 72
→ description = "Fix critical auth bug"

Validation:

```bash
if [ $# -lt 2 ]; then
  echo "ERROR: Both phase number and description required"
  echo "Usage: /fuska-insert-phase <after> <description>"
  echo "Example: /fuska-insert-phase 72 Fix critical auth bug"
  exit 1
fi
```

Parse first argument as integer:

```bash
after_phase=$1
shift
description="$*"

# Validate after_phase is an integer
if ! [[ "$after_phase" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Phase number must be an integer"
  exit 1
fi
```
</step>

<step name="verify_target_phase">
Verify that the target phase exists in the roadmap:

**Step 1: Query roadmap concept**
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 2: Check roadmap exists**

If response.matches.length === 0:
→ Display: "ERROR: Roadmap not found in MegaMemory"
→ Stop

**Step 3: Extract roadmap data**
```
const roadmapSummaryString = response.matches[0].summary
const roadmapData = JSON.parse(roadmapSummaryString)
```

**Step 4: Search for target phase**
Find phase with number equal to after_phase in roadmapData.phases array.

**Step 5: If not found:**
```
ERROR: Phase {after_phase} not found in roadmap
Available phases: [list phase numbers from roadmapData.phases]
```

Stop.

**Step 6: Verify phase is in current milestone (not completed/archived)**
Check phase status is not "complete" or "archived".
</step>

<step name="find_existing_decimals">
Find existing decimal phases after the target phase:

**Step 1: Query phase concepts**
```
megamemory_understand(query=`phase-${after_phase.toString().padStart(2, '0')}`, top_k=20)
```

**Step 2: Extract decimal phases**
Filter matches where name matches pattern `{after_phase}.{N}` and kind is "feature".

**Step 3: Find highest decimal suffix**
Parse decimal numbers from matching concept names.

Examples:
- Phase 72 with no decimals → next is 72.1
- Phase 72 with 72.1 → next is 72.2
- Phase 72 with 72.1, 72.2 → next is 72.3

**Step 4: Calculate next decimal**
Store as: `decimal_phase="${after_phase.toString().padStart(2, '0')}.${next_decimal}"`
</step>

<step name="generate_slug">
Convert the phase description to a kebab-case slug:

```bash
slug=$(echo "$description" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
```

Phase slug: `phase-${decimal_phase}-${slug}`
Example: `phase-06.1-fix-critical-auth-bug` (phase 6 insertion)
</step>

<step name="create_phase_concept">
Create the phase concept in MegaMemory:

**Step 1: Build phase data**
```
const phaseData = {
  number: decimal_phase,
  name: description,
  goal: "[Urgent work - to be planned]",
  depends_on: `phase-${after_phase.toString().padStart(2, '0')}`,
  status: "not_planned",
  plans: [],
  marker: "INSERTED"
}
```

**Step 2: Create phase concept**
```
megamemory_create_concept(
  name=`${phaseSlug}`,
  kind="feature",
  summary=JSON.stringify(phaseData),
  why=`Urgent phase inserted after phase ${after_phase}: ${description}`,
  parent_id=roadmapId
)
```

Confirm: "Created phase concept: ${phaseSlug}"
</step>

<step name="update_roadmap">
Insert the new phase entry into the roadmap:

**Step 1: Extract roadmap ID**
```
const roadmapId = response.matches[0].id
```

**Step 2: Build updated phases array**
Insert new phase entry immediately after the target phase in roadmapData.phases array.

New phase entry:
```json
{
  "number": "{decimal_phase}",
  "name": "{Description} (INSERTED)",
  "goal": "[Urgent work - to be planned]",
  "depends_on": "{after_phase}",
  "plans": [],
  "status": "not_planned",
  "marker": "INSERTED"
}
```

**Step 3: Update roadmap concept**
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

The "(INSERTED)" marker helps identify decimal phases as urgent insertions.

Preserve all other content exactly (formatting, other phases).
</step>

<step name="update_project_state">
Update state concept to reflect the inserted phase:

**Step 1: Extract state ID**
```
const stateId = stateResponse.matches[0].id
```

**Step 2: Build updated state data**
```
const updatedStateData = {
  ...stateData,
  roadmap_evolution: [
    ...(stateData.roadmap_evolution || []),
    `Phase ${decimal_phase} inserted after Phase ${after_phase}: ${description} (URGENT)`
  ],
  last_activity: `Inserted urgent phase ${decimal_phase}`
}
```

**Step 3: Update state concept**
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

Add note about insertion reason if appropriate.
</step>

<step name="completion">
Present completion summary:

```
Phase {decimal_phase} inserted after Phase {after_phase}:
- Description: {description}
- Slug: {phaseSlug}
- Status: Not planned yet
- Marker: (INSERTED) - indicates urgent work

Roadmap updated in MegaMemory
Project state updated in MegaMemory

---

## > Next Up

**Phase {decimal_phase}: {description}** — urgent insertion

`/fuska-plan-phase {decimal_phase}`

*`/new` first → fresh context window*

---

**Also available:**
- Review insertion impact: Check if Phase {next_integer} dependencies still make sense
- Review roadmap: Query roadmap concept

---
```
</step>

</process>

<anti_patterns>

- Don't use this for planned work at end of milestone (use /fuska-add-phase)
- Don't insert before Phase 1 (decimal 0.1 makes no sense)
- Don't renumber existing phases
- Don't modify the target phase content
- Don't create plans yet (that's /fuska-plan-phase)
- Don't commit changes (user decides when to commit)
</anti_patterns>

<success_criteria>
Phase insertion is complete when:

- [ ] Phase concept created in MegaMemory
- [ ] Roadmap concept updated with new phase entry (includes "(INSERTED)" marker)
- [ ] Phase inserted in correct position (after target phase, before next integer phase)
- [ ] State concept updated with roadmap evolution note
- [ ] Decimal number calculated correctly (based on existing decimals)
- [ ] User informed of next steps and dependency implications
</success_criteria>
