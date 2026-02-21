# Optimization Plan: fuska-plan.md Proof of Concept

**Goal:** Reduce `fuska-plan.md` from 1,447 lines to ~500 lines (65% reduction) by extracting shared content into reusable files.

**Approach:** Proof of concept first — fully optimize one command to validate approach before applying to other 29 commands.

---

## Current State Analysis

### Duplication Metrics

| Pattern | Files Affected | Lines Each | Total Waste |
|---------|---------------|------------|-------------|
| `<megamemory_guide>` | 29 commands | ~20 lines | ~580 lines |
| Model lookup table | 8 commands | ~30 lines | ~240 lines |
| Workflow mode config | 4 commands | ~20 lines | ~80 lines |
| Preflight check logic | 20+ commands | ~15 lines | ~300 lines |
| Banner/formatting | 15+ commands | ~10 lines | ~150 lines |

### fuska-plan.md Line Distribution

| Section | Lines | Extractable |
|---------|-------|-------------|
| Frontmatter + objective | 29 | No |
| Execution context (includes) | 8 | No (add more) |
| Megamemory guide | 20 | Yes → reference |
| Step 1: Model validation | 174 | Yes → config |
| Steps 2-3: Parse/validate | 80 | Partial |
| Step 4: Research | 120 | Partial |
| Step 4.3-4.4: Workflow modes | 20 | Yes → config |
| Step 5: Existing plans | 30 | No |
| Step 6: Context loading | 153 | Yes → reference |
| Step 7: Planner spawn | 90 | Yes → template |
| Steps 8-9: Return handling | 60 | Partial |
| Step 10: Checker spawn | 50 | Yes → template |
| Step 11-12: Revision loop | 70 | No |
| Step 13: Interactive review | 282 | Yes → template |
| Step 14-15: State + status | 50 | No |
| Offer next + success | 60 | No |
| **Total** | **1,447** | |

---

## Phase 1: Create Shared Files

### 1.1 `fuska/config/model-lookup.ts` (~60 lines)

**Location:** `provider/opinkode/fuska/config/model-lookup.ts`

**Purpose:** Model resolution tables + OpenCode config validation

**Extracted from:** Steps 1.5-1.8 (174 lines) → 2-line include + this file

**Content:**

```typescript
/**
 * Model Lookup Configuration
 * 
 * Resolves model profile to specific models for each agent type.
 * Includes validation against OpenCode configuration.
 */

export const DEFAULT_ALIASES = {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}

export const MODEL_LOOKUP = {
  quality: { 
    researcher: 'quality_model', 
    planner: 'quality_model', 
    checker: 'balanced_model' 
  },
  balanced: { 
    researcher: 'balanced_model', 
    planner: 'quality_model', 
    checker: 'balanced_model' 
  },
  budget: { 
    researcher: 'budget_model', 
    planner: 'balanced_model', 
    checker: 'budget_model' 
  }
}

export function resolveModels(
  profile: string, 
  aliases: Record<string, string>
): { researcher: string; planner: string; checker: string } {
  const lookup = MODEL_LOOKUP[profile] || MODEL_LOOKUP.balanced
  return {
    researcher: aliases[lookup.researcher],
    planner: aliases[lookup.planner],
    checker: aliases[lookup.checker]
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  providerModels: Map<string, string[]>
}

export function validateModelsAgainstOpenCode(
  modelAliases: Record<string, string>,
  openCodeConfig: any
): ValidationResult {
  const errors: string[] = []
  const providerModels = new Map<string, string[]>()

  for (const [alias, modelString] of Object.entries(modelAliases)) {
    const parts = modelString.split('/')
    if (parts.length !== 2) {
      errors.push(`"${modelString}" (${alias}) - invalid format, expected "provider/model"`)
      continue
    }
    
    const [provider, model] = parts
    const providerConfig = openCodeConfig.provider?.[provider]
    
    if (!providerConfig) {
      errors.push(`"${modelString}" (${alias}) - provider "${provider}" not found`)
      const availableProviders = Object.keys(openCodeConfig.provider || {})
      for (const p of availableProviders) {
        const pc = openCodeConfig.provider[p]
        const models = pc.whitelist || Object.keys(pc.models || {})
        if (!providerModels.has(p)) {
          providerModels.set(p, models)
        }
      }
      continue
    }
    
    const whitelist = providerConfig.whitelist || []
    const configuredModels = Object.keys(providerConfig.models || {})
    const availableModels = whitelist.length > 0 ? whitelist : configuredModels
    
    if (!providerModels.has(provider)) {
      providerModels.set(provider, availableModels)
    }
    
    if (!availableModels.includes(model)) {
      errors.push(`"${modelString}" (${alias}) - model "${model}" not found in provider "${provider}"`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    providerModels
  }
}

export function formatValidationErrors(
  errors: string[], 
  providerModels: Map<string, string[]>
): string {
  const providerList = Array.from(providerModels.entries())
    .map(([provider, models]) => `  - ${provider}: ${models.join(', ')}`)
    .join('\n')
  
  return `Invalid model configuration:
${errors.map(e => `  - ${e}`).join('\n')}

Available providers in your OpenCode config:
${providerList}

To fix: Run \`fuska config\` to reconfigure your models`
}
```

**Usage in commands:**
```markdown
@../../fuska/config/model-lookup.ts
```

---

### 1.2 `fuska/config/workflow-modes.ts` (~30 lines)

**Location:** `provider/opinkode/fuska/config/workflow-modes.ts`

**Purpose:** Workflow mode configuration (research, planCheck settings)

**Extracted from:** Steps 4.3-4.4 (20 lines) → 2-line include + this file

**Content:**

```typescript
/**
 * Workflow Mode Configuration
 * 
 * Defines behavior flags for each workflow mode.
 * Used by fuska-plan, fuska-do, and related commands.
 */

export const WORKFLOW_MODES = {
  direct: { research: false, planCheck: false },
  quick: { research: false, planCheck: false },
  fast: { research: false, planCheck: true },
  balanced: { research: true, planCheck: false },
  thorough: { research: true, planCheck: true },
  standard: { research: true, planCheck: true }
}

export interface WorkflowFlags {
  shouldResearch: boolean
  shouldPlanCheck: boolean
}

export function resolveWorkflowMode(
  mode: string, 
  flags: { research?: boolean; skipVerify?: boolean }
): WorkflowFlags {
  const config = WORKFLOW_MODES[mode] || WORKFLOW_MODES.standard
  
  return {
    // Flags can augment (never reduce) mode defaults
    shouldResearch: config.research || flags.research === true,
    shouldPlanCheck: config.planCheck && !flags.skipVerify
  }
}

export function getCheckerPanelDefaults() {
  return {
    base: 'quality-advocate',
    contextual: null,
    expert: 'dynamic'
  }
}

export function getProjectClassificationDefaults() {
  return {
    type: 'generic',
    confidence: 'low',
    signals: []
  }
}
```

**Usage in commands:**
```markdown
@../../fuska/config/workflow-modes.ts
```

---

### 1.3 `fuska/references/megamemory-api.md` (~25 lines)

**Location:** `provider/opinkode/fuska/references/megamemory-api.md`

**Purpose:** Quick reference for MegaMemory tool responses

**Extracted from:** `<megamemory_guide>` section (20 lines × 29 files = ~580 lines total)

**Content:**

```markdown
## MegaMemory API Quick Reference

All project data lives in MegaMemory. If queries return no results, tell the user data wasn't found.

### Tool Responses

**`megamemory:understand` returns:**
```json
{ "concepts": [ { "id": "...", "name": "...", "kind": "...", "summary": "{...}", "children": [...], "edges": [...] } ] }
```

- Parse `summary` field with `JSON.parse()` to extract data
- If `concepts` array is empty, the concept doesn't exist
- Use `top_k` parameter to control result count

**`megamemory:create_concept` returns:** `{id, message}` on success

**`megamemory:update_concept` accepts:** `{summary?, name?, kind?, why?, file_refs?}` only
- Pass full updated JSON string as `summary`
- Returns `{message}`
- Cannot update `parent_id` or `edges` — use `megamemory:link` instead

**`megamemory:list_roots` returns:** array of root concepts (no parent_id)

**`megamemory:link` creates:** relationship between two existing concepts

### Error Handling

If response contains `MEGAMEMORY_ERROR:` → MCP server issue. Display error and stop.

