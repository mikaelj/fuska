---
name: fuska-map-codebase
description: Analyze codebase with serial mapper agents to produce MegaMemory concepts
argument-hint: "[optional: specific area to map]"
agent: "fuska-codebase-mapper"
tools:
  - read
  - bash
  - glob
  - grep
  - webfetch
  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:link
  - megamemory:list_roots
  - megamemory:remove_concept

---

<objective>
Analyze existing codebase using serial fuska-codebase-mapper agents to produce structured MegaMemory concepts about the codebase.

Each mapper agent explores a focus area and **creates concepts directly** in MegaMemory. Agents run serially (one at a time) to reduce resource contention. The coordinator only receives confirmations, keeping context usage minimal.

Output: MegaMemory concepts for tech, architecture, quality, concerns, and domains.

**For domain discovery only**, use `fuska map --domains-only` which runs a faster, focused operation.
</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md

</execution_context>

<context>

**Load project state if exists:**
Check for state concept in MegaMemory - loads context if project already initialized

**This command runs:**
- Before fuska init (brownfield codebases) - creates codebase concepts first
- After fuska init (greenfield codebases) - updates codebase concepts as code evolves
- Anytime to refresh codebase understanding

**For faster domain discovery only**, use `fuska map --domains-only`
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
- When you only need domains (use --domains-only instead)
</when_to_use>

<process>

### 1. Preflight Check

Display: "Checking MegaMemory connectivity..."

**Ping MCP with any query** (just to verify server responds):
```
megamemory_understand(query="connectivity-ping", top_k=1)
```

If tool call fails or returns `MEGAMEMORY_ERROR:`:
→ Display: "MegaMemory MCP server is not responding. Check MCP configuration and restart."
→ Stop

If any response (even empty matches): MCP is working, continue.

### 2. Validate MegaMemory

Display: "Validating MegaMemory state..."

**2.1: Load current initiative**

```
megamemory_understand(query="config concepts", top_k=10000)

const configNode = allConcepts.matches?.find(n => n.name === 'config' && n.kind === 'config')
const currentInitiative = configNode ? JSON.parse(configNode.summary).current_initiative : null

const initiativeRoot = allConcepts.matches?.find(n =>
  n.name === currentInitiative && n.kind === 'feature' && !n.parent_id
)
const initiativeId = initiativeRoot?.id
```

**2.2: Check for project**

If initiativeId exists:
→ Set `HAS_PROJECT = true`
→ Set `PROJECT_ROOT_ID = initiativeId`

If no initiativeId:
→ Set `HAS_PROJECT = false`
→ Display: "No project found — mapping codebase standalone"

**2.3: Query state concept scoped by initiative**

If `HAS_PROJECT`:
```
const stateNode = allConcepts.matches?.find(n =>
  n.name === 'state' && n.kind === 'config' && n.parent_id === initiativeId
)
```

