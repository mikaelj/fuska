---
name: fuska-new-project
description: Initialize a new project using MegaMemory instead of markdown files
tools:
  - read
  - bash
  - question
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:list_roots
---

## Usage

```
/fuska-new-project <project-name> [options]
```

**Arguments:**
- `<project-name>` — Project name (required when using arguments mode)

**Options:**
| Flag | Values | Description |
|------|--------|-------------|
| `--mode` | `yolo`, `interactive` | Workflow mode: auto-approve or confirm each step |
| `--depth` | `quick`, `standard`, `comprehensive` | Planning thoroughness |
| `--parallel` | `true`, `false` | Run independent plans simultaneously |
| `--commits` | `per-phase`, `per-plan`, `per-task` | Git commit granularity |
| `--research` | `yes`, `no` | Research domain before planning |
| `--plan-check` | `yes`, `no` | Verify plans achieve goals |
| `--verifier` | `yes`, `no` | Verify work satisfies requirements |

**Examples:**

```bash
# Full argument mode - skip all questions
/fuska-new-project My Blog --mode yolo --depth quick --parallel true --commits per-phase --research yes --plan-check yes --verifier no

# Project name only - skip questioning but ask workflow preferences
/fuska-new-project My Blog

# Interactive mode (no arguments) - ask everything
/fuska-new-project
```

<objective>

Initialize a new project through unified flow using MegaMemory knowledge graph: questioning → research (optional) → requirements → roadmap.

This is most leveraged moment in any project. Deep questioning here means better plans, better execution, better outcomes. One command takes you from idea to ready-for-planning.

**Creates MegaMemory concepts:**
- `project-root` — project context
- `config` — workflow preferences
- `research/*` — domain research (optional)
- `requirements/*` — scoped requirements
- `roadmap` and `phase-N` — phase structure
- `state` — project memory

**After this command:** Run `/fuska-discuss-phase 1` to start execution.

</objective>

 <execution_context>
 
 @./opencode/fuska/references/preflight-check-connectivity.md
 @./opencode/fuska/references/questioning.md
 @./opencode/fuska/references/ui-brand.md
 
 @./opencode/fuska/scripts/types.ts
 @./opencode/fuska/scripts/project-templates.ts
 @./opencode/fuska/scripts/phase-templates.ts
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

**`megamemory:list_roots` returns:** an array of root concepts with `id`, `name`, `kind`, `summary`.

</megamemory_guide>

<process>

## 0. Preflight Check

This is a new project — the database may not exist yet, so skip the `test -f .megamemory/knowledge.db` check.
Instead, only verify MegaMemory connectivity: call `megamemory:list_roots()`. If the tool call itself errors (not empty results, but an actual tool error), display the MCP server diagnostic from @preflight-check-connectivity.md and stop.

## Phase 1: Setup

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

1. **Abort if project exists:**

   Check if a project already exists by calling `megamemory:list_roots`. This returns an array of root concepts, each with `{id, name, kind, summary}`. If any root with `kind="feature"` has a name matching the project, the project is already initialized — abort with "ERROR: Project already initialized. Use /fuska-progress"

2. **Check if codebase is already mapped in MegaMemory:**
   ```
   megamemory:understand({ query: "codebase", top_k: 5 })
   ```
   If matches include a concept named `codebase` or any `codebase-*` concepts, set `HAS_CODEBASE_MAP="yes"`, otherwise `HAS_CODEBASE_MAP=""`.

3. **Initialize git repo in THIS directory** (required even if inside a parent repo):
   ```bash
   if [ -d .git ] || [ -f .git ]; then
       echo "Git repo exists in current directory"
   else
       git init
       echo "Initialized new git repo"
   fi
   ```

4. **Detect existing code (brownfield detection):**
   ```bash
   CODE_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" 2>/dev/null | grep -v node_modules | grep -v .git | head -20)
   HAS_PACKAGE=$([ -f package.json ] || [ -f requirements.txt ] || [ -f Cargo.toml ] || [ -f go.mod ] || [ -f Package.swift ] && echo "yes")
   ```

   **You MUST run all checks above before proceeding.**

