---
name: fuska-configure
description: Configure an existing initiative through questioning and preferences
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
/fuska-configure [flags...] [description]
```

**Flags:**
- `--mode (yolo|interactive)` — Workflow mode
- `--depth (quick|standard|comprehensive)` — Planning depth
- `--parallel (true|false)` — Parallel execution
- `--commits (per-chapter|per-plan|per-task)` — Commit strategy
- `--research (yes|no)` — Enable research phase
- `--plan-check (yes|no)` — Enable plan verification
- `--verifier (yes|no)` — Enable chapter verification

**Examples:**
- `/fuska-configure` — Interactive mode (asks all questions)
- `/fuska-configure A task management app for teams` — Description provided, asks workflow questions
- `/fuska-configure --mode yolo --depth quick A task management app` — Description + flags, minimal questions
- `/fuska-configure --mode yolo --depth quick --parallel true --commits per-chapter --research yes --plan-check yes --verifier yes` — All flags, no questions asked

<objective>

Configure an existing initiative through unified flow using MegaMemory knowledge graph: questioning → research (optional) → requirements → roadmap.

This command is run after `fuska init` to complete initiative setup. If a description was provided during init, questioning is streamlined.

**Creates MegaMemory concepts:**
- Updates `initiative-root` — with what_this_is and core_value
- `config` — workflow preferences (root-level)
- `research/*` — domain research (optional)
- `requirements/*` — scoped requirements
- `roadmap` and `chapter-N` — chapter structure
- Updates `state` — initiative memory

**After this command:** Run `/fuska-design 1` to start execution.

</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md

@../../fuska/references/preflight-check-connectivity.md
@../../fuska/references/questioning.md
@../../fuska/references/ui-brand.md

@../../fuska/scripts/types.ts
@../../fuska/scripts/initiative-templates.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<process>

## Chapter 0: Preflight

1. Get current initiative from config:
   ```
   megamemory:understand({ query: 'config', top_k: 5 })
   ```
   Parse the config concept's summary to get `current_initiative`.

2. Load initiative concept:
   ```
   megamemory:understand({ query: 'current_initiative value', top_k: 5 })
   ```
   Find the concept with matching name and `parent_id: null`.

3. Check if summary contains description:
   - Parse the initiative summary
   - Format is: `Initiative: {name}\n\n{description}`
   - If text after `\n\n` is non-empty: `HAS_DESCRIPTION="yes"`, store in `STORED_DESCRIPTION`
   - If empty or whitespace only: `HAS_DESCRIPTION=""`

4. Display context banner:
   ```
   -----------------------------------------------------
    Fuska: CONFIGURE INITIATIVE
   -----------------------------------------------------
   ```

5. Parse command arguments (if any):
   - The user prompt may contain flags and/or a description
   - Parse flags first: `--mode (yolo|interactive)`, `--depth (quick|standard|comprehensive)`, `--parallel (true|false)`, `--commits (per-chapter|per-plan|per-task)`, `--research (yes|no)`, `--plan-check (yes|no)`, `--verifier (yes|no)`
   - Store flags in `PARSED_ARGS` object
   - Extract remaining non-flag text as `PROVIDED_DESCRIPTION`
   - If `PROVIDED_DESCRIPTION` is non-empty:
     - `HAS_DESCRIPTION="yes"`
     - `STORED_DESCRIPTION = PROVIDED_DESCRIPTION`
   - If `STORED_DESCRIPTION` exists (either from arguments or initiative): `SKIP_QUESTIONING="yes"`
   - If ALL workflow args provided (`--mode`, `--depth`, `--parallel`, `--commits`, `--research`, `--plan-check`, `--verifier`): `SKIP_WORKFLOW_QUESTIONS="yes"`

## Chapter 1: Deep Questioning

**If SKIP_QUESTIONING is set:**

Description was provided (via command argument or stored in initiative). Skip questioning entirely:

1. Use `STORED_DESCRIPTION` (from command argument or initiative)
2. Derive `whatThisIs` and `coreValue` from the description
3. Skip directly to Chapter 2 (Workflow Preferences)

**If HAS_DESCRIPTION:**

The user provided a description (via command argument or during `fuska init`). Use it to derive context:

1. Parse `STORED_DESCRIPTION`
2. Derive `whatThisIs` from the description content
3. Derive `coreValue` from the description (identify the key value proposition)
4. If core value is unclear, ask ONE clarifying question:
   ```
   question: {
     header: "Core Value",
     question: "What's the ONE thing that makes this valuable? What problem does it solve?",
     options: [
       { label: "Use derived value", description: "I'll use: ${derived core value}" }
     ]
   }
   ```
5. Skip to Chapter 2 (Workflow Preferences)

**If no description:**

Run full interactive questioning.

**Display stage banner:**

```
-----------------------------------------------------
 Fuska: QUESTIONING
-----------------------------------------------------
```

**Open conversation:**

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

When you could create a clear initiative-root concept, use question:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to update the initiative in MegaMemory?"
- options:
  - "Update initiative" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Update initiative" selected.

**Update initiative concept:**

After questioning, update the initiative root concept:

```typescript
// Get the initiative concept ID from earlier
megamemory:update_concept({
  id: initiativeId,
  changes: {
    summary: `Initiative: ${initiativeName}\n\n${whatThisIs}`,
    why: coreValue
  }
})
```

## Chapter 2: Workflow Preferences

**If SKIP_WORKFLOW_QUESTIONS is set:**

All workflow preferences were provided via command flags. Use `PARSED_ARGS` directly:

- `mode`: PARSED_ARGS.mode or "yolo"
- `depth`: PARSED_ARGS.depth or "standard"
- `parallelization`: PARSED_ARGS.parallel === "true"
- `git.commit_strategy`: PARSED_ARGS.commits
- `workflow.research`: PARSED_ARGS.research === "yes"
- `workflow.plan_check`: PARSED_ARGS["plan-check"] === "yes"
- `workflow.verifier`: PARSED_ARGS.verifier === "yes"

Skip the interactive questions and proceed to "Create/update config concept" below.

**Ask interactive questions:**

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
      { label: "Quick", description: "Ship fast (3-5 chapters, 1-3 plans each)" },
      { label: "Standard", description: "Balanced scope and speed (5-8 chapters, 3-5 plans each)" },
      { label: "Comprehensive", description: "Thorough coverage (8-12 chapters, 5-10 plans each)" }
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
      { label: "Per chapter (Recommended)", description: "One commit when all plans in a chapter complete" },
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
    question: "Research before planning each chapter? (adds tokens/time)",
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
    header: "Reviewer",
    question: "Review work satisfies requirements after each chapter? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match chapter goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  }
]
```

**Create/update config concept:**

```typescript
// Check if config exists, update or create
megamemory:understand({ query: 'config', top_k: 5 })

// If exists, update:
megamemory:update_concept({
  id: configId,
  changes: {
    summary: JSON.stringify({
      current_initiative: initiativeSlug,
      mode: "yolo|interactive",
      depth: "quick|standard|comprehensive",
      parallelization: true|false,
      workflow: {
        research: true|false,
        plan_check: true|false,
        verifier: true|false
      },
      git: {
        commit_strategy: "per-chapter|per-plan|per-task"
      }
    })
  }
})

// If doesn't exist, create:
megamemory:create_concept({
  name: "config",
  kind: "config",
  summary: JSON.stringify({ ... }),
  parent_id: undefined,
  edges: []
})
```

## Chapter 3: Research Decision

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

Display spawning indicator:
```
[IN_PROGRESS] Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

Spawn 4 parallel fuska-initiative-researcher agents with context about MegaMemory usage:

```
Task(prompt="
<objective>
Research stack dimension for project: ${initiativeName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${initiativeSlug}-stack-research
Include standard stack options with recommendations
Include why each technology is chosen
</output>
", subagent_type="fuska-initiative-researcher", description="Stack research")

Task(prompt="
<objective>
Research features dimension for project: ${initiativeName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${initiativeSlug}-features-research
Categorize: table stakes, differentiators, anti-features
Note complexity and dependencies
</output>
", subagent_type="fuska-initiative-researcher", description="Features research")

Task(prompt="
<objective>
Research architecture dimension for project: ${initiativeName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${initiativeSlug}-architecture-research
Include recommended architecture patterns
Include component boundaries and data flow
</output>
", subagent_type="fuska-initiative-researcher", description="Architecture research")

Task(prompt="
<objective>
Research pitfalls dimension for project: ${initiativeName}.
</objective>

<context>
GREENFIELD PROJECT — Building from scratch.

Project description: ${projectDescription}
</context>

<output>
Create research concept: ${initiativeSlug}-pitfalls-research
For each pitfall: warning signs, prevention strategy, which chapter should address
</output>
", subagent_type="fuska-initiative-researcher", description="Pitfalls research")
```

Each researcher creates MegaMemory concepts:

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
  parent_id: initiativeSlug,
  edges: [{ to: initiativeSlug, relation: "connects_to" }]
}
```

After all researchers complete, gather all research findings by calling `megamemory:understand` with `query="research stack features architecture pitfalls"` and `top_k=20`. Parse their `summary` JSON to synthesize findings.

**If "Skip research":** Continue to Chapter 4.

## Chapter 4: Define Requirements

Display stage banner:
```
-----------------------------------------------------
 Fuska: DEFINING REQUIREMENTS
-----------------------------------------------------
```

**Load context:**

Retrieve the project's core value and scope boundaries by calling `megamemory:understand` with `query="project context"` and `top_k=5`. Extract `why` field for core value.

**If research exists:** Load research findings by calling `megamemory:understand` with `query="research features architecture"` and `top_k=20`.

**Present features by category:**

Extract feature categories from research concepts (if available) or gather through conversation.

**Scope each category using question tool.**

**Create requirement concepts:**

For each requirement, create in MegaMemory:

```typescript
{
  name: `req-${id}`,  // Format: CATEGORY-NUMBER (AUTH-01, CONTENT-02)
  kind: "feature",
  summary: JSON.stringify({
    description: requirementText,
    status: "active",
    hypothesis: true  // For greenfield, all requirements are hypotheses
  }),
  parent_id: `${initiativeSlug}/requirements`,
  edges: [{ to: "requirements", relation: "part_of" }]
}
```

**Present full requirements list:**

Query all requirements: `megamemory:understand({ query: "requirements", top_k: 50 })`. Filter for `kind="feature"` with `parent_id` ending in `/requirements`. Present for user confirmation.

## Chapter 5: Create Roadmap

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
1. Derive chapters from requirements (don't impose structure)
2. Map every v1 requirement to exactly one chapter
3. Derive 2-5 success criteria per chapter
4. Validate 100% coverage
5. Create/update chapter concepts in MegaMemory
6. Update state concept with current chapter info
7. Return ROADMAP CREATED with summary

Create concepts using InitiativeConceptTemplates.
</instructions>
", subagent_type="fuska-roadmapper", description="Create roadmap with MegaMemory")
```

**Handle roadmapper return:**

**If `## ROADMAP BLOCKED`:** Present blocker, resolve, re-spawn.

**If `## ROADMAP CREATED`:**

Load the generated roadmap by calling `megamemory:understand` with `query="chapter"` and `top_k=20`. Filter for `kind="feature"` with `parent_id` ending in `/roadmap`. Sort by number and present.

**CRITICAL: Ask for approval:**

Use question tool as before.

**If "Approve":** Chapter concepts already created. Continue.

**If "Adjust chapters":** Re-spawn roadmapper with revision context.

## Chapter 6: Done

Present completion with next steps:

```
-----------------------------------------------------
  Fuska: Initiative configured
-----------------------------------------------------

**[Project Name]**

| Concept Type | Count |
|-------------|--------|
| Requirements | [X] |
| Chapters      | [N] |
| Research     | [4 or 0] |

All v1 requirements mapped to chapters [OK]

───────────────────────────────────────────────────────

## > Next Up

**Chapter 1: [Chapter Name]** — [Goal]

/fuska-design 1 — gather context and clarify approach

*/new first → fresh context window*