If `concepts` array is empty → Concept doesn't exist. Handle gracefully with user message.
```

**Usage in commands:**
```markdown
@../../fuska/references/megamemory-api.md
```

---

### 1.4 `fuska/references/context-loading.md` (~50 lines)

**Location:** `provider/opinkode/fuska/references/context-loading.md`

**Purpose:** Standard 6-step context query pattern used by planning and execution

**Extracted from:** Step 6 (153 lines) → 15-line include + this file

**Content:**

```markdown
## Context Loading Pattern (Single Pass)

Query MegaMemory for all needed concepts in sequence. Cache results — subsequent steps reference these variables, no re-querying.

### Standard Queries

**1. State:**
```
megamemory_understand(query="state", top_k=5)
stateData = response.concepts.length > 0 ? JSON.parse(response.concepts[0].summary) : null
```

**2. Roadmap:**
```
megamemory_understand(query="roadmap", top_k=5)
roadmapData = response.concepts.length > 0 ? JSON.parse(response.concepts[0].summary) : null
```

**3. Requirements:**
```
megamemory_understand(query="requirements", top_k=50)
requirements = response.concepts.map(m => ({
  id: m.id,
  ...JSON.parse(m.summary)
}))
```

**4. Chapter Context:**
```
megamemory_understand(query=`${chapterSlug}-context`, top_k=1)
contextData = response.concepts.length > 0 ? JSON.parse(response.concepts[0].summary) : null
hasContext = response.concepts.length > 0
```

**5. Research:**
```
megamemory_understand(query=`${chapterSlug}-research`, top_k=1)
researchData = response.concepts.length > 0 ? JSON.parse(response.concepts[0].summary) : null
hasResearch = response.concepts.length > 0
```

**6. Verification (if --fixes mode):**
```
if (hasFixesFlag) {
  megamemory_understand(query=`${chapterSlug}-verification`, top_k=1)
  verificationData = response.concepts.length > 0 ? JSON.parse(response.concepts[0].summary) : null
}
```

### Import Graph Context

**7. Check freshness:**
```
configData = from Step 1
refreshConfig = configData.refresh || { mode: 'disabled' }

if (refreshConfig.mode === 'hybrid' && refreshConfig.auto_before?.includes('plan-chapter')) {
  currentSha = $(git rev-parse HEAD)
  lastSha = refreshConfig.last_sha
  ageHours = refreshConfig.last_refresh ? (Date.now() - new Date(refreshConfig.last_refresh).getTime()) / (1000*60*60) : Infinity
  
  needsRefresh = !lastSha || lastSha !== currentSha || ageHours > (refreshConfig.age_hours || 24)
}
```

**8. Query import graph:**
```
chapterKeywords = chapterName.split(/[\s-]+/).join(' ')
symbolMatches = megamemory_understand(query=`symbol ${chapterKeywords}`, top_k=50)
fileMatches = megamemory_understand(query=`file ${chapterKeywords}`, top_k=50)

// Filter dead-code symbols
importGraphSymbols = symbolMatches.concepts.filter(m => !m.name.startsWith('dead-code:'))
```

### Computed Values

After loading:
```
modelProfile = configData?.model_profile || "balanced"
```
```

**Usage in commands:**
```markdown
@../../fuska/references/context-loading.md
```

---

### 1.5 `fuska/templates/plan-prompts.md` (~100 lines)

**Location:** `provider/opinkode/fuska/templates/plan-prompts.md`

**Purpose:** Planner and Checker prompt templates

**Extracted from:** Steps 7 and 10 (140 lines) → 10-line include + this file

**Content:**

```markdown
# Plan Agent Prompt Templates

Reusable prompt templates for spawning planner and checker agents.

---

## Planner Prompt Template

Use when spawning `fuska-planner` agent. Replace `{placeholders}` with actual values.