5. **Check for command arguments:**

   The user prompt may contain arguments after the `/fuska-new-project` command. Parse them:

   ```bash
   # Example: '/fuska-new-project My App Name --mode yolo --depth quick'
   # Extract project name (text before first --flag) and flags
   ```

   **Parse arguments from the prompt:**
   - Project name: Text after `/fuska-new-project` and before any `--flag`
   - Flags: `--mode`, `--depth`, `--parallel`, `--commits`, `--research`, `--plan-check`, `--verifier`

   **Set shell variables:**
   - If any arguments present: `HAS_ARGS="yes"`, `SKIP_QUESTIONING="yes"`
   - If all workflow flags present: `SKIP_WORKFLOW_QUESTIONS="yes"`
   - Store parsed values in `PARSED_ARGS` (JSON-like structure in memory):
     ```
     PARSED_PROJECT_NAME="My App Name"
     PARSED_MODE="yolo"
     PARSED_DEPTH="quick"
     PARSED_PARALLEL="true"
     PARSED_COMMITS="per-phase"
     PARSED_RESEARCH="yes"
     PARSED_PLAN_CHECK="yes"
     PARSED_VERIFIER="no"
     ```

## Phase 2: Brownfield Offer

**If existing code detected and no codebase concepts exist in MegaMemory:**

Check results from setup step:
- If `CODE_FILES` is non-empty OR `HAS_PACKAGE` is "yes"
- AND `HAS_CODEBASE_MAP` is NOT "yes"

Use question:
- header: "Existing Code"
- question: "I detected existing code in this directory. Would you like to map codebase first?"
- options:
  - "Map codebase first" — Run /fuska-map-codebase to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**
```
Run `/fuska-map-codebase` first, then return to `/fuska-new-project`
```
Exit command.

**If "Skip mapping":** Continue to Phase 3.

**If no existing code detected OR codebase already mapped:** Continue to Phase 3.

## Phase 3: Deep Questioning

**Skip if arguments provided:**

If `SKIP_QUESTIONING="yes"`, extract project info from `PARSED_*` variables and jump to Phase 4:

```typescript
// Use parsed arguments instead of interactive questioning
const projectName = PARSED_PROJECT_NAME;
const projectSlug = generateSlug(projectName);  // lowercase, hyphenated
const whatThisIs = `${projectName} project`;     // default description
const coreValue = `Core value of ${projectName}`; // default value proposition

// Skip to Phase 4: Create MegaMemory Concepts
```

**Otherwise, continue with interactive questioning:**

**Display stage banner:**

```
-----------------------------------------------------
 Fuska: QUESTIONING
-----------------------------------------------------
```

**OpenMegaMemory conversation:**

Ask inline (freeform, NOT question):

"What do you want to build?"

Wait for their response. This gives you context needed to ask intelligent follow-up questions.

**Follow thread:**

Based on what they said, ask follow-up questions that dig into their response. Use question with options that probe what they mentioned — interpretations, clarifications, concrete examples.

Keep following threads. Each answer opens new threads to explore. Ask about:
- What excited them
- What problem sparked this
- What they mean by vague terms
- What it would actually look like
- What's already decided

Consult `questioning.md` for techniques:
- Challenge vagueness
- Make abstract concrete
- Surface assumptions
- Find edges
- Reveal motivation

**Check context (background, not out loud):**

As you go, mentally check context checklist from `questioning.md`. If gaps remain, weave questions naturally. Don't suddenly switch to checklist mode.

**Decision gate:**

When you could create a clear project-root concept, use question:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create project concepts in MegaMemory?"
- options:
  - "Create project concepts" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Create project concepts" selected.

## Phase 4: Create MegaMemory Concepts

**Generate project slug:**
```
Extract a short, lowercase, hyphenated slug from project name.
Example: "User Authentication System" → "user-auth"
```

**Create project-root concept:**

Establish the project root in MegaMemory so all other concepts can attach to it. Call `megamemory:create_concept` with this structure (returns `{id, message}` on success):

```typescript
{
  name: projectSlug,
  kind: "feature",
  summary: `Project: ${projectName}\n\n${whatThisIs}`,
  why: coreValue,
  parent_id: null
}
```