───────────────────────────────────────────────────────
```

</process>

<output>

All concepts updated/created in MegaMemory knowledge graph:
- `initiative-root` (updated with what_this_is, core_value)
- `config` (updated with workflow preferences)
- `research/*` (created if research selected)
- `requirements/*` (created)
- `roadmap` (module exists)
- `chapter-N` (created)
- `state` (updated)

</output>

<success_criteria>

- [ ] Current initiative loaded from config
- [ ] Flags parsed from $ARGUMENTS into PARSED_ARGS
- [ ] Positional description extracted as PROVIDED_DESCRIPTION (if any)
- [ ] Description detection completed (HAS_DESCRIPTION set correctly from PROVIDED_DESCRIPTION or stored initiative)
- [ ] SKIP_QUESTIONING and SKIP_WORKFLOW_QUESTIONS set correctly
- [ ] Deep questioning completed (or skipped if description/args provided)
- [ ] Initiative root updated with what_this_is and core_value
- [ ] Workflow preferences collected (from args or interactive questions)
- [ ] Config concept created/updated with workflow preferences
- [ ] Research completed (if selected)
- [ ] Requirements gathered and scoped
- [ ] fuska-roadmapper spawned
- [ ] Chapter concepts created
- [ ] State concept updated
- [ ] User knows next step is `/fuska-design 1`

</success_criteria>