```markdown
<critical_constraints>
Return: ## PLANNING COMPLETE or ## CHECKPOINT REACHED or ## PLANNING INCONCLUSIVE
Create plan concepts in MegaMemory using ChapterConceptTemplates.createPlan()
Plans MUST complete within 50% context usage
Each plan: 2-3 tasks maximum
</critical_constraints>

<planning_context>

**Chapter:** {chapter_number}
**Mode:** {standard | fix_planning}

**Project State:**
{stateData JSON}

**Roadmap:**
{roadmapData JSON}

**Requirements (if exists):**
{requirements array}

**Chapter Context (if exists):**
{contextData JSON}

**Research (if exists):**
{researchData JSON}

**Fix Planning (if --fixes mode):**
{verificationData JSON}

</planning_context>

{if importGraphAvailable}
<import_graph_context>

**Related files ({importGraphFiles.length}):**
{importGraphFiles formatted list}

**Related symbols ({importGraphSymbols.length}):**
{importGraphSymbols formatted list}

**Usage:**
- Check `fileByPath.get('path')` before creating files
- Use `symbolByName.get('Name')` for existing symbols
- If file exists: action = "extend"
- If file missing: action = "create"

</import_graph_context>
{endif}

<downstream_consumer>
Output consumed by /fuska-build

Plans must be executable prompts with:
- Frontmatter (batch, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- requirements for goal-backward verification

Use MegaMemory:
- Create plan concepts: ChapterConceptTemplates.createPlan()
- Reference patterns: megamemory:understand()
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] Plan concepts created in MegaMemory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Batchs assigned for parallel execution
- [ ] requirements derived from chapter goal
- [ ] Patterns referenced from MegaMemory (if found)
</quality_gate>
```

---

## Revision Prompt Template

Use when sending plans back to planner for fixes.

```markdown
<critical_constraints>
Return what changed
Do NOT replan from scratch unless issues are fundamental
Update plan concepts in MegaMemory
</critical_constraints>

<revision_context>

**Chapter:** {chapter_number}
**Mode:** revision

**Existing plans:**
{current plan summaries}

**Checker issues:**
{structured issues from checker}

</revision_context>

<instructions>
Make targeted updates to address checker issues.

Use MegaMemory:
- Update plan concepts: megamemory:update_concept()
- Reference patterns from MegaMemory for solutions
</instructions>
```

---

## Checker Panel Prompt Template

Use when spawning `fuska-plan-checker-panel` agent.

```markdown
<critical_constraints>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list with cross-validation badges
</critical_constraints>

<verification_context>

**Chapter:** {chapterNumber}
**Chapter Goal:** {chapterGoal}

**Plans to verify:**
{planConcepts formatted with batch, dependencies, tasks, mustHaves}

**Requirements (if any):**
{requirementConcepts list}

</verification_context>

<checker_panel>
Base: quality-advocate (always)
Contextual: {checkerPanel.contextual or 'none'}
Expert: dynamic (derived from plan content)

Project Classification:
- Type: {projectClassification.type}
- Confidence: {projectClassification.confidence}
- Signals: {projectClassification.signals}
</checker_panel>
```
```

**Usage in commands:**
```markdown
@../../fuska/templates/plan-prompts.md
```

---

### 1.6 `fuska/templates/review-loop.md` (~80 lines)

**Location:** `provider/opinkode/fuska/templates/review-loop.md`

**Purpose:** Interactive review loop pattern for plan/execution review

**Extracted from:** Step 13 (282 lines) → 15-line include + this file

**Content:**

```markdown
# Interactive Review Loop Pattern

Reusable pattern for reviewing plans or execution results with user interaction.

---

## Review Options

```typescript
const reviewOptions = [
  { label: "Looks good, proceed", description: "Save and continue" },
  { label: "Ask a question", description: "Discuss the content" },
  { label: "Modify a task", description: "Change a specific task" },
  { label: "Add a task", description: "Add new task" },
  { label: "Remove a task", description: "Remove a task" }
]
```

---

## Plan Display Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CHAPTER {X}: {Name} - Plans
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Plan 1: {objective}

**Batch:** {batch}
**Depends on:** {depends_on}
**Autonomous:** {yes/no}
**Purpose:** {purpose}
**Output:** {output}

### Must Haves
{requirements list}

### Files to Modify
{files_modified list}

### Tasks ({count})
#### Task 1: {name}
- **Files:** {files}
- **Action:** {action}
- **Verify:** {verify}
- **Done:** {done}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Review Loop Logic

