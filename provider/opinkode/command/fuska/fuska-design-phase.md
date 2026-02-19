---
name: fuska-design-phase
description: Gather phase context through adaptive questioning before planning using MegaMemory
argument-hint: "<phase>"
tools:
  - read
  - bash

  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
---

<objective>

Extract implementation decisions that downstream agents need — researcher and planner will use phase context concepts to know what to investigate and what choices are locked.

**How it works:**
1. Analyze phase from MegaMemory to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create/update phase context concept with decisions that guide research and planning

**Output:** `{phase}-context` concept — decisions clear enough that downstream agents can act without asking the user again.

</objective>

<execution_context>
@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/phase-templates.ts
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

**`megamemory:create_concept` returns:** `{id, message}` on success.

**`megamemory:update_concept` accepts changes:** `{summary?, name?, kind?, why?, file_refs?}` only. Pass the full updated JSON string as `summary`. Returns `{message}`.

</megamemory_guide>

<context>

Phase number: `$ARGUMENTS` (required)

**Load project state from MegaMemory:**

Search MegaMemory for the project state using `megamemory:understand` — query for "state".
The state concept summary is JSON with fields: `current_phase`, `current_plan`, `status`, `progress`, `last_activity`.
Extract the current phase and status to understand where the project stands.

**Load phase information from MegaMemory:**

Search MegaMemory for this phase using `megamemory:understand` — query for "phase {PHASE}" with top_k=10.
Phase concepts are JSON with fields: `number`, `slug`, `name`, `goal`, `status`.
Extract the phase goal and status — these define the scope boundary for discussion.

**Load relevant knowledge from MegaMemory:**

Search MegaMemory for prior decisions using `megamemory:understand` — query for "decisions architecture" with top_k=20.
Look for any previously captured decisions, architectural choices, or constraints that should inform this phase's discussion.

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate Phase Number

**Step 1.1: Extract phase number from arguments**

The variable `input` contains the raw argument string provided by the user.

```
const phaseNumber = input.match(/\d+/)?.[0]
if (!phaseNumber) {
  Display: "Phase number is required"
  Display: "Usage: /fuska-design-phase <phase>"
  Stop
}
```

**Step 1.2: Query roadmap**

Call:
```
megamemory_understand(query="roadmap", top_k=5)
```

**Step 1.3: Check roadmap exists**

If response.matches.length === 0:
→ Display: "Roadmap concept not found in MegaMemory"
→ Suggest: "Run fuska init to initialize initiative"
→ Stop

**Step 1.4: Extract roadmap data**

If response.matches.length > 0:
```
const roadmapSummaryString = response.matches[0].summary
let phases = []

try {
  const roadmapData = JSON.parse(roadmapSummaryString)
  phases = roadmapData.phases || []
} catch (e) {
  const roadmapId = response.matches[0].id
  const phaseConcepts = await megamemory:understand({ query: `parent:${roadmapId} phase`, top_k: 20 })
  phases = phaseConcepts.matches
    .filter(m => m.kind === 'feature' && m.name.startsWith('phase-'))
    .map(m => {
      const phaseData = JSON.parse(m.summary)
      return {
        number: phaseData.number,
        slug: phaseData.slug,
        name: phaseData.name,
        goal: phaseData.goal
      }
    })
    .sort((a, b) => a.number - b.number)
}
```

**Step 1.5: Find matching phase**

```
const matchingPhase = phases.find(p => p.number === phaseNumber)
```

**Step 1.6: Validate phase exists**

If !matchingPhase:
→ Display: `Phase ${phaseNumber} not found in roadmap`
→ Display: "Available phases:"
for (const phase of phases) {
  Display: `- Phase ${phase.number}: ${phase.name}`
}
→ Stop

---

## 2. Check for Existing Phase Context

**Step 2.1: Query phase context**

Call:
```
megamemory_understand(query=`phase-${phaseNumber.toString().padStart(2, '0')}-context`, top_k=1)
```

**Step 2.2: Check if context exists**

If response.matches.length === 0:
```
const contextExists = false
```

Else:
```
const contextSummaryString = response.matches[0].summary
const contextData = JSON.parse(contextSummaryString)
const contextExists = true
```

