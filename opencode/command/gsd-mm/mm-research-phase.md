---
name: gsd-mm-research-phase
description: Research how to implement a phase (standalone - usually use /gsd-mm-plan-phase instead) using MegaMemory
argument-hint: "[phase]"
agent: gsd-mm-phase-researcher
tools:
  - read
  - bash
  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Research how to implement a phase using MegaMemory. Spawns gsd-mm-phase-researcher agent with phase context.

**Note:** This is a standalone research command. For most workflows, use `/gsd-mm-plan-phase` which integrates research automatically.

**Use this command when:**
- You want to research without planning yet
- You want to re-research after planning is complete
- You need to investigate before deciding if a phase is feasible

**Orchestrator role:** Parse phase, validate against roadmap, check existing research, gather context, spawn researcher agent, present results.

**Why subagent:** Research burns context fast (webfetch, web searches, source verification). Fresh context for investigation. Main context stays lean for user interaction.
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
Phase number: `$ARGUMENTS` (required)

Normalize phase input in step 1 before any MegaMemory lookups.
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Project Exists Preflight Check from @preflight-check-project-exists.md.

## 0. Validate MegaMemory

**Step 0.1: Call list_roots**
```
megamemory_list_roots()
```

**Step 0.2: Check for empty results**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /gsd-mm-new-project to initialize project"
→ Stop

**Step 0.3: Query config concept**
```
megamemory_understand(query="config", top_k=5)
```

**Step 0.4: Extract config data**
```
const configSummaryString = response.matches[0].summary
const configData = JSON.parse(configSummaryString)

const modelProfile = configData.model_profile || "balanced"
```

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-mm-phase-researcher | opus | sonnet | haiku |

Store resolved model for use in Task calls below.

## 1. Normalize and Validate Phase

**Step 1.1: Normalize phase input**
```bash
# Normalize phase number (8 → 08, but preserve decimals like 2.1 → 02.1)
if [[ "$ARGUMENTS" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$ARGUMENTS")
elif [[ "$ARGUMENTS" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
else
  PHASE="$ARGUMENTS"
fi
```

**Step 1.2: Query phase concept**
```
megamemory_understand(query=`${PHASE}`, top_k=5)
```

**Step 1.3: Check phase exists**

If response.matches.length === 0:
→ Display: `Phase ${PHASE} not found in MegaMemory`
→ Suggest: "Query available phases using megamemory:understand(query='roadmap', top_k=10)"
→ Stop

**Step 1.4: Extract phase data**
```
const phaseSummaryString = response.matches[0].summary
const phaseData = JSON.parse(phaseSummaryString)

const phaseNumber = phaseData.number
const phaseName = phaseData.name
const phaseGoal = phaseData.goal
const phaseId = response.matches[0].id
```

## 2. Check Existing Research

**Step 2.1: Query research concept**
```
megamemory_understand(query=`${PHASE}-research`, top_k=1)
```

**Step 2.2: Check for existing research**

If response.matches.length > 0:
→ Display: "Research already exists for this phase"
→ Use question tool:
```
question(
  header="Existing Research",
  question="Research already exists for this phase. What would you like to do?",
  options=[
    {label: "Update research", description: "Re-research and update existing concept"},
    {label: "View existing", description: "Show current research content"},
    {label: "Skip", description: "Keep existing research, exit"}
  ]
)
```

If user chooses "View existing":
→ Display research content
→ Re-prompt question

If user chooses "Skip":
→ Stop

If user chooses "Update research":
→ Continue to step 3

If doesn't exist:
→ Continue to step 3

## 3. Gather Phase Context

**Step 3.1: Query requirements**
```
megamemory_understand(query="requirements", top_k=50)
```

**Step 3.2: Extract requirement data**
```
const requirements = response.matches.map(match => {
  const summaryString = match.summary
  const reqData = JSON.parse(summaryString)
  return {
    id: match.id,
    description: reqData.description,
    status: reqData.status
  }
})
```

**Step 3.3: Query phase context (if exists)**
```
megamemory_understand(query=`${PHASE}-context`, top_k=1)
```

**Step 3.4: Extract context data (if exists)**
```
let contextData = null
if (response.matches.length > 0) {
  const contextSummaryString = response.matches[0].summary
  contextData = JSON.parse(contextSummaryString)
}
```

**Step 3.5: Query state**
```
megamemory_understand(query="state", top_k=1)
```

**Step 3.6: Extract state data**
```
const stateSummaryString = response.matches[0].summary
const stateData = JSON.parse(stateSummaryString)
```

Present summary with phase description, requirements, prior decisions.