```typescript
while (true) {
  const actionResponse = question(questions=[{
    header: "Plan Review",
    question: "What would you like to do with these plans?",
    options: reviewOptions
  }])

  if (actionResponse[0] === "Looks good, proceed") {
    break  // Continue to next step
  }

  if (actionResponse[0] === "Ask a question") {
    // Get question, answer based on context, re-display
    continue
  }

  if (actionResponse[0] === "Modify a task") {
    // Select plan → Select task → Get modification → Spawn planner revision
    // Re-query and re-display
    continue
  }

  if (actionResponse[0] === "Add a task") {
    // Select plan → Get task details → Spawn planner
    // Re-query and re-display
    continue
  }

  if (actionResponse[0] === "Remove a task") {
    // Select plan → Select task → Confirm → Spawn planner
    // Re-query and re-display
    continue
  }
}
```

---

## Revision Prompt Snippets

**Modify task:**
```markdown
<revision_context>
**Mode:** revision
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Current plan:** {planData JSON}
**User feedback:** {feedback}
</revision_context>

<instructions>
Update the plan to address user feedback.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

**Add task:**
```markdown
<revision_context>
**Mode:** add_task
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Current plan:** {planData JSON}
**New task to add:** {taskDescription}
</revision_context>

<instructions>
Add the new task to the plan.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```

**Remove task:**
```markdown
<revision_context>
**Mode:** remove_task
**Chapter:** {chapterNumber}
**Plan Concept ID:** {planId}
**Current plan:** {planData JSON}
**Task to remove:** Task {index}
</revision_context>

<instructions>
Remove the specified task from the plan.
Use: megamemory_update_concept(id="{planId}", changes={summary: JSON.stringify(updatedPlan)})
Return: ## REVISION COMPLETE
</instructions>
```
```

**Usage in commands:**
```markdown
@../../fuska/templates/review-loop.md
```

---

## Phase 2: Refactor fuska-plan.md

### Updated File Structure

```markdown
---
name: fuska-plan
description: Create detailed execution plan for a chapter with MegaMemory and verification loop
argument-hint: "[chapter] [--research] [--skip-research] [--fixes] [--skip-verify] [--no-review]"
agent: @../../agents/fuska/fuska-planner.md
tools:
  - read
  - bash
  - question
  - task
  - webfetch
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots

---

<objective>

Create executable chapter concepts (plan concepts) for a roadmap chapter with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate chapter, research domain (unless skipped or exists), spawn fuska-planner agent, verify plans with fuska-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees flow between agents in main context.

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/model-validation.md
@../../fuska/references/megamemory-api.md
@../../fuska/references/context-loading.md
@../../fuska/config/model-lookup.ts
@../../fuska/config/workflow-modes.ts
@../../fuska/templates/plan-prompts.md
@../../fuska/templates/review-loop.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Chapter number: `$ARGUMENTS` (optional - auto-detects next unplanned chapter if not provided)

**Flags:**
- `--research` — Force re-research even if research concept exists
- `--skip-research` — Skip research entirely, go straight to planning
- `--fixes` — Fix planning mode (uses verification concept for issues, skips research)
- `--skip-verify` — Skip planner → checker verification loop
- `--no-review` — Skip interactive review loop

Normalize chapter input in step 2 before any MegaMemory lookups.

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate Environment and Resolve Model Profile

**Step 1.1: Check MegaMemory availability**

Call `megamemory_list_roots()`

If empty: Display "No initiatives found. Run fuska init first" → Stop

**Step 1.2: Query and parse config**

```
megamemory_understand(query="config", top_k=5)
configData = JSON.parse(response.concepts[0].summary)
```

**Step 1.3: Resolve models**

Using model-lookup.ts:
```
modelProfile = configData.model_profile || "balanced"
aliases = configData.model_aliases || DEFAULT_ALIASES
models = resolveModels(modelProfile, aliases)
```

**Step 1.4: Validate against OpenCode config**

Using validateModelsAgainstOpenCode() from model-lookup.ts:
- Read ~/.config/opencode/opencode.jsonc
- Validate all model aliases
- If invalid: Display formatted errors → Stop

**Step 1.5: Extract checker panel config**

```
checkerPanel = configData.checker_panel || getCheckerPanelDefaults()
projectClassification = configData.project_classification || getProjectClassificationDefaults()
```

---

## 2. Parse and Normalize Arguments

**Step 2.1: Extract flags**
```
hasResearchFlag = input.includes("--research")
hasSkipResearchFlag = input.includes("--skip-research")
hasFixesFlag = input.includes("--fixes")
hasSkipVerifyFlag = input.includes("--skip-verify")
hasNoReviewFlag = input.includes("--no-review")
modeOverride = input.match(/--mode\s+(\S+)/)?[1] : null
chapterNumber = input.match(/\d+/) ? parseInt(match[0]) : null
```

**Step 2.2: Auto-detect chapter if not provided**

If no chapterNumber:
```
megamemory_understand(query="roadmap", top_k=5)
// Find first incomplete chapter
```

If still no chapter: Display error → Stop

**Step 2.3: Normalize to slug**
```
chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
```

**Step 2.4-2.5: Check existing research and plans**

Query `${chapterSlug}-research` and `${chapterSlug}-plan` concepts.

---

## 3. Validate Chapter

Query chapter concept. If not found: Display error → Stop.

Extract: chapterName, chapterGoal, chapterStatus, chapterId

---

## 4. Handle Research

**Step 4.1-4.2: Skip if --fixes or --skip-research**

**Step 4.3: Resolve workflow mode**

Using workflow-modes.ts:
```
mode = modeOverride || configData.workflow?.mode || "standard"
{ shouldResearch, shouldPlanCheck } = resolveWorkflowMode(mode, { 
  research: hasResearchFlag, 
  skipVerify: hasSkipVerifyFlag 
})
```

**Step 4.4: Skip if research disabled**

**Step 4.5: Use existing if available**

If researchExists AND !hasResearchFlag: Display "Using existing research" → Skip to step 5

**Step 4.6-4.8: Spawn researcher**

Display banner:
```
----------------------------------------------------
 Fuska: RESEARCHING CHAPTER {chapterNumber}