If not `HAS_PROJECT`: skip (state doesn't exist yet).

**2.4: Check if codebase concepts exist**

```
const codebaseConcepts = allConcepts.matches?.filter(n =>
  n.name.startsWith('codebase-') && n.parent_id === initiativeId
)
```

**2.5: Handle existing codebase**

If codebaseConcepts.length > 0:

**Check for --force flag:**
```
const forceRefresh = ARGUMENTS && ARGUMENTS.includes('--force')
```

If `forceRefresh` is true:
→ Display: "Force refresh requested — updating all codebase concepts, domains, and file/code index"
→ Proceed to step 3 (Get Project Root)

If `forceRefresh` is false:
→ Display: "Codebase concepts already exist in MegaMemory"
→ Use question tool:
```
const codebaseResponse = question(questions=[{
  header: "Codebase Exists",
  question: "Codebase concepts already exist. What would you like to do?",
  options: [
    {label: "Refresh all (Recommended)", description: "Update codebase concepts, domains, and file/code index"},
    {label: "View existing", description: "Show current codebase concepts"},
    {label: "Skip", description: "Keep existing concepts"}
  ]
}])
```

If user chooses "View existing":
→ Display existing codebase concepts (query and show codebase-tech, codebase-arch, codebase-quality, codebase-concerns summaries)
→ Re-prompt question

If user chooses "Skip":
→ Display: "Keeping existing concepts. Run with --force to refresh."
→ Stop

### 3. Get Project Root

```bash
pwd
```

Store result as `$PROJECT_ROOT`. This is the directory the agents must explore.

Display: "Project root: ${PROJECT_ROOT}"

### 4. Spawn 5 Mapper Agents

Display: "Spawning 5 mapper agents (serial)..."

Spawn 5 fuska-codebase-mapper agents serially (one at a time):

**Agent 1: Tech focus** → codebase-tech
**Agent 2: Architecture focus** → codebase-arch
**Agent 3: Quality focus** → codebase-quality
**Agent 4: Concerns focus** → codebase-concerns
**Agent 5: Domains focus** → domain-* concepts

---

#### 4.1: Spawn Agent 1 - Tech Focus

**Build tech focus prompt:**
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

**Spawn agent:**
```
Task(
  prompt=techPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  variant="plan",
  description="Map tech stack and integrations"
)
```

Wait for completion, then:
Display: "[OK] Tech mapping complete"

---

#### 4.2: Spawn Agent 2 - Architecture Focus

**Build architecture focus prompt:**
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

**Spawn agent:**
```
Task(
  prompt=architecturePrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  variant="plan",
  description="Map architecture and structure"
)
```

Wait for completion, then:
Display: "[OK] Architecture mapping complete"

---

#### 4.3: Spawn Agent 3 - Quality Focus

**Build quality focus prompt:**
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

**Spawn agent:**
```
Task(
  prompt=qualityPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  variant="plan",
  description="Map conventions and testing"
)
```

Wait for completion, then:
Display: "[OK] Quality mapping complete"

---

#### 4.4: Spawn Agent 4 - Concerns Focus

**Build concerns focus prompt:**
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

**Spawn agent:**
```
Task(
  prompt=concernsPrompt,
  subagent_type="fuska-codebase-mapper",
  model="balanced",
  variant="plan",
  description="Map concerns and technical debt"
)
```

Wait for completion, then:
Display: "[OK] Concerns mapping complete"

---

#### 4.5: Spawn Agent 5 - Domains Focus

@../../fuska/references/domain-mapping-task.md

### 5. Verify All Concepts

Display: "Verifying created concepts..."

**5.1: Query all codebase concepts**
```
megamemory_understand(query="codebase", top_k=20)
```

**5.2: Check for expected concepts**

Verify all 5 concept types were created:
- [ ] codebase-tech
- [ ] codebase-arch
- [ ] codebase-quality
- [ ] codebase-concerns
- [ ] domain-* (at least one)

**5.3: Display verification results**

If any concept missing:
→ Display: "Warning: Some concepts were not created: {missing concepts}"

If all concepts present:
→ Display: "All 5 codebase concept types created successfully"

**5.4: Query and display project classification**

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

### 6. Create Codebase Root Concept

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
    // Note: domain-* concepts are standalone, not children of codebase
  ]
})
```

If this concept already exists (refresh scenario), use `megamemory_update_concept` instead.

Display: "Created codebase root concept"

### 7. Update State Concept

If `HAS_PROJECT` is false, skip this step.

Display: "Updating project state..."

**7.1: Extract state ID**
```
const stateId = stateNode.id
```

**7.2: Build updated state data**
```
const stateData = stateNode ? JSON.parse(stateNode.summary) : {}
const updatedStateData = {
  ...stateData,
  codebase_mapped: true,
  codebase_mapped_at: new Date().toISOString()
}
```

**7.3: Update state concept**
```
megamemory_update_concept(
  id=stateId,
  changes={
    summary: JSON.stringify(updatedStateData)
  }
)
```

### 7.5. Refresh Import Graph

After mapping the codebase at a high level, build the granular import graph so file/symbol-level queries are immediately available.

Display: "Building import graph..."

Get current Git SHA and list source files:
```javascript
const { stdout: sha } = await exec('git rev-parse HEAD')
const { stdout: files } = await exec('git ls-files')
const sourceFiles = files.split('\n').filter(f => f.endsWith('.ts') || f.endsWith('.js'))
```

For each source file, extract imports, exports, and symbols using language-specific patterns, then create MegaMemory concepts and edges:

**1. Create file concept:**
```javascript
const fileConceptName = `file:${filePath}`

const fileSummary = {
  path: filePath,
  language: 'TypeScript',
  imports: importsList,
  exports: exportsList,
  symbol_count: symbols.length,
  last_indexed: new Date().toISOString()
}