## 4. Spawn gsd-mm-phase-researcher Agent

**Step 4.1: Build research prompt**
```
<research_type>
Phase Research — investigating HOW to implement a specific phase well.
</research_type>

<key_insight>
The question is NOT "which library should I use?"

The question is: "What do I not know that I don't know?"

For this phase, discover:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what OpenCode's training thinks is SOTA?
- What should NOT be hand-rolled?
</key_insight>

<objective>
Research implementation approach for Phase ${phaseNumber}: ${phaseName}
Mode: ecosystem
</objective>

<context>
**Phase description:**
Number: ${phaseNumber}
Name: ${phaseName}
Goal: ${phaseGoal}

**Requirements:**
${requirements.map(r => `- ${r.description} (${r.status})`).join('\n') || 'No requirements found'}

**Prior decisions:**
Current Phase: ${stateData.current_phase || 'None'}
Status: ${stateData.status || 'Unknown'}
Progress: ${stateData.progress || 0}%
Last Activity: ${stateData.last_activity || 'Never'}

**Phase context (if any):**
${contextData ? JSON.stringify(contextData, null, 2) : 'No context found'}
</context>

<downstream_consumer>
Your research concept will be loaded by `/gsd-mm-plan-phase` which uses specific sections:
- `## Standard Stack` → Plans use these libraries
- `## Architecture Patterns` → Task structure follows these
- `## Don't Hand-Roll` → Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` → Verification steps check for these
- `## Code Examples` → Task actions reference these patterns

Be prescriptive, not exploratory. "Use X" not "Consider X or Y."
</downstream_consumer>

<quality_gate>
Before declaring complete, verify:
- [ ] All domains investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources for critical claims
- [ ] Confidence levels assigned honestly
- [ ] Section names match what plan-phase expects
</quality_gate>

<output>
Create/update research concept: ${PHASE}-research
Use: megamemory:create_concept() or megamemory:update_concept()
</output>
```

**Step 4.2: Spawn researcher**
```
Task(
  description=`Research Phase ${phaseNumber}`,
  subagent_type="gsd-mm-phase-researcher",
  model=researcherModel,
  prompt=researchPrompt
)
```

## 5. Handle Agent Return

**`## RESEARCH COMPLETE`:**
→ Display summary from researcher
→ Update state concept with research completion
→ Offer: Plan phase, Dig deeper, Review full, Done

**Step 5.1: Update state concept**
```
const updatedStateData = {
  ...stateData,
  last_activity: `Phase ${phaseNumber} research completed`,
  research_completed: true
}

megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

**Step 5.2: Present options**
```
question(
  header="Research Complete",
  question="What would you like to do next?",
  options=[
    {label: "Plan phase", description: "Create execution plans for this phase"},
    {label: "Dig deeper", description: "Research specific aspects in more detail"},
    {label: "Review full", description: "View complete research content"},
    {label: "Done", description: "Exit, research saved to MegaMemory"}
  ]
)
```

**`## CHECKPOINT REACHED`:**
→ Present checkpoint to user
→ Use question tool:
```
question(
  header="Research Checkpoint",
  question="Research has reached a checkpoint. How would you like to proceed?",
  options=[
    {label: "Provide context", description: "I'll provide additional context"},
    {label: "Continue", description: "Resume research from checkpoint"},
    {label: "Manual", description: "Take manual control"}
  ]
)
```

If user chooses "Provide context":
→ Gather additional context from user
→ Spawn continuation agent (step 6)

If user chooses "Continue":
→ Spawn continuation agent (step 6)

If user chooses "Manual":
→ Stop

**`## RESEARCH INCONCLUSIVE`:**
→ Show what was attempted
→ Offer: Add context, Try different mode, Manual

## 6. Spawn Continuation Agent

**Step 6.1: Build continuation prompt**
```
<objective>
Continue research for Phase ${phaseNumber}: ${phaseName}
</objective>

<prior_state>
Research concept: @${PHASE}-research
</prior_state>

<checkpoint_response>
**Type:** ${checkpoint_type}
**Response:** ${user_response}
</checkpoint_response>
```

**Step 6.2: Spawn continuation**
```
Task(
  description="Continue research Phase ${phaseNumber}",
  subagent_type="gsd-mm-phase-researcher",
  model=researcherModel,
  prompt=continuationPrompt
)
```

</process>

<success_criteria>
- [ ] MegaMemory validated (roots exist)
- [ ] Phase validated against roadmap (phase concept exists)
- [ ] Existing research checked
- [ ] gsd-mm-phase-researcher spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps
</success_criteria>