----------------------------------------------------
 [IN_PROGRESS] Spawning researcher...
```

Gather context (chapter, requirements, context, state) and spawn fuska-chapter-researcher.

**Handle researcher return:**
- `## RESEARCH COMPLETE` → Continue to step 5
- `## RESEARCH BLOCKED` → Offer options (Provide context, Skip research, Abort)

---

## 5. Check Existing Plans

If plans exist: Question user (Continue, View, Replan)

---

## 6. Load All Context (Single Pass)

Follow context-loading.md pattern:
1. State → stateData
2. Roadmap → roadmapData
3. Requirements → requirements
4. Chapter context → contextData, hasContext
5. Research → researchData, hasResearch
6. Verification (if --fixes) → verificationData
7. Import graph (if available) → importGraphFiles, importGraphSymbols

---

## 7. Spawn fuska-planner Agent

Display banner:
```
-----------------------------------------------------
 Fuska: PLANNING CHAPTER {X}
-----------------------------------------------------
 [IN_PROGRESS] Spawning planner...
```

Build prompt using plan-prompts.md templates. Fill placeholders with gathered context.

```
Task(
  prompt=filled_prompt,
  subagent_type="fuska-planner",
  model=models.planner,
  variant="plan",
  description="Plan Chapter {chapter}"
)
```

---

## 8. Handle Planner Return

- `## PLANNING COMPLETE` → If skip-verify: Step 14, else: Step 10
- `## CHECKPOINT REACHED` → Present to user, spawn continuation
- `## PLANNING INCONCLUSIVE` → Offer options

---

## 9. Query Plans for Verification

Query all `${chapterSlug}-plan` concepts. Extract plan data for checker.

---

## 10. Spawn fuska-plan-checker-panel Agent

Display banner:
```
-----------------------------------------------------
 Fuska: VERIFYING PLANS
-----------------------------------------------------
 [IN_PROGRESS] Spawning plan checker panel...
```

Build prompt using plan-prompts.md checker template.

```
Task(
  subagent_type="fuska-plan-checker-panel",
  model=models.checker,
  variant="validate",
  description="Verify Chapter {chapterNumber} plans",
  prompt=checkerPrompt
)
```

---

## 11. Handle Checker Return

- `## VERIFICATION PASSED` → Step 13
- `## ISSUES FOUND` → List issues → Step 12

---

## 12. Revision Loop (Max 3 Iterations)

Track iteration_count (starts at 1).

**If iteration_count < 3:**
- Display "Sending back for revision... (iteration N/3)"
- Query current plans
- Build revision prompt from plan-prompts.md
- Spawn fuska-planner
- Increment iteration_count
- Return to Step 10