const fileConcept = await megamemory_create_concept(
  name=fileConceptName,
  kind='component',
  summary=JSON.stringify(fileSummary),
  parent_id=null
)
```

**2. Create symbol concepts with edges:**
```javascript
for (const symbol of symbols) {
  const symbolSummary = {
    type: symbol.type,
    name: symbol.name,
    file: filePath,
    signature: symbol.signature,
    exported: symbol.exported,
    methods: symbol.methods || []
  }

  const symbolConcept = await megamemory_create_concept(
    name=`symbol:${symbol.name}`,
    kind='component',
    summary=JSON.stringify(symbolSummary)
  )

  // Link symbol to file (defined_in) - ALWAYS
  await megamemory_link(
    from=`symbol:${symbol.name}`,
    to=fileConceptName,
    relation='defined_in'
  )

  // Link file to symbol (exports) - ONLY if exported
  if (symbol.exported) {
    await megamemory_link(
      from=fileConceptName,
      to=`symbol:${symbol.name}`,
      relation='exports'
    )
  }
}
```

**3. Create import edges:**
```javascript
for (const importedPath of importsList) {
  const importedFileConceptName = `file:${importedPath}`
  await megamemory_link(
    from=fileConceptName,
    to=importedFileConceptName,
    relation='imports'
  )
}
```

**4. Detect dead code (after all edges created):**
```javascript
const exportedSymbols = allSymbols.filter(s => s.exported)
for (const symbol of exportedSymbols) {
  const query = await megamemory_understand({
    query: `symbol:${symbol.name}`,
    top_k: 1
  })
  
  const hasIncomingUses = query.matches[0]?.incoming_edges?.some(
    e => e.relation === 'uses'
  )
  
  if (!hasIncomingUses) {
    await megamemory_create_concept(
      name=`dead-code:${symbol.name}`,
      kind='component',
      summary=JSON.stringify({
        type: symbol.type,
        name: symbol.name,
        file: symbol.file,
        reason: 'no_incoming_edges',
        related_dead: []
      })
    )
  }
}
```

**5. Update config concept:**
```javascript
const configResult = await megamemory_understand({ query: 'config', top_k: 1 })
if (configResult.matches.length > 0) {
  const configData = JSON.parse(configResult.matches[0].summary)
  configData.refresh = {
    mode: 'full',
    last_sha: sha.trim(),
    last_refresh: new Date().toISOString(),
    files_scanned: sourceFiles.length,
    symbols_indexed: allSymbols.length,
    dead_code_count: deadCodeCount
  }
  await megamemory_update_concept(
    id=configResult.matches[0].id,
    changes={ summary: JSON.stringify(configData) }
  )
}
```

**CRITICAL**: Use exact relation strings 'imports', 'exports', 'defined_in', 'uses' - NOT standard relations like 'connects_to' or 'depends_on'.

This ensures that after `fuska init` or `/fuska-map-codebase`, commands like `/fuska-ask` and the planner/executor/debugger integrations have import graph data available without requiring a separate `/fuska-refresh` call.

Display: "Import graph built: ${filesScanned} files, ${symbolsIndexed} symbols, ${deadCodeCount} dead code candidates"

### 8. Present Summary

Query config for checker_panel settings:
```
const configData = configNode ? JSON.parse(configNode.summary) : {}
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

5 codebase concepts + N domain concepts created in MegaMemory
Import graph: ${filesScanned} files, ${symbolsIndexed} symbols indexed

────────────────────────────────────────────────────────────

## Checker Panel Configuration

Project Type: ${classification.type || 'not detected'}
Contextual Role: ${checkerPanel.contextual || 'none'}
Confidence: ${classification.confidence || 'unknown'}
Detection Signals: ${classification.signals?.join(', ') || 'none'}

Use `fuska config` to view or override the contextual checker role.

────────────────────────────────────────────────────────────

## > Next Up

${!stateData.current_chapter ? 'Initialize project' : 'Continue with project planning'}

${!stateData.current_chapter
   ? 'fuska init — Initialize project foundation with this codebase understanding'
   : '/fuska-plan ' + stateData.current_chapter + ' — Plan next chapter'
}

────────────────────────────────────────────────────────────

**Also available:**
- Query codebase concepts: megamemory:understand(query='codebase')
- /fuska-design {N} — Discuss a chapter
- /fuska-plan {N} — Plan a chapter
- fuska config — View/change checker panel settings
────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] MegaMemory validated (connectivity OK)
- [ ] All 5 serial mapper agents spawned
- [ ] Agents completed without errors
- [ ] All 4 codebase concepts + 1+ domain concepts created in MegaMemory
- [ ] Codebase concepts verified
- [ ] `codebase` root concept created grouping the 4 sub-concepts
- [ ] State concept updated with mapping status (if project exists)
- [ ] Import graph built with file/symbol concepts and edges
- [ ] Config concept updated with refresh metadata
- [ ] User knows next steps
</success_criteria>
