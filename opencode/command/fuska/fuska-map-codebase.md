---
name: fuska-map-codebase
description: Analyze codebase with serial mapper agents to produce MegaMemory concepts
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
agent: fuska-codebase-mapper
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
Analyze existing codebase using serial fuska-codebase-mapper agents to produce structured MegaMemory concepts about the codebase.

Each mapper agent explores a focus area and **creates concepts directly** in MegaMemory. Agents run serially (one at a time) to reduce resource contention. The orchestrator only receives confirmations, keeping context usage minimal.

Output: MegaMemory concepts for codebase state (tech, arch, quality, concerns).
</objective>

 <execution_context>
  @./opencode/fuska/references/preflight-check-connectivity.md
  @./opencode/fuska/references/preflight-check-project-exists.md
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
- Before /fuska-new-project (brownfield codebases) - creates codebase concepts first
- After /fuska-new-project (greenfield codebases) - updates codebase concepts as code evolves
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

Display: "Checking MegaMemory connectivity..."

Follow the MegaMemory Connectivity Preflight Check from @preflight-check-connectivity.md.

## 1. Validate MegaMemory

Display: "Validating MegaMemory state..."

**Step 1.1: Call list_roots**
```
megamemory_list_roots()
```

**Step 1.2: Check for project**

If a root with `kind="feature"` exists:
→ Set `HAS_PROJECT = true`
→ Extract `PROJECT_ROOT_ID` from that root concept's ID

If no root with `kind="feature"` exists:
→ Set `HAS_PROJECT = false`
→ Display: "No project found — mapping codebase standalone"

**Step 1.3: Query state concept**

If `HAS_PROJECT`:
```
megamemory_understand(query="state", top_k=5)
```

