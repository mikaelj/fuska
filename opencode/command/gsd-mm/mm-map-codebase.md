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

Output: MegaMemory concepts for codebase state (tech, arch, quality, concerns).
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

## 2. Determine Project Root

**Step 2.0: Get the user's working directory**

```bash
pwd
```

Store result as `$PROJECT_ROOT`. This is the directory the agents must explore — NOT the opencode config directory.

## 3. Spawn Parallel Mapper Agents

Spawn 4 parallel gsd-mm-codebase-mapper agents:

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
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map tech stack and integrations"
)
```

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
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map architecture and structure"
)
```

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
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map conventions and testing"
)
```

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
  subagent_type="gsd-mm-codebase-mapper",
  model="balanced",
  description="Map concerns and technical debt"
)
```

## 4. Wait for Agents to Complete

Wait for all 4 mapper agents to complete. Collect confirmations (NOT concept contents).

Display progress as agents return.

## 5. Verify Codebase Concepts

**Step 5.1: Query all codebase concepts**
```
megamemory_understand(query="codebase", top_k=20)
```

**Step 5.2: Check for expected concepts**

Verify all 4 concepts were created:
- [ ] codebase-tech
- [ ] codebase-arch
- [ ] codebase-quality
- [ ] codebase-concerns

**Step 5.3: Display verification results**

If any concept missing:
→ Display: "Warning: Some concepts were not created: {missing concepts}"

If all concepts present:
→ Display: "All 4 codebase concepts created successfully"

**Step 5.4: Create codebase root concept**

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

## 6. Update State Concept

**Skip this step if `HAS_PROJECT` is false** (no state concept to update).

**Step 6.1: Extract state ID**
```
const stateId = stateResponse.matches[0].id
```

**Step 6.2: Build updated state data**
```
const updatedStateData = {
  ...stateData,
  codebase_mapped: true,
  codebase_mapped_at: new Date().toISOString(),
  last_activity: `Codebase mapped (focus: ${ARGUMENTS || 'full'})`
}
```

**Step 6.3: Update state concept**
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

## 7. Present Completion Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CODEBASE MAPPED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Focus: ${ARGUMENTS || 'Full codebase'}

Tech Stack: [summary from agent 1]
Architecture: [summary from agent 2]
Conventions: [summary from agent 3]
Concerns: [summary from agent 4]

5 concepts created in MegaMemory (codebase + 4 sub-concepts)

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
- [ ] MegaMemory validated (connectivity OK)
- [ ] All 4 parallel mapper agents spawned
- [ ] Agents completed without errors
- [ ] All 4 codebase concepts created in MegaMemory (codebase-tech, codebase-arch, codebase-quality, codebase-concerns)
- [ ] Codebase concepts verified
- [ ] `codebase` root concept created grouping the 4 sub-concepts
- [ ] State concept updated with mapping status (if project exists)
- [ ] User knows next steps
</success_criteria>
