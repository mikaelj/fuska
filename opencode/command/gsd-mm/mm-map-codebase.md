---
name: gsd-mm-map-codebase
description: Analyze codebase with parallel mapper agents to produce MegaMemory concepts
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
agent: gsd-mm-codebase-mapper
tools:
  - read
  - bash
  - glob
  - grep
  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>
Analyze existing codebase using parallel gsd-mm-codebase-mapper agents to produce structured MegaMemory concepts about the codebase.

Each mapper agent explores a focus area and **creates concepts directly** in MegaMemory. The orchestrator only receives confirmations, keeping context usage minimal.

Output: MegaMemory concepts for codebase state (stack, architecture, structure, conventions, testing, integrations, concerns).
</objective>

 <execution_context>
 @~/.config/opencode/gsd-mm/references/preflight-check-connectivity.md
 @~/.config/opencode/gsd-mm/references/preflight-check-project-exists.md
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
Focus area: `$ARGUMENTS` (optional - if provided, tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for state concept in MegaMemory - loads context if project already initialized

**This command can run:**
- Before /gsd-mm-new-project (brownfield codebases) - creates codebase concepts first
- After /gsd-mm-new-project (greenfield codebases) - updates codebase concepts as code evolves
- Anytime to refresh codebase understanding
</context>

<when_to_use>
**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase concepts after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)
- When state concept references outdated codebase info

**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)
</when_to_use>

<process>

## 0. Preflight Check

Follow the MegaMemory Connectivity Preflight Check from @preflight-check-connectivity.md.

## 1. Validate MegaMemory

**Step 1.1: Call list_roots**
```
megamemory_list_roots()
```

**Step 1.2: Check for roots**

If response.roots.length === 0:
→ Display: "No projects found in MegaMemory"
→ Suggest: "Run /gsd-mm-new-project to start a new project"
→ Stop

**Step 1.3: Query state concept**
```
megamemory_understand(query="state", top_k=5)
```

**Step 1.4: Check if codebase concepts exist**
```
megamemory_understand(query="codebase", top_k=20)
```

**Step 1.5: Handle existing codebase**

If codebase concepts exist:
→ Display: "Codebase concepts already exist in MegaMemory"
→ Use question tool:
```
question(
  header="Codebase Exists",
  question="Codebase concepts already exist. What would you like to do?",
  options=[
    {label: "Refresh all", description: "Update all codebase concepts"},
    {label: "View existing", description: "Show current codebase concepts"},
    {label: "Skip", description: "Keep existing concepts"}
  ]
)
```

If user chooses "View existing":
→ Display existing codebase concepts
→ Re-prompt question

If user chooses "Skip":
→ Stop

## 2. Spawn Parallel Mapper Agents

Spawn 4 parallel gsd-mm-codebase-mapper agents:

**Agent 1: Tech focus**
Creates concepts:
- codebase-stack (tech stack, languages, frameworks)
- codebase-integrations (external services, APIs)

**Agent 2: Architecture focus**
Creates concepts:
- codebase-architecture (patterns, design decisions)
- codebase-structure (directory layout, module organization)

**Agent 3: Quality focus**
Creates concepts:
- codebase-conventions (style, naming, patterns)
- codebase-testing (test setup, coverage, framework)

**Agent 4: Concerns focus**
Creates concept:
- codebase-concerns (technical debt, known issues, security)

### Spawn Agent 1: Tech Focus

**Step 2.1: Build tech focus prompt**
```
<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map tech stack and integrations in the codebase.

Create these MegaMemory concepts:
1. codebase-stack — technologies, languages, frameworks, versions
2. codebase-integrations — external services, APIs, third-party libs

Use megamemory:create_concept() for each concept.
</objective>

<output>
Return confirmation when complete:
## TECH MAPPING COMPLETE

Created concepts:
- codebase-stack
- codebase-integrations

Stack summary:
[Brief description of tech stack]
</output>
```

**Step 2.2: Spawn agent**
```
Task(
  prompt=techPrompt,
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map tech stack and integrations"
)
```

### Spawn Agent 2: Architecture Focus