If not `HAS_PROJECT`: skip (state doesn't exist yet).

**Step 1.4: Check if codebase concepts exist**
```
megamemory_understand(query="codebase", top_k=20)
```

**Step 1.5: Handle existing codebase**

If codebase concepts exist:
→ Display: "Codebase concepts already exist in MegaMemory"
→ Use question tool:
```
const codebaseResponse = question(questions=[{
  header: "Codebase Exists",
  question: "Codebase concepts already exist. What would you like to do?",
  options: [
    {label: "Refresh all", description: "Update all codebase concepts"},
    {label: "View existing", description: "Show current codebase concepts"},
    {label: "Skip", description: "Keep existing concepts"}
  ]
}])
```

If user chooses "View existing":
→ Display existing codebase concepts
→ Re-prompt question

If user chooses "Skip":
→ Stop

## 2. Determine Project Root

**Step 2.0: Get the user's working directory**

```bash
pwd
```

Store result as `$PROJECT_ROOT`. This is the directory the agents must explore — NOT the opencode config directory.

Display: "Project root: ${PROJECT_ROOT}"

## 3. Spawn Mapper Agents (Serial)

Display: "Spawning 4 mapper agents (serial)..."

Spawn 4 fuska-codebase-mapper agents serially (one at a time):

**Agent 1: Tech focus**
Creates concept:
- codebase-tech (tech stack, languages, frameworks, external integrations)

**Agent 2: Architecture focus**
Creates concept:
- codebase-arch (architecture patterns, directory layout, module organization)

**Agent 3: Quality focus**
Creates concept:
- codebase-quality (coding conventions, testing patterns)

**Agent 4: Concerns focus**
Creates concept:
- codebase-concerns (technical debt, known issues, security)

### Spawn Agent 1: Tech Focus

**Step 3.1: Build tech focus prompt**
```
<project_root>${PROJECT_ROOT}</project_root>

<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map tech stack and integrations in the project at ${PROJECT_ROOT}.

IMPORTANT: All exploration (ls, find, grep, glob, read) must target ${PROJECT_ROOT}, not the current directory. Use absolute paths.

Create this MegaMemory concept:
1. codebase-tech — technologies, languages, frameworks, versions, external services, APIs, third-party libs

Use megamemory:create_concept() for the concept.
</objective>

<output>
Return confirmation when complete:
## TECH MAPPING COMPLETE

Created concepts:
- codebase-tech

Stack summary:
[Brief description of tech stack]
</output>
```

**Step 3.2: Spawn agent**
```
Task(
  prompt=techPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  description="Map tech stack and integrations"
)
```

**Step 3.2b: Wait for agent and display progress**
Wait for the agent to complete, then:
Display: "[OK] Tech mapping complete"

### Spawn Agent 2: Architecture Focus

**Step 3.3: Build architecture focus prompt**
```
<project_root>${PROJECT_ROOT}</project_root>

<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map architecture and structure in the project at ${PROJECT_ROOT}.

IMPORTANT: All exploration (ls, find, grep, glob, read) must target ${PROJECT_ROOT}, not the current directory. Use absolute paths.

Create this MegaMemory concept:
1. codebase-arch — architecture patterns, design decisions, layers, directory layout, module organization

Use megamemory:create_concept() for the concept.
</objective>

<output>
Return confirmation when complete:
## ARCHITECTURE MAPPING COMPLETE

Created concepts:
- codebase-arch

Architecture summary:
[Brief description of architecture]
</output>
```

**Step 3.4: Spawn agent**
```
Task(
  prompt=architecturePrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  description="Map architecture and structure"
)
```

**Step 3.4b: Wait for agent and display progress**
Wait for the agent to complete, then:
Display: "[OK] Architecture mapping complete"

### Spawn Agent 3: Quality Focus

**Step 3.5: Build quality focus prompt**
```
<project_root>${PROJECT_ROOT}</project_root>

<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map conventions and testing in the project at ${PROJECT_ROOT}.

IMPORTANT: All exploration (ls, find, grep, glob, read) must target ${PROJECT_ROOT}, not the current directory. Use absolute paths.

Create this MegaMemory concept:
1. codebase-quality — coding conventions, style guides, naming patterns, test framework, coverage, test structure

Use megamemory:create_concept() for the concept.
</objective>

<output>
Return confirmation when complete:
## QUALITY MAPPING COMPLETE

Created concepts:
- codebase-quality

Quality summary:
[Brief description of conventions and testing]
</output>
```

**Step 3.6: Spawn agent**
```
Task(
  prompt=qualityPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  description="Map conventions and testing"
)
```

**Step 3.6b: Wait for agent and display progress**
Wait for the agent to complete, then:
Display: "[OK] Quality mapping complete"

### Spawn Agent 4: Concerns Focus

**Step 3.7: Build concerns focus prompt**
```
<project_root>${PROJECT_ROOT}</project_root>

<focus_area>
${ARGUMENTS || 'entire codebase'}
</focus_area>

<objective>
Map concerns and technical debt in the project at ${PROJECT_ROOT}.

IMPORTANT: All exploration (ls, find, grep, glob, read) must target ${PROJECT_ROOT}, not the current directory. Use absolute paths.

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

**Step 3.8: Spawn agent**
```
Task(
  prompt=concernsPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  description="Map concerns and technical debt"
)
```

**Step 3.8b: Wait for agent and display progress**
Wait for the agent to complete, then:
Display: "[OK] Concerns mapping complete"

## 4. Verify Codebase Concepts

Display: "Verifying created concepts..."

**Step 4.1: Query all codebase concepts**
```
megamemory_understand(query="codebase", top_k=20)
```

**Step 4.2: Check for expected concepts**

Verify all 4 concepts were created:
- [ ] codebase-tech
- [ ] codebase-arch
- [ ] codebase-quality
- [ ] codebase-concerns

**Step 4.3: Display verification results**

If any concept missing:
→ Display: "Warning: Some concepts were not created: {missing concepts}"

If all concepts present:
→ Display: "All 4 codebase concepts created successfully"

**Step 4.4: Query and display project classification**

Query the config concept to check for project classification:
```
megamemory_understand(query="config", top_k=5)
```

If config concept exists and has `project_classification`:
```
const configData = JSON.parse(configResponse.matches[0].summary)
const classification = configData.project_classification

Display: "Project Classification Detected:"
Display: "  Type: ${classification.type}"
Display: "  Contextual Checker: ${configData.checker_panel?.contextual || 'none'}"
Display: "  Confidence: ${classification.confidence}"
Display: "  Signals: ${classification.signals.join(', ')}"
```

If no classification found:
→ Display: "Project classification not yet detected (run with tech focus)"

**Step 4.5: Create codebase root concept**

Display: "Creating codebase root concept..."

Create a `codebase` module concept that groups the 4 sub-concepts into one discoverable entry:

```
megamemory_create_concept({
  name: "codebase",
  kind: "module",
  summary: "Codebase analysis: tech stack, architecture, quality conventions, and concerns.",
  parent_id: HAS_PROJECT ? PROJECT_ROOT_ID : null,
  edges: [
    { to: "codebase-tech", relation: "connects_to" },
    { to: "codebase-arch", relation: "connects_to" },
    { to: "codebase-quality", relation: "connects_to" },
    { to: "codebase-concerns", relation: "connects_to" }
  ]
})
```

If this concept already exists (refresh scenario), use `megamemory_update_concept` instead.

Display: "Created codebase root concept"

## 5. Update State Concept

**Skip this step if `HAS_PROJECT` is false** (no state concept to update).

Display: "Updating project state..."

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

Query config for checker_panel settings:
```
megamemory_understand(query="config", top_k=5)
const configData = configResponse.matches.length > 0 
  ? JSON.parse(configResponse.matches[0].summary) 
  : {}
const checkerPanel = configData.checker_panel || {}
const classification = configData.project_classification || {}
```

```
---------------------------------------------------
  Fuska: Codebase mapped
---------------------------------------------------

Focus: ${ARGUMENTS || 'Full codebase'}

Tech Stack: [summary from agent 1]
Architecture: [summary from agent 2]
Conventions: [summary from agent 3]
Concerns: [summary from agent 4]

5 concepts created in MegaMemory (codebase + 4 sub-concepts)

────────────────────────────────────────────────────────────

## Checker Panel Configuration

Project Type: ${classification.type || 'not detected'}
Contextual Role: ${checkerPanel.contextual || 'none'}
Confidence: ${classification.confidence || 'unknown'}
Detection Signals: ${classification.signals?.join(', ') || 'none'}

Use `fuska config` to view or override the contextual checker role.

────────────────────────────────────────────────────────────

## > Next Up

${!stateData.current_phase ? 'Initialize project' : 'Continue with project planning'}

${!stateData.current_phase
  ? '/fuska-new-project — Initialize project with this codebase understanding'
  : '/fuska-plan-phase ' + stateData.current_phase + ' — Plan next phase'
}

────────────────────────────────────────────────────────────

**Also available:**
- Query codebase concepts: megamemory:understand(query='codebase')
- /fuska-discuss-phase {N} — Discuss a phase
- /fuska-plan-phase {N} — Plan a phase
- fuska config — View/change checker panel settings
────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] MegaMemory validated (connectivity OK)
- [ ] All 4 serial mapper agents spawned
- [ ] Agents completed without errors
- [ ] All 4 codebase concepts created in MegaMemory (codebase-tech, codebase-arch, codebase-quality, codebase-concerns)
- [ ] Codebase concepts verified
- [ ] `codebase` root concept created grouping the 4 sub-concepts
- [ ] State concept updated with mapping status (if project exists)
- [ ] User knows next steps
</success_criteria>