Where:
- `projectSlug` = generated slug
- `projectName` = from user input
- `whatThisIs` = summary of what this project is
- `coreValue` = the ONE thing that makes this valuable

**Create requirements module:**

```typescript
{
  name: "requirements",
  kind: "module",
  summary: "Project requirements list",
  parent_id: projectSlug,
  edges: [{ to: projectSlug, relation: "connects_to" }]
}
```

**Create initial requirement concepts:**

For greenfield projects, initialize requirements as hypotheses:

```typescript
// For each initial requirement
{
  name: `req-${id}`,
  kind: "feature",
  summary: JSON.stringify({
    description: requirementText,
    status: "active",
    hypothesis: true
  }),
  parent_id: `${projectSlug}/requirements`,
  edges: [{ to: "requirements", relation: "implements" }]
}
```

For brownfield projects (codebase map exists):

1. Query MegaMemory for codebase concepts: `megamemory:understand({ query: "codebase architecture stack", top_k: 10 })` and parse summaries for architecture/stack info
2. Infer validated requirements from existing code
3. Create requirement concepts with `status: "validated"` and `existing: true`

**Create roadmap module:**

```typescript
{
  name: "roadmap",
  kind: "module",
  summary: "Project roadmap with phases",
  parent_id: projectSlug,
  edges: [{ to: projectSlug, relation: "connects_to" }]
}
```

**Create initial phase concepts:**

Based on requirements, create phase concepts:

```typescript
{
  name: `phase-${phaseNumber}`,
  kind: "feature",
  summary: JSON.stringify({
    number: phaseNumber,
    slug: `phase-${phaseNumber.toString().padStart(2, '0')}`,
    name: phaseName,
    goal: phaseGoal,
    status: "planned"
  }),
  parent_id: `${projectSlug}/roadmap`,
  edges: [{ to: "roadmap", relation: "connects_to" }]
}
```

**Create state concept:**

```typescript
{
  name: "state",
  kind: "config",
  summary: JSON.stringify({
    current_phase: `phase-01`,
    current_plan: null,
    status: "ready_to_plan",
    progress: 0,
    last_activity: "Project initialized"
  }),
  parent_id: projectSlug,
  edges: [{ to: projectSlug, relation: "configured_by" }]
}
```

**Create todos module:**

```typescript
{
  name: "todos",
  kind: "module",
  summary: "Project todos tracking",
  parent_id: projectSlug,
  edges: [{ to: projectSlug, relation: "connects_to" }]
}
```

## Phase 5: Workflow Preferences

**Skip if workflow flags provided:**

If `SKIP_WORKFLOW_QUESTIONS="yes"`, use parsed preference flags from `PARSED_*` variables instead of asking:

```typescript
// Use parsed workflow preferences
const config = {
  mode: PARSED_MODE || "yolo",           // yolo|interactive
  depth: PARSED_DEPTH || "standard",     // quick|standard|comprehensive
  parallelization: PARSED_PARALLEL !== "false",  // true|false
  workflow: {
    research: PARSED_RESEARCH !== "no",  // true|false
    plan_check: PARSED_PLAN_CHECK !== "no",  // true|false
    verifier: PARSED_VERIFIER !== "no"   // true|false
  },
  git: {
    commit_strategy: PARSED_COMMITS || "per-phase"  // per-phase|per-plan|per-task
  }
};
```

**Otherwise, ask interactive questions:**

**Round 1 — Core workflow settings (4 questions):**

```
questions: [
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ]
  },
  {
    header: "Depth",
    question: "How thorough should planning be?",
    multiSelect: false,
    options: [
      { label: "Quick", description: "Ship fast (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced scope and speed (5-8 phases, 3-5 plans each)" },
      { label: "Comprehensive", description: "Thorough coverage (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Commits",
    question: "How should git commits be structured?",
    multiSelect: false,
    options: [
      { label: "Per phase (Recommended)", description: "One commit when all plans in a phase complete" },
      { label: "Per plan", description: "One commit per plan (groups all tasks in a plan)" },
      { label: "Per task", description: "One commit per task (most granular)" }
    ]
  },
]
```