**Step 2.3: Handle existing context**

If contextExists === true:
→ Use question tool:
```
const contextResponse = question(questions=[{
  header: "Existing Context",
  question: "Phase context already exists. What would you like to do?",
  options: [
    {label: "Update existing", description: "Modify current context with new decisions"},
    {label: "View existing", description: "Show current context decisions"},
    {label: "Replace", description: "Start fresh, overwrite existing"},
    {label: "Skip discussion", description: "Context is good, proceed to planning"}
  ]
}])
```

**Step 2.4: Handle user response**

If user chooses "View existing":
→ Display: contextData
→ Re-offer question options

If user chooses "Replace":
→ Ask confirmation
→ If confirmed, delete existing context and create new

If user chooses "Skip discussion":
→ Continue to step 7

---

## 3. Analyze Phase to Identify Gray Areas

**Step 3.1: Query phase concept**

Call:
```
megamemory_understand(query=`phase ${phaseNumber}`, top_k=5)
```

**Step 3.2: Check phase exists**

If response.matches.length === 0:
→ Display: `Phase ${phaseNumber} not found in MegaMemory`
→ Stop

**Step 3.3: Extract phase data**

If response.matches.length > 0:
```
const phaseSummaryString = response.matches[0].summary
const phaseData = JSON.parse(phaseSummaryString)
const phaseGoal = phaseData.goal
const phaseRequirements = phaseData.requirements || []
```

**Step 3.4: Query requirements (if any)**

If phaseRequirements.length > 0:
```
const requirementIds = phaseRequirements
const requirementConcepts = []

for (const reqId of requirementIds) {
  megamemory_understand(query=reqId, top_k=1)
  if (response.matches.length > 0) {
    const reqSummaryString = response.matches[0].summary
    const reqData = JSON.parse(reqSummaryString)
    requirementConcepts.push({ id: reqId, description: reqData.description, status: reqData.status })
  }
}
```

**Step 3.5: Query existing research (if any)**

Call:
```
megamemory_understand(query=`phase-${phaseNumber.toString().padStart(2, '0')}-research`, top_k=1)
```

If response.matches.length > 0:
```
const researchSummaryString = response.matches[0].summary
const researchData = JSON.parse(researchSummaryString)
```

Else:
```
const researchData = null
```

**Step 3.6: Generate gray areas**

Generate 3-4 phase-specific gray areas based on phase goal:

**Domain-aware gray areas:**

Analyze the phase goal:
- Something users SEE → layout, density, interactions, states
- Something users CALL → responses, errors, auth, versioning
- Something users RUN → output format, flags, modes, error handling
- Something users READ → structure, tone, depth, flow
- Something being ORGANIZED → criteria, grouping, naming, exceptions

Generate 3-4 phase-specific areas (not generic categories).

---

## 4. Present Gray Areas

**Step 4.1: Present gray areas to user**

Use question tool with multiSelect:
```
const areasResponse = question(questions=[{
  header: "Discussion Areas",
  question: "Which areas would you like to discuss for Phase ${phaseNumber}?",
  options: [
    {label: "Gray area 1", description: "[brief description]"},
    {label: "Gray area 2", description: "[brief description]"},
    {label: "Gray area 3", description: "[brief description]"},
    {label: "Gray area 4", description: "[brief description]"}
  ],
  multiple: true
}])
```

**Step 4.2: Track selected areas**

```
const selectedAreas = user_response.options
```

User must select at least one area.

---

## 5. Deep-Dive Each Selected Area

**Step 5.1: Loop through selected areas**

For each selected area:

**Step 5.2: Ask up to 4 questions per area**

Questioning technique:
- Probe for specifics
- Challenge assumptions
- Make abstract concrete
- Surface constraints

Use question tool:
```
const areaResponse = question(questions=[{
  header: "[Area Name]",
  question: "More questions about [area name], or move to next area?",
  options: [
    {label: "More questions", description: "Continue deep-dive"},
    {label: "Move to next", description: "Done with this area"}
  ]
}])
```

**Step 5.3: Handle question response**

If "More questions" → ask 4 more questions and repeat.

If "Move to next" → done with this area, continue to next selected area.

**Scope guardrail:**