**If iteration_count >= 3:**
- Display remaining issues
- Offer: Force proceed, Provide guidance, Abandon

---

## 13. Interactive Review Loop

Using review-loop.md pattern:

**Step 13.1: Check skip flag**
```
skipReview = hasNoReviewFlag || configData?.workflow?.interactive_review === false
if (skipReview) → Step 14
```

**Step 13.2-13.3: Display plans and review loop**

Follow review-loop.md for:
- Plan display format
- Review options handling
- Modification prompts
- Re-query and re-display after changes

---

## 14. Update State Concept

Query state concept, update with:
```
{
  ...stateData,
  current_chapter: chapterSlug,
  status: "ready_to_execute"
}
```

---

## 15. Present Final Status

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly:

```
-----------------------------------------------------
  Fuska: Chapter {X} planned
-----------------------------------------------------

**Chapter {X}: {Name}** — {N} plan(s) in {M} batch(s)

| Batch | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

──────────────────────────────────────────────────────────────

## > Next Up

**Execute Chapter {X}** — run all {N} plans
/fuska-build {X}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Review plans in MegaMemory: search for "{CHAPTER}-plan" to see all plan concepts
- /fuska-plan {X} --research — re-research first
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Chapter validated against roadmap
- [ ] Research completed (unless skipped/exists)
- [ ] fuska-planner spawned with context
- [ ] Plan concepts created
- [ ] fuska-plan-checker spawned (unless --skip-verify)
- [ ] Verification passed OR user override
- [ ] Interactive review loop (unless --no-review)
- [ ] State concept updated
- [ ] User knows next steps

</success_criteria>
```

### Line Count Comparison

| Section | Original | Optimized |
|---------|----------|-----------|
| Frontmatter | 16 | 16 |
| Objective | 11 | 11 |
| Execution context | 8 | 16 (+8 includes) |
| Megamemory guide | 20 | 0 (moved to reference) |
| Step 1: Model validation | 174 | 25 |
| Steps 2-3: Parse/validate | 80 | 50 |
| Step 4: Research | 120 | 60 |
| Step 5: Existing plans | 30 | 15 |
| Step 6: Context loading | 153 | 15 |
| Step 7: Planner spawn | 90 | 20 |
| Steps 8-9: Return handling | 60 | 40 |
| Step 10: Checker spawn | 50 | 15 |
| Step 11-12: Revision loop | 70 | 45 |
| Step 13: Interactive review | 282 | 20 |
| Step 14-15: State + status | 50 | 35 |
| Offer next + success | 60 | 60 |
| **Total** | **1,447** | **~450** |

**Reduction: 69%** (1,447 → ~450 lines)

---

## Phase 3: Apply to Other Commands (Future)

After proof of concept validates approach:

### High-Impact Extractions

| Command | Lines | Can Use |
|---------|-------|---------|
| fuska-do.md | 1,164 | review-loop, context-loading, megamemory-api |
| fuska-init.md | ~800 | megamemory-api |
| fuska-configure.md | ~600 | model-lookup, megamemory-api |
| fuska-debug.md | 464 | context-loading, megamemory-api |
| All 29 commands | ~18,000 | megamemory-api |

### Expected Savings

- megamemory-api.md: 29 files × 20 lines = **580 lines saved**
- model-lookup.ts: 8 files × 30 lines = **240 lines saved**
- workflow-modes.ts: 4 files × 20 lines = **80 lines saved**
- review-loop.md: 3 files × 200 lines = **600 lines saved**
- context-loading.md: 10 files × 100 lines = **1,000 lines saved**

**Total estimated savings: ~2,500 lines across all commands**

---

## Verification Checklist

Before marking complete:

- [ ] All 6 shared files created
- [ ] fuska-plan.md refactored
- [ ] Line count verified (~450 lines)
- [ ] All includes resolve correctly
- [ ] Command still functions (test manually)
- [ ] No content lost in extraction

---

## Notes

1. **Include syntax**: Using existing `@path` syntax (already supported)
2. **Config format**: TypeScript for type safety and IDE support
3. **Extraction threshold**: >20 lines duplicated in 3+ files = extract

## Questions for User

None — plan is ready for execution when approved.