**Round 2 — Workflow agents:**

These spawn additional agents during planning/execution. They add tokens and time but improve quality.

```
questions: [
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  }
]
```

**Create config concept:**

```typescript
{
  name: "config",
  kind: "config",
  summary: JSON.stringify({
    mode: "yolo|interactive",
    depth: "quick|standard|comprehensive",
    parallelization: true|false,
    workflow: {
      research: true|false,
      plan_check: true|false,
      verifier: true|false
    },
    git: {
      commit_strategy: "per-phase|per-plan|per-task"  // default: "per-phase"
    }
  }),
  parent_id: projectSlug,
  edges: [{ to: projectSlug, relation: "configured_by" }]
}
```

## Phase 6: Research Decision

Use question:
- header: "Research"
- question: "Research domain ecosystem before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover standard stacks, expected features, architecture patterns
  - "Skip research" — I know this domain well, go straight to requirements

**If "Research first":**

Display stage banner:
```
-----------------------------------------------------
 Fuska: RESEARCHING
-----------------------------------------------------

Researching [domain] ecosystem...
```

**Determine milestone context:**

Check requirements concepts:
- If no validated requirements → Greenfield (building from scratch)
- If validated requirements exist → Subsequent milestone (adding to existing app)

Display spawning indicator:
```
[IN_PROGRESS] Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

Spawn 4 parallel fuska-project-researcher agents with context about MegaMemory usage:

```
Task(prompt="
<objective>
Research stack dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-stack-research
Include standard stack options with recommendations
Include why each technology is chosen
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Stack research")

Task(prompt="
<objective>
Research features dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-features-research
Categorize: table stakes, differentiators, anti-features
Note complexity and dependencies
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Features research")

Task(prompt="
<objective>
Research architecture dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-architecture-research
Include recommended architecture patterns
Include component boundaries and data flow
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Architecture research")

Task(prompt="
<objective>
Research pitfalls dimension for project: ${projectName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${projectSlug}-pitfalls-research
For each pitfall: warning signs, prevention strategy, which phase should address
</output>
", subagent_type="fuska-project-researcher", model="${models.researcher}", description="Pitfalls research")
```

Each researcher creates MegaMemory concepts instead of markdown files:

```typescript
// Stack research creates:
{
  name: "research-stack",
  kind: "pattern",
  summary: JSON.stringify({
    domain: domainName,
    confidence: "high|medium|low",
    sources: [...],
    standard_stack: [...],
    architecture_patterns: [],
    pitfalls: []
  }),
  parent_id: projectSlug,
  edges: [{ to: projectSlug, relation: "connects_to" }]
}
```

After all researchers complete, gather all research findings by calling `megamemory:understand` with `query="research stack features architecture pitfalls"` and `top_k=20`. This returns `{matches: [...]}` where each match contains `{id, name, kind, summary, children, edges}`. Look for matches with names like `research-stack`, `research-features`, `research-architecture`, `research-pitfalls` — parse their `summary` JSON to synthesize findings across all four research areas:

```
Research concepts found:
- research-stack
- research-features
- research-architecture
- research-pitfalls
```

**If "Skip research":** Continue to Phase 7.

## Phase 7: Define Requirements

Display stage banner:
```
-----------------------------------------------------
 Fuska: DEFINING REQUIREMENTS
-----------------------------------------------------
```

**Load context:**

Retrieve the project's core value, constraints, and scope boundaries by calling `megamemory:understand` with `query="project context"` and `top_k=5`. This returns `{matches: [...]}` — look for the project-root concept (kind="feature") and extract its `summary` and `why` fields to anchor requirement decisions.

**If research exists:** Load research findings to drive feature categories by calling `megamemory:understand` with `query="research features architecture"` and `top_k=20`. From the returned matches, find concepts named `research-features` and `research-architecture` — their `summary` JSON contains categorized feature lists and architecture patterns to use as the basis for requirements.

**Present features by category:**

Extract feature categories from research concepts and present similarly to file-based version.

**If no research:** Gather requirements through conversation.

**Scope each category using question tool as before.**

**Update requirement concepts:**

For each requirement:
1. Check if concept exists
2. If exists, update with `megamemory:update_concept`
3. If new, create with `megamemory:create_concept`

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02)

**Requirement quality criteria:** Same as file-based version.

**Present full requirements list:**

Retrieve the complete requirements list by calling `megamemory:understand` with `query="requirements"` and `top_k=50`. This returns `{matches: [...]}` — filter for matches whose `parent_id` ends with `/requirements` and whose `kind="feature"`. Each match's `summary` is a JSON string containing `{description, status, hypothesis}`. Parse these to build the full requirements table.

Present for user confirmation.

## Phase 8: Create Roadmap

Display stage banner:
```
-----------------------------------------------------
 Fuska: CREATING ROADMAP
-----------------------------------------------------

[IN_PROGRESS] Spawning roadmapper...
```

Spawn fuska-roadmapper agent with MegaMemory context:

```
Task(prompt="
<planning_context>

Use MegaMemory instead of file I/O:

**Project:**
Query: 'project context'

**Requirements:**
Query: 'requirements' top_k=50

**Research (if exists):**
Query: 'research' top_k=10

**Config:**
Query: 'config'

</planning_context>

<instructions>
Create roadmap using MegaMemory:
1. Derive phases from requirements (don't impose structure)
2. Map every v1 requirement to exactly one phase
3. Derive 2-5 success criteria per phase
4. Validate 100% coverage
5. Create/update phase concepts in MegaMemory
6. Update state concept with current phase info
7. Return ROADMAP CREATED with summary

Create concepts using ProjectConceptTemplates and PhaseConceptTemplates.
</instructions>
", subagent_type="fuska-roadmapper", model="{roadmapper_model}", description="Create roadmap with MegaMemory")
```

**Handle roadmapper return:**

**If `## ROADMAP BLOCKED`:** Present blocker, resolve, re-spawn.

**If `## ROADMAP CREATED`:**

Load the generated roadmap by calling `megamemory:understand` with `query="phase"` and `top_k=20`. This returns `{matches: [...]}` — filter for matches with `kind="feature"` whose `parent_id` ends with `/roadmap`. Each match's `summary` is a JSON string containing `{number, slug, name, goal, status}`. Sort by `number` and present as an ordered phase list with goals.

**CRITICAL: Ask for approval:**

Use question tool as before.

**If "Approve":** Phase concepts already created in MegaMemory. Continue.

**If "Adjust phases":** Re-spawn roadmapper with revision context.

**If "Review full file":** Query individual phase concepts.

## Phase 9: Done

Present completion with next steps:

```
-----------------------------------------------------
  Fuska: Project initialized
-----------------------------------------------------

**[Project Name]**

| Concept Type | Count |
|-------------|--------|
| Requirements | [X] |
| Phases      | [N] |
| Research     | [4 or 0] |

All v1 requirements mapped to phases [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Phase 1: [Phase Name]** — [Goal]

/fuska-discuss-phase 1 — gather context and clarify approach

*/new first → fresh context window*

──────────────────────────────────────────────────────────────
```

</process>

<output>

All concepts created in MegaMemory knowledge graph:
- `project-root` (kind: feature)
- `requirements/*` (kind: feature)
- `roadmap` (kind: module)
- `phase-N` (kind: feature)
- `state` (kind: config)
- `config` (kind: config)
- `todos` (kind: module)
- `research/*` (kind: pattern, if research selected)

</output>

<success_criteria>

- [ ] Git repo initialized
- [ ] Brownfield detection completed
- [ ] Deep questioning completed (threads followed, not rushed)
- [ ] project-root concept created
- [ ] config concept created with workflow mode, depth, parallelization
- [ ] Research completed (if selected) — 4 parallel agents spawned, concepts created
- [ ] Requirements gathered (from research or conversation)
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] Requirement concepts created with REQ-IDs
- [ ] fuska-roadmapper spawned with MegaMemory context
- [ ] Phase concepts created with requirements mapped
- [ ] State concept updated
- [ ] User knows next step is `/fuska-discuss-phase 1`

**No file commits needed:** All state in MegaMemory. Optional export script can create markdown backup if needed.

</success_criteria>