- Phase boundary from roadmap is FIXED
- Discussion clarifies HOW to implement, not WHETHER to add more
- If user suggests new capabilities: "That's its own phase. I'll note it as deferred."
- Capture deferred ideas — don't lose them, don't act on them

**Do NOT ask about:**
- Technical implementation (OpenCode handles these)
- Architecture choices (OpenCode handles these)
- Performance concerns (OpenCode handles these)
- Scope expansion (OpenCode handles these)

**Step 5.4: Track all decisions and specifics**

Accumulate across all selected areas:
- `allDecisions` — object with area names as keys and decisions per area
- `allSpecifics` — array of specific decisions captured
- `allDeferred` — array of deferred ideas captured

---

## 6. Update Phase Context Concept

**Step 6.1: Compile context data**

After all areas explored, compile decisions into context data structure:

```
const contextData = {
  gathered: new Date().toISOString().split('T')[0],
  status: 'ready_for_planning',
  phase_boundary: phaseGoal,
  decisions: allDecisions,
  open_code_discretion: [],
  specifics: allSpecifics,
  deferred: allDeferred
}
```

**Step 6.2: Create or update context concept**

Check if context already exists (from step 2):
```
const phaseContextSlug = `phase-${phaseNumber.toString().padStart(2, '0')}-context`
```

If contextExists === true:
→ Update existing concept:
```
megamemory_update_concept(
  id=phaseContextSlug,
  changes={
    summary: JSON.stringify(contextData)
  }
)
```

If contextExists === false:
→ Create new concept:
```
megamemory_create_concept(
  name=phaseContextSlug,
  kind="config",
  summary=JSON.stringify(contextData),
  parent_id=`phase-${phaseNumber.toString().padStart(2, '0')}`,
  why=`Context gathered for Phase ${phaseNumber}`
)
```

**Step 6.3: Verify concept created**

The tool returns `{id, message}` — confirm that concept was created/updated successfully before proceeding.

---

## 7. Offer Next Steps

## 7. Offer Next Steps

Use question tool:

- header: "Context Complete"
- question: "Phase context is ready. What's next?"
- options:
  - "Research phase" — Investigate domain ecosystem (if research enabled)
  - "Plan phase" — Skip to planning
  - "Review context" — Show what was captured

**If user chooses "Research phase":**

→ Query config to check research setting:
```
megamemory_understand(query="config", top_k=5)
```

Extract and check:
```
const configData = JSON.parse(response.matches[0].summary)
const researchEnabled = configData.workflow?.research !== false
```

If researchEnabled === true:
→ Suggest: `/fuska-plan-phase ${phaseNumber} --research`

If researchEnabled === false:
→ Display: "Research is disabled in config. Research phase is not available."
→ Re-offer completion options

**If user chooses "Plan phase":**

→ Suggest: `/fuska-plan-phase ${phaseNumber}`

**If user chooses "Review context":**

→ Display: contextData
→ Re-offer completion options

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
---------------------------------------------------------
 Fuska: Context gathered
--------------------------------------------------------

**Phase ${phaseNumber}: ${phaseName || 'Unnamed'}**

Decisions captured:
${Object.keys(allDecisions || {}).map(area => `- ${area}: ${allDecisions[area] || 'No decisions'}`).join('\n') || 'No decisions captured'}

Deferred ideas:
${allDeferred.map(deferred => `- ${deferred}`).join('\n') || 'No deferred ideas'}

──────────────────────────────────────────────────────────────

## > Next Up

**Research Phase ${phaseNumber}** — investigate domain ecosystem
/fuska-plan-phase ${phaseNumber} --research

**Or skip to planning:**

**Plan Phase ${phaseNumber}** — create execution plans directly
/fuska-plan-phase ${phaseNumber}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] Phase number validated against roadmap
- [ ] Existing phase context checked (offered update/view/skip if found)
- [ ] Gray areas identified through intelligent analysis
- [ ] User chose which areas to discuss
- [ ] Each selected area explored until satisfied (4+ questions per area)
- [ ] Scope creep redirected to deferred ideas
- [ ] Phase context concept created or updated
- [ ] Decisions are specific enough for downstream agents
- [ ] User knows next steps (research or planning)

</success_criteria>