**Step 2.3: Build architecture focus prompt**
```
<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map architecture and structure in the codebase.

Create these MegaMemory concepts:
1. codebase-architecture — patterns, design decisions, layers
2. codebase-structure — directory layout, module organization

Use megamemory:create_concept() for each concept.
</objective>

<output>
Return confirmation when complete:
## ARCHITECTURE MAPPING COMPLETE

Created concepts:
- codebase-architecture
- codebase-structure

Architecture summary:
[Brief description of architecture]
</output>
```

**Step 2.4: Spawn agent**
```
Task(
  prompt=architecturePrompt,
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map architecture and structure"
)
```

### Spawn Agent 3: Quality Focus

**Step 2.5: Build quality focus prompt**
```
<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map conventions and testing in the codebase.

Create these MegaMemory concepts:
1. codebase-conventions — style guides, naming patterns, coding standards
2. codebase-testing — test framework, coverage, test structure

Use megamemory:create_concept() for each concept.
</objective>

<output>
Return confirmation when complete:
## QUALITY MAPPING COMPLETE

Created concepts:
- codebase-conventions
- codebase-testing

Quality summary:
[Brief description of conventions and testing]
</output>
```

**Step 2.6: Spawn agent**
```
Task(
  prompt=qualityPrompt,
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map conventions and testing"
)
```

### Spawn Agent 4: Concerns Focus

**Step 2.7: Build concerns focus prompt**
```
<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map concerns and technical debt in the codebase.

Create MegaMemory concept:
1. codebase-concerns — technical debt, known issues, security considerations, performance concerns

Use megamemory:create_concept() for the concept.
</objective>

<output>
Return confirmation when complete:
## CONCERNS MAPPING COMPLETE

Created concepts:
- codebase-concerns

Concerns summary:
[Brief description of concerns]
</output>
```

**Step 2.8: Spawn agent**
```
Task(
  prompt=concernsPrompt,
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map concerns and technical debt"
)
```

## 3. Wait for Agents to Complete

Wait for all 4 mapper agents to complete. Collect confirmations (NOT concept contents).

Display progress as agents return.

## 4. Verify Codebase Concepts

**Step 4.1: Query all codebase concepts**
```
megamemory_understand(query="codebase", top_k=20)
```

**Step 4.2: Check for expected concepts**

Verify all 7 concepts were created:
- [ ] codebase-stack
- [ ] codebase-integrations
- [ ] codebase-architecture
- [ ] codebase-structure
- [ ] codebase-conventions
- [ ] codebase-testing
- [ ] codebase-concerns

**Step 4.3: Display verification results**

If any concept missing:
→ Display: "Warning: Some concepts were not created: {missing concepts}"

If all concepts present:
→ Display: "All 7 codebase concepts created successfully"

## 5. Update State Concept

**Step 5.1: Extract state ID**
```
const stateId = stateResponse.matches[0].id
```

**Step 5.2: Build updated state data**
```
const updatedStateData = {
  ...stateData,
  codebase_mapped: true,
  codebase_mapped_at: new Date().toISOString(),
  last_activity: `Codebase mapped (focus: ${ARGUMENTS || 'full'})`
}
```

**Step 5.3: Update state concept**
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

## 6. Present Completion Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CODEBASE MAPPED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Focus: ${ARGUMENTS || 'Full codebase'}

Tech Stack: [summary from agent 1]
Architecture: [summary from agent 2]
Conventions: [summary from agent 3]
Concerns: [summary from agent 4]

7 concepts created in MegaMemory

────────────────────────────────────────────────────────────

## ▶ Next Up

${!stateData.current_phase ? 'Initialize project' : 'Continue with project planning'}

${!stateData.current_phase
  ? '/gsd-mm-new-project — Initialize project with this codebase understanding'
  : '/gsd-mm-plan-phase ' + stateData.current_phase + ' — Plan next phase'
}

────────────────────────────────────────────────────────────

**Also available:**
- Query codebase concepts: megamemory:understand(query='codebase')
- /gsd-mm-discuss-phase {N} — Discuss a phase
- /gsd-mm-plan-phase {N} — Plan a phase
────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] MegaMemory validated (roots exist)
- [ ] All 4 parallel mapper agents spawned
- [ ] Agents completed without errors
- [ ] All 7 codebase concepts created in MegaMemory
- [ ] Codebase concepts verified
- [ ] State concept updated with mapping status
- [ ] User knows next steps
</success_criteria>
