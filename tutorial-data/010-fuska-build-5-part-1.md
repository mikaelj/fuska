# Fuska Chapter 5 Plan: MegaMemory-Driven Roadmap

**Session ID:** ses_3514bb60affe3eMyE7Y79o5y0H
**Created:** 3/2/2026, 2:19:36 PM
**Updated:** 3/2/2026, 4:51:29 PM

---

## User

<objective>

Create executable chapter concepts (plan concepts) for a roadmap chapter with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate chapter, research domain (unless skipped), spawn fuska-planner agent, verify plans with fuska-plan-checker, iterate until plans pass or max iterations, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees flow between agents.

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/model-validation.md
@../../fuska/references/megamemory-quick-ref.md
@../../fuska/config/workflow-modes.md
@../../fuska/templates/plan-prompts.md
@../../fuska/templates/review-loop.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Chapter number: `5` (optional - auto-detects next unplanned chapter)

**Flags:**
- `--research` — Force re-research even if research concept exists
- `--skip-research` — Skip research entirely
- `--fixes` — Fix planning mode (uses verification concept, skips research)
- `--skip-verify` — Skip planner → checker verification loop
- `--no-review` — Skip interactive review loop

Normalize chapter input in step 2 before any MegaMemory lookups.

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Validate Environment and Resolve Model Profile

**Step 1.1: Check MegaMemory availability**

Call `megamemory_list_roots()`. If empty: Display "No initiatives found" → Stop.

**Step 1.2: Query and parse config**

```
megamemory_understand(query="config", top_k=5)
configData = JSON.parse(response.matches[0].summary)
```

If no config found: Display "Config not found" → Suggest "Run fuska init" → Stop.

**Step 1.3: Resolve models**

Use model-validation.md patterns. Extract `model_profile` (default: "balanced") and `model_aliases`.

Model lookup table:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-chapter-researcher | quality_model | balanced_model | budget_model |
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |

```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}

const modelLookup = {
  quality: { researcher: aliases.quality_model, planner: aliases.quality_model, checker: aliases.balanced_model },
  balanced: { researcher: aliases.balanced_model, planner: aliases.quality_model, checker: aliases.balanced_model },
  budget: { researcher: aliases.budget_model, planner: aliases.balanced_model, checker: aliases.budget_model }
}
const models = modelLookup[modelProfile]
```

**Step 1.4: Validate against OpenCode config**

Follow model-validation.md to validate model strings against `~/.config/opencode/opencode.jsonc`.

**Step 1.5: Extract checker panel config**

```
checkerPanel = configData.checker_panel || { base: 'quality-advocate', contextual: null, expert: 'dynamic' }
projectClassification = configData.project_classification || { type: 'generic', confidence: 'low', signals: [] }
```

---

## 2. Parse and Normalize Arguments

**Step 2.1: Extract flags and chapter number**

```
hasResearchFlag = input.includes("--research")
hasSkipResearchFlag = input.includes("--skip-research")
hasFixesFlag = input.includes("--fixes")
hasSkipVerifyFlag = input.includes("--skip-verify")
hasNoReviewFlag = input.includes("--no-review")
modeOverride = input.match(/--mode\s+(\S+)/)?.[1]
chapterNumber = input.match(/\d+/) ? parseInt(match[0]) : null
```

**Step 2.2: Auto-detect chapter if not provided**

Query roadmap, find first incomplete chapter. If none found: Display error → Stop.

**Step 2.3: Normalize to slug**

```
chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
```

**Step 2.4-2.5: Check existing research and plans**

Query `${chapterSlug}-research` and `${chapterSlug}-plan` concepts. Store `researchExists` and `existingPlansCount`.

---

## 3. Validate Chapter

Query `chapter ${chapterNumber}` concept. If not found: Display error → Stop.

Extract: `chapterName`, `chapterGoal`, `chapterStatus`, `chapterId` from parsed summary.

---

## 4. Handle Research

**Step 4.1-4.2: Skip if --fixes or --skip-research**

**Step 4.3: Resolve workflow mode**

Using workflow-modes.md:
```
mode = modeOverride || configData.workflow?.mode || "standard"
{ shouldResearch, shouldPlanCheck } = resolve from mode flags table
```

Flags augment (never reduce) mode defaults:
```
shouldResearch = modeConfig.research || hasResearchFlag
shouldPlanCheck = modeConfig.planCheck && !hasSkipVerifyFlag
```

**Step 4.4: Skip if research disabled by mode**

**Step 4.5: Use existing if available**

If researchExists AND !hasResearchFlag: Display "Using existing research" → Skip to step 5

**Step 4.6-4.8: Spawn researcher**

Display banner:
```
----------------------------------------------------
 Fuska: RESEARCHING CHAPTER ${chapterNumber}
----------------------------------------------------
```

Gather context (chapter, requirements, context, state) then build researcher prompt:

```
const researchPrompt = `<critical_constraints>
Return: ## RESEARCH COMPLETE or ## RESEARCH BLOCKED
Create/update research concept: ${chapterSlug}-research
</critical_constraints>

<objective>
Research how to implement Chapter ${chapterNumber}: ${chapterName}
Answer: "What do I need to know to PLAN this chapter well?"
</objective>

<context>
**Chapter:** ${chapterName} — ${chapterGoal}
**Requirements:** ${requirements list or 'None'}
**Chapter context:** ${contextData or 'None'}
**Prior state:** ${stateData or 'None'}
</context>

<output>
Use: ChapterConceptTemplates.createResearch()
</output>`

Task(
  subagent_type="fuska-chapter-researcher",
  model=researcherModel,
  variant="plan",
  description=`Research Chapter ${chapterNumber}`,
  prompt=researchPrompt
)
```

Handle return:
- `## RESEARCH COMPLETE` → Continue to step 5
- `## RESEARCH BLOCKED` → Offer options (Provide context, Skip research, Abort)

---

## 5. Check Existing Plans

If existingPlansCount > 0: Question user (Continue planning, View existing, Replan from scratch)

---

## 6. Load All Context

Query in sequence, cache results — NO re-querying in later steps:

1. State → `stateData`
2. Roadmap → `roadmapData`
3. Requirements → `requirements`
4. Chapter context → `contextData`, `hasContext`
5. Research → `researchData`, `hasResearch`
6. Verification (if --fixes) → `verificationData`
7. Import graph freshness check (if refresh config enables it):
   - Check `configData.refresh` for hybrid mode with `auto_before` including `plan-chapter`
   - Compare `git rev-parse HEAD` against `last_sha` and age against `age_hours`
   - If stale: spawn fuska-refresh, then re-query config
8. Import graph context:
   - Query `symbol ${chapterKeywords}` and `file ${chapterKeywords}` (top_k=50)
   - Filter out `dead-code:` concepts
   - Format as `importGraphFiles` and `importGraphSymbols`
   - Set `importGraphAvailable = files.length > 0 || symbols.length > 0`

---

## 7. Spawn fuska-planner Agent

Display banner:
```
-----------------------------------------------------
 Fuska: PLANNING CHAPTER {X}
-----------------------------------------------------
```

Build prompt using **plan-prompts.md Planner Prompt Template**. Fill placeholders with cached data from step 6. Inline the actual JSON summaries for stateData, roadmapData, requirements, contextData, researchData, verificationData, and import graph context.

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

- `## PLANNING COMPLETE` → If --skip-verify or !shouldPlanCheck: Step 13, else: Step 9
- `## CHECKPOINT REACHED` → Present to user, spawn continuation (step 12)
- `## PLANNING INCONCLUSIVE` → Offer options (Add context, Retry, Manual)

---

## 9. Query Plans for Verification

Query all `${chapterSlug}-plan` concepts (top_k=20). If none found: Display error → Stop.

Extract plan data: `id`, `name`, `batch`, `dependsOn`, `filesModified`, `autonomous`, `objective`, `tasks`, `mustHaves`.

Also query requirements (top_k=50) for checker context.

---

## 10. Spawn fuska-plan-checker-panel Agent

Display banner:
```
-----------------------------------------------------
 Fuska: VERIFYING PLANS
-----------------------------------------------------
```

Build prompt using **plan-prompts.md Checker Panel Prompt Template**. Fill with plan data from step 9, chapter data from step 3, and checker panel config from step 1.

```
Task(
  subagent_type="fuska-plan-checker-panel",
  model=models.checker,
  variant="validate",
  description="Verify Chapter ${chapterNumber} plans"
)
```

---

## 11. Handle Checker Return

- `## VERIFICATION PASSED` → Step 13
- `## ISSUES FOUND` → List issues → Step 12

---

## 12. Revision Loop (Max 3 Iterations)

Track `iteration_count` (starts at 1).

**If iteration_count < 3:**

Display: `Sending back for revision... (iteration N/3)`

Query current `${chapterSlug}-plan` concepts (top_k=20). Build revision prompt using **plan-prompts.md Revision Prompt Template**. Fill with current plan summaries and checker issues.

```
Task(
  prompt=revision_prompt,
  subagent_type="fuska-planner",
  model=models.planner,
  variant="plan",
  description="Revise Chapter {chapter} plans"
)
```

After planner returns → spawn checker again (step 10). Increment iteration_count.

**If iteration_count >= 3:**

Display remaining issues. Offer: Force proceed, Provide guidance, Abandon.

---

## 13. Interactive Review Loop

**Step 13.1: Check skip flag**

```
skipReview = hasNoReviewFlag || configData?.workflow?.interactive_review === false
if (skipReview) → Step 14
```

**Step 13.2-13.3: Display plans and review loop**

Follow **review-loop.md** for:
- Query and sort plan concepts by plan number
- Display each plan with full details (batch, depends_on, autonomous, purpose, output, must haves, files, tasks)
- Review options: Looks good proceed, Ask a question, Modify a task, Add a task, Remove a task
- For modifications: Select plan → Select task → Get feedback → Spawn planner revision via Task
- Re-query and re-display after each change
- Loop until user selects "Looks good, proceed"

---

## 14. Update State Concept

Query state concept. Update with:
```
{
  ...stateData,
  current_chapter: chapterSlug,
  status: "ready_to_execute"
}
```

Note: `changes` parameter only accepts: `summary`, `name`, `kind`, `why`, `file_refs`.

---

## 15. Present Final Status

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

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

- [ ] MegaMemory validated
- [ ] Chapter validated
- [ ] Research completed (unless skipped/exists)
- [ ] fuska-planner spawned with context
- [ ] Plan concepts created
- [ ] fuska-plan-checker spawned (unless --skip-verify)
- [ ] Verification passed OR user override
- [ ] Interactive review loop (unless --no-review)
- [ ] State concept updated
- [ ] User knows next steps

</success_criteria>

---

## Assistant (Fuska-Planner · glm-5 · 10.9s)

I'll help you plan Chapter 5. Let me start by validating the environment and loading the necessary context.

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "config",
  "top_k": 5
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "config",
      "name": "config",
      "kind": "config",
      "summary": "{\"current_initiative\":\"main\",\"mode\":\"interactive\",\"depth\":\"quick\",\"parallelization\":false,\"workflow\":{\"research\":true,\"plan_check\":true,\"verifier\":true},\"git\":{\"commit_strategy\":\"per-chapter\"}}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [],
      "incoming_edges": [],
      "parent": null,
      "similarity": 0.33184836926718053
    },
    {
      "id": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-01-summary",
      "name": "chapter-01-plan-01-summary",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-01\",\n  \"plan\": \"chapter-01-plan-01\",\n  \"subsystem\": \"ui-foundation\",\n  \"tags\": [\"vite\", \"vanilla-js\", \"semantic-html\", \"accessibility\", \"skip-link\"],\n  \"requires\": [],\n  \"provides\": [\"Vite build setup\", \"Semantic HTML structure\", \"Accessibility features\"],\n  \"affects\": [\"index.html\", \"src/main.js\", \"src/style.css\", \"package.json\", \"vite.config.js\"],\n  \"tech_stack\": {\n    \"added\": [\n      {\"name\": \"Vite\", \"version\": \"^6.2.0\", \"purpose\": \"Build tool and dev server\"}\n    ],\n    \"patterns\": [\"ES modules\", \"Semantic HTML5\", \"ARIA attributes\"]\n  },\n  \"key_files\": {\n    \"created\": [\"package.json\", \"vite.config.js\", \"src/main.js\", \"src/style.css\", \".gitignore\"],\n    \"modified\": [\"index.html\"]\n  },\n  \"key_decisions\": [],\n  \"accomplishments\": [\n    \"Initialized Vite project with vanilla JS template in existing directory\",\n    \"Created semantic HTML structure with main, form, ul, li elements\",\n    \"Added skip link for keyboard accessibility\",\n    \"Created empty state section with SVG icon placeholder (64x64px)\",\n    \"Added visually hidden label for screen reader accessibility\",\n    \"Form includes input with autocomplete='off' and required attribute\",\n    \"Dev server successfully starts at localhost:5173\"\n  ],\n  \"task_commits\": [],\n  \"files_modified\": [\"index.html\", \"package.json\", \"vite.config.js\", \"src/main.js\", \"src/style.css\", \".gitignore\"],\n  \"decisions_made\": {},\n  \"deviations\": [],\n  \"issues_encountered\": [\n    \"Vite create command cancelled due to existing files - manually created project structure instead\"\n  ],\n  \"next_chapter_readiness\": \"ready\",\n  \"self_check\": \"PASSED\"\n}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-01",
          "to_name": "chapter-01-plan-01",
          "relation": "implements",
          "description": "Summary implements plan execution"
        },
        {
          "to": "main/roadmap/chapter-1-ui-foundation",
          "to_name": "chapter-1-ui-foundation",
          "relation": "connects_to",
          "description": "Plan summary for chapter"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.23595888714349647
    },
    {
      "id": "main/roadmap/chapter-1-ui-foundation/css-styling-system",
      "name": "css-styling-system",
      "kind": "component",
      "summary": "Complete CSS styling system with custom properties for the todo app. Includes: \n- Design tokens in :root (colors: #f4f6f8 background, #ffffff cards, #3b82f6 accent; typography: system-ui stack, 16px base; spacing: 8px unit system 4/8/16/20/30px; layout: 600px max-width, 8/12px border radius; shadows: 0 4px 20px rgba(0,0,0,0.1); focus: 2px ring with 2px offset; accessibility: 44px touch targets, 64px empty icon)\n- Base styles with universal box-sizing, zero-margin body, responsive container padding (20px mobile, 30px 480px+)\n- Form styling with flexbox layout, card appearance with shadow, input with border, accent button with hover/active states\n- Empty state with centered flex layout, 64px icon, responsive message font size with clamp()\n- Accessibility: skip link (hidden until focus), visually hidden class, :focus-visible for keyboard navigation\n- Mobile-first responsive breakpoints at 480px for container padding, button sizing, and typography scaling",
      "why": "Establishes visual design system implementing all user-locked design decisions with theming support and mobile-first responsive behavior",
      "file_refs": [
        "src/style.css"
      ],
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation/semantic-html-structure",
          "to_name": "semantic-html-structure",
          "relation": "implements",
          "description": "Styles the semantic HTML elements from plan-01"
        },
        {
          "to": "main/roadmap/chapter-1-ui-foundation/chapter-01-research",
          "to_name": "chapter-01-research",
          "relation": "implements",
          "description": "Implements CSS patterns from research"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.23195120352900495
    },
    {
      "id": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-02-summary",
      "name": "chapter-01-plan-02-summary",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-01\",\n  \"plan\": \"chapter-01-plan-02\",\n  \"subsystem\": \"ui-foundation\",\n  \"tags\": [\"css\", \"custom-properties\", \"responsive-design\", \"accessibility\", \"mobile-first\"],\n  \"requires\": [],\n  \"provides\": [\"CSS custom properties system\", \"Responsive styling\", \"Keyboard accessibility styles\", \"Empty state styling\"],\n  \"affects\": [\"src/style.css\"],\n  \"tech_stack\": {\n    \"added\": [],\n    \"patterns\": [\"CSS Custom Properties\", \"Mobile-first media queries\", \":focus-visible for keyboard navigation\", \"Fluid typography with clamp()\"]\n  },\n  \"key_files\": {\n    \"created\": [],\n    \"modified\": [\"src/style.css\"]\n  },\n  \"key_decisions\": [],\n  \"accomplishments\": [\n    \"Created complete CSS custom properties system in :root with all user-locked values\",\n    \"Defined color tokens: #f4f6f8 background, #ffffff cards, #3b82f6 accent with hover state\",\n    \"Established typography system: system-ui stack, 16px base, modular scale for sm/lg/xl\",\n    \"Implemented 8px spacing unit system with 5 levels (4/8/16/20/30px)\",\n    \"Added layout properties: 600px max-width, 8px/12px border radius, card shadow\",\n    \"Defined accessibility tokens: 44px touch targets, 64px empty icon, 2px focus ring\",\n    \"Created base styles with universal box-sizing, body reset, responsive container\",\n    \"Styled todo form with flexbox, card appearance, shadow, and responsive padding\",\n    \"Styled input with border, touch-target sizing, and inherited typography\",\n    \"Styled button with accent color, hover/active states, and responsive sizing\",\n    \"Implemented empty state with centered layout, 64px icon, and responsive typography\",\n    \"Added skip link that becomes visible on focus for keyboard navigation\",\n    \"Created visually hidden class for screen reader content\",\n    \"Implemented :focus-visible for keyboard accessibility with 2px blue outline\",\n    \"Added button states for hover, active, and disabled\",\n    \"Created mobile-first responsive breakpoints at 480px for padding and typography\"\n  ],\n  \"task_commits\": [],\n  \"files_modified\": [\"src/style.css\"],\n  \"decisions_made\": {},\n  \"deviations\": [],\n  \"issues_encountered\": [],\n  \"next_chapter_readiness\": \"ready\",\n  \"self_check\": \"PASSED - CSS file exists (239 lines), 28 custom properties defined, all accessibility styles present\"\n}",
      "why": "Summary of CSS styling implementation with custom properties, responsive design, and accessibility features",
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-02",
          "to_name": "chapter-01-plan-02",
          "relation": "implements",
          "description": null
        },
        {
          "to": "main/roadmap/chapter-1-ui-foundation",
          "to_name": "chapter-1-ui-foundation",
          "relation": "connects_to",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.22891306781532678
    },
    {
      "id": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-01",
      "name": "chapter-01-plan-01",
      "kind": "feature",
      "summary": "{\n  \"objective\": \"Set up Vite project with vanilla JS template and create semantic HTML structure with accessibility features (skip link, form, empty state)\",\n  \"purpose\": \"Establish clean project structure and accessible HTML foundation for todo app\",\n  \"output\": \"Working Vite dev server with semantic HTML structure ready for styling\",\n  \"chapter\": \"chapter-01\",\n  \"plan_number\": 1,\n  \"batch\": 1,\n  \"depends_on\": [],\n  \"autonomous\": true,\n  \"files_modified\": [\"package.json\", \"vite.config.js\", \"index.html\", \"src/main.js\", \"src/style.css\"],\n  \"requirements\": {\n    \"truths\": [\n      \"User can run the application and see it loads successfully\",\n      \"User sees proper HTML structure with form and input field\",\n      \"User sees empty state message when app loads\",\n      \"Screen reader users can skip to main content\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"index.html\",\n        \"provides\": \"Semantic HTML structure with accessibility features\",\n        \"action\": \"create\"\n      },\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"JavaScript entry point\",\n        \"action\": \"create\"\n      },\n      {\n        \"path\": \"src/style.css\",\n        \"provides\": \"CSS file (empty initially)\",\n        \"action\": \"create\"\n      },\n      {\n        \"path\": \"package.json\",\n        \"provides\": \"Project configuration and dependencies\",\n        \"action\": \"create\"\n      },\n      {\n        \"path\": \"vite.config.js\",\n        \"provides\": \"Vite build configuration\",\n        \"action\": \"create\"\n      }\n    ],\n    \"key_links\": []\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Initialize Vite project with vanilla template\",\n      \"type\": \"auto\",\n      \"files\": [\"package.json\", \"vite.config.js\", \"src/main.js\", \"src/style.css\", \"index.html\"],\n      \"action\": \"Initialize Vite project in current directory with vanilla JS template using 'npm create vite@latest . -- --template vanilla'. Accept all defaults. This creates: package.json, vite.config.js, src/main.js, src/style.css, index.html, and .gitignore. Verify installation with 'npm install'. DO NOT use alternative build tools (Webpack, Parcel) - Vite is locked per user decision.\",\n      \"verify\": \"Run 'npm run dev' and verify dev server starts without errors at localhost:5173\",\n      \"done\": \"Dev server runs successfully and shows default Vite page\"\n    },\n    {\n      \"name\": \"Create semantic HTML structure with accessibility features\",\n      \"type\": \"auto\",\n      \"files\": [\"index.html\"],\n      \"action\": \"Replace index.html content with semantic HTML structure implementing user-locked design decisions:\\n\\n- DOCTYPE, html lang='en', meta charset/viewport, title 'Todo App'\\n- Skip link: <a href='#main-content' class='skip-link'>Skip to main content</a> (for keyboard users)\\n- Main container: <main id='main-content' class='container'>\\n- Header: <h1>Todo App</h1>\\n- Form: <form id='todo-form' class='todo-form'> with:\\n  * Visually hidden label for accessibility\\n  * Text input id='todo-input', placeholder='Add a new task...', autocomplete='off'\\n  * Submit button with text 'Add'\\n- Section: aria-label='Tasks' containing:\\n  * Empty state: <li class='empty-state'> with SVG icon placeholder (64x64px) and message 'No tasks yet. Add your first task to get started!'\\n\\nUse semantic elements (main, form, button, ul, li). DO NOT use divs for interactive elements. Include ARIA attributes where semantic HTML isn't sufficient.\",\n      \"verify\": \"Open index.html in browser, verify structure: skip link, form with input/button, empty state section all present\",\n      \"done\": \"HTML structure complete with all semantic elements and accessibility features in place\"\n    }\n  ]\n}",
      "why": "Foundation plan establishes project structure and semantic HTML - required before any styling or interactivity can be added",
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation",
          "to_name": "chapter-1-ui-foundation",
          "relation": "implements",
          "description": null
        }
      ],
      "incoming_edges": [
        {
          "from": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-02",
          "from_name": "chapter-01-plan-02",
          "relation": "depends_on",
          "description": "CSS styles HTML elements created in plan-01"
        },
        {
          "from": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-03",
          "from_name": "chapter-01-plan-03",
          "relation": "depends_on",
          "description": "JavaScript references HTML elements created in plan-01"
        },
        {
          "from": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-01-summary",
          "from_name": "chapter-01-plan-01-summary",
          "relation": "implements",
          "description": "Summary implements plan execution"
        }
      ],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.2054726666021662
    }
  ]
}
```

**Tool: megamemory_list_roots**

**Input:**
```json
{}
```

**Output:**
```
{
  "roots": [
    {
      "id": "config",
      "name": "config",
      "kind": "config",
      "summary": "{\"current_initiative\":\"main\",\"mode\":\"interactive\",\"depth\":\"quick\",\"parallelization\":false,\"workflow\":{\"research\":true,\"plan_check\":true,\"verifier\":true},\"git\":{\"commit_strategy\":\"per-chapter\"}}",
      "children": []
    },
    {
      "id": "decision-filter-persistence",
      "name": "decision-filter-persistence",
      "kind": "decision",
      "summary": "{\n  \"id\": \"filter-persistence\",\n  \"title\": \"Filter Preference Persistence\",\n  \"context\": \"Deciding whether to persist the user's filter preference (All/Active/Completed) across page refreshes\",\n  \"decision\": \"Persist filter preference to localStorage\",\n  \"alternatives\": [\n    {\n      \"option\": \"Don't persist - always show 'All' on load\",\n      \"considered\": true,\n      \"reason\": \"Simpler, no additional storage needed. User always sees full list on refresh.\"\n    },\n    {\n      \"option\": \"Persist to localStorage\",\n      \"considered\": true,\n      \"reason\": \"Better UX - user returns to their preferred view. Easy to implement with existing localStorage pattern. Listed as optional enhancement in chapter scope.\"\n    }\n  ],\n  \"consequences\": {\n    \"positive\": [\n      \"Improved user experience\",\n      \"Consistent with persistence pattern from Chapter 3\",\n      \"Easy to implement (localStorage.getItem/setItem)\",\n      \"Low storage cost (single string value)\"\n    ],\n    \"negative\": [\n      \"Slight increase in code complexity\",\n      \"One more localStorage key to manage\"\n    ],\n    \"risks\": [\n      \"If localStorage is disabled, falls back to 'all' gracefully\"\n    ]\n  },\n  \"status\": \"proposed\",\n  \"created_at\": \"2026-03-02T00:00:00.000Z\",\n  \"decided_at\": null,\n  \"superseded_by\": null,\n  \"related_chapters\": [\"chapter-4-filtering-management\"]\n}",
      "children": []
    },
    {
      "id": "decision-filter-ui-pattern",
      "name": "decision-filter-ui-pattern",
      "kind": "decision",
      "summary": "{\n  \"id\": \"filter-ui-pattern\",\n  \"title\": \"Filter UI Pattern Selection\",\n  \"context\": \"Choosing between full ARIA tabs pattern and button group with aria-pressed for filter controls (All/Active/Completed)\",\n  \"decision\": \"Use button group with aria-pressed states\",\n  \"alternatives\": [\n    {\n      \"option\": \"Full ARIA tabs pattern\",\n      \"considered\": true,\n      \"reason\": \"More semantic structure with tablist, tab, tabpanel roles. Better for screen reader users with arrow key navigation.\"\n    },\n    {\n      \"option\": \"Button group with aria-pressed\",\n      \"considered\": true,\n      \"reason\": \"Simpler implementation. Sufficient for 3-option filter. Less complex keyboard navigation. Recommended by research.\"\n    }\n  ],\n  \"consequences\": {\n    \"positive\": [\n      \"Simpler implementation and maintenance\",\n      \"Fewer ARIA roles to manage\",\n      \"Sufficient for small number of options (3)\",\n      \"Faster development\"\n    ],\n    \"negative\": [\n      \"Slightly less semantic than full tabs pattern\",\n      \"Screen reader users may prefer tabs pattern for complex interfaces\"\n    ],\n    \"risks\": [\n      \"May need to upgrade to tabs pattern if user testing reveals accessibility issues\"\n    ]\n  },\n  \"status\": \"proposed\",\n  \"created_at\": \"2026-03-02T00:00:00.000Z\",\n  \"decided_at\": null,\n  \"superseded_by\": null,\n  \"related_chapters\": [\"chapter-4-filtering-management\"]\n}",
      "children": []
    },
    {
      "id": "main",
      "name": "main",
      "kind": "feature",
      "summary": "Initiative: Main\n\nA single-page vanilla JS todo app with local storage persistence, add/complete/delete tasks, and a clean modern UI",
      "children": [
        "state",
        "roadmap",
        "milestones",
        "todos",
        "research",
        "main-stack-research",
        "main-architecture-research",
        "main-features-research",
        "main-pitfalls-research",
        "requirements"
      ]
    }
  ],
  "stats": {
    "nodes": 66,
    "edges": 65,
    "removed": 0
  }
}
```

---

## Assistant (Fuska-Planner · glm-5 · 18.1s)

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "roadmap chapter-05",
  "top_k": 5
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/research",
      "name": "research",
      "kind": "module",
      "summary": "Initiative research documents",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.3639144822203597
    },
    {
      "id": "main/roadmap",
      "name": "roadmap",
      "kind": "module",
      "summary": "# Roadmap: Vanilla JS Todo App\n\n## Overview\nA focused 5-chapter roadmap delivering a complete vanilla JS todo application with local storage persistence. Chapters are structured to deliver observable user value incrementally, from initial UI foundation through full feature completion.\n\n**Total Chapters:** 5\n**Depth:** Quick (3-5 chapters)\n**Coverage:** 13/13 requirements (100%)\n\n## Chapter Structure\n\n| Chapter | Goal | Requirements | Success Criteria |\n|---------|------|--------------|------------------|\n| 1 - UI Foundation | Users see a clean, responsive, accessible todo interface | UI-01, UI-05, UI-06 | 3 criteria |\n| 2 - Core Task Operations | Users can manage individual tasks with clear visual feedback | CORE-01, CORE-02, CORE-03, CORE-04 | 4 criteria |\n| 3 - Data Persistence | Users never lose their todos across browser sessions | STORAGE-01, STORAGE-02 | 3 criteria |\n| 4 - Filtering & Management | Users can organize and manage tasks efficiently | UI-02, UI-03, UI-04 | 3 criteria |\n| 5 - Due Dates | Users can track task deadlines and overdue items | ENHANCE-01 | 3 criteria |\n\n## Progress Tracking\n\n| Chapter | Status | Progress | Plans | Last Updated |\n|---------|--------|----------|-------|--------------|\n| Chapter 1 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 2 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 3 | Planned | 0% | 2 plans (2 batches) | 2026-03-02 |\n| Chapter 4 | Planned | 0% | 2 plans (1 batch) | 2026-03-02 |\n| Chapter 5 | Not Started | 0% | - | - |\n\n**Overall Progress:** 40% (2/5 chapters complete)\n\n## Chapter 1 Plans\n\n**Plan 01:** Project Setup & HTML Structure (Batch 1) ✓\n- Objective: Set up Vite project and create semantic HTML with accessibility features\n- Tasks: 2 tasks (Initialize Vite, Create HTML structure)\n- Files: package.json, vite.config.js, index.html, src/main.js, src/style.css\n\n**Plan 02:** CSS Styling & Responsive Design (Batch 1) ✓\n- Objective: Create CSS with custom properties and mobile-first responsive layout\n- Tasks: 3 tasks (Define custom properties, Add base styles, Add empty state styles)\n- Files: src/style.css\n\n**Plan 03:** Keyboard Interactivity (Batch 2) ✓\n- Objective: Add keyboard event handlers and SVG icon for empty state\n- Tasks: 2 tasks (Add keyboard handlers, Add inline SVG icon)\n- Files: index.html, src/main.js\n- Depends on: Plan 01, Plan 02\n\n## Chapter 2 Plans\n\n**Plan 01:** State Management & Add Operation (Batch 1) ✓\n- Objective: Implement state management and add todo functionality with validation\n- Tasks: 2 tasks (Implement state/add, Add task styling/highlight)\n- Files: src/main.js, src/style.css\n\n**Plan 02:** Toggle & Delete Operations (Batch 1) ✓\n- Objective: Implement toggle complete/incomplete and delete with confirmation\n- Tasks: 1 task (Implement toggle/delete with event delegation)\n- Files: src/main.js\n\n**Plan 03:** Inline Editing (Batch 2) ✓\n- Objective: Implement inline editing with double-click or edit button\n- Tasks: 2 tasks (Implement inline editing, Add edit mode styling)\n- Files: src/main.js, src/style.css\n- Depends on: Plan 01, Plan 02\n\n## Chapter 3 Plans\n\n**Plan 01:** StorageService & Integration (Batch 1)\n- Objective: Create StorageService abstraction layer and integrate localStorage persistence into main.js\n- Tasks: 3 tasks (Create StorageService, Integrate into main.js, Add error styling)\n- Files: src/storage.js, src/main.js, src/style.css\n\n**Plan 02:** Cross-Tab Sync & Testing (Batch 2)\n- Objective: Add cross-tab synchronization and verify all error handling scenarios work correctly\n- Tasks: 2 tasks (Add cross-tab sync, Verify error scenarios)\n- Files: src/main.js\n- Depends on: Plan 01\n\n## Chapter 4 Plans\n\n**Plan 01:** Filter Controls & Task Counts (Batch 1)\n- Objective: Implement filter controls (All/Active/Completed) with task counts and real-time display updates\n- Tasks: 3 tasks (Add filter state/logic, Add filter controls HTML, Add styling/event handlers)\n- Files: index.html, src/main.js, src/style.css\n\n**Plan 02:** Clear Completed & Empty States (Batch 1)\n- Objective: Implement clear completed functionality with bulk delete and filter-specific empty states\n- Tasks: 1 task (Implement clear completed handler and filter-specific empty states)\n- Files: src/main.js",
      "why": null,
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-1-ui-foundation",
          "name": "chapter-1-ui-foundation",
          "kind": "feature",
          "summary": "# Chapter 1: UI Foundation\n\n**Goal:** Users see a clean, responsive, accessible todo interface ready for task management\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- UI-01: Clean modern UI with semantic HTML, CSS custom properties, responsive design ✓\n- UI-05: Empty state message when no todos exist ✓\n- UI-06: Keyboard support: Enter to submit, Tab navigation, Escape to cancel ✓\n\n## Success Criteria\n1. User opens app and sees clean, modern interface with proper visual hierarchy ✓\n2. User can navigate all interactive elements using Tab key ✓\n3. User sees helpful empty state message when no todos exist ✓\n\n## Dependencies\nNone (foundation chapter)\n\n## Scope\n- HTML structure with semantic elements (form, input, button, ul) ✓\n- CSS with custom properties for theming ✓\n- Responsive layout (mobile-first) ✓\n- Keyboard event handlers setup ✓\n- Empty state rendering logic ✓\n- No business logic or state management yet"
        },
        {
          "id": "main/roadmap/chapter-2-core-operations",
          "name": "chapter-2-core-operations",
          "kind": "feature",
          "summary": "# Chapter 2: Core Task Operations\n\n**Goal:** Users can create, complete, edit, and delete individual tasks with clear visual feedback\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- CORE-01: Add new tasks with text input validation (non-empty, trimmed) ✓\n- CORE-02: Mark tasks as complete/incomplete with visual feedback (strikethrough/opacity) ✓\n- CORE-03: Delete tasks with confirmation ✓\n- CORE-04: Edit existing task text inline or via modal ✓\n\n## Success Criteria\n1. User can add a new task by typing text and pressing Enter or clicking Add button ✓\n2. User can click checkbox/toggle to mark task complete (strikethrough styling appears) ✓\n3. User can delete task with confirmation prompt ✓\n4. User can edit task text inline and save changes ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation must exist) ✓\n\n## Scope\n- State management (in-memory todo array) ✓\n- CRUD operations (add, toggle, delete, edit) ✓\n- Input validation (trim, non-empty check) ✓\n- Visual feedback for all operations ✓\n- Event handling and delegation ✓\n- Re-rendering UI from state ✓\n- No persistence yet (data lost on refresh) ✓"
        },
        {
          "id": "main/roadmap/chapter-3-persistence",
          "name": "chapter-3-persistence",
          "kind": "feature",
          "summary": "# Chapter 3: Data Persistence\n\n**Goal:** Users never lose their todos - data survives browser refresh, closing tab, and works across multiple tabs\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- STORAGE-01: Persist todos to localStorage with JSON serialization and error handling ✓\n- STORAGE-02: Load todos from localStorage on app initialization ✓\n\n## Success Criteria\n1. User can refresh page and see all their todos preserved ✓\n2. User sees graceful error message if localStorage is disabled or full ✓\n3. User can open app in multiple tabs and see synchronized data ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with state management) ✓\n\n## Scope\n- StorageService abstraction layer ✓\n- JSON serialization/deserialization ✓\n- Error handling (try/catch, QuotaExceededError, private browsing mode) ✓\n- Load from localStorage on app initialization ✓\n- Save to localStorage on every state change ✓\n- Cross-tab synchronization via storage event ✓\n- Graceful degradation messaging ✓"
        },
        {
          "id": "main/roadmap/chapter-4-filtering-management",
          "name": "chapter-4-filtering-management",
          "kind": "feature",
          "summary": "# Chapter 4: Filtering & Bulk Management\n\n**Goal:** Users can organize, filter, and manage large numbers of tasks efficiently\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n**Commit:** ce45d8a\n\n## Requirements\n- UI-02: Filter todos by status: all, active, completed with tab navigation ✓\n- UI-03: Display task counts (total, active, completed) ✓\n- UI-04: Bulk delete all completed tasks with one action ✓\n\n## Success Criteria\n1. User can switch between \"All\", \"Active\", and \"Completed\" views to filter tasks ✓\n2. User sees real-time counts of total, active, and completed tasks ✓\n3. User can clear all completed tasks with single button click ✓\n\n## Known Issues\n- Filter preference does not persist across page refreshes (minor enhancement)\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with completion state) ✓\n- Chapter 3 (Persistence for filtered views) ✓\n\n## Scope\n- Filter state management (current filter: all/active/completed) ✓\n- Filter logic (array filtering based on completion status) ✓\n- Task count calculations (total, active, completed) ✓\n- Clear completed functionality (filter and delete) ✓\n- Filter UI controls (tabs or buttons) ✓\n- Persist filter preference in localStorage (optional enhancement - not implemented)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates",
          "name": "chapter-5-due-dates",
          "kind": "feature",
          "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting"
        }
      ],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.34752386882311903
    },
    {
      "id": "main/requirements",
      "name": "requirements",
      "kind": "module",
      "summary": "Initiative requirements organized by category",
      "why": null,
      "file_refs": null,
      "children": [
        {
          "id": "main/requirements/req-core-01",
          "name": "req-CORE-01",
          "kind": "feature",
          "summary": "{\"description\":\"Add new tasks with text input validation (non-empty, trimmed)\",\"status\":\"complete\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-core-02",
          "name": "req-CORE-02",
          "kind": "feature",
          "summary": "{\"description\":\"Mark tasks as complete/incomplete with visual feedback (strikethrough/opacity)\",\"status\":\"complete\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-core-03",
          "name": "req-CORE-03",
          "kind": "feature",
          "summary": "{\"description\":\"Delete tasks with confirmation\",\"status\":\"complete\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-core-04",
          "name": "req-CORE-04",
          "kind": "feature",
          "summary": "{\"description\":\"Edit existing task text inline or via modal\",\"status\":\"complete\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-storage-01",
          "name": "req-STORAGE-01",
          "kind": "feature",
          "summary": "{\"description\":\"Persist todos to localStorage with JSON serialization and error handling\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-storage-02",
          "name": "req-STORAGE-02",
          "kind": "feature",
          "summary": "{\"description\":\"Load todos from localStorage on app initialization\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-ui-01",
          "name": "req-UI-01",
          "kind": "feature",
          "summary": "{\"description\":\"Clean modern UI with semantic HTML, CSS custom properties, responsive design\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-ui-02",
          "name": "req-UI-02",
          "kind": "feature",
          "summary": "{\"description\":\"Filter todos by status: all, active, completed with tab navigation\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-ui-03",
          "name": "req-UI-03",
          "kind": "feature",
          "summary": "{\"description\":\"Display task counts (total, active, completed)\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-ui-04",
          "name": "req-UI-04",
          "kind": "feature",
          "summary": "{\"description\":\"Bulk delete all completed tasks with one action\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-enhance-01",
          "name": "req-ENHANCE-01",
          "kind": "feature",
          "summary": "{\"description\":\"Set due dates for tasks with date picker, display overdue indicators, sort by date\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-ui-05",
          "name": "req-UI-05",
          "kind": "feature",
          "summary": "{\"description\":\"Empty state message when no todos exist\",\"status\":\"in_progress\",\"hypothesis\":true}"
        },
        {
          "id": "main/requirements/req-ui-06",
          "name": "req-UI-06",
          "kind": "feature",
          "summary": "{\"description\":\"Keyboard support: Enter to submit, Tab navigation, Escape to cancel\",\"status\":\"in_progress\",\"hypothesis\":true}"
        }
      ],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "connects_to",
          "description": "Requirements module connects to the main initiative"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.3165932655532053
    },
    {
      "id": "main/milestones",
      "name": "milestones",
      "kind": "module",
      "summary": "Initiative milestones tracking",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.3021965952594935
    },
    {
      "id": "config",
      "name": "config",
      "kind": "config",
      "summary": "{\"current_initiative\":\"main\",\"mode\":\"interactive\",\"depth\":\"quick\",\"parallelization\":false,\"workflow\":{\"research\":true,\"plan_check\":true,\"verifier\":true},\"git\":{\"commit_strategy\":\"per-chapter\"}}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [],
      "incoming_edges": [],
      "parent": null,
      "similarity": 0.2834468040821872
    }
  ]
}
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-05-research",
  "top_k": 2
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/research",
      "name": "research",
      "kind": "module",
      "summary": "Initiative research documents",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.395746461674105
    },
    {
      "id": "main/roadmap",
      "name": "roadmap",
      "kind": "module",
      "summary": "# Roadmap: Vanilla JS Todo App\n\n## Overview\nA focused 5-chapter roadmap delivering a complete vanilla JS todo application with local storage persistence. Chapters are structured to deliver observable user value incrementally, from initial UI foundation through full feature completion.\n\n**Total Chapters:** 5\n**Depth:** Quick (3-5 chapters)\n**Coverage:** 13/13 requirements (100%)\n\n## Chapter Structure\n\n| Chapter | Goal | Requirements | Success Criteria |\n|---------|------|--------------|------------------|\n| 1 - UI Foundation | Users see a clean, responsive, accessible todo interface | UI-01, UI-05, UI-06 | 3 criteria |\n| 2 - Core Task Operations | Users can manage individual tasks with clear visual feedback | CORE-01, CORE-02, CORE-03, CORE-04 | 4 criteria |\n| 3 - Data Persistence | Users never lose their todos across browser sessions | STORAGE-01, STORAGE-02 | 3 criteria |\n| 4 - Filtering & Management | Users can organize and manage tasks efficiently | UI-02, UI-03, UI-04 | 3 criteria |\n| 5 - Due Dates | Users can track task deadlines and overdue items | ENHANCE-01 | 3 criteria |\n\n## Progress Tracking\n\n| Chapter | Status | Progress | Plans | Last Updated |\n|---------|--------|----------|-------|--------------|\n| Chapter 1 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 2 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 3 | Planned | 0% | 2 plans (2 batches) | 2026-03-02 |\n| Chapter 4 | Planned | 0% | 2 plans (1 batch) | 2026-03-02 |\n| Chapter 5 | Not Started | 0% | - | - |\n\n**Overall Progress:** 40% (2/5 chapters complete)\n\n## Chapter 1 Plans\n\n**Plan 01:** Project Setup & HTML Structure (Batch 1) ✓\n- Objective: Set up Vite project and create semantic HTML with accessibility features\n- Tasks: 2 tasks (Initialize Vite, Create HTML structure)\n- Files: package.json, vite.config.js, index.html, src/main.js, src/style.css\n\n**Plan 02:** CSS Styling & Responsive Design (Batch 1) ✓\n- Objective: Create CSS with custom properties and mobile-first responsive layout\n- Tasks: 3 tasks (Define custom properties, Add base styles, Add empty state styles)\n- Files: src/style.css\n\n**Plan 03:** Keyboard Interactivity (Batch 2) ✓\n- Objective: Add keyboard event handlers and SVG icon for empty state\n- Tasks: 2 tasks (Add keyboard handlers, Add inline SVG icon)\n- Files: index.html, src/main.js\n- Depends on: Plan 01, Plan 02\n\n## Chapter 2 Plans\n\n**Plan 01:** State Management & Add Operation (Batch 1) ✓\n- Objective: Implement state management and add todo functionality with validation\n- Tasks: 2 tasks (Implement state/add, Add task styling/highlight)\n- Files: src/main.js, src/style.css\n\n**Plan 02:** Toggle & Delete Operations (Batch 1) ✓\n- Objective: Implement toggle complete/incomplete and delete with confirmation\n- Tasks: 1 task (Implement toggle/delete with event delegation)\n- Files: src/main.js\n\n**Plan 03:** Inline Editing (Batch 2) ✓\n- Objective: Implement inline editing with double-click or edit button\n- Tasks: 2 tasks (Implement inline editing, Add edit mode styling)\n- Files: src/main.js, src/style.css\n- Depends on: Plan 01, Plan 02\n\n## Chapter 3 Plans\n\n**Plan 01:** StorageService & Integration (Batch 1)\n- Objective: Create StorageService abstraction layer and integrate localStorage persistence into main.js\n- Tasks: 3 tasks (Create StorageService, Integrate into main.js, Add error styling)\n- Files: src/storage.js, src/main.js, src/style.css\n\n**Plan 02:** Cross-Tab Sync & Testing (Batch 2)\n- Objective: Add cross-tab synchronization and verify all error handling scenarios work correctly\n- Tasks: 2 tasks (Add cross-tab sync, Verify error scenarios)\n- Files: src/main.js\n- Depends on: Plan 01\n\n## Chapter 4 Plans\n\n**Plan 01:** Filter Controls & Task Counts (Batch 1)\n- Objective: Implement filter controls (All/Active/Completed) with task counts and real-time display updates\n- Tasks: 3 tasks (Add filter state/logic, Add filter controls HTML, Add styling/event handlers)\n- Files: index.html, src/main.js, src/style.css\n\n**Plan 02:** Clear Completed & Empty States (Batch 1)\n- Objective: Implement clear completed functionality with bulk delete and filter-specific empty states\n- Tasks: 1 task (Implement clear completed handler and filter-specific empty states)\n- Files: src/main.js",
      "why": null,
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-1-ui-foundation",
          "name": "chapter-1-ui-foundation",
          "kind": "feature",
          "summary": "# Chapter 1: UI Foundation\n\n**Goal:** Users see a clean, responsive, accessible todo interface ready for task management\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- UI-01: Clean modern UI with semantic HTML, CSS custom properties, responsive design ✓\n- UI-05: Empty state message when no todos exist ✓\n- UI-06: Keyboard support: Enter to submit, Tab navigation, Escape to cancel ✓\n\n## Success Criteria\n1. User opens app and sees clean, modern interface with proper visual hierarchy ✓\n2. User can navigate all interactive elements using Tab key ✓\n3. User sees helpful empty state message when no todos exist ✓\n\n## Dependencies\nNone (foundation chapter)\n\n## Scope\n- HTML structure with semantic elements (form, input, button, ul) ✓\n- CSS with custom properties for theming ✓\n- Responsive layout (mobile-first) ✓\n- Keyboard event handlers setup ✓\n- Empty state rendering logic ✓\n- No business logic or state management yet"
        },
        {
          "id": "main/roadmap/chapter-2-core-operations",
          "name": "chapter-2-core-operations",
          "kind": "feature",
          "summary": "# Chapter 2: Core Task Operations\n\n**Goal:** Users can create, complete, edit, and delete individual tasks with clear visual feedback\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- CORE-01: Add new tasks with text input validation (non-empty, trimmed) ✓\n- CORE-02: Mark tasks as complete/incomplete with visual feedback (strikethrough/opacity) ✓\n- CORE-03: Delete tasks with confirmation ✓\n- CORE-04: Edit existing task text inline or via modal ✓\n\n## Success Criteria\n1. User can add a new task by typing text and pressing Enter or clicking Add button ✓\n2. User can click checkbox/toggle to mark task complete (strikethrough styling appears) ✓\n3. User can delete task with confirmation prompt ✓\n4. User can edit task text inline and save changes ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation must exist) ✓\n\n## Scope\n- State management (in-memory todo array) ✓\n- CRUD operations (add, toggle, delete, edit) ✓\n- Input validation (trim, non-empty check) ✓\n- Visual feedback for all operations ✓\n- Event handling and delegation ✓\n- Re-rendering UI from state ✓\n- No persistence yet (data lost on refresh) ✓"
        },
        {
          "id": "main/roadmap/chapter-3-persistence",
          "name": "chapter-3-persistence",
          "kind": "feature",
          "summary": "# Chapter 3: Data Persistence\n\n**Goal:** Users never lose their todos - data survives browser refresh, closing tab, and works across multiple tabs\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- STORAGE-01: Persist todos to localStorage with JSON serialization and error handling ✓\n- STORAGE-02: Load todos from localStorage on app initialization ✓\n\n## Success Criteria\n1. User can refresh page and see all their todos preserved ✓\n2. User sees graceful error message if localStorage is disabled or full ✓\n3. User can open app in multiple tabs and see synchronized data ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with state management) ✓\n\n## Scope\n- StorageService abstraction layer ✓\n- JSON serialization/deserialization ✓\n- Error handling (try/catch, QuotaExceededError, private browsing mode) ✓\n- Load from localStorage on app initialization ✓\n- Save to localStorage on every state change ✓\n- Cross-tab synchronization via storage event ✓\n- Graceful degradation messaging ✓"
        },
        {
          "id": "main/roadmap/chapter-4-filtering-management",
          "name": "chapter-4-filtering-management",
          "kind": "feature",
          "summary": "# Chapter 4: Filtering & Bulk Management\n\n**Goal:** Users can organize, filter, and manage large numbers of tasks efficiently\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n**Commit:** ce45d8a\n\n## Requirements\n- UI-02: Filter todos by status: all, active, completed with tab navigation ✓\n- UI-03: Display task counts (total, active, completed) ✓\n- UI-04: Bulk delete all completed tasks with one action ✓\n\n## Success Criteria\n1. User can switch between \"All\", \"Active\", and \"Completed\" views to filter tasks ✓\n2. User sees real-time counts of total, active, and completed tasks ✓\n3. User can clear all completed tasks with single button click ✓\n\n## Known Issues\n- Filter preference does not persist across page refreshes (minor enhancement)\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with completion state) ✓\n- Chapter 3 (Persistence for filtered views) ✓\n\n## Scope\n- Filter state management (current filter: all/active/completed) ✓\n- Filter logic (array filtering based on completion status) ✓\n- Task count calculations (total, active, completed) ✓\n- Clear completed functionality (filter and delete) ✓\n- Filter UI controls (tabs or buttons) ✓\n- Persist filter preference in localStorage (optional enhancement - not implemented)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates",
          "name": "chapter-5-due-dates",
          "kind": "feature",
          "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting"
        }
      ],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.26335320272472074
    }
  ]
}
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-05-plan",
  "top_k": 2
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "config",
      "name": "config",
      "kind": "config",
      "summary": "{\"current_initiative\":\"main\",\"mode\":\"interactive\",\"depth\":\"quick\",\"parallelization\":false,\"workflow\":{\"research\":true,\"plan_check\":true,\"verifier\":true},\"git\":{\"commit_strategy\":\"per-chapter\"}}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [],
      "incoming_edges": [],
      "parent": null,
      "similarity": 0.3812383159745889
    },
    {
      "id": "main/roadmap",
      "name": "roadmap",
      "kind": "module",
      "summary": "# Roadmap: Vanilla JS Todo App\n\n## Overview\nA focused 5-chapter roadmap delivering a complete vanilla JS todo application with local storage persistence. Chapters are structured to deliver observable user value incrementally, from initial UI foundation through full feature completion.\n\n**Total Chapters:** 5\n**Depth:** Quick (3-5 chapters)\n**Coverage:** 13/13 requirements (100%)\n\n## Chapter Structure\n\n| Chapter | Goal | Requirements | Success Criteria |\n|---------|------|--------------|------------------|\n| 1 - UI Foundation | Users see a clean, responsive, accessible todo interface | UI-01, UI-05, UI-06 | 3 criteria |\n| 2 - Core Task Operations | Users can manage individual tasks with clear visual feedback | CORE-01, CORE-02, CORE-03, CORE-04 | 4 criteria |\n| 3 - Data Persistence | Users never lose their todos across browser sessions | STORAGE-01, STORAGE-02 | 3 criteria |\n| 4 - Filtering & Management | Users can organize and manage tasks efficiently | UI-02, UI-03, UI-04 | 3 criteria |\n| 5 - Due Dates | Users can track task deadlines and overdue items | ENHANCE-01 | 3 criteria |\n\n## Progress Tracking\n\n| Chapter | Status | Progress | Plans | Last Updated |\n|---------|--------|----------|-------|--------------|\n| Chapter 1 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 2 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 3 | Planned | 0% | 2 plans (2 batches) | 2026-03-02 |\n| Chapter 4 | Planned | 0% | 2 plans (1 batch) | 2026-03-02 |\n| Chapter 5 | Not Started | 0% | - | - |\n\n**Overall Progress:** 40% (2/5 chapters complete)\n\n## Chapter 1 Plans\n\n**Plan 01:** Project Setup & HTML Structure (Batch 1) ✓\n- Objective: Set up Vite project and create semantic HTML with accessibility features\n- Tasks: 2 tasks (Initialize Vite, Create HTML structure)\n- Files: package.json, vite.config.js, index.html, src/main.js, src/style.css\n\n**Plan 02:** CSS Styling & Responsive Design (Batch 1) ✓\n- Objective: Create CSS with custom properties and mobile-first responsive layout\n- Tasks: 3 tasks (Define custom properties, Add base styles, Add empty state styles)\n- Files: src/style.css\n\n**Plan 03:** Keyboard Interactivity (Batch 2) ✓\n- Objective: Add keyboard event handlers and SVG icon for empty state\n- Tasks: 2 tasks (Add keyboard handlers, Add inline SVG icon)\n- Files: index.html, src/main.js\n- Depends on: Plan 01, Plan 02\n\n## Chapter 2 Plans\n\n**Plan 01:** State Management & Add Operation (Batch 1) ✓\n- Objective: Implement state management and add todo functionality with validation\n- Tasks: 2 tasks (Implement state/add, Add task styling/highlight)\n- Files: src/main.js, src/style.css\n\n**Plan 02:** Toggle & Delete Operations (Batch 1) ✓\n- Objective: Implement toggle complete/incomplete and delete with confirmation\n- Tasks: 1 task (Implement toggle/delete with event delegation)\n- Files: src/main.js\n\n**Plan 03:** Inline Editing (Batch 2) ✓\n- Objective: Implement inline editing with double-click or edit button\n- Tasks: 2 tasks (Implement inline editing, Add edit mode styling)\n- Files: src/main.js, src/style.css\n- Depends on: Plan 01, Plan 02\n\n## Chapter 3 Plans\n\n**Plan 01:** StorageService & Integration (Batch 1)\n- Objective: Create StorageService abstraction layer and integrate localStorage persistence into main.js\n- Tasks: 3 tasks (Create StorageService, Integrate into main.js, Add error styling)\n- Files: src/storage.js, src/main.js, src/style.css\n\n**Plan 02:** Cross-Tab Sync & Testing (Batch 2)\n- Objective: Add cross-tab synchronization and verify all error handling scenarios work correctly\n- Tasks: 2 tasks (Add cross-tab sync, Verify error scenarios)\n- Files: src/main.js\n- Depends on: Plan 01\n\n## Chapter 4 Plans\n\n**Plan 01:** Filter Controls & Task Counts (Batch 1)\n- Objective: Implement filter controls (All/Active/Completed) with task counts and real-time display updates\n- Tasks: 3 tasks (Add filter state/logic, Add filter controls HTML, Add styling/event handlers)\n- Files: index.html, src/main.js, src/style.css\n\n**Plan 02:** Clear Completed & Empty States (Batch 1)\n- Objective: Implement clear completed functionality with bulk delete and filter-specific empty states\n- Tasks: 1 task (Implement clear completed handler and filter-specific empty states)\n- Files: src/main.js",
      "why": null,
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-1-ui-foundation",
          "name": "chapter-1-ui-foundation",
          "kind": "feature",
          "summary": "# Chapter 1: UI Foundation\n\n**Goal:** Users see a clean, responsive, accessible todo interface ready for task management\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- UI-01: Clean modern UI with semantic HTML, CSS custom properties, responsive design ✓\n- UI-05: Empty state message when no todos exist ✓\n- UI-06: Keyboard support: Enter to submit, Tab navigation, Escape to cancel ✓\n\n## Success Criteria\n1. User opens app and sees clean, modern interface with proper visual hierarchy ✓\n2. User can navigate all interactive elements using Tab key ✓\n3. User sees helpful empty state message when no todos exist ✓\n\n## Dependencies\nNone (foundation chapter)\n\n## Scope\n- HTML structure with semantic elements (form, input, button, ul) ✓\n- CSS with custom properties for theming ✓\n- Responsive layout (mobile-first) ✓\n- Keyboard event handlers setup ✓\n- Empty state rendering logic ✓\n- No business logic or state management yet"
        },
        {
          "id": "main/roadmap/chapter-2-core-operations",
          "name": "chapter-2-core-operations",
          "kind": "feature",
          "summary": "# Chapter 2: Core Task Operations\n\n**Goal:** Users can create, complete, edit, and delete individual tasks with clear visual feedback\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- CORE-01: Add new tasks with text input validation (non-empty, trimmed) ✓\n- CORE-02: Mark tasks as complete/incomplete with visual feedback (strikethrough/opacity) ✓\n- CORE-03: Delete tasks with confirmation ✓\n- CORE-04: Edit existing task text inline or via modal ✓\n\n## Success Criteria\n1. User can add a new task by typing text and pressing Enter or clicking Add button ✓\n2. User can click checkbox/toggle to mark task complete (strikethrough styling appears) ✓\n3. User can delete task with confirmation prompt ✓\n4. User can edit task text inline and save changes ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation must exist) ✓\n\n## Scope\n- State management (in-memory todo array) ✓\n- CRUD operations (add, toggle, delete, edit) ✓\n- Input validation (trim, non-empty check) ✓\n- Visual feedback for all operations ✓\n- Event handling and delegation ✓\n- Re-rendering UI from state ✓\n- No persistence yet (data lost on refresh) ✓"
        },
        {
          "id": "main/roadmap/chapter-3-persistence",
          "name": "chapter-3-persistence",
          "kind": "feature",
          "summary": "# Chapter 3: Data Persistence\n\n**Goal:** Users never lose their todos - data survives browser refresh, closing tab, and works across multiple tabs\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- STORAGE-01: Persist todos to localStorage with JSON serialization and error handling ✓\n- STORAGE-02: Load todos from localStorage on app initialization ✓\n\n## Success Criteria\n1. User can refresh page and see all their todos preserved ✓\n2. User sees graceful error message if localStorage is disabled or full ✓\n3. User can open app in multiple tabs and see synchronized data ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with state management) ✓\n\n## Scope\n- StorageService abstraction layer ✓\n- JSON serialization/deserialization ✓\n- Error handling (try/catch, QuotaExceededError, private browsing mode) ✓\n- Load from localStorage on app initialization ✓\n- Save to localStorage on every state change ✓\n- Cross-tab synchronization via storage event ✓\n- Graceful degradation messaging ✓"
        },
        {
          "id": "main/roadmap/chapter-4-filtering-management",
          "name": "chapter-4-filtering-management",
          "kind": "feature",
          "summary": "# Chapter 4: Filtering & Bulk Management\n\n**Goal:** Users can organize, filter, and manage large numbers of tasks efficiently\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n**Commit:** ce45d8a\n\n## Requirements\n- UI-02: Filter todos by status: all, active, completed with tab navigation ✓\n- UI-03: Display task counts (total, active, completed) ✓\n- UI-04: Bulk delete all completed tasks with one action ✓\n\n## Success Criteria\n1. User can switch between \"All\", \"Active\", and \"Completed\" views to filter tasks ✓\n2. User sees real-time counts of total, active, and completed tasks ✓\n3. User can clear all completed tasks with single button click ✓\n\n## Known Issues\n- Filter preference does not persist across page refreshes (minor enhancement)\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with completion state) ✓\n- Chapter 3 (Persistence for filtered views) ✓\n\n## Scope\n- Filter state management (current filter: all/active/completed) ✓\n- Filter logic (array filtering based on completion status) ✓\n- Task count calculations (total, active, completed) ✓\n- Clear completed functionality (filter and delete) ✓\n- Filter UI controls (tabs or buttons) ✓\n- Persist filter preference in localStorage (optional enhancement - not implemented)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates",
          "name": "chapter-5-due-dates",
          "kind": "feature",
          "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting"
        }
      ],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.381052572402171
    }
  ]
}
```

---

## Assistant (Fuska-Planner · glm-5 · 29.4s)

Great! I found Chapter 5 in the roadmap. Let me load the necessary context and begin the planning workflow.

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "state",
  "top_k": 1
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-2-core-operations/chapter-02-implementation",
      "name": "chapter-02-implementation",
      "kind": "component",
      "summary": "Chapter 2 implementation complete: State management with in-memory todos array, CRUD operations (add, toggle complete, delete with confirmation, inline edit), input validation (trim, non-empty check), visual feedback (strikethrough + 0.6 opacity for completed tasks, highlight animation for new tasks), event delegation pattern for efficient event handling, unidirectional data flow (action → update state → render). All 3 plans implemented in single batch.",
      "why": "Core CRUD functionality is the heart of the application - must work perfectly before adding persistence or advanced features",
      "file_refs": [
        "src/main.js:1-145",
        "src/style.css:240-340"
      ],
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-2-core-operations",
          "to_name": "chapter-2-core-operations",
          "relation": "implements",
          "description": "Complete implementation of chapter 2"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-2-core-operations",
        "name": "chapter-2-core-operations"
      },
      "similarity": 0.21547662703444537
    }
  ]
}
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-5-context",
  "top_k": 2
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-02-summary",
      "name": "chapter-01-plan-02-summary",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-01\",\n  \"plan\": \"chapter-01-plan-02\",\n  \"subsystem\": \"ui-foundation\",\n  \"tags\": [\"css\", \"custom-properties\", \"responsive-design\", \"accessibility\", \"mobile-first\"],\n  \"requires\": [],\n  \"provides\": [\"CSS custom properties system\", \"Responsive styling\", \"Keyboard accessibility styles\", \"Empty state styling\"],\n  \"affects\": [\"src/style.css\"],\n  \"tech_stack\": {\n    \"added\": [],\n    \"patterns\": [\"CSS Custom Properties\", \"Mobile-first media queries\", \":focus-visible for keyboard navigation\", \"Fluid typography with clamp()\"]\n  },\n  \"key_files\": {\n    \"created\": [],\n    \"modified\": [\"src/style.css\"]\n  },\n  \"key_decisions\": [],\n  \"accomplishments\": [\n    \"Created complete CSS custom properties system in :root with all user-locked values\",\n    \"Defined color tokens: #f4f6f8 background, #ffffff cards, #3b82f6 accent with hover state\",\n    \"Established typography system: system-ui stack, 16px base, modular scale for sm/lg/xl\",\n    \"Implemented 8px spacing unit system with 5 levels (4/8/16/20/30px)\",\n    \"Added layout properties: 600px max-width, 8px/12px border radius, card shadow\",\n    \"Defined accessibility tokens: 44px touch targets, 64px empty icon, 2px focus ring\",\n    \"Created base styles with universal box-sizing, body reset, responsive container\",\n    \"Styled todo form with flexbox, card appearance, shadow, and responsive padding\",\n    \"Styled input with border, touch-target sizing, and inherited typography\",\n    \"Styled button with accent color, hover/active states, and responsive sizing\",\n    \"Implemented empty state with centered layout, 64px icon, and responsive typography\",\n    \"Added skip link that becomes visible on focus for keyboard navigation\",\n    \"Created visually hidden class for screen reader content\",\n    \"Implemented :focus-visible for keyboard accessibility with 2px blue outline\",\n    \"Added button states for hover, active, and disabled\",\n    \"Created mobile-first responsive breakpoints at 480px for padding and typography\"\n  ],\n  \"task_commits\": [],\n  \"files_modified\": [\"src/style.css\"],\n  \"decisions_made\": {},\n  \"deviations\": [],\n  \"issues_encountered\": [],\n  \"next_chapter_readiness\": \"ready\",\n  \"self_check\": \"PASSED - CSS file exists (239 lines), 28 custom properties defined, all accessibility styles present\"\n}",
      "why": "Summary of CSS styling implementation with custom properties, responsive design, and accessibility features",
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-02",
          "to_name": "chapter-01-plan-02",
          "relation": "implements",
          "description": null
        },
        {
          "to": "main/roadmap/chapter-1-ui-foundation",
          "to_name": "chapter-1-ui-foundation",
          "relation": "connects_to",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.2709881545406927
    },
    {
      "id": "main/roadmap",
      "name": "roadmap",
      "kind": "module",
      "summary": "# Roadmap: Vanilla JS Todo App\n\n## Overview\nA focused 5-chapter roadmap delivering a complete vanilla JS todo application with local storage persistence. Chapters are structured to deliver observable user value incrementally, from initial UI foundation through full feature completion.\n\n**Total Chapters:** 5\n**Depth:** Quick (3-5 chapters)\n**Coverage:** 13/13 requirements (100%)\n\n## Chapter Structure\n\n| Chapter | Goal | Requirements | Success Criteria |\n|---------|------|--------------|------------------|\n| 1 - UI Foundation | Users see a clean, responsive, accessible todo interface | UI-01, UI-05, UI-06 | 3 criteria |\n| 2 - Core Task Operations | Users can manage individual tasks with clear visual feedback | CORE-01, CORE-02, CORE-03, CORE-04 | 4 criteria |\n| 3 - Data Persistence | Users never lose their todos across browser sessions | STORAGE-01, STORAGE-02 | 3 criteria |\n| 4 - Filtering & Management | Users can organize and manage tasks efficiently | UI-02, UI-03, UI-04 | 3 criteria |\n| 5 - Due Dates | Users can track task deadlines and overdue items | ENHANCE-01 | 3 criteria |\n\n## Progress Tracking\n\n| Chapter | Status | Progress | Plans | Last Updated |\n|---------|--------|----------|-------|--------------|\n| Chapter 1 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 2 | Complete | 100% | 3 plans (2 batches) | 2026-03-02 |\n| Chapter 3 | Planned | 0% | 2 plans (2 batches) | 2026-03-02 |\n| Chapter 4 | Planned | 0% | 2 plans (1 batch) | 2026-03-02 |\n| Chapter 5 | Not Started | 0% | - | - |\n\n**Overall Progress:** 40% (2/5 chapters complete)\n\n## Chapter 1 Plans\n\n**Plan 01:** Project Setup & HTML Structure (Batch 1) ✓\n- Objective: Set up Vite project and create semantic HTML with accessibility features\n- Tasks: 2 tasks (Initialize Vite, Create HTML structure)\n- Files: package.json, vite.config.js, index.html, src/main.js, src/style.css\n\n**Plan 02:** CSS Styling & Responsive Design (Batch 1) ✓\n- Objective: Create CSS with custom properties and mobile-first responsive layout\n- Tasks: 3 tasks (Define custom properties, Add base styles, Add empty state styles)\n- Files: src/style.css\n\n**Plan 03:** Keyboard Interactivity (Batch 2) ✓\n- Objective: Add keyboard event handlers and SVG icon for empty state\n- Tasks: 2 tasks (Add keyboard handlers, Add inline SVG icon)\n- Files: index.html, src/main.js\n- Depends on: Plan 01, Plan 02\n\n## Chapter 2 Plans\n\n**Plan 01:** State Management & Add Operation (Batch 1) ✓\n- Objective: Implement state management and add todo functionality with validation\n- Tasks: 2 tasks (Implement state/add, Add task styling/highlight)\n- Files: src/main.js, src/style.css\n\n**Plan 02:** Toggle & Delete Operations (Batch 1) ✓\n- Objective: Implement toggle complete/incomplete and delete with confirmation\n- Tasks: 1 task (Implement toggle/delete with event delegation)\n- Files: src/main.js\n\n**Plan 03:** Inline Editing (Batch 2) ✓\n- Objective: Implement inline editing with double-click or edit button\n- Tasks: 2 tasks (Implement inline editing, Add edit mode styling)\n- Files: src/main.js, src/style.css\n- Depends on: Plan 01, Plan 02\n\n## Chapter 3 Plans\n\n**Plan 01:** StorageService & Integration (Batch 1)\n- Objective: Create StorageService abstraction layer and integrate localStorage persistence into main.js\n- Tasks: 3 tasks (Create StorageService, Integrate into main.js, Add error styling)\n- Files: src/storage.js, src/main.js, src/style.css\n\n**Plan 02:** Cross-Tab Sync & Testing (Batch 2)\n- Objective: Add cross-tab synchronization and verify all error handling scenarios work correctly\n- Tasks: 2 tasks (Add cross-tab sync, Verify error scenarios)\n- Files: src/main.js\n- Depends on: Plan 01\n\n## Chapter 4 Plans\n\n**Plan 01:** Filter Controls & Task Counts (Batch 1)\n- Objective: Implement filter controls (All/Active/Completed) with task counts and real-time display updates\n- Tasks: 3 tasks (Add filter state/logic, Add filter controls HTML, Add styling/event handlers)\n- Files: index.html, src/main.js, src/style.css\n\n**Plan 02:** Clear Completed & Empty States (Batch 1)\n- Objective: Implement clear completed functionality with bulk delete and filter-specific empty states\n- Tasks: 1 task (Implement clear completed handler and filter-specific empty states)\n- Files: src/main.js",
      "why": null,
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-1-ui-foundation",
          "name": "chapter-1-ui-foundation",
          "kind": "feature",
          "summary": "# Chapter 1: UI Foundation\n\n**Goal:** Users see a clean, responsive, accessible todo interface ready for task management\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- UI-01: Clean modern UI with semantic HTML, CSS custom properties, responsive design ✓\n- UI-05: Empty state message when no todos exist ✓\n- UI-06: Keyboard support: Enter to submit, Tab navigation, Escape to cancel ✓\n\n## Success Criteria\n1. User opens app and sees clean, modern interface with proper visual hierarchy ✓\n2. User can navigate all interactive elements using Tab key ✓\n3. User sees helpful empty state message when no todos exist ✓\n\n## Dependencies\nNone (foundation chapter)\n\n## Scope\n- HTML structure with semantic elements (form, input, button, ul) ✓\n- CSS with custom properties for theming ✓\n- Responsive layout (mobile-first) ✓\n- Keyboard event handlers setup ✓\n- Empty state rendering logic ✓\n- No business logic or state management yet"
        },
        {
          "id": "main/roadmap/chapter-2-core-operations",
          "name": "chapter-2-core-operations",
          "kind": "feature",
          "summary": "# Chapter 2: Core Task Operations\n\n**Goal:** Users can create, complete, edit, and delete individual tasks with clear visual feedback\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- CORE-01: Add new tasks with text input validation (non-empty, trimmed) ✓\n- CORE-02: Mark tasks as complete/incomplete with visual feedback (strikethrough/opacity) ✓\n- CORE-03: Delete tasks with confirmation ✓\n- CORE-04: Edit existing task text inline or via modal ✓\n\n## Success Criteria\n1. User can add a new task by typing text and pressing Enter or clicking Add button ✓\n2. User can click checkbox/toggle to mark task complete (strikethrough styling appears) ✓\n3. User can delete task with confirmation prompt ✓\n4. User can edit task text inline and save changes ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation must exist) ✓\n\n## Scope\n- State management (in-memory todo array) ✓\n- CRUD operations (add, toggle, delete, edit) ✓\n- Input validation (trim, non-empty check) ✓\n- Visual feedback for all operations ✓\n- Event handling and delegation ✓\n- Re-rendering UI from state ✓\n- No persistence yet (data lost on refresh) ✓"
        },
        {
          "id": "main/roadmap/chapter-3-persistence",
          "name": "chapter-3-persistence",
          "kind": "feature",
          "summary": "# Chapter 3: Data Persistence\n\n**Goal:** Users never lose their todos - data survives browser refresh, closing tab, and works across multiple tabs\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n\n## Requirements\n- STORAGE-01: Persist todos to localStorage with JSON serialization and error handling ✓\n- STORAGE-02: Load todos from localStorage on app initialization ✓\n\n## Success Criteria\n1. User can refresh page and see all their todos preserved ✓\n2. User sees graceful error message if localStorage is disabled or full ✓\n3. User can open app in multiple tabs and see synchronized data ✓\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with state management) ✓\n\n## Scope\n- StorageService abstraction layer ✓\n- JSON serialization/deserialization ✓\n- Error handling (try/catch, QuotaExceededError, private browsing mode) ✓\n- Load from localStorage on app initialization ✓\n- Save to localStorage on every state change ✓\n- Cross-tab synchronization via storage event ✓\n- Graceful degradation messaging ✓"
        },
        {
          "id": "main/roadmap/chapter-4-filtering-management",
          "name": "chapter-4-filtering-management",
          "kind": "feature",
          "summary": "# Chapter 4: Filtering & Bulk Management\n\n**Goal:** Users can organize, filter, and manage large numbers of tasks efficiently\n\n**Status:** Complete ✓\n**Completed:** 2026-03-02\n**Commit:** ce45d8a\n\n## Requirements\n- UI-02: Filter todos by status: all, active, completed with tab navigation ✓\n- UI-03: Display task counts (total, active, completed) ✓\n- UI-04: Bulk delete all completed tasks with one action ✓\n\n## Success Criteria\n1. User can switch between \"All\", \"Active\", and \"Completed\" views to filter tasks ✓\n2. User sees real-time counts of total, active, and completed tasks ✓\n3. User can clear all completed tasks with single button click ✓\n\n## Known Issues\n- Filter preference does not persist across page refreshes (minor enhancement)\n\n## Dependencies\n- Chapter 1 (UI Foundation) ✓\n- Chapter 2 (Core Operations with completion state) ✓\n- Chapter 3 (Persistence for filtered views) ✓\n\n## Scope\n- Filter state management (current filter: all/active/completed) ✓\n- Filter logic (array filtering based on completion status) ✓\n- Task count calculations (total, active, completed) ✓\n- Clear completed functionality (filter and delete) ✓\n- Filter UI controls (tabs or buttons) ✓\n- Persist filter preference in localStorage (optional enhancement - not implemented)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates",
          "name": "chapter-5-due-dates",
          "kind": "feature",
          "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting"
        }
      ],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.2691301039285572
    }
  ]
}
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "ENHANCE-01",
  "top_k": 1
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/requirements/req-ui-01",
      "name": "req-UI-01",
      "kind": "feature",
      "summary": "{\"description\":\"Clean modern UI with semantic HTML, CSS custom properties, responsive design\",\"status\":\"in_progress\",\"hypothesis\":true}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "connects_to",
          "description": "UI requirement for user experience"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/requirements",
        "name": "requirements"
      },
      "similarity": 0.24958191122470963
    }
  ]
}
```

---

## Assistant (Fuska-Planner · glm-5 · 10.0s)

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "req-ENHANCE-01 requirement due dates",
  "top_k": 2
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/requirements/req-enhance-01",
      "name": "req-ENHANCE-01",
      "kind": "feature",
      "summary": "{\"description\":\"Set due dates for tasks with date picker, display overdue indicators, sort by date\",\"status\":\"in_progress\",\"hypothesis\":true}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "connects_to",
          "description": "Enhancement requirement for time-based management"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/requirements",
        "name": "requirements"
      },
      "similarity": 0.5089197828035164
    },
    {
      "id": "main/roadmap/chapter-5-due-dates",
      "name": "chapter-5-due-dates",
      "kind": "feature",
      "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting",
      "why": "Due dates add organizational dimension to task management, enabling time-based prioritization",
      "file_refs": null,
      "children": [],
      "edges": [],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap",
        "name": "roadmap"
      },
      "similarity": 0.4565469915881126
    }
  ]
}
```

---

## Assistant (Fuska-Planner · glm-5 · 549.6s)

Perfect! I have all the context needed. Let me begin the planning workflow for Chapter 5.

```
----------------------------------------------------
 Fuska: RESEARCHING CHAPTER 5
----------------------------------------------------
```

**Tool: task**

**Input:**
```json
{
  "subagent_type": "fuska-chapter-researcher",
  "description": "Research Chapter 5",
  "prompt": "<critical_constraints>\nReturn: ## RESEARCH COMPLETE or ## RESEARCH BLOCKED\nCreate/update research concept: chapter-5-due-dates-research\n</critical_constraints>\n\n<objective>\nResearch how to implement Chapter 5: Due Dates\nAnswer: \"What do I need to know to PLAN this chapter well?\"\n</objective>\n\n<context>\n**Chapter:** Chapter 5: Due Dates — Users can track deadlines and prioritize time-sensitive tasks\n\n**Requirements:** \n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n**Success Criteria:**\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n**Chapter Scope:**\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting\n\n**Dependencies:**\n- Chapter 1 (UI Foundation) - Complete\n- Chapter 2 (Core Operations with task data model) - Complete\n- Chapter 3 (Persistence for due date data) - Complete\n\n**Prior Work:**\n- Chapters 1-4 are complete\n- Application has: semantic HTML, CSS custom properties, state management, localStorage persistence, filtering/clear functionality\n- Current todo model: { id, text, completed, createdAt }\n- Existing patterns: Event delegation, localStorage via StorageService, render-from-state pattern\n</context>\n\n<output>\nUse: ChapterConceptTemplates.createResearch()\n\nFocus on:\n1. Date picker implementation approaches (native vs custom) for vanilla JS\n2. Date handling libraries (if any) or vanilla JS Date API patterns\n3. Overdue calculation logic and timezone considerations\n4. Sorting algorithms for tasks with optional due dates\n5. Date formatting best practices\n6. Visual indicators for overdue tasks (CSS patterns)\n7. Accessibility considerations for date inputs\n8. Common pitfalls in date handling (timezone bugs, edge cases)\n</output>"
}
```

**Output:**
```
task_id: ses_3514a1820ffeBT7TlXT15CouYG (for resuming to continue this task if needed)

<task_result>
## RESEARCH COMPLETE

**Chapter:** 5 - Due Dates
**Confidence:** HIGH

### Key Findings

1. **Native HTML5 date input is the standard approach** - No custom picker libraries needed, widely supported since 2021, built-in accessibility and validation
2. **Store dates as `YYYY-MM-DD` strings** - Matches native input format, avoid timestamps to simplify comparison
3. **Compare dates at start-of-day to avoid timezone bugs** - Critical pattern: use `date.setHours(0, 0, 0, 0)` and add `'T00:00:00'` to date strings
4. **Sort with explicit null handling** - Null dates last, don't use epoch comparison (causes wrong ordering)
5. **Intl.DateTimeFormat for display** - Create formatter once for performance, automatic locale support
6. **Visual overdue indicator** - Red border-left + text color, exclude completed tasks from overdue detection
7. **Six major pitfalls identified** - Timezone bugs, time normalization, null sorting, completed task display, formatter efficiency, value format

### Research Concept Created

`concept: chapter-5-due-dates-research` (kind: pattern, edge: connects_to → chapter-5-due-dates)

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Native HTML5 and JavaScript APIs, no dependencies |
| Architecture | HIGH | Extends existing patterns, follows date handling best practices from MDN |
| Accessibility | HIGH | Native date input provides built-in a11y, aria-invalid for validation |
| Pitfalls | HIGH | Common mistakes documented in MDN, verified against codebase patterns |

### Open Questions

1. **Date input visibility** - Always visible (clear affordance) or show on hover/edit (less clutter)?
2. **Timezone edge cases** - DST transitions, timezone changes with start-of-day comparison
3. **Time-of-day support** - Date-only sufficient for MVP, add time as future enhancement?

### Ready for Planning

Research complete with HIGH confidence. All critical implementation decisions documented:
- **Date picker:** Native HTML5 `<input type="date">`
- **Storage format:** `YYYY-MM-DD` string or null
- **Overdue detection:** Compare at start-of-day, exclude completed tasks
- **Sorting:** Null dates last, explicit null handling
- **Display:** Intl.DateTimeFormat (create once)
- **Styling:** Red border-left + text color for overdue

Planner can now create plan concept in MegaMemory.
</task_result>
```

---

## Assistant (Fuska-Planner · glm-5 · 14.2s)

Excellent! Research is complete. Now let me load the research concept and spawn the planner agent.

```
-----------------------------------------------------
 Fuska: PLANNING CHAPTER 5
-----------------------------------------------------
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-5-due-dates-research",
  "top_k": 1
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-5-due-dates",
      "name": "chapter-5-due-dates",
      "kind": "feature",
      "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting",
      "why": "Due dates add organizational dimension to task management, enabling time-based prioritization",
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "name": "chapter-5-due-dates-research",
          "kind": "pattern",
          "summary": "# Chapter 5: Due Dates - Research\n\n**Researched:** 2026-03-02\n**Domain:** Date handling, date picker UI, overdue detection, sorting with dates in vanilla JS\n**Confidence:** HIGH\n\n## Summary\n\nResearch for implementing due dates in a vanilla JS todo app. This chapter adds time-based task management, enabling users to set deadlines, identify overdue tasks, and prioritize work by due date. The standard approach uses native HTML5 `<input type=\"date\">` for date selection, vanilla JavaScript Date API for comparison, and Intl.DateTimeFormat for locale-aware display. Key challenge: avoid timezone bugs by using date-only storage and start-of-day comparison.\n\n**Primary recommendation:** Use native HTML5 date input (no custom picker), store dates as `YYYY-MM-DD` strings, compare at start-of-day to avoid timezone issues, sort with null dates last, use Intl.DateTimeFormat for display, and apply red visual indicator for overdue tasks.\n\n## Standard Stack\n\nThe established libraries/tools for this chapter:\n\n### Core\n| Library | Version | Purpose | Why Standard |\n|---------|---------|---------|--------------|\n| Native HTML5 date input | HTML5 | Date picker UI | Built-in browser support since 2021, baseline widely available, accessible, no dependencies |\n| Vanilla JS Date API | ES5+ | Date comparison and manipulation | Native, no dependencies, sufficient for date-only operations |\n| Intl.DateTimeFormat | ES6 | Locale-aware date formatting | Built-in i18n support, no manual formatting |\n\n### Supporting\n| Library | Version | Purpose | When to Use |\n|---------|---------|---------|-------------|\n| CSS custom properties | CSS3 | Overdue task styling (red highlight) | Already in use from Chapter 1 |\n| Event delegation | ES6 | Date input change handling | Existing pattern from Chapters 2-4 |\n\n### Alternatives Considered\n| Instead of | Could Use | Tradeoff |\n|------------|-----------|----------|\n| Native date input | Custom date picker (flatpickr, date-fns) | 2-10KB dependency, more code, maintenance burden |\n| Vanilla Date API | date-fns, dayjs, luxon | 2-10KB dependency, overkill for simple date-only operations |\n| Intl.DateTimeFormat | toLocaleDateString() | toLocaleDateString() creates formatter each call, less efficient |\n| Date-only storage | Timestamp storage | Over-complicates comparison, timezone handling needed |\n\n**Installation:**\nNo additional dependencies needed - all functionality uses native HTML5, JavaScript, and browser APIs.\n\n## Architecture Patterns\n\n### Recommended Data Model Extension\n\n```javascript\n// Extend existing todo model\nconst todo = {\n  id: number | string,\n  text: string,\n  completed: boolean,\n  createdAt: string | number, // existing\n  dueDate: string | null // NEW: 'YYYY-MM-DD' format or null (optional)\n}\n```\n\n**Key decisions:**\n- **Format:** Store as ISO date string (`YYYY-MM-DD`) - matches native date input value format\n- **Optional:** Nullable field - tasks can exist without due dates\n- **No time component:** Date-only, no hours/minutes/seconds (simplifies comparison)\n\n### Recommended Implementation Structure\n\nExtend existing state management and render pattern:\n\n```javascript\n// Modified render function\nfunction render() {\n  // Get filtered/sorted todos\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = createTodoElement(todo, isOverdue)\n    todoList.appendChild(li)\n  })\n}\n\n// Date input handler\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null // null if empty\n  storage.save(todos)\n  render()\n}\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Compare at start of day\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00') // Avoid UTC interpretation\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today // Overdue if due date is before today\n}\n\n// Sort by due date (earliest first, null dates last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - compare them\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Only a has due date - a comes first\n    if (a.dueDate && !b.dueDate) return -1\n    // Only b has due date - b comes first\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain original order\n    return 0\n  })\n}\n\n// Format date for display\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short',\n    day: 'numeric',\n    year: 'numeric'\n  }).format(date)\n}\n```\n\n### Pattern 1: Native Date Input Integration\n\n**What:** Add `<input type=\"date\">` to each todo item for date selection\n**When:** Always - native input provides built-in picker, validation, accessibility\n**Example:**\n\n```html\n<!-- Inside todo item -->\n<li class=\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\">\n  <button class=\"toggle-btn\" data-id=\"${todo.id}\" aria-label=\"Toggle complete\">\n    ✓\n  </button>\n  \n  <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n  \n  <!-- Date input -->\n  <input \n    type=\"date\" \n    class=\"due-date-input\"\n    value=\"${todo.dueDate || ''}\"\n    data-id=\"${todo.id}\"\n    aria-label=\"Due date for ${escapeHtml(todo.text)}\"\n  />\n  \n  <!-- Formatted date display (optional, shows when input not focused) -->\n  <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n    ${todo.dueDate ? formatDate(todo.dueDate) : ''}\n  </span>\n  \n  <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n  <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n</li>\n```\n\n```javascript\n// Event delegation for date changes\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n**Key principles:**\n- Native `<input type=\"date\">` provides browser's built-in date picker\n- Value always returns `YYYY-MM-DD` format (standardized)\n- Display format adapts to user's locale automatically\n- Built-in keyboard navigation and screen reader support\n- Can be styled with CSS (though some limitations exist)\n\n### Pattern 2: Overdue Detection and Styling\n\n**What:** Compare due date to current date, apply visual indicator for overdue tasks\n**When:** On every render\n**Example:**\n\n```javascript\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Start of today\n  \n  // CRITICAL: Add time component to avoid UTC interpretation\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n```\n\n```css\n/* Overdue styling */\n.todo-item.overdue {\n  border-left: 3px solid #ef4444; /* Red accent */\n}\n\n.todo-item.overdue .due-date-display,\n.todo-item.overdue .todo-text {\n  color: #ef4444;\n}\n\n.todo-item.overdue .due-date-display::before {\n  content: '⚠ ';\n  /* Warning icon */\n}\n```\n\n**Why this approach:**\n- Uses start-of-day comparison to avoid timezone edge cases\n- Completed tasks never show as overdue (common UX pattern)\n- Visual indicator (red) is universally understood\n- Subtle styling (border-left + text color) doesn't overwhelm UI\n\n### Pattern 3: Sorting with Nullable Due Dates\n\n**What:** Sort todos by due date, placing tasks without due dates at the end\n**When:** On every render (after state changes)\n**Example:**\n\n```javascript\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - sort chronologically\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Tasks with due dates come before tasks without\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain creation order\n    return 0\n  })\n}\n```\n\n**Why this approach:**\n- Tasks with deadlines are more urgent (should appear first)\n- Null dates at the end prevents them from interrupting sorted order\n- Stable sort (maintains original order for equal priorities)\n- Simple comparison using Date subtraction (milliseconds)\n\n### Pattern 4: Date Display Formatting\n\n**What:** Format dates in user's locale with Intl.DateTimeFormat\n**When:** On render\n**Example:**\n\n```javascript\n// Create formatter once (reuse for performance)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return dateFormatter.format(date)\n}\n\n// Examples:\n// en-US: \"Mar 15, 2026\"\n// en-GB: \"15 Mar 2026\"\n// de-DE: \"15.03.2026\"\n// ja-JP: \"2026年3月15日\"\n```\n\n**Why Intl.DateTimeFormat:**\n- Automatic locale detection (uses browser settings)\n- No manual formatting logic\n- Handles all edge cases (different calendars, numbering systems)\n- More efficient than toLocaleDateString() for repeated use\n\n### Anti-Patterns to Avoid\n\n- **Comparing dates without normalizing time:** Leads to false overdue detection due to time components\n- **Using `new Date(dateString)` without time component:** Date-only strings interpreted as UTC, causes timezone bugs\n- **Sorting null dates as 0 or epoch:** Clusters all no-date tasks at start (wrong UX)\n- **Showing overdue indicator on completed tasks:** Confusing UX - task is done, deadline irrelevant\n- **Storing date with time component:** Over-complicates comparison, user only cares about day\n- **Using toLocaleDateString() in render loop:** Creates new formatter every time, inefficient\n\n## Don't Hand-Roll\n\nProblems that look simple but have established solutions:\n\n| Problem | Don't Build | Use Instead | Why |\n|---------|-------------|-------------|-----|\n| Date picker UI | Custom calendar widget | `<input type=\"date\">` | Native, accessible, no code, consistent with OS |\n| Date formatting | Manual string concatenation | Intl.DateTimeFormat | Handles all locales, edge cases, calendars |\n| Timezone handling | Manual offset calculations | Store date-only + compare at start-of-day | Avoids timezone complexity entirely |\n| Date validation | Custom regex/parser | Native date input validation | Built-in min/max, required, invalid states |\n\n**Key insight:** Date handling is notoriously error-prone. Use native APIs and simple patterns (date-only, start-of-day comparison) to avoid timezone bugs.\n\n## Common Pitfalls\n\n### Pitfall 1: Timezone Bugs with Date-Only Strings\n**What goes wrong:** Task due \"2026-03-02\" shows as overdue on March 2nd due to timezone conversion\n**Why it happens:** `new Date('2026-03-02')` interprets as UTC midnight, which may be previous day in local timezone\n**How to avoid:** Always add time component: `new Date('2026-03-02' + 'T00:00:00')`\n```javascript\n// ❌ Wrong - timezone issues\nconst dueDate = new Date(todo.dueDate)\n\n// ✅ Correct - local timezone\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\n```\n**Warning signs:** Tasks show as overdue one day early, date display doesn't match input value\n\n### Pitfall 2: Overdue Detection Without Time Normalization\n**What goes wrong:** Task due today shows as overdue in the afternoon\n**Why it happens:** `new Date()` includes current time (e.g., 14:30), due date is midnight (00:00)\n**How to avoid:** Compare both dates at start-of-day (00:00:00)\n```javascript\n// ❌ Wrong - time component causes false positives\nconst today = new Date()\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\nreturn dueDate < today // FALSE POSITIVE if today is 14:30\n\n// ✅ Correct - compare at start of day\nconst today = new Date()\ntoday.setHours(0, 0, 0, 0)\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\ndueDate.setHours(0, 0, 0, 0)\nreturn dueDate < today\n```\n**Warning signs:** Tasks show overdue mid-day on due date\n\n### Pitfall 3: Null Dates Sorted as Epoch (1970)\n**What goes wrong:** Tasks without due dates appear first in sorted list (treated as Jan 1, 1970)\n**Why it happens:** `new Date(null)` returns epoch date\n**How to avoid:** Explicit null handling in sort comparator\n```javascript\n// ❌ Wrong - null becomes epoch\ntodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))\n\n// ✅ Correct - null dates last\ntodos.sort((a, b) => {\n  if (a.dueDate && b.dueDate) {\n    return new Date(a.dueDate) - new Date(b.dueDate)\n  }\n  if (a.dueDate && !b.dueDate) return -1\n  if (!a.dueDate && b.dueDate) return 1\n  return 0\n})\n```\n**Warning signs:** Tasks without due dates cluster at top of list\n\n### Pitfall 4: Completed Tasks Show Overdue\n**What goes wrong:** Completed task with past due date still shows red/overdue styling\n**Why it happens:** Overdue check doesn't exclude completed tasks\n**How to avoid:** Check completion status before overdue detection\n```javascript\n// ❌ Wrong - completed tasks can be overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n\n// ✅ Correct - completed tasks never overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n```\n**Warning signs:** Completed tasks have red styling, confusing users\n\n### Pitfall 5: Inefficient Date Formatting in Render Loop\n**What goes wrong:** Performance issues with large todo lists (> 100 items)\n**Why it happens:** Creating new Intl.DateTimeFormat instance on every render\n**How to avoid:** Create formatter once, reuse\n```javascript\n// ❌ Wrong - new formatter every call\nfunction formatDate(dateString) {\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short', day: 'numeric', year: 'numeric'\n  }).format(new Date(dateString + 'T00:00:00'))\n}\n\n// ✅ Correct - reuse formatter\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short', day: 'numeric', year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n```\n**Warning signs:** Slow rendering with many todos\n\n### Pitfall 6: Date Input Value Format Mismatch\n**What goes wrong:** Date input shows wrong date or fails to set value\n**Why it happens:** Native date input expects `YYYY-MM-DD` format exactly\n**How to avoid:** Store dates in ISO format, set input.value directly\n```javascript\n// ❌ Wrong - wrong format\ndateInput.value = '03/15/2026' // MM/DD/YYYY - won't work\ndateInput.value = 'March 15, 2026' // won't work\n\n// ✅ Correct - ISO format\ndateInput.value = '2026-03-15' // YYYY-MM-DD\ndateInput.value = todo.dueDate || '' // empty string if null\n```\n**Warning signs:** Date input shows blank or incorrect date\n\n## Code Examples\n\n### Complete Due Date Integration (main.js)\n\n```javascript\n// State extension (todos already exists)\n// Date formatter (create once)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n\n// Date formatting\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n\n// Sort by due date (earliest first, null last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    return 0\n  })\n}\n\n// Set due date\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null\n  storage.save(todos)\n  render()\n}\n\n// Update render function\nfunction render() {\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  if (displayTodos.length === 0) {\n    renderEmptyState()\n    return\n  }\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = document.createElement('li')\n    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`\n    \n    li.innerHTML = `\n      <button class=\"toggle-btn\" data-id=\"${todo.id}\" \n              aria-label=\"Mark as ${todo.completed ? 'incomplete' : 'complete'}\"\n              aria-checked=\"${todo.completed}\">\n        ${todo.completed ? '✓' : ''}\n      </button>\n      \n      <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n      \n      <input \n        type=\"date\" \n        class=\"due-date-input\"\n        value=\"${todo.dueDate || ''}\"\n        data-id=\"${todo.id}\"\n        aria-label=\"Due date\"\n      />\n      \n      <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n        ${formatDate(todo.dueDate)}\n      </span>\n      \n      <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n      <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n    `\n    \n    todoList.appendChild(li)\n  })\n}\n\n// Event listeners (add to existing delegation)\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n## State of the Art\n\n| Old Approach | Current Approach | When Changed | Impact |\n|--------------|------------------|--------------|--------|\n| Custom date picker libraries | Native HTML5 date input | 2021 (baseline support) | Less code, better accessibility, consistent UX |\n| toLocaleDateString() for formatting | Intl.DateTimeFormat | 2016+ | Better performance, more options |\n| Manual timezone handling | Date-only + start-of-day comparison | Best practice | Avoids timezone bugs entirely |\n| Sorting null dates as epoch | Explicit null handling | Best practice | Better UX (null dates last) |\n\n**Deprecated/outdated:**\n- Using jQuery UI datepicker: Replaced by native date input\n- Storing dates as timestamps: Over-complicates date-only use case\n- Custom timezone logic: Error-prone, better to avoid with date-only approach\n- Parsing dates with regex: Use native Date constructor with ISO format\n\n## Open Questions\n\nThings that couldn't be fully resolved:\n\n1. **Should we show date input always or only on hover/edit?**\n   - What we know: Always visible provides clear affordance\n   - What's unclear: Does it clutter the UI for tasks without due dates?\n   - Recommendation: Always visible, use compact styling (date input can be small)\n\n2. **Should overdue detection consider timezone?**\n   - What we know: Start-of-day comparison avoids most issues\n   - What's unclear: Edge cases with DST transitions, timezone changes\n   - Recommendation: Accept local timezone comparison (user's perspective), document limitation\n\n3. **Should we add time-of-day support in future?**\n   - What we know: Date-only is simpler, covers most use cases\n   - What's unclear: Do users need specific deadlines (e.g., \"5 PM\")?\n   - Recommendation: Keep date-only for MVP, add time support as future enhancement if requested\n\n## Sources\n\n### Primary (HIGH confidence)\n- MDN Web Docs - HTML input type=\"date\" (official documentation, verified 2025-12-08)\n- MDN Web Docs - JavaScript Date object (official reference, verified 2025-12-08)\n- MDN Web Docs - Intl.DateTimeFormat (official documentation, verified 2025-07-10)\n- MDN Web Docs - aria-invalid attribute (accessibility validation, verified 2025-06-02)\n- W3C HTML5 Specification - Date state (input type=date)\n- DigitalOcean Community - Understanding Date and Time in JavaScript (tutorial, 2021-08-25)\n\n### Secondary (MEDIUM confidence)\n- MDN Web Docs - Date and time formats used in HTML\n- ISO 8601 standard (date format specification)\n\n### Tertiary (LOW confidence)\n- None - all recommendations based on official MDN documentation and established patterns\n\n## Metadata\n\n**Confidence breakdown:**\n- Standard stack: HIGH - Based on native HTML5 and JavaScript APIs, no external dependencies\n- Architecture: HIGH - Extends existing patterns from chapters 1-4, follows date handling best practices\n- Accessibility: HIGH - Native date input provides built-in accessibility, aria-invalid for validation\n- Pitfalls: HIGH - Common date handling mistakes documented in MDN and industry blogs, verified against existing codebase\n\n**Research date:** 2026-03-02\n**Valid until:** 90 days (stable web standards, date handling patterns well-established)"
        }
      ],
      "edges": [],
      "incoming_edges": [
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "from_name": "chapter-5-due-dates-research",
          "relation": "connects_to",
          "description": "Research findings connect to and inform planning for Chapter 5 implementation"
        }
      ],
      "parent": {
        "id": "main/roadmap",
        "name": "roadmap"
      },
      "similarity": 0.4991166680075965
    }
  ]
}
```

---

## Assistant (Fuska-Planner · glm-5 · 533.9s)

**Tool: task**

**Input:**
```json
{
  "description": "Plan Chapter 5",
  "prompt": "<critical_constraints>\nReturn: ## PLANNING COMPLETE or ## CHECKPOINT REACHED or ## PLANNING INCONCLUSIVE\nCreate plan concepts: chapter-5-due-dates-plan-01, chapter-5-due-dates-plan-02, etc.\n</critical_constraints>\n\n<objective>\nCreate executable plan concepts for Chapter 5: Due Dates\n</objective>\n\n<chapter_data>\n{\n  \"name\": \"chapter-5-due-dates\",\n  \"goal\": \"Users can track deadlines and prioritize time-sensitive tasks\",\n  \"requirements\": [\"ENHANCE-01\"],\n  \"success_criteria\": [\n    \"User can set a due date for any task using a date picker\",\n    \"User sees visual indicator (red highlight) for overdue tasks\",\n    \"User can sort task list by due date (earliest first)\"\n  ],\n  \"dependencies\": [\"chapter-1\", \"chapter-2\", \"chapter-3\"],\n  \"scope\": [\n    \"Extend todo data model with dueDate field (optional, nullable)\",\n    \"Date picker UI integration (native HTML date input)\",\n    \"Overdue calculation logic (compare dueDate to current date)\",\n    \"Visual styling for overdue tasks\",\n    \"Sort functionality (by due date, null dates last)\",\n    \"Date display formatting\"\n  ],\n  \"status\": \"Not Started\"\n}\n</chapter_data>\n\n<requirements>\n{\n  \"ENHANCE-01\": {\n    \"description\": \"Set due dates for tasks with date picker, display overdue indicators, sort by date\",\n    \"status\": \"in_progress\",\n    \"hypothesis\": true\n  }\n}\n</requirements>\n\n<research_data>\n{\n  \"standard_stack\": {\n    \"core\": [\n      {\"name\": \"Native HTML5 date input\", \"purpose\": \"Date picker UI - built-in browser support, accessible, no dependencies\"},\n      {\"name\": \"Vanilla JS Date API\", \"purpose\": \"Date comparison and manipulation - native, no dependencies\"},\n      {\"name\": \"Intl.DateTimeFormat\", \"purpose\": \"Locale-aware date formatting - built-in i18n support\"}\n    ]\n  },\n  \"architecture_patterns\": {\n    \"data_model\": {\n      \"field\": \"dueDate\",\n      \"type\": \"string | null\",\n      \"format\": \"YYYY-MM-DD\",\n      \"optional\": true\n    },\n    \"key_functions\": [\n      \"isTodoOverdue(todo) - Compare at start-of-day, exclude completed tasks\",\n      \"formatDate(dateString) - Use Intl.DateTimeFormat, create formatter once\",\n      \"getDisplayTodos() - Sort by due date, null dates last\",\n      \"setDueDate(todoId, dateString) - Update todo and save to storage\"\n    ]\n  },\n  \"dont_hand_roll\": [\n    {\"problem\": \"Date picker UI\", \"use\": \"<input type=\\\"date\\\">\", \"reason\": \"Native, accessible, no code\"},\n    {\"problem\": \"Date formatting\", \"use\": \"Intl.DateTimeFormat\", \"reason\": \"Handles all locales and edge cases\"},\n    {\"problem\": \"Timezone handling\", \"use\": \"Date-only + start-of-day comparison\", \"reason\": \"Avoids timezone complexity\"}\n  ],\n  \"common_pitfalls\": [\n    \"Timezone bugs - Always add 'T00:00:00' to date strings\",\n    \"Time normalization - Compare dates at start-of-day (setHours(0,0,0,0))\",\n    \"Null sorting - Explicit null handling (null dates last)\",\n    \"Completed tasks overdue - Exclude completed tasks from overdue detection\",\n    \"Inefficient formatting - Create Intl.DateTimeFormat once, reuse\",\n    \"Value format mismatch - Native date input expects YYYY-MM-DD exactly\"\n  ],\n  \"key_decisions\": [\n    \"Use native HTML5 date input (no custom picker)\",\n    \"Store dates as YYYY-MM-DD strings (or null)\",\n    \"Compare at start-of-day to avoid timezone bugs\",\n    \"Exclude completed tasks from overdue detection\",\n    \"Sort with null dates last\",\n    \"Create date formatter once for performance\"\n  ]\n}\n</research_data>\n\n<context>\n**Prior Chapters Complete:**\n- Chapter 1: UI Foundation (Vite, semantic HTML, CSS custom properties)\n- Chapter 2: Core Operations (state management, CRUD, event delegation)\n- Chapter 3: Data Persistence (localStorage via StorageService)\n- Chapter 4: Filtering & Bulk Management (filter controls, task counts, clear completed)\n\n**Current Todo Model:**\n```javascript\n{\n  id: number | string,\n  text: string,\n  completed: boolean,\n  createdAt: string | number\n}\n```\n\n**Existing Patterns:**\n- Event delegation for all user interactions\n- StorageService for localStorage (load/save)\n- Render-from-state pattern\n- CSS custom properties for styling\n- Filter state management (all/active/completed)\n\n**No chapter context exists** - no user-locked decisions or deferred ideas\n**No state concept exists** - using default state\n</context>\n\n<planning_instructions>\n1. Apply goal-backward methodology to derive requirements\n2. Break into 2-3 tasks per plan (context budget: ~50%)\n3. Use vertical slices where possible (related work together)\n4. Prefer 1-3 plans for \"quick\" depth\n5. Batch analysis for parallel execution\n6. Create plan concepts in MegaMemory with:\n   - name: chapter-5-due-dates-plan-{number}\n   - kind: feature\n   - parent: chapter-5-due-dates\n   - edges: implements → chapter-5-due-dates\n7. Use research recommendations (native date input, date-only storage, start-of-day comparison)\n8. Include specific file paths, function names, and implementation details in tasks\n9. Each task needs: name, type (auto/checkpoint), files, action, verify, done\n</planning_instructions>\n\n<output>\nCreate plan concepts following ChapterConceptTemplates.createPlan() structure with:\n- objective, purpose, output\n- requirements (truths, artifacts, key_links)\n- tasks (name, type, files, action, verify, done)\n- batch, depends_on, autonomous, files_modified\n</output>",
  "subagent_type": "fuska-planner"
}
```

**Output:**
```
task_id: ses_35141426fffeKKtOSBErK21RcM (for resuming to continue this task if needed)

<task_result>
## PLANNING COMPLETE

**Chapter:** Chapter 5: Due Dates
**Plans:** 2 plan(s) in 2 batch(s)

### Batch Structure

| Batch | Plans | Autonomous |
|------|-------|------------|
| 1 | chapter-5-due-dates-plan-01 | yes |
| 2 | chapter-5-due-dates-plan-02 | yes |

### Plans Created

| Plan | Objective | Tasks | Files |
|------|-----------|-------|-------|
| chapter-5-due-dates-plan-01 | Extend todo data model with due dates and implement date utility functions | 3 | src/main.js |
| chapter-5-due-dates-plan-02 | Add date picker UI, overdue styling, and formatted date display | 3 | src/main.js, src/style.css |

### Plan Details

**Plan 01: Data Model & Date Utilities** (Batch 1)
- **Objective:** Establish foundation for time-based task management with proper date handling
- **Tasks:**
  1. Extend todo model and add setDueDate function
  2. Implement date utility functions (isTodoOverdue, formatDate, getDisplayTodos)
  3. Integrate sort into render function
- **Key Technical Decisions:**
  - Store dates as YYYY-MM-DD strings (matches native date input)
  - Use start-of-day comparison to avoid timezone bugs (setHours(0,0,0,0))
  - Exclude completed tasks from overdue detection
  - Sort with null dates last
  - Create Intl.DateTimeFormat once for performance

**Plan 02: Date Picker UI & Overdue Styling** (Batch 2)
- **Objective:** Complete user-facing due date feature with visual feedback
- **Tasks:**
  1. Add native HTML5 date picker to todo item rendering
  2. Add change event handler for date picker
  3. Add overdue task styling (red border-left and text color)
- **Dependencies:** Plan 01 (date utilities)
- **Key Technical Decisions:**
  - Use native <input type="date"> for date picker (no dependencies)
  - Always visible date picker (research recommendation)
  - Subtle visual indicator for overdue tasks (border-left + text color)

### Requirements Addressed

✓ **ENHANCE-01:** Set due dates for tasks with date picker, display overdue indicators, sort by date

**Success Criteria Coverage:**
1. ✓ User can set a due date for any task using a date picker (Plan 02)
2. ✓ User sees visual indicator (red highlight) for overdue tasks (Plan 02)
3. ✓ User can sort task list by due date (earliest first) (Plan 01)

### Concepts Updated

- ✓ Plan concept: chapter-5-due-dates-plan-01 (created)
- ✓ Plan concept: chapter-5-due-dates-plan-02 (created)
- ✓ Roadmap concept updated with Chapter 5 plans
- ✓ State concept updated with Chapter 5 status (planned)

### Goal-Backward Verification

**Goal:** Users can track deadlines and prioritize time-sensitive tasks

**Observable Truths Planned:**
1. ✓ User can see a date picker for each task (Plan 02, Task 1)
2. ✓ User can select a due date using the date picker (Plan 02, Task 2)
3. ✓ User sees which tasks are overdue (red visual indicator) (Plan 02, Task 3)
4. ✓ User sees tasks sorted by due date (Plan 01, Task 3)
5. ✓ User sees formatted date display (Plan 02, Task 1)
6. ✓ Completed tasks are never marked as overdue (Plan 01, Task 2)

**Key Links Planned:**
- ✓ date input onChange → setDueDate → storage.save → render
- ✓ render → isTodoOverdue (visual feedback)
- ✓ render → getDisplayTodos (sorted display)
- ✓ render → formatDate (date display)

### Next Steps

Execute: `/fuska-build chapter-5-due-dates`

*`/new` first - fresh context window*
</task_result>
```

---

## Assistant (Fuska-Planner · glm-5 · 10.0s)

Perfect! Planning is complete. Now let me verify the plans with the checker.

```
-----------------------------------------------------
 Fuska: VERIFYING PLANS
-----------------------------------------------------
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-5-due-dates-plan",
  "top_k": 20
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-5-due-dates",
      "name": "chapter-5-due-dates",
      "kind": "feature",
      "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting",
      "why": "Due dates add organizational dimension to task management, enabling time-based prioritization",
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "name": "chapter-5-due-dates-research",
          "kind": "pattern",
          "summary": "# Chapter 5: Due Dates - Research\n\n**Researched:** 2026-03-02\n**Domain:** Date handling, date picker UI, overdue detection, sorting with dates in vanilla JS\n**Confidence:** HIGH\n\n## Summary\n\nResearch for implementing due dates in a vanilla JS todo app. This chapter adds time-based task management, enabling users to set deadlines, identify overdue tasks, and prioritize work by due date. The standard approach uses native HTML5 `<input type=\"date\">` for date selection, vanilla JavaScript Date API for comparison, and Intl.DateTimeFormat for locale-aware display. Key challenge: avoid timezone bugs by using date-only storage and start-of-day comparison.\n\n**Primary recommendation:** Use native HTML5 date input (no custom picker), store dates as `YYYY-MM-DD` strings, compare at start-of-day to avoid timezone issues, sort with null dates last, use Intl.DateTimeFormat for display, and apply red visual indicator for overdue tasks.\n\n## Standard Stack\n\nThe established libraries/tools for this chapter:\n\n### Core\n| Library | Version | Purpose | Why Standard |\n|---------|---------|---------|--------------|\n| Native HTML5 date input | HTML5 | Date picker UI | Built-in browser support since 2021, baseline widely available, accessible, no dependencies |\n| Vanilla JS Date API | ES5+ | Date comparison and manipulation | Native, no dependencies, sufficient for date-only operations |\n| Intl.DateTimeFormat | ES6 | Locale-aware date formatting | Built-in i18n support, no manual formatting |\n\n### Supporting\n| Library | Version | Purpose | When to Use |\n|---------|---------|---------|-------------|\n| CSS custom properties | CSS3 | Overdue task styling (red highlight) | Already in use from Chapter 1 |\n| Event delegation | ES6 | Date input change handling | Existing pattern from Chapters 2-4 |\n\n### Alternatives Considered\n| Instead of | Could Use | Tradeoff |\n|------------|-----------|----------|\n| Native date input | Custom date picker (flatpickr, date-fns) | 2-10KB dependency, more code, maintenance burden |\n| Vanilla Date API | date-fns, dayjs, luxon | 2-10KB dependency, overkill for simple date-only operations |\n| Intl.DateTimeFormat | toLocaleDateString() | toLocaleDateString() creates formatter each call, less efficient |\n| Date-only storage | Timestamp storage | Over-complicates comparison, timezone handling needed |\n\n**Installation:**\nNo additional dependencies needed - all functionality uses native HTML5, JavaScript, and browser APIs.\n\n## Architecture Patterns\n\n### Recommended Data Model Extension\n\n```javascript\n// Extend existing todo model\nconst todo = {\n  id: number | string,\n  text: string,\n  completed: boolean,\n  createdAt: string | number, // existing\n  dueDate: string | null // NEW: 'YYYY-MM-DD' format or null (optional)\n}\n```\n\n**Key decisions:**\n- **Format:** Store as ISO date string (`YYYY-MM-DD`) - matches native date input value format\n- **Optional:** Nullable field - tasks can exist without due dates\n- **No time component:** Date-only, no hours/minutes/seconds (simplifies comparison)\n\n### Recommended Implementation Structure\n\nExtend existing state management and render pattern:\n\n```javascript\n// Modified render function\nfunction render() {\n  // Get filtered/sorted todos\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = createTodoElement(todo, isOverdue)\n    todoList.appendChild(li)\n  })\n}\n\n// Date input handler\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null // null if empty\n  storage.save(todos)\n  render()\n}\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Compare at start of day\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00') // Avoid UTC interpretation\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today // Overdue if due date is before today\n}\n\n// Sort by due date (earliest first, null dates last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - compare them\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Only a has due date - a comes first\n    if (a.dueDate && !b.dueDate) return -1\n    // Only b has due date - b comes first\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain original order\n    return 0\n  })\n}\n\n// Format date for display\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short',\n    day: 'numeric',\n    year: 'numeric'\n  }).format(date)\n}\n```\n\n### Pattern 1: Native Date Input Integration\n\n**What:** Add `<input type=\"date\">` to each todo item for date selection\n**When:** Always - native input provides built-in picker, validation, accessibility\n**Example:**\n\n```html\n<!-- Inside todo item -->\n<li class=\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\">\n  <button class=\"toggle-btn\" data-id=\"${todo.id}\" aria-label=\"Toggle complete\">\n    ✓\n  </button>\n  \n  <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n  \n  <!-- Date input -->\n  <input \n    type=\"date\" \n    class=\"due-date-input\"\n    value=\"${todo.dueDate || ''}\"\n    data-id=\"${todo.id}\"\n    aria-label=\"Due date for ${escapeHtml(todo.text)}\"\n  />\n  \n  <!-- Formatted date display (optional, shows when input not focused) -->\n  <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n    ${todo.dueDate ? formatDate(todo.dueDate) : ''}\n  </span>\n  \n  <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n  <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n</li>\n```\n\n```javascript\n// Event delegation for date changes\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n**Key principles:**\n- Native `<input type=\"date\">` provides browser's built-in date picker\n- Value always returns `YYYY-MM-DD` format (standardized)\n- Display format adapts to user's locale automatically\n- Built-in keyboard navigation and screen reader support\n- Can be styled with CSS (though some limitations exist)\n\n### Pattern 2: Overdue Detection and Styling\n\n**What:** Compare due date to current date, apply visual indicator for overdue tasks\n**When:** On every render\n**Example:**\n\n```javascript\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Start of today\n  \n  // CRITICAL: Add time component to avoid UTC interpretation\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n```\n\n```css\n/* Overdue styling */\n.todo-item.overdue {\n  border-left: 3px solid #ef4444; /* Red accent */\n}\n\n.todo-item.overdue .due-date-display,\n.todo-item.overdue .todo-text {\n  color: #ef4444;\n}\n\n.todo-item.overdue .due-date-display::before {\n  content: '⚠ ';\n  /* Warning icon */\n}\n```\n\n**Why this approach:**\n- Uses start-of-day comparison to avoid timezone edge cases\n- Completed tasks never show as overdue (common UX pattern)\n- Visual indicator (red) is universally understood\n- Subtle styling (border-left + text color) doesn't overwhelm UI\n\n### Pattern 3: Sorting with Nullable Due Dates\n\n**What:** Sort todos by due date, placing tasks without due dates at the end\n**When:** On every render (after state changes)\n**Example:**\n\n```javascript\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - sort chronologically\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Tasks with due dates come before tasks without\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain creation order\n    return 0\n  })\n}\n```\n\n**Why this approach:**\n- Tasks with deadlines are more urgent (should appear first)\n- Null dates at the end prevents them from interrupting sorted order\n- Stable sort (maintains original order for equal priorities)\n- Simple comparison using Date subtraction (milliseconds)\n\n### Pattern 4: Date Display Formatting\n\n**What:** Format dates in user's locale with Intl.DateTimeFormat\n**When:** On render\n**Example:**\n\n```javascript\n// Create formatter once (reuse for performance)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return dateFormatter.format(date)\n}\n\n// Examples:\n// en-US: \"Mar 15, 2026\"\n// en-GB: \"15 Mar 2026\"\n// de-DE: \"15.03.2026\"\n// ja-JP: \"2026年3月15日\"\n```\n\n**Why Intl.DateTimeFormat:**\n- Automatic locale detection (uses browser settings)\n- No manual formatting logic\n- Handles all edge cases (different calendars, numbering systems)\n- More efficient than toLocaleDateString() for repeated use\n\n### Anti-Patterns to Avoid\n\n- **Comparing dates without normalizing time:** Leads to false overdue detection due to time components\n- **Using `new Date(dateString)` without time component:** Date-only strings interpreted as UTC, causes timezone bugs\n- **Sorting null dates as 0 or epoch:** Clusters all no-date tasks at start (wrong UX)\n- **Showing overdue indicator on completed tasks:** Confusing UX - task is done, deadline irrelevant\n- **Storing date with time component:** Over-complicates comparison, user only cares about day\n- **Using toLocaleDateString() in render loop:** Creates new formatter every time, inefficient\n\n## Don't Hand-Roll\n\nProblems that look simple but have established solutions:\n\n| Problem | Don't Build | Use Instead | Why |\n|---------|-------------|-------------|-----|\n| Date picker UI | Custom calendar widget | `<input type=\"date\">` | Native, accessible, no code, consistent with OS |\n| Date formatting | Manual string concatenation | Intl.DateTimeFormat | Handles all locales, edge cases, calendars |\n| Timezone handling | Manual offset calculations | Store date-only + compare at start-of-day | Avoids timezone complexity entirely |\n| Date validation | Custom regex/parser | Native date input validation | Built-in min/max, required, invalid states |\n\n**Key insight:** Date handling is notoriously error-prone. Use native APIs and simple patterns (date-only, start-of-day comparison) to avoid timezone bugs.\n\n## Common Pitfalls\n\n### Pitfall 1: Timezone Bugs with Date-Only Strings\n**What goes wrong:** Task due \"2026-03-02\" shows as overdue on March 2nd due to timezone conversion\n**Why it happens:** `new Date('2026-03-02')` interprets as UTC midnight, which may be previous day in local timezone\n**How to avoid:** Always add time component: `new Date('2026-03-02' + 'T00:00:00')`\n```javascript\n// ❌ Wrong - timezone issues\nconst dueDate = new Date(todo.dueDate)\n\n// ✅ Correct - local timezone\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\n```\n**Warning signs:** Tasks show as overdue one day early, date display doesn't match input value\n\n### Pitfall 2: Overdue Detection Without Time Normalization\n**What goes wrong:** Task due today shows as overdue in the afternoon\n**Why it happens:** `new Date()` includes current time (e.g., 14:30), due date is midnight (00:00)\n**How to avoid:** Compare both dates at start-of-day (00:00:00)\n```javascript\n// ❌ Wrong - time component causes false positives\nconst today = new Date()\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\nreturn dueDate < today // FALSE POSITIVE if today is 14:30\n\n// ✅ Correct - compare at start of day\nconst today = new Date()\ntoday.setHours(0, 0, 0, 0)\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\ndueDate.setHours(0, 0, 0, 0)\nreturn dueDate < today\n```\n**Warning signs:** Tasks show overdue mid-day on due date\n\n### Pitfall 3: Null Dates Sorted as Epoch (1970)\n**What goes wrong:** Tasks without due dates appear first in sorted list (treated as Jan 1, 1970)\n**Why it happens:** `new Date(null)` returns epoch date\n**How to avoid:** Explicit null handling in sort comparator\n```javascript\n// ❌ Wrong - null becomes epoch\ntodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))\n\n// ✅ Correct - null dates last\ntodos.sort((a, b) => {\n  if (a.dueDate && b.dueDate) {\n    return new Date(a.dueDate) - new Date(b.dueDate)\n  }\n  if (a.dueDate && !b.dueDate) return -1\n  if (!a.dueDate && b.dueDate) return 1\n  return 0\n})\n```\n**Warning signs:** Tasks without due dates cluster at top of list\n\n### Pitfall 4: Completed Tasks Show Overdue\n**What goes wrong:** Completed task with past due date still shows red/overdue styling\n**Why it happens:** Overdue check doesn't exclude completed tasks\n**How to avoid:** Check completion status before overdue detection\n```javascript\n// ❌ Wrong - completed tasks can be overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n\n// ✅ Correct - completed tasks never overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n```\n**Warning signs:** Completed tasks have red styling, confusing users\n\n### Pitfall 5: Inefficient Date Formatting in Render Loop\n**What goes wrong:** Performance issues with large todo lists (> 100 items)\n**Why it happens:** Creating new Intl.DateTimeFormat instance on every render\n**How to avoid:** Create formatter once, reuse\n```javascript\n// ❌ Wrong - new formatter every call\nfunction formatDate(dateString) {\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short', day: 'numeric', year: 'numeric'\n  }).format(new Date(dateString + 'T00:00:00'))\n}\n\n// ✅ Correct - reuse formatter\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short', day: 'numeric', year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n```\n**Warning signs:** Slow rendering with many todos\n\n### Pitfall 6: Date Input Value Format Mismatch\n**What goes wrong:** Date input shows wrong date or fails to set value\n**Why it happens:** Native date input expects `YYYY-MM-DD` format exactly\n**How to avoid:** Store dates in ISO format, set input.value directly\n```javascript\n// ❌ Wrong - wrong format\ndateInput.value = '03/15/2026' // MM/DD/YYYY - won't work\ndateInput.value = 'March 15, 2026' // won't work\n\n// ✅ Correct - ISO format\ndateInput.value = '2026-03-15' // YYYY-MM-DD\ndateInput.value = todo.dueDate || '' // empty string if null\n```\n**Warning signs:** Date input shows blank or incorrect date\n\n## Code Examples\n\n### Complete Due Date Integration (main.js)\n\n```javascript\n// State extension (todos already exists)\n// Date formatter (create once)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n\n// Date formatting\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n\n// Sort by due date (earliest first, null last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    return 0\n  })\n}\n\n// Set due date\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null\n  storage.save(todos)\n  render()\n}\n\n// Update render function\nfunction render() {\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  if (displayTodos.length === 0) {\n    renderEmptyState()\n    return\n  }\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = document.createElement('li')\n    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`\n    \n    li.innerHTML = `\n      <button class=\"toggle-btn\" data-id=\"${todo.id}\" \n              aria-label=\"Mark as ${todo.completed ? 'incomplete' : 'complete'}\"\n              aria-checked=\"${todo.completed}\">\n        ${todo.completed ? '✓' : ''}\n      </button>\n      \n      <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n      \n      <input \n        type=\"date\" \n        class=\"due-date-input\"\n        value=\"${todo.dueDate || ''}\"\n        data-id=\"${todo.id}\"\n        aria-label=\"Due date\"\n      />\n      \n      <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n        ${formatDate(todo.dueDate)}\n      </span>\n      \n      <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n      <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n    `\n    \n    todoList.appendChild(li)\n  })\n}\n\n// Event listeners (add to existing delegation)\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n## State of the Art\n\n| Old Approach | Current Approach | When Changed | Impact |\n|--------------|------------------|--------------|--------|\n| Custom date picker libraries | Native HTML5 date input | 2021 (baseline support) | Less code, better accessibility, consistent UX |\n| toLocaleDateString() for formatting | Intl.DateTimeFormat | 2016+ | Better performance, more options |\n| Manual timezone handling | Date-only + start-of-day comparison | Best practice | Avoids timezone bugs entirely |\n| Sorting null dates as epoch | Explicit null handling | Best practice | Better UX (null dates last) |\n\n**Deprecated/outdated:**\n- Using jQuery UI datepicker: Replaced by native date input\n- Storing dates as timestamps: Over-complicates date-only use case\n- Custom timezone logic: Error-prone, better to avoid with date-only approach\n- Parsing dates with regex: Use native Date constructor with ISO format\n\n## Open Questions\n\nThings that couldn't be fully resolved:\n\n1. **Should we show date input always or only on hover/edit?**\n   - What we know: Always visible provides clear affordance\n   - What's unclear: Does it clutter the UI for tasks without due dates?\n   - Recommendation: Always visible, use compact styling (date input can be small)\n\n2. **Should overdue detection consider timezone?**\n   - What we know: Start-of-day comparison avoids most issues\n   - What's unclear: Edge cases with DST transitions, timezone changes\n   - Recommendation: Accept local timezone comparison (user's perspective), document limitation\n\n3. **Should we add time-of-day support in future?**\n   - What we know: Date-only is simpler, covers most use cases\n   - What's unclear: Do users need specific deadlines (e.g., \"5 PM\")?\n   - Recommendation: Keep date-only for MVP, add time support as future enhancement if requested\n\n## Sources\n\n### Primary (HIGH confidence)\n- MDN Web Docs - HTML input type=\"date\" (official documentation, verified 2025-12-08)\n- MDN Web Docs - JavaScript Date object (official reference, verified 2025-12-08)\n- MDN Web Docs - Intl.DateTimeFormat (official documentation, verified 2025-07-10)\n- MDN Web Docs - aria-invalid attribute (accessibility validation, verified 2025-06-02)\n- W3C HTML5 Specification - Date state (input type=date)\n- DigitalOcean Community - Understanding Date and Time in JavaScript (tutorial, 2021-08-25)\n\n### Secondary (MEDIUM confidence)\n- MDN Web Docs - Date and time formats used in HTML\n- ISO 8601 standard (date format specification)\n\n### Tertiary (LOW confidence)\n- None - all recommendations based on official MDN documentation and established patterns\n\n## Metadata\n\n**Confidence breakdown:**\n- Standard stack: HIGH - Based on native HTML5 and JavaScript APIs, no external dependencies\n- Architecture: HIGH - Extends existing patterns from chapters 1-4, follows date handling best practices\n- Accessibility: HIGH - Native date input provides built-in accessibility, aria-invalid for validation\n- Pitfalls: HIGH - Common date handling mistakes documented in MDN and industry blogs, verified against existing codebase\n\n**Research date:** 2026-03-02\n**Valid until:** 90 days (stable web standards, date handling patterns well-established)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01",
          "name": "chapter-5-due-dates-plan-01",
          "kind": "feature",
          "summary": "{\n  \"objective\": \"Extend todo data model with due dates and implement date utility functions\",\n  \"purpose\": \"Establish foundation for time-based task management with proper date handling\",\n  \"output\": \"Working date utilities that can be tested via browser console\",\n  \"chapter\": \"chapter-5-due-dates\",\n  \"plan_number\": 1,\n  \"batch\": 1,\n  \"depends_on\": [],\n  \"autonomous\": true,\n  \"files_modified\": [\"src/main.js\"],\n  \"requirements\": {\n    \"truths\": [\n      \"Due dates can be stored and retrieved from the todo data model\",\n      \"Tasks can be sorted by due date with null dates appearing last\",\n      \"Overdue detection correctly identifies past-due incomplete tasks\",\n      \"Dates are formatted for human-readable display\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"Date utilities and extended todo model\",\n        \"exports\": [\"setDueDate\", \"formatDate\", \"isTodoOverdue\", \"getDisplayTodos\"],\n        \"modifications\": \"Add dueDate field to todo objects, add utility functions, integrate sort into render\"\n      }\n    ],\n    \"key_links\": [\n      {\n        \"from\": \"setDueDate\",\n        \"to\": \"storage.save\",\n        \"via\": \"direct call after state mutation\",\n        \"pattern\": \"storage.save(todos)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"getDisplayTodos\",\n        \"via\": \"call at render start\",\n        \"pattern\": \"const displayTodos = getDisplayTodos()\"\n      }\n    ]\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Extend todo model and add setDueDate function\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects in the form submit handler. Create setDueDate(todoId, dateString) function that finds todo by id, updates todo.dueDate to dateString or null (if empty), calls storage.save(todos), and calls render(). Follow existing pattern from toggle/delete operations. The dueDate field should default to null for backward compatibility with existing todos.\",\n      \"verify\": \"In browser console: Add a new todo, then run setDueDate(todoId, '2026-03-15'), check that localStorage contains the dueDate field and todo list re-renders\",\n      \"done\": \"New todos have dueDate: null field, setDueDate function persists changes to localStorage and triggers re-render\"\n    },\n    {\n      \"name\": \"Implement date utility functions\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Create three utility functions:\\n\\n1. isTodoOverdue(todo) - Returns false if !todo.dueDate OR todo.completed (critical: completed tasks never overdue). Normalize dates to start-of-day: today.setHours(0,0,0,0) and dueDate = new Date(todo.dueDate + 'T00:00:00') (avoids timezone bugs). Return dueDate < today.\\n\\n2. formatDate(dateString) - Returns empty string if !dateString. Create dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) at module level (reuse for performance). Return dateFormatter.format(new Date(dateString + 'T00:00:00')).\\n\\n3. getDisplayTodos() - Copy todos array [...todos], sort with comparator: if both have dueDate, return new Date(a.dueDate) - new Date(b.dueDate); if only a has dueDate return -1; if only b has dueDate return 1; else return 0 (null dates last, maintain original order). Return sorted array.\",\n      \"verify\": \"In browser console: Test isTodoOverdue with past date (should return true), future date (false), completed task (false), null date (false). Test formatDate('2026-03-15') returns formatted string. Test getDisplayTodos() returns sorted array with null dates at end.\",\n      \"done\": \"All three utility functions work correctly with proper timezone handling, null handling, and sorting behavior\"\n    },\n    {\n      \"name\": \"Integrate sort into render function\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Update render() function to use getDisplayTodos(): const displayTodos = getDisplayTodos(). Replace direct 'todos' references in render with 'displayTodos'. This ensures the UI always shows tasks sorted by due date. No changes to filter logic - getDisplayTodos should apply after any filter (or integrate into existing getDisplayTodos if using filter pattern from Chapter 4).\",\n      \"verify\": \"Create multiple todos with different due dates and null dates, verify they appear in sorted order (earliest first, null last) in the UI\",\n      \"done\": \"Todo list displays in sorted order by due date, null dates appear at the end\"\n    }\n  ]\n}\n\n# Plan 01: Data Model & Date Utilities\n\n**Objective:** Extend todo data model with due dates and implement date utility functions\n\n**Purpose:** Establish foundation for time-based task management with proper date handling\n\n**Output:** Working date utilities that can be tested via browser console\n\n## Requirements\n\n### Observable Truths\n- Due dates can be stored and retrieved from the todo data model\n- Tasks can be sorted by due date with null dates appearing last\n- Overdue detection correctly identifies past-due incomplete tasks\n- Dates are formatted for human-readable display\n\n### Artifacts\n- **src/main.js** - Date utilities and extended todo model\n  - Exports: setDueDate, formatDate, isTodoOverdue, getDisplayTodos\n  - Modifications: Add dueDate field, add utility functions, integrate sort\n\n### Key Links\n- setDueDate → storage.save → render (state mutation flow)\n- render → getDisplayTodos (sorted display)\n\n## Tasks\n\n### Task 1: Extend todo model and add setDueDate function\n**Files:** src/main.js\n**Action:** Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects. Create setDueDate(todoId, dateString) function following existing CRUD patterns.\n**Verify:** Console test: setDueDate(todoId, '2026-03-15') persists to localStorage\n**Done:** New todos have dueDate field, setDueDate function works\n\n### Task 2: Implement date utility functions\n**Files:** src/main.js\n**Action:** Create isTodoOverdue (timezone-safe), formatDate (Intl.DateTimeFormat), getDisplayTodos (sorted, null dates last)\n**Verify:** Console tests for each function\n**Done:** All utilities work correctly with proper edge case handling\n\n### Task 3: Integrate sort into render function\n**Files:** src/main.js\n**Action:** Update render() to use getDisplayTodos() for sorted display\n**Verify:** Create todos with different due dates, verify sorted order in UI\n**Done:** Todo list displays sorted by due date\n\n## Execution\n\n**Batch:** 1\n**Autonomous:** Yes\n**Depends on:** Nothing"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02",
          "name": "chapter-5-due-dates-plan-02",
          "kind": "feature",
          "summary": "{\n  \"objective\": \"Add date picker UI, overdue styling, and formatted date display\",\n  \"purpose\": \"Complete user-facing due date feature with visual feedback for overdue tasks\",\n  \"output\": \"Working date picker with overdue indicators and date formatting in UI\",\n  \"chapter\": \"chapter-5-due-dates\",\n  \"plan_number\": 2,\n  \"batch\": 2,\n  \"depends_on\": [\"chapter-5-due-dates-plan-01\"],\n  \"autonomous\": true,\n  \"files_modified\": [\"src/main.js\", \"src/style.css\"],\n  \"requirements\": {\n    \"truths\": [\n      \"User can see a date picker input for each task\",\n      \"User can select a due date using the native date picker\",\n      \"User sees overdue tasks highlighted in red\",\n      \"User sees formatted date display (not YYYY-MM-DD)\",\n      \"Completed tasks are never marked as overdue\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"Date picker integration and event handling\",\n        \"modifications\": \"Add date input to render, add change event listener, integrate formatDate and isTodoOverdue\"\n      },\n      {\n        \"path\": \"src/style.css\",\n        \"provides\": \"Overdue task styling\",\n        \"modifications\": \"Add .overdue class with red border-left and text color\"\n      }\n    ],\n    \"key_links\": [\n      {\n        \"from\": \"date input onChange\",\n        \"to\": \"setDueDate\",\n        \"via\": \"event delegation\",\n        \"pattern\": \"todoList.addEventListener('change', ...)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"isTodoOverdue\",\n        \"via\": \"call for each todo\",\n        \"pattern\": \"const isOverdue = isTodoOverdue(todo)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"formatDate\",\n        \"via\": \"display formatted date\",\n        \"pattern\": \"${formatDate(todo.dueDate)}\"\n      }\n    ]\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Add date picker to todo item rendering\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"In the render() function's todo item HTML, add:\\n1. Native date input: <input type=\\\"date\\\" class=\\\"due-date-input\\\" value=\\\"${todo.dueDate || ''}\\\" data-id=\\\"${todo.id}\\\" aria-label=\\\"Due date\\\"> (value uses YYYY-MM-DD format, empty string if null)\\n2. Formatted date display: <span class=\\\"due-date-display ${isOverdue ? 'overdue' : ''}\\\">${formatDate(todo.dueDate)}</span> (call isTodoOverdue(todo) at start of loop, use formatDate for display)\\n3. Add isOverdue to li classList: class=\\\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\\\"\\n\\nPlace date input and display between todo text and edit/delete buttons. Input is always visible (research recommendation).\",\n      \"verify\": \"Add a todo, verify date picker appears for each todo item. Set a date, verify formatted date appears next to input.\",\n      \"done\": \"Each todo item shows a date picker and formatted date display\"\n    },\n    {\n      \"name\": \"Add change event handler for date picker\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Add event delegation handler to todoList for date input changes:\\n\\ntodoList.addEventListener('change', (e) => {\\n  if (e.target.matches('.due-date-input')) {\\n    const todoId = e.target.dataset.id\\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\\n    setDueDate(todoId, dateString) // already handles storage.save and render\\n  }\\n})\\n\\nPlace this with other event listeners (toggle, delete, edit). Native date input fires 'change' event when user selects a date.\",\n      \"verify\": \"Set a due date for a todo, verify it persists on page refresh and sorts correctly\",\n      \"done\": \"Date picker changes persist to localStorage and trigger re-render with sorted order\"\n    },\n    {\n      \"name\": \"Add overdue task styling\",\n      \"type\": \"auto\",\n      \"files\": [\"src/style.css\"],\n      \"action\": \"Add CSS rules for overdue tasks:\\n\\n.todo-item.overdue {\\n  border-left: 3px solid var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .todo-text,\\n.todo-item.overdue .due-date-display {\\n  color: var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .due-date-display::before {\\n  content: '⚠ ';\\n}\\n\\nUse CSS custom property for danger color if exists (from Chapter 1), otherwise use #ef4444 (red). The border-left creates a subtle visual indicator without overwhelming the UI. Completed tasks should never have .overdue class (isTodoOverdue returns false for completed).\",\n      \"verify\": \"Create a todo with a past due date, verify it shows red border and text. Complete the task, verify red styling disappears. Create a todo with future due date, verify no red styling.\",\n      \"done\": \"Overdue tasks display red border-left and text color with warning icon, completed tasks never show overdue styling\"\n    }\n  ]\n}\n\n# Plan 02: Date Picker UI & Overdue Styling\n\n**Objective:** Add date picker UI, overdue styling, and formatted date display\n\n**Purpose:** Complete user-facing due date feature with visual feedback for overdue tasks\n\n**Output:** Working date picker with overdue indicators and date formatting in UI\n\n## Requirements\n\n### Observable Truths\n- User can see a date picker input for each task\n- User can select a due date using the native date picker\n- User sees overdue tasks highlighted in red\n- User sees formatted date display (not YYYY-MM-DD)\n- Completed tasks are never marked as overdue\n\n### Artifacts\n- **src/main.js** - Date picker integration and event handling\n- **src/style.css** - Overdue task styling\n\n### Key Links\n- date input onChange → setDueDate → render (user interaction flow)\n- render → isTodoOverdue (visual feedback)\n- render → formatDate (date display)\n\n## Tasks\n\n### Task 1: Add date picker to todo item rendering\n**Files:** src/main.js\n**Action:** Add native date input and formatted date display to render() function\n**Verify:** Date picker appears for each todo, formatted date displays\n**Done:** Each todo shows date picker and formatted date\n\n### Task 2: Add change event handler for date picker\n**Files:** src/main.js\n**Action:** Add event delegation for .due-date-input changes\n**Verify:** Date selection persists and triggers sort\n**Done:** Date picker changes save and re-render\n\n### Task 3: Add overdue task styling\n**Files:** src/style.css\n**Action:** Add .overdue class with red border-left and text color\n**Verify:** Overdue tasks show red styling, completed tasks don't\n**Done:** Visual indicator for overdue tasks works correctly\n\n## Execution\n\n**Batch:** 2\n**Autonomous:** Yes\n**Depends on:** Plan 01"
        }
      ],
      "edges": [],
      "incoming_edges": [
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "from_name": "chapter-5-due-dates-research",
          "relation": "connects_to",
          "description": "Research findings connect to and inform planning for Chapter 5 implementation"
        },
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01",
          "from_name": "chapter-5-due-dates-plan-01",
          "relation": "implements",
          "description": "Plan 01 implements chapter 5 due dates feature"
        },
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02",
          "from_name": "chapter-5-due-dates-plan-02",
          "relation": "implements",
          "description": "Plan 02 implements chapter 5 due dates feature UI layer"
        }
      ],
      "parent": {
        "id": "main/roadmap",
        "name": "roadmap"
      },
      "similarity": 0.6130737576376675
    },
    {
      "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
      "name": "chapter-5-due-dates-research",
      "kind": "pattern",

...214091 bytes truncated...

The tool call succeeded but the output was truncated. Full output saved to: /Users/mikaelj/.local/share/opencode/tool-output/tool_caec63bf0001IZXl2mPv0mhrl0
Use the Task tool to have explore agent process this file with Grep and Read (with offset/limit). Do NOT read the full file yourself - delegate to save context.
```

---

## Assistant (Fuska-Planner · glm-5 · 252.9s)

**Tool: task**

**Input:**
```json
{
  "description": "Verify Chapter 5 plans",
  "prompt": "<objective>\nVerify Chapter 5 plans against quality dimensions to ensure they will achieve the chapter goal\n</objective>\n\n<chapter_data>\n{\n  \"name\": \"chapter-5-due-dates\",\n  \"goal\": \"Users can track deadlines and prioritize time-sensitive tasks\",\n  \"success_criteria\": [\n    \"User can set a due date for any task using a date picker\",\n    \"User sees visual indicator (red highlight) for overdue tasks\",\n    \"User can sort task list by due date (earliest first)\"\n  ]\n}\n</chapter_data>\n\n<plans>\n[\n  {\n    \"id\": \"main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01\",\n    \"name\": \"chapter-5-due-dates-plan-01\",\n    \"batch\": 1,\n    \"depends_on\": [],\n    \"autonomous\": true,\n    \"files_modified\": [\"src/main.js\"],\n    \"objective\": \"Extend todo data model with due dates and implement date utility functions\",\n    \"tasks\": [\n      {\n        \"name\": \"Extend todo model and add setDueDate function\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects in the form submit handler. Create setDueDate(todoId, dateString) function that finds todo by id, updates todo.dueDate to dateString or null (if empty), calls storage.save(todos), and calls render(). Follow existing pattern from toggle/delete operations. The dueDate field should default to null for backward compatibility with existing todos.\",\n        \"verify\": \"In browser console: Add a new todo, then run setDueDate(todoId, '2026-03-15'), check that localStorage contains the dueDate field and todo list re-renders\",\n        \"done\": \"New todos have dueDate: null field, setDueDate function persists changes to localStorage and triggers re-render\"\n      },\n      {\n        \"name\": \"Implement date utility functions\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Create three utility functions:\\n\\n1. isTodoOverdue(todo) - Returns false if !todo.dueDate OR todo.completed (critical: completed tasks never overdue). Normalize dates to start-of-day: today.setHours(0,0,0,0) and dueDate = new Date(todo.dueDate + 'T00:00:00') (avoids timezone bugs). Return dueDate < today.\\n\\n2. formatDate(dateString) - Returns empty string if !dateString. Create dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) at module level (reuse for performance). Return dateFormatter.format(new Date(dateString + 'T00:00:00')).\\n\\n3. getDisplayTodos() - Copy todos array [...todos], sort with comparator: if both have dueDate, return new Date(a.dueDate) - new Date(b.dueDate); if only a has dueDate return -1; if only b has dueDate return 1; else return 0 (null dates last, maintain original order). Return sorted array.\",\n        \"verify\": \"In browser console: Test isTodoOverdue with past date (should return true), future date (false), completed task (false), null date (false). Test formatDate('2026-03-15') returns formatted string. Test getDisplayTodos() returns sorted array with null dates at end.\",\n        \"done\": \"All three utility functions work correctly with proper timezone handling, null handling, and sorting behavior\"\n      },\n      {\n        \"name\": \"Integrate sort into render function\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Update render() function to use getDisplayTodos(): const displayTodos = getDisplayTodos(). Replace direct 'todos' references in render with 'displayTodos'. This ensures the UI always shows tasks sorted by due date. No changes to filter logic - getDisplayTodos should apply after any filter (or integrate into existing getDisplayTodos if using filter pattern from Chapter 4).\",\n        \"verify\": \"Create multiple todos with different due dates and null dates, verify they appear in sorted order (earliest first, null last) in the UI\",\n        \"done\": \"Todo list displays in sorted order by due date, null dates appear at the end\"\n      }\n    ],\n    \"requirements\": {\n      \"truths\": [\n        \"Due dates can be stored and retrieved from the todo data model\",\n        \"Tasks can be sorted by due date with null dates appearing last\",\n        \"Overdue detection correctly identifies past-due incomplete tasks\",\n        \"Dates are formatted for human-readable display\"\n      ]\n    }\n  },\n  {\n    \"id\": \"main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02\",\n    \"name\": \"chapter-5-due-dates-plan-02\",\n    \"batch\": 2,\n    \"depends_on\": [\"chapter-5-due-dates-plan-01\"],\n    \"autonomous\": true,\n    \"files_modified\": [\"src/main.js\", \"src/style.css\"],\n    \"objective\": \"Add date picker UI, overdue styling, and formatted date display\",\n    \"tasks\": [\n      {\n        \"name\": \"Add date picker to todo item rendering\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"In the render() function's todo item HTML, add:\\n1. Native date input: <input type=\\\"date\\\" class=\\\"due-date-input\\\" value=\\\"${todo.dueDate || ''}\\\" data-id=\\\"${todo.id}\\\" aria-label=\\\"Due date\\\"> (value uses YYYY-MM-DD format, empty string if null)\\n2. Formatted date display: <span class=\\\"due-date-display ${isOverdue ? 'overdue' : ''}\\\">${formatDate(todo.dueDate)}</span> (call isTodoOverdue(todo) at start of loop, use formatDate for display)\\n3. Add isOverdue to li classList: class=\\\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\\\"\\n\\nPlace date input and display between todo text and edit/delete buttons. Input is always visible (research recommendation).\",\n        \"verify\": \"Add a todo, verify date picker appears for each todo item. Set a date, verify formatted date appears next to input.\",\n        \"done\": \"Each todo item shows a date picker and formatted date display\"\n      },\n      {\n        \"name\": \"Add change event handler for date picker\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Add event delegation handler to todoList for date input changes:\\n\\ntodoList.addEventListener('change', (e) => {\\n  if (e.target.matches('.due-date-input')) {\\n    const todoId = e.target.dataset.id\\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\\n    setDueDate(todoId, dateString) // already handles storage.save and render\\n  }\\n})\\n\\nPlace this with other event listeners (toggle, delete, edit). Native date input fires 'change' event when user selects a date.\",\n        \"verify\": \"Set a due date for a todo, verify it persists on page refresh and sorts correctly\",\n        \"done\": \"Date picker changes persist to localStorage and trigger re-render with sorted order\"\n      },\n      {\n        \"name\": \"Add overdue task styling\",\n        \"type\": \"auto\",\n        \"files\": [\"src/style.css\"],\n        \"action\": \"Add CSS rules for overdue tasks:\\n\\n.todo-item.overdue {\\n  border-left: 3px solid var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .todo-text,\\n.todo-item.overdue .due-date-display {\\n  color: var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .due-date-display::before {\\n  content: '⚠ ';\\n}\\n\\nUse CSS custom property for danger color if exists (from Chapter 1), otherwise use #ef4444 (red). The border-left creates a subtle visual indicator without overwhelming the UI. Completed tasks should never have .overdue class (isTodoOverdue returns false for completed).\",\n        \"verify\": \"Create a todo with a past due date, verify it shows red border and text. Complete the task, verify red styling disappears. Create a todo with future due date, verify no red styling.\",\n        \"done\": \"Overdue tasks display red border-left and text color with warning icon, completed tasks never show overdue styling\"\n      }\n    ],\n    \"requirements\": {\n      \"truths\": [\n        \"User can see a date picker input for each task\",\n        \"User can select a due date using the native date picker\",\n        \"User sees overdue tasks highlighted in red\",\n        \"User sees formatted date display (not YYYY-MM-DD)\",\n        \"Completed tasks are never marked as overdue\"\n      ]\n    }\n  }\n]\n</plans>\n\n<verification_dimensions>\nCheck each plan against:\n1. **Requirement coverage** - Does the plan address all requirements needed for the goal?\n2. **Task completeness** - Does each task have: name, type, files, action, verify, done?\n3. **Dependency correctness** - Are dependencies correctly identified? Are batches valid?\n4. **Key links planned** - Are critical connections between components identified?\n5. **Scope sanity** - Is the plan scope reasonable (2-3 tasks, ~50% context budget)?\n6. **Requirements derivation** - Are requirements properly derived from goal-backward analysis?\n</verification_dimensions>\n\n<output>\nReturn:\n- ## VERIFICATION PASSED (if all plans pass)\n- ## ISSUES FOUND (with structured issues list)\n\nFor each issue, provide:\n- plan: which plan has the issue\n- dimension: which dimension failed\n- severity: blocker | warning\n- description: what's wrong\n- fix_hint: how to fix it\n</output>",
  "subagent_type": "fuska-plan-checker-panel"
}
```

**Output:**
```
task_id: ses_35138a11affeK6iqzkPVqLm5dg (for resuming to continue this task if needed)

<task_result>
Now I'll determine panel composition and run verification.

**Panel composition analysis:**

- **Base:** quality-advocate (always runs)
- **Contextual:** security-auditor (web app with user input handling)
- **Expert:** data-architect (keywords matched: "model", "data model", storage operations)

Now running multi-dimensional verification:

## PLAN VERIFICATION REPORT

**Chapter:** chapter-5-due-dates  
**Goal:** Users can track deadlines and prioritize time-sensitive tasks  
**Plans verified:** 2  
**Checkers run:** quality-advocate, security-auditor, data-architect  
**Issues:** 0 critical, 1 high, 2 medium, 0 low

---

### VERIFICATION SUMMARY

Chapter 5 plans are **WELL-STRUCTURED** with minor integration concerns that should be addressed during implementation.

✅ **All success criteria covered** by the plans  
✅ **Task completeness** - all tasks have required fields  
✅ **Dependency correctness** - proper batch ordering  
✅ **Key links identified** - state flow documented  
✅ **Scope sanity** - reasonable task counts  
✅ **Requirements derivation** - proper goal-backward analysis

---

### ISSUES FOUND

#### High Priority

**1. [task_completeness] Filter + Sort integration unclear**
- **Plan:** chapter-5-due-dates-plan-01
- **Task:** 3 (Integrate sort into render function)
- **Dimension:** errors
- **Checkers:** quality-advocate, data-architect
- **Severity:** high
- **Description:** Task 3 says "No changes to filter logic - getDisplayTodos should apply after any filter (or integrate into existing getDisplayTodos if using filter pattern from Chapter 4)". This is ambiguous - Chapter 4 has getFilteredTodos(), and it's unclear whether getDisplayTodos() should replace it, wrap it, or coexist with it.
- **Fix Hint:** Clarify the integration strategy: "Update getDisplayTodos() to apply getFilteredTodos() first, then sort. Pattern: const filtered = getFilteredTodos(todos, currentFilter); return filtered.sort(...)" OR "Rename getDisplayTodos to getSortedTodos and call after getFilteredTodos in render()".

---

#### Medium Priority

**2. [completeness] CSS custom property dependency assumed**
- **Plan:** chapter-5-due-dates-plan-02
- **Task:** 3 (Add overdue task styling)
- **Dimension:** maintainability
- **Severity:** medium
- **Description:** CSS uses var(--color-danger, #ef4444) with fallback, but task assumes "if exists (from Chapter 1)". Chapter 1 verification doesn't show --color-danger custom property defined. While the fallback ensures it works, this creates a disconnect.
- **Fix Hint:** Either: (a) Add "Verify or create --color-danger custom property in :root" to the task action, or (b) Change CSS to use #ef4444 directly with a comment "Future: extract to --color-danger custom property".

**3. [completeness] Backward compatibility handling**
- **Plan:** chapter-5-due-dates-plan-01
- **Task:** 1 (Extend todo model and add setDueDate function)
- **Dimension:** errors
- **Severity:** medium
- **Description:** Task mentions "dueDate field should default to null for backward compatibility with existing todos" but only applies to NEW todos. Existing todos loaded from localStorage won't have the field, which could cause issues with formatDate(null) and sorting (though both handle null correctly).
- **Fix Hint:** Add migration logic or note: "When loading todos from localStorage, ensure missing dueDate fields are set to null (storage.load should handle this, or add migration step)."

---

### STRUCTURED ISSUES (YAML)

```yaml
issues:
  - plan: "chapter-5-due-dates-plan-01"
    task: 3
    severity: high
    dimension: errors
    cross_validated: true
    checkers: ["quality-advocate", "data-architect"]
    description: "Filter + Sort integration strategy unclear - task mentions 'integrate into existing getDisplayTodos if using filter pattern from Chapter 4' but Chapter 4 uses getFilteredTodos(). Need to clarify whether to rename, wrap, or replace."
    fix_hint: "Specify integration pattern: getDisplayTodos() calls getFilteredTodos() first, then sorts. Or use separate getSortedTodos() called after getFilteredTodos() in render()."
    
  - plan: "chapter-5-due-dates-plan-02"
    task: 3
    severity: medium
    dimension: maintainability
    checkers: ["quality-advocate"]
    description: "CSS assumes --color-danger custom property exists from Chapter 1, but verification shows it's not defined. Fallback works but creates disconnect."
    fix_hint: "Add verification step to task or use direct color value with future extraction comment."
    
  - plan: "chapter-5-due-dates-plan-01"
    task: 1
    severity: medium
    dimension: errors
    checkers: ["data-architect"]
    description: "Backward compatibility only addresses new todos. Existing localStorage todos without dueDate field need null default on load."
    fix_hint: "Add note about storage.load handling missing fields or add migration step to set null defaults."
```

---

### RECOMMENDATIONS

**Before execution:**
1. **HIGH:** Clarify filter + sort integration (Issue #1) - this affects the core implementation approach
2. **MEDIUM:** Verify CSS custom property approach (Issue #2)
3. **MEDIUM:** Confirm backward compatibility strategy (Issue #3)

**Overall assessment:** Plans are well-structured and cover all requirements. Issues are implementation details that can be resolved during execution but should be clarified to avoid confusion.

---

### READY FOR EXECUTION?

**Proceed with caution.** Address Issue #1 (filter/sort integration) before starting Plan 01, Task 3. Issues #2 and #3 can be addressed during implementation.

Run `/fuska-build chapter-5-due-dates` when ready.
</task_result>
```

---

## Assistant (Fuska-Planner · glm-5 · 11.9s)

The checker found some issues. Let me send the plans back for revision.

**Sending back for revision... (iteration 1/3)**

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-5-due-dates-plan",
  "top_k": 20
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-5-due-dates",
      "name": "chapter-5-due-dates",
      "kind": "feature",
      "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting",
      "why": "Due dates add organizational dimension to task management, enabling time-based prioritization",
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "name": "chapter-5-due-dates-research",
          "kind": "pattern",
          "summary": "# Chapter 5: Due Dates - Research\n\n**Researched:** 2026-03-02\n**Domain:** Date handling, date picker UI, overdue detection, sorting with dates in vanilla JS\n**Confidence:** HIGH\n\n## Summary\n\nResearch for implementing due dates in a vanilla JS todo app. This chapter adds time-based task management, enabling users to set deadlines, identify overdue tasks, and prioritize work by due date. The standard approach uses native HTML5 `<input type=\"date\">` for date selection, vanilla JavaScript Date API for comparison, and Intl.DateTimeFormat for locale-aware display. Key challenge: avoid timezone bugs by using date-only storage and start-of-day comparison.\n\n**Primary recommendation:** Use native HTML5 date input (no custom picker), store dates as `YYYY-MM-DD` strings, compare at start-of-day to avoid timezone issues, sort with null dates last, use Intl.DateTimeFormat for display, and apply red visual indicator for overdue tasks.\n\n## Standard Stack\n\nThe established libraries/tools for this chapter:\n\n### Core\n| Library | Version | Purpose | Why Standard |\n|---------|---------|---------|--------------|\n| Native HTML5 date input | HTML5 | Date picker UI | Built-in browser support since 2021, baseline widely available, accessible, no dependencies |\n| Vanilla JS Date API | ES5+ | Date comparison and manipulation | Native, no dependencies, sufficient for date-only operations |\n| Intl.DateTimeFormat | ES6 | Locale-aware date formatting | Built-in i18n support, no manual formatting |\n\n### Supporting\n| Library | Version | Purpose | When to Use |\n|---------|---------|---------|-------------|\n| CSS custom properties | CSS3 | Overdue task styling (red highlight) | Already in use from Chapter 1 |\n| Event delegation | ES6 | Date input change handling | Existing pattern from Chapters 2-4 |\n\n### Alternatives Considered\n| Instead of | Could Use | Tradeoff |\n|------------|-----------|----------|\n| Native date input | Custom date picker (flatpickr, date-fns) | 2-10KB dependency, more code, maintenance burden |\n| Vanilla Date API | date-fns, dayjs, luxon | 2-10KB dependency, overkill for simple date-only operations |\n| Intl.DateTimeFormat | toLocaleDateString() | toLocaleDateString() creates formatter each call, less efficient |\n| Date-only storage | Timestamp storage | Over-complicates comparison, timezone handling needed |\n\n**Installation:**\nNo additional dependencies needed - all functionality uses native HTML5, JavaScript, and browser APIs.\n\n## Architecture Patterns\n\n### Recommended Data Model Extension\n\n```javascript\n// Extend existing todo model\nconst todo = {\n  id: number | string,\n  text: string,\n  completed: boolean,\n  createdAt: string | number, // existing\n  dueDate: string | null // NEW: 'YYYY-MM-DD' format or null (optional)\n}\n```\n\n**Key decisions:**\n- **Format:** Store as ISO date string (`YYYY-MM-DD`) - matches native date input value format\n- **Optional:** Nullable field - tasks can exist without due dates\n- **No time component:** Date-only, no hours/minutes/seconds (simplifies comparison)\n\n### Recommended Implementation Structure\n\nExtend existing state management and render pattern:\n\n```javascript\n// Modified render function\nfunction render() {\n  // Get filtered/sorted todos\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = createTodoElement(todo, isOverdue)\n    todoList.appendChild(li)\n  })\n}\n\n// Date input handler\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null // null if empty\n  storage.save(todos)\n  render()\n}\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Compare at start of day\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00') // Avoid UTC interpretation\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today // Overdue if due date is before today\n}\n\n// Sort by due date (earliest first, null dates last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - compare them\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Only a has due date - a comes first\n    if (a.dueDate && !b.dueDate) return -1\n    // Only b has due date - b comes first\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain original order\n    return 0\n  })\n}\n\n// Format date for display\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short',\n    day: 'numeric',\n    year: 'numeric'\n  }).format(date)\n}\n```\n\n### Pattern 1: Native Date Input Integration\n\n**What:** Add `<input type=\"date\">` to each todo item for date selection\n**When:** Always - native input provides built-in picker, validation, accessibility\n**Example:**\n\n```html\n<!-- Inside todo item -->\n<li class=\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\">\n  <button class=\"toggle-btn\" data-id=\"${todo.id}\" aria-label=\"Toggle complete\">\n    ✓\n  </button>\n  \n  <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n  \n  <!-- Date input -->\n  <input \n    type=\"date\" \n    class=\"due-date-input\"\n    value=\"${todo.dueDate || ''}\"\n    data-id=\"${todo.id}\"\n    aria-label=\"Due date for ${escapeHtml(todo.text)}\"\n  />\n  \n  <!-- Formatted date display (optional, shows when input not focused) -->\n  <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n    ${todo.dueDate ? formatDate(todo.dueDate) : ''}\n  </span>\n  \n  <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n  <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n</li>\n```\n\n```javascript\n// Event delegation for date changes\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n**Key principles:**\n- Native `<input type=\"date\">` provides browser's built-in date picker\n- Value always returns `YYYY-MM-DD` format (standardized)\n- Display format adapts to user's locale automatically\n- Built-in keyboard navigation and screen reader support\n- Can be styled with CSS (though some limitations exist)\n\n### Pattern 2: Overdue Detection and Styling\n\n**What:** Compare due date to current date, apply visual indicator for overdue tasks\n**When:** On every render\n**Example:**\n\n```javascript\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Start of today\n  \n  // CRITICAL: Add time component to avoid UTC interpretation\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n```\n\n```css\n/* Overdue styling */\n.todo-item.overdue {\n  border-left: 3px solid #ef4444; /* Red accent */\n}\n\n.todo-item.overdue .due-date-display,\n.todo-item.overdue .todo-text {\n  color: #ef4444;\n}\n\n.todo-item.overdue .due-date-display::before {\n  content: '⚠ ';\n  /* Warning icon */\n}\n```\n\n**Why this approach:**\n- Uses start-of-day comparison to avoid timezone edge cases\n- Completed tasks never show as overdue (common UX pattern)\n- Visual indicator (red) is universally understood\n- Subtle styling (border-left + text color) doesn't overwhelm UI\n\n### Pattern 3: Sorting with Nullable Due Dates\n\n**What:** Sort todos by due date, placing tasks without due dates at the end\n**When:** On every render (after state changes)\n**Example:**\n\n```javascript\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - sort chronologically\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Tasks with due dates come before tasks without\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain creation order\n    return 0\n  })\n}\n```\n\n**Why this approach:**\n- Tasks with deadlines are more urgent (should appear first)\n- Null dates at the end prevents them from interrupting sorted order\n- Stable sort (maintains original order for equal priorities)\n- Simple comparison using Date subtraction (milliseconds)\n\n### Pattern 4: Date Display Formatting\n\n**What:** Format dates in user's locale with Intl.DateTimeFormat\n**When:** On render\n**Example:**\n\n```javascript\n// Create formatter once (reuse for performance)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return dateFormatter.format(date)\n}\n\n// Examples:\n// en-US: \"Mar 15, 2026\"\n// en-GB: \"15 Mar 2026\"\n// de-DE: \"15.03.2026\"\n// ja-JP: \"2026年3月15日\"\n```\n\n**Why Intl.DateTimeFormat:**\n- Automatic locale detection (uses browser settings)\n- No manual formatting logic\n- Handles all edge cases (different calendars, numbering systems)\n- More efficient than toLocaleDateString() for repeated use\n\n### Anti-Patterns to Avoid\n\n- **Comparing dates without normalizing time:** Leads to false overdue detection due to time components\n- **Using `new Date(dateString)` without time component:** Date-only strings interpreted as UTC, causes timezone bugs\n- **Sorting null dates as 0 or epoch:** Clusters all no-date tasks at start (wrong UX)\n- **Showing overdue indicator on completed tasks:** Confusing UX - task is done, deadline irrelevant\n- **Storing date with time component:** Over-complicates comparison, user only cares about day\n- **Using toLocaleDateString() in render loop:** Creates new formatter every time, inefficient\n\n## Don't Hand-Roll\n\nProblems that look simple but have established solutions:\n\n| Problem | Don't Build | Use Instead | Why |\n|---------|-------------|-------------|-----|\n| Date picker UI | Custom calendar widget | `<input type=\"date\">` | Native, accessible, no code, consistent with OS |\n| Date formatting | Manual string concatenation | Intl.DateTimeFormat | Handles all locales, edge cases, calendars |\n| Timezone handling | Manual offset calculations | Store date-only + compare at start-of-day | Avoids timezone complexity entirely |\n| Date validation | Custom regex/parser | Native date input validation | Built-in min/max, required, invalid states |\n\n**Key insight:** Date handling is notoriously error-prone. Use native APIs and simple patterns (date-only, start-of-day comparison) to avoid timezone bugs.\n\n## Common Pitfalls\n\n### Pitfall 1: Timezone Bugs with Date-Only Strings\n**What goes wrong:** Task due \"2026-03-02\" shows as overdue on March 2nd due to timezone conversion\n**Why it happens:** `new Date('2026-03-02')` interprets as UTC midnight, which may be previous day in local timezone\n**How to avoid:** Always add time component: `new Date('2026-03-02' + 'T00:00:00')`\n```javascript\n// ❌ Wrong - timezone issues\nconst dueDate = new Date(todo.dueDate)\n\n// ✅ Correct - local timezone\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\n```\n**Warning signs:** Tasks show as overdue one day early, date display doesn't match input value\n\n### Pitfall 2: Overdue Detection Without Time Normalization\n**What goes wrong:** Task due today shows as overdue in the afternoon\n**Why it happens:** `new Date()` includes current time (e.g., 14:30), due date is midnight (00:00)\n**How to avoid:** Compare both dates at start-of-day (00:00:00)\n```javascript\n// ❌ Wrong - time component causes false positives\nconst today = new Date()\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\nreturn dueDate < today // FALSE POSITIVE if today is 14:30\n\n// ✅ Correct - compare at start of day\nconst today = new Date()\ntoday.setHours(0, 0, 0, 0)\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\ndueDate.setHours(0, 0, 0, 0)\nreturn dueDate < today\n```\n**Warning signs:** Tasks show overdue mid-day on due date\n\n### Pitfall 3: Null Dates Sorted as Epoch (1970)\n**What goes wrong:** Tasks without due dates appear first in sorted list (treated as Jan 1, 1970)\n**Why it happens:** `new Date(null)` returns epoch date\n**How to avoid:** Explicit null handling in sort comparator\n```javascript\n// ❌ Wrong - null becomes epoch\ntodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))\n\n// ✅ Correct - null dates last\ntodos.sort((a, b) => {\n  if (a.dueDate && b.dueDate) {\n    return new Date(a.dueDate) - new Date(b.dueDate)\n  }\n  if (a.dueDate && !b.dueDate) return -1\n  if (!a.dueDate && b.dueDate) return 1\n  return 0\n})\n```\n**Warning signs:** Tasks without due dates cluster at top of list\n\n### Pitfall 4: Completed Tasks Show Overdue\n**What goes wrong:** Completed task with past due date still shows red/overdue styling\n**Why it happens:** Overdue check doesn't exclude completed tasks\n**How to avoid:** Check completion status before overdue detection\n```javascript\n// ❌ Wrong - completed tasks can be overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n\n// ✅ Correct - completed tasks never overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n```\n**Warning signs:** Completed tasks have red styling, confusing users\n\n### Pitfall 5: Inefficient Date Formatting in Render Loop\n**What goes wrong:** Performance issues with large todo lists (> 100 items)\n**Why it happens:** Creating new Intl.DateTimeFormat instance on every render\n**How to avoid:** Create formatter once, reuse\n```javascript\n// ❌ Wrong - new formatter every call\nfunction formatDate(dateString) {\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short', day: 'numeric', year: 'numeric'\n  }).format(new Date(dateString + 'T00:00:00'))\n}\n\n// ✅ Correct - reuse formatter\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short', day: 'numeric', year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n```\n**Warning signs:** Slow rendering with many todos\n\n### Pitfall 6: Date Input Value Format Mismatch\n**What goes wrong:** Date input shows wrong date or fails to set value\n**Why it happens:** Native date input expects `YYYY-MM-DD` format exactly\n**How to avoid:** Store dates in ISO format, set input.value directly\n```javascript\n// ❌ Wrong - wrong format\ndateInput.value = '03/15/2026' // MM/DD/YYYY - won't work\ndateInput.value = 'March 15, 2026' // won't work\n\n// ✅ Correct - ISO format\ndateInput.value = '2026-03-15' // YYYY-MM-DD\ndateInput.value = todo.dueDate || '' // empty string if null\n```\n**Warning signs:** Date input shows blank or incorrect date\n\n## Code Examples\n\n### Complete Due Date Integration (main.js)\n\n```javascript\n// State extension (todos already exists)\n// Date formatter (create once)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n\n// Date formatting\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n\n// Sort by due date (earliest first, null last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    return 0\n  })\n}\n\n// Set due date\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null\n  storage.save(todos)\n  render()\n}\n\n// Update render function\nfunction render() {\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  if (displayTodos.length === 0) {\n    renderEmptyState()\n    return\n  }\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = document.createElement('li')\n    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`\n    \n    li.innerHTML = `\n      <button class=\"toggle-btn\" data-id=\"${todo.id}\" \n              aria-label=\"Mark as ${todo.completed ? 'incomplete' : 'complete'}\"\n              aria-checked=\"${todo.completed}\">\n        ${todo.completed ? '✓' : ''}\n      </button>\n      \n      <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n      \n      <input \n        type=\"date\" \n        class=\"due-date-input\"\n        value=\"${todo.dueDate || ''}\"\n        data-id=\"${todo.id}\"\n        aria-label=\"Due date\"\n      />\n      \n      <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n        ${formatDate(todo.dueDate)}\n      </span>\n      \n      <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n      <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n    `\n    \n    todoList.appendChild(li)\n  })\n}\n\n// Event listeners (add to existing delegation)\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n## State of the Art\n\n| Old Approach | Current Approach | When Changed | Impact |\n|--------------|------------------|--------------|--------|\n| Custom date picker libraries | Native HTML5 date input | 2021 (baseline support) | Less code, better accessibility, consistent UX |\n| toLocaleDateString() for formatting | Intl.DateTimeFormat | 2016+ | Better performance, more options |\n| Manual timezone handling | Date-only + start-of-day comparison | Best practice | Avoids timezone bugs entirely |\n| Sorting null dates as epoch | Explicit null handling | Best practice | Better UX (null dates last) |\n\n**Deprecated/outdated:**\n- Using jQuery UI datepicker: Replaced by native date input\n- Storing dates as timestamps: Over-complicates date-only use case\n- Custom timezone logic: Error-prone, better to avoid with date-only approach\n- Parsing dates with regex: Use native Date constructor with ISO format\n\n## Open Questions\n\nThings that couldn't be fully resolved:\n\n1. **Should we show date input always or only on hover/edit?**\n   - What we know: Always visible provides clear affordance\n   - What's unclear: Does it clutter the UI for tasks without due dates?\n   - Recommendation: Always visible, use compact styling (date input can be small)\n\n2. **Should overdue detection consider timezone?**\n   - What we know: Start-of-day comparison avoids most issues\n   - What's unclear: Edge cases with DST transitions, timezone changes\n   - Recommendation: Accept local timezone comparison (user's perspective), document limitation\n\n3. **Should we add time-of-day support in future?**\n   - What we know: Date-only is simpler, covers most use cases\n   - What's unclear: Do users need specific deadlines (e.g., \"5 PM\")?\n   - Recommendation: Keep date-only for MVP, add time support as future enhancement if requested\n\n## Sources\n\n### Primary (HIGH confidence)\n- MDN Web Docs - HTML input type=\"date\" (official documentation, verified 2025-12-08)\n- MDN Web Docs - JavaScript Date object (official reference, verified 2025-12-08)\n- MDN Web Docs - Intl.DateTimeFormat (official documentation, verified 2025-07-10)\n- MDN Web Docs - aria-invalid attribute (accessibility validation, verified 2025-06-02)\n- W3C HTML5 Specification - Date state (input type=date)\n- DigitalOcean Community - Understanding Date and Time in JavaScript (tutorial, 2021-08-25)\n\n### Secondary (MEDIUM confidence)\n- MDN Web Docs - Date and time formats used in HTML\n- ISO 8601 standard (date format specification)\n\n### Tertiary (LOW confidence)\n- None - all recommendations based on official MDN documentation and established patterns\n\n## Metadata\n\n**Confidence breakdown:**\n- Standard stack: HIGH - Based on native HTML5 and JavaScript APIs, no external dependencies\n- Architecture: HIGH - Extends existing patterns from chapters 1-4, follows date handling best practices\n- Accessibility: HIGH - Native date input provides built-in accessibility, aria-invalid for validation\n- Pitfalls: HIGH - Common date handling mistakes documented in MDN and industry blogs, verified against existing codebase\n\n**Research date:** 2026-03-02\n**Valid until:** 90 days (stable web standards, date handling patterns well-established)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01",
          "name": "chapter-5-due-dates-plan-01",
          "kind": "feature",
          "summary": "{\n  \"objective\": \"Extend todo data model with due dates and implement date utility functions\",\n  \"purpose\": \"Establish foundation for time-based task management with proper date handling\",\n  \"output\": \"Working date utilities that can be tested via browser console\",\n  \"chapter\": \"chapter-5-due-dates\",\n  \"plan_number\": 1,\n  \"batch\": 1,\n  \"depends_on\": [],\n  \"autonomous\": true,\n  \"files_modified\": [\"src/main.js\"],\n  \"requirements\": {\n    \"truths\": [\n      \"Due dates can be stored and retrieved from the todo data model\",\n      \"Tasks can be sorted by due date with null dates appearing last\",\n      \"Overdue detection correctly identifies past-due incomplete tasks\",\n      \"Dates are formatted for human-readable display\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"Date utilities and extended todo model\",\n        \"exports\": [\"setDueDate\", \"formatDate\", \"isTodoOverdue\", \"getDisplayTodos\"],\n        \"modifications\": \"Add dueDate field to todo objects, add utility functions, integrate sort into render\"\n      }\n    ],\n    \"key_links\": [\n      {\n        \"from\": \"setDueDate\",\n        \"to\": \"storage.save\",\n        \"via\": \"direct call after state mutation\",\n        \"pattern\": \"storage.save(todos)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"getDisplayTodos\",\n        \"via\": \"call at render start\",\n        \"pattern\": \"const displayTodos = getDisplayTodos()\"\n      }\n    ]\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Extend todo model and add setDueDate function\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects in the form submit handler. Create setDueDate(todoId, dateString) function that finds todo by id, updates todo.dueDate to dateString or null (if empty), calls storage.save(todos), and calls render(). Follow existing pattern from toggle/delete operations. The dueDate field should default to null for backward compatibility with existing todos.\",\n      \"verify\": \"In browser console: Add a new todo, then run setDueDate(todoId, '2026-03-15'), check that localStorage contains the dueDate field and todo list re-renders\",\n      \"done\": \"New todos have dueDate: null field, setDueDate function persists changes to localStorage and triggers re-render\"\n    },\n    {\n      \"name\": \"Implement date utility functions\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Create three utility functions:\\n\\n1. isTodoOverdue(todo) - Returns false if !todo.dueDate OR todo.completed (critical: completed tasks never overdue). Normalize dates to start-of-day: today.setHours(0,0,0,0) and dueDate = new Date(todo.dueDate + 'T00:00:00') (avoids timezone bugs). Return dueDate < today.\\n\\n2. formatDate(dateString) - Returns empty string if !dateString. Create dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) at module level (reuse for performance). Return dateFormatter.format(new Date(dateString + 'T00:00:00')).\\n\\n3. getDisplayTodos() - Copy todos array [...todos], sort with comparator: if both have dueDate, return new Date(a.dueDate) - new Date(b.dueDate); if only a has dueDate return -1; if only b has dueDate return 1; else return 0 (null dates last, maintain original order). Return sorted array.\",\n      \"verify\": \"In browser console: Test isTodoOverdue with past date (should return true), future date (false), completed task (false), null date (false). Test formatDate('2026-03-15') returns formatted string. Test getDisplayTodos() returns sorted array with null dates at end.\",\n      \"done\": \"All three utility functions work correctly with proper timezone handling, null handling, and sorting behavior\"\n    },\n    {\n      \"name\": \"Integrate sort into render function\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Update render() function to use getDisplayTodos(): const displayTodos = getDisplayTodos(). Replace direct 'todos' references in render with 'displayTodos'. This ensures the UI always shows tasks sorted by due date. No changes to filter logic - getDisplayTodos should apply after any filter (or integrate into existing getDisplayTodos if using filter pattern from Chapter 4).\",\n      \"verify\": \"Create multiple todos with different due dates and null dates, verify they appear in sorted order (earliest first, null last) in the UI\",\n      \"done\": \"Todo list displays in sorted order by due date, null dates appear at the end\"\n    }\n  ]\n}\n\n# Plan 01: Data Model & Date Utilities\n\n**Objective:** Extend todo data model with due dates and implement date utility functions\n\n**Purpose:** Establish foundation for time-based task management with proper date handling\n\n**Output:** Working date utilities that can be tested via browser console\n\n## Requirements\n\n### Observable Truths\n- Due dates can be stored and retrieved from the todo data model\n- Tasks can be sorted by due date with null dates appearing last\n- Overdue detection correctly identifies past-due incomplete tasks\n- Dates are formatted for human-readable display\n\n### Artifacts\n- **src/main.js** - Date utilities and extended todo model\n  - Exports: setDueDate, formatDate, isTodoOverdue, getDisplayTodos\n  - Modifications: Add dueDate field, add utility functions, integrate sort\n\n### Key Links\n- setDueDate → storage.save → render (state mutation flow)\n- render → getDisplayTodos (sorted display)\n\n## Tasks\n\n### Task 1: Extend todo model and add setDueDate function\n**Files:** src/main.js\n**Action:** Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects. Create setDueDate(todoId, dateString) function following existing CRUD patterns.\n**Verify:** Console test: setDueDate(todoId, '2026-03-15') persists to localStorage\n**Done:** New todos have dueDate field, setDueDate function works\n\n### Task 2: Implement date utility functions\n**Files:** src/main.js\n**Action:** Create isTodoOverdue (timezone-safe), formatDate (Intl.DateTimeFormat), getDisplayTodos (sorted, null dates last)\n**Verify:** Console tests for each function\n**Done:** All utilities work correctly with proper edge case handling\n\n### Task 3: Integrate sort into render function\n**Files:** src/main.js\n**Action:** Update render() to use getDisplayTodos() for sorted display\n**Verify:** Create todos with different due dates, verify sorted order in UI\n**Done:** Todo list displays sorted by due date\n\n## Execution\n\n**Batch:** 1\n**Autonomous:** Yes\n**Depends on:** Nothing"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02",
          "name": "chapter-5-due-dates-plan-02",
          "kind": "feature",
          "summary": "{\n  \"objective\": \"Add date picker UI, overdue styling, and formatted date display\",\n  \"purpose\": \"Complete user-facing due date feature with visual feedback for overdue tasks\",\n  \"output\": \"Working date picker with overdue indicators and date formatting in UI\",\n  \"chapter\": \"chapter-5-due-dates\",\n  \"plan_number\": 2,\n  \"batch\": 2,\n  \"depends_on\": [\"chapter-5-due-dates-plan-01\"],\n  \"autonomous\": true,\n  \"files_modified\": [\"src/main.js\", \"src/style.css\"],\n  \"requirements\": {\n    \"truths\": [\n      \"User can see a date picker input for each task\",\n      \"User can select a due date using the native date picker\",\n      \"User sees overdue tasks highlighted in red\",\n      \"User sees formatted date display (not YYYY-MM-DD)\",\n      \"Completed tasks are never marked as overdue\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"Date picker integration and event handling\",\n        \"modifications\": \"Add date input to render, add change event listener, integrate formatDate and isTodoOverdue\"\n      },\n      {\n        \"path\": \"src/style.css\",\n        \"provides\": \"Overdue task styling\",\n        \"modifications\": \"Add .overdue class with red border-left and text color\"\n      }\n    ],\n    \"key_links\": [\n      {\n        \"from\": \"date input onChange\",\n        \"to\": \"setDueDate\",\n        \"via\": \"event delegation\",\n        \"pattern\": \"todoList.addEventListener('change', ...)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"isTodoOverdue\",\n        \"via\": \"call for each todo\",\n        \"pattern\": \"const isOverdue = isTodoOverdue(todo)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"formatDate\",\n        \"via\": \"display formatted date\",\n        \"pattern\": \"${formatDate(todo.dueDate)}\"\n      }\n    ]\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Add date picker to todo item rendering\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"In the render() function's todo item HTML, add:\\n1. Native date input: <input type=\\\"date\\\" class=\\\"due-date-input\\\" value=\\\"${todo.dueDate || ''}\\\" data-id=\\\"${todo.id}\\\" aria-label=\\\"Due date\\\"> (value uses YYYY-MM-DD format, empty string if null)\\n2. Formatted date display: <span class=\\\"due-date-display ${isOverdue ? 'overdue' : ''}\\\">${formatDate(todo.dueDate)}</span> (call isTodoOverdue(todo) at start of loop, use formatDate for display)\\n3. Add isOverdue to li classList: class=\\\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\\\"\\n\\nPlace date input and display between todo text and edit/delete buttons. Input is always visible (research recommendation).\",\n      \"verify\": \"Add a todo, verify date picker appears for each todo item. Set a date, verify formatted date appears next to input.\",\n      \"done\": \"Each todo item shows a date picker and formatted date display\"\n    },\n    {\n      \"name\": \"Add change event handler for date picker\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Add event delegation handler to todoList for date input changes:\\n\\ntodoList.addEventListener('change', (e) => {\\n  if (e.target.matches('.due-date-input')) {\\n    const todoId = e.target.dataset.id\\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\\n    setDueDate(todoId, dateString) // already handles storage.save and render\\n  }\\n})\\n\\nPlace this with other event listeners (toggle, delete, edit). Native date input fires 'change' event when user selects a date.\",\n      \"verify\": \"Set a due date for a todo, verify it persists on page refresh and sorts correctly\",\n      \"done\": \"Date picker changes persist to localStorage and trigger re-render with sorted order\"\n    },\n    {\n      \"name\": \"Add overdue task styling\",\n      \"type\": \"auto\",\n      \"files\": [\"src/style.css\"],\n      \"action\": \"Add CSS rules for overdue tasks:\\n\\n.todo-item.overdue {\\n  border-left: 3px solid var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .todo-text,\\n.todo-item.overdue .due-date-display {\\n  color: var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .due-date-display::before {\\n  content: '⚠ ';\\n}\\n\\nUse CSS custom property for danger color if exists (from Chapter 1), otherwise use #ef4444 (red). The border-left creates a subtle visual indicator without overwhelming the UI. Completed tasks should never have .overdue class (isTodoOverdue returns false for completed).\",\n      \"verify\": \"Create a todo with a past due date, verify it shows red border and text. Complete the task, verify red styling disappears. Create a todo with future due date, verify no red styling.\",\n      \"done\": \"Overdue tasks display red border-left and text color with warning icon, completed tasks never show overdue styling\"\n    }\n  ]\n}\n\n# Plan 02: Date Picker UI & Overdue Styling\n\n**Objective:** Add date picker UI, overdue styling, and formatted date display\n\n**Purpose:** Complete user-facing due date feature with visual feedback for overdue tasks\n\n**Output:** Working date picker with overdue indicators and date formatting in UI\n\n## Requirements\n\n### Observable Truths\n- User can see a date picker input for each task\n- User can select a due date using the native date picker\n- User sees overdue tasks highlighted in red\n- User sees formatted date display (not YYYY-MM-DD)\n- Completed tasks are never marked as overdue\n\n### Artifacts\n- **src/main.js** - Date picker integration and event handling\n- **src/style.css** - Overdue task styling\n\n### Key Links\n- date input onChange → setDueDate → render (user interaction flow)\n- render → isTodoOverdue (visual feedback)\n- render → formatDate (date display)\n\n## Tasks\n\n### Task 1: Add date picker to todo item rendering\n**Files:** src/main.js\n**Action:** Add native date input and formatted date display to render() function\n**Verify:** Date picker appears for each todo, formatted date displays\n**Done:** Each todo shows date picker and formatted date\n\n### Task 2: Add change event handler for date picker\n**Files:** src/main.js\n**Action:** Add event delegation for .due-date-input changes\n**Verify:** Date selection persists and triggers sort\n**Done:** Date picker changes save and re-render\n\n### Task 3: Add overdue task styling\n**Files:** src/style.css\n**Action:** Add .overdue class with red border-left and text color\n**Verify:** Overdue tasks show red styling, completed tasks don't\n**Done:** Visual indicator for overdue tasks works correctly\n\n## Execution\n\n**Batch:** 2\n**Autonomous:** Yes\n**Depends on:** Plan 01"
        }
      ],
      "edges": [],
      "incoming_edges": [
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "from_name": "chapter-5-due-dates-research",
          "relation": "connects_to",
          "description": "Research findings connect to and inform planning for Chapter 5 implementation"
        },
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01",
          "from_name": "chapter-5-due-dates-plan-01",
          "relation": "implements",
          "description": "Plan 01 implements chapter 5 due dates feature"
        },
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02",
          "from_name": "chapter-5-due-dates-plan-02",
          "relation": "implements",
          "description": "Plan 02 implements chapter 5 due dates feature UI layer"
        }
      ],
      "parent": {
        "id": "main/roadmap",
        "name": "roadmap"
      },
      "similarity": 0.6130737576376675
    },
    {
      "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
      "name": "chapter-5-due-dates-research",
      "kind": "pattern",

...214091 bytes truncated...

The tool call succeeded but the output was truncated. Full output saved to: /Users/mikaelj/.local/share/opencode/tool-output/tool_caeca4683001f5rg3uIf970iko
Use the Task tool to have explore agent process this file with Grep and Read (with offset/limit). Do NOT read the full file yourself - delegate to save context.
```

---

## Assistant (Fuska-Planner · glm-5 · 235.8s)

**Tool: task**

**Input:**
```json
{
  "description": "Revise Chapter 5 plans",
  "prompt": "<critical_constraints>\nReturn: ## REVISION COMPLETE\nUpdate plan concepts: chapter-5-due-dates-plan-01, chapter-5-due-dates-plan-02\n</critical_constraints>\n\n<objective>\nRevise Chapter 5 plans to address checker issues\n</objective>\n\n<revision_context>\n\n## Checker Issues Found\n\n```yaml\nissues:\n  - plan: \"chapter-5-due-dates-plan-01\"\n    task: 3\n    severity: high\n    dimension: errors\n    cross_validated: true\n    checkers: [\"quality-advocate\", \"data-architect\"]\n    description: \"Filter + Sort integration strategy unclear - task mentions 'integrate into existing getDisplayTodos if using filter pattern from Chapter 4' but Chapter 4 uses getFilteredTodos(). Need to clarify whether to rename, wrap, or replace.\"\n    fix_hint: \"Specify integration pattern: getDisplayTodos() calls getFilteredTodos() first, then sorts. Or use separate getSortedTodos() called after getFilteredTodos() in render().\"\n    \n  - plan: \"chapter-5-due-dates-plan-02\"\n    task: 3\n    severity: medium\n    dimension: maintainability\n    checkers: [\"quality-advocate\"]\n    description: \"CSS assumes --color-danger custom property exists from Chapter 1, but verification shows it's not defined. Fallback works but creates disconnect.\"\n    fix_hint: \"Add verification step to task or use direct color value with future extraction comment.\"\n    \n  - plan: \"chapter-5-due-dates-plan-01\"\n    task: 1\n    severity: medium\n    dimension: errors\n    checkers: [\"data-architect\"]\n    description: \"Backward compatibility only addresses new todos. Existing localStorage todos without dueDate field need null default on load.\"\n    fix_hint: \"Add note about storage.load handling missing fields or add migration step to set null defaults.\"\n```\n\n</revision_context>\n\n<current_plans>\n\n## Plan 01: chapter-5-due-dates-plan-01\n\n**Current Summary:**\n```json\n{\n  \"objective\": \"Extend todo data model with due dates and implement date utility functions\",\n  \"tasks\": [\n    {\n      \"name\": \"Extend todo model and add setDueDate function\",\n      \"action\": \"Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects in the form submit handler. Create setDueDate(todoId, dateString) function that finds todo by id, updates todo.dueDate to dateString or null (if empty), calls storage.save(todos), and calls render(). Follow existing pattern from toggle/delete operations. The dueDate field should default to null for backward compatibility with existing todos.\"\n    },\n    {\n      \"name\": \"Implement date utility functions\",\n      \"action\": \"Create three utility functions:\\n\\n1. isTodoOverdue(todo)...\\n2. formatDate(dateString)...\\n3. getDisplayTodos() - Copy todos array [...todos], sort with comparator: if both have dueDate, return new Date(a.dueDate) - new Date(b.dueDate); if only a has dueDate return -1; if only b has dueDate return 1; else return 0 (null dates last, maintain original order). Return sorted array.\"\n    },\n    {\n      \"name\": \"Integrate sort into render function\",\n      \"action\": \"Update render() function to use getDisplayTodos(): const displayTodos = getDisplayTodos(). Replace direct 'todos' references in render with 'displayTodos'. This ensures the UI always shows tasks sorted by due date. No changes to filter logic - getDisplayTodos should apply after any filter (or integrate into existing getDisplayTodos if using filter pattern from Chapter 4).\"\n    }\n  ]\n}\n```\n\n## Plan 02: chapter-5-due-dates-plan-02\n\n**Current Summary:**\n```json\n{\n  \"objective\": \"Add date picker UI, overdue styling, and formatted date display\",\n  \"tasks\": [\n    {\n      \"name\": \"Add date picker to todo item rendering\",\n      \"action\": \"...\"\n    },\n    {\n      \"name\": \"Add change event handler for date picker\",\n      \"action\": \"...\"\n    },\n    {\n      \"name\": \"Add overdue task styling\",\n      \"action\": \"Add CSS rules for overdue tasks:\\n\\n.todo-item.overdue {\\n  border-left: 3px solid var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .todo-text,\\n.todo-item.overdue .due-date-display {\\n  color: var(--color-danger, #ef4444);\\n}\\n\\n.todo-item.overdue .due-date-display::before {\\n  content: '⚠ ';\\n}\\n\\nUse CSS custom property for danger color if exists (from Chapter 1), otherwise use #ef4444 (red). The border-left creates a subtle visual indicator without overwhelming the UI. Completed tasks should never have .overdue class (isTodoOverdue returns false for completed).\"\n    }\n  ]\n}\n```\n\n</current_plans>\n\n<revision_instructions>\n\nYou are in **REVISION MODE** - making targeted updates to address specific issues.\n\n**Step 1: Load Existing Plans** (already provided above)\n\n**Step 2: Parse Issues**\n- Issue 1 (HIGH): Plan 01, Task 3 - Filter + Sort integration unclear\n- Issue 2 (MEDIUM): Plan 02, Task 3 - CSS custom property assumption\n- Issue 3 (MEDIUM): Plan 01, Task 1 - Backward compatibility incomplete\n\n**Step 3: Make Targeted Updates**\n\nFor each issue:\n\n**Issue 1 - Filter + Sort Integration:**\n- Update Plan 01, Task 3 action to specify clear integration pattern\n- Choice: getDisplayTodos() should call getFilteredTodos() first, then sort\n- New action: \"Update render() to use getDisplayTodos() which calls getFilteredTodos(todos, currentFilter) first (Chapter 4 pattern), then sorts by due date. Pattern: const filtered = getFilteredTodos(todos, currentFilter); return filtered.sort(comparator). Replace direct 'todos' references in render with result from getDisplayTodos().\"\n\n**Issue 2 - CSS Custom Property:**\n- Update Plan 02, Task 3 action to use direct color value\n- New action: Remove var(--color-danger, ...) reference, use #ef4444 directly with comment\n- Add note: \"Using #ef4444 directly (red). Future: could extract to --color-danger custom property.\"\n\n**Issue 3 - Backward Compatibility:**\n- Update Plan 01, Task 1 action to include migration note\n- Add to action: \"For existing todos loaded from localStorage, ensure missing dueDate field is handled. The formatDate() and sorting functions already handle null/undefined gracefully. StorageService.load() returns todos as-is, so functions must handle missing fields.\"\n\n**Step 4: Update Plan Concepts**\n\nUse megamemory:update_concept for each modified plan:\n- Update the JSON summary with corrected task actions\n- Update the markdown rendering if needed\n\n**DO:**\n- Make minimal, targeted changes\n- Keep working parts of plans intact\n- Update only the specific task actions that have issues\n\n**DO NOT:**\n- Rewrite entire plans\n- Add unnecessary tasks\n- Change task structure\n\n</revision_instructions>\n\n<output>\nReturn structured revision summary:\n- Issues addressed\n- Changes made\n- Plan concepts updated\n</output>",
  "subagent_type": "fuska-planner"
}
```

**Output:**
```
task_id: ses_35134c79effe1etvq5MpEHQ37U (for resuming to continue this task if needed)

<task_result>
## REVISION COMPLETE

**Issues addressed:** 3/3

### Changes Made

| Plan | Task | Change | Issue Addressed |
|------|------|--------|-----------------|
| chapter-5-due-dates-plan-01 | Task 1 | Added backward compatibility clarification: formatDate() and sorting functions handle null/undefined gracefully, no migration needed since functions are defensive | data-architect: Backward compatibility only addressed new todos |
| chapter-5-due-dates-plan-01 | Task 2 | Updated getDisplayTodos() to call getFilteredTodos(todos, currentFilter) first, then sort filtered result | quality-advocate/data-architect: Filter + Sort integration strategy unclear |
| chapter-5-due-dates-plan-01 | Task 3 | Clarified integration pattern: getDisplayTodos() handles both filtering (via getFilteredTodos) and sorting, avoiding duplication | quality-advocate/data-architect: Filter + Sort integration strategy unclear |
| chapter-5-due-dates-plan-02 | Task 3 | Changed from var(--color-danger, #ef4444) to #ef4444 directly, added note about future extraction | quality-advocate: CSS assumes --color-danger custom property exists |

### Concepts Updated

- Plan concept: chapter-5-due-dates-plan-01 (backward compatibility, filter+sort integration)
- Plan concept: chapter-5-due-dates-plan-02 (CSS color value)

### Key Improvements

1. **Filter + Sort Integration**: Now explicitly uses Chapter 4's getFilteredTodos() pattern, then sorts the filtered results. This ensures compatibility with existing filter functionality and avoids duplicating filter logic.

2. **Backward Compatibility**: Clarified that defensive function design (handling null/undefined) eliminates need for migration steps. Existing localStorage todos without dueDate field are handled gracefully.

3. **CSS Custom Property**: Removed assumption about --color-danger custom property. Using #ef4444 directly with note about potential future extraction.

### Ready for Re-verification

All flagged issues have been addressed with minimal, targeted changes. Plans maintain their structure while fixing the specific concerns raised by checkers.
</task_result>
```

---

## Assistant (Fuska-Planner · glm-5 · 10.5s)

Excellent! Revisions complete. Let me verify the updated plans.

```
-----------------------------------------------------
 Fuska: VERIFYING PLANS (Iteration 2)
-----------------------------------------------------
```

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "chapter-5-due-dates-plan",
  "top_k": 20
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-5-due-dates",
      "name": "chapter-5-due-dates",
      "kind": "feature",
      "summary": "# Chapter 5: Due Dates\n\n**Goal:** Users can track deadlines and prioritize time-sensitive tasks\n\n## Requirements\n- ENHANCE-01: Set due dates for tasks with date picker, display overdue indicators, sort by date\n\n## Success Criteria\n1. User can set a due date for any task using a date picker\n2. User sees visual indicator (red highlight) for overdue tasks\n3. User can sort task list by due date (earliest first)\n\n## Dependencies\n- Chapter 1 (UI Foundation)\n- Chapter 2 (Core Operations with task data model)\n- Chapter 3 (Persistence for due date data)\n\n## Scope\n- Extend todo data model with dueDate field (optional, nullable)\n- Date picker UI integration (native HTML date input or custom)\n- Overdue calculation logic (compare dueDate to current date)\n- Visual styling for overdue tasks\n- Sort functionality (by due date, null dates last)\n- Date display formatting",
      "why": "Due dates add organizational dimension to task management, enabling time-based prioritization",
      "file_refs": null,
      "children": [
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "name": "chapter-5-due-dates-research",
          "kind": "pattern",
          "summary": "# Chapter 5: Due Dates - Research\n\n**Researched:** 2026-03-02\n**Domain:** Date handling, date picker UI, overdue detection, sorting with dates in vanilla JS\n**Confidence:** HIGH\n\n## Summary\n\nResearch for implementing due dates in a vanilla JS todo app. This chapter adds time-based task management, enabling users to set deadlines, identify overdue tasks, and prioritize work by due date. The standard approach uses native HTML5 `<input type=\"date\">` for date selection, vanilla JavaScript Date API for comparison, and Intl.DateTimeFormat for locale-aware display. Key challenge: avoid timezone bugs by using date-only storage and start-of-day comparison.\n\n**Primary recommendation:** Use native HTML5 date input (no custom picker), store dates as `YYYY-MM-DD` strings, compare at start-of-day to avoid timezone issues, sort with null dates last, use Intl.DateTimeFormat for display, and apply red visual indicator for overdue tasks.\n\n## Standard Stack\n\nThe established libraries/tools for this chapter:\n\n### Core\n| Library | Version | Purpose | Why Standard |\n|---------|---------|---------|--------------|\n| Native HTML5 date input | HTML5 | Date picker UI | Built-in browser support since 2021, baseline widely available, accessible, no dependencies |\n| Vanilla JS Date API | ES5+ | Date comparison and manipulation | Native, no dependencies, sufficient for date-only operations |\n| Intl.DateTimeFormat | ES6 | Locale-aware date formatting | Built-in i18n support, no manual formatting |\n\n### Supporting\n| Library | Version | Purpose | When to Use |\n|---------|---------|---------|-------------|\n| CSS custom properties | CSS3 | Overdue task styling (red highlight) | Already in use from Chapter 1 |\n| Event delegation | ES6 | Date input change handling | Existing pattern from Chapters 2-4 |\n\n### Alternatives Considered\n| Instead of | Could Use | Tradeoff |\n|------------|-----------|----------|\n| Native date input | Custom date picker (flatpickr, date-fns) | 2-10KB dependency, more code, maintenance burden |\n| Vanilla Date API | date-fns, dayjs, luxon | 2-10KB dependency, overkill for simple date-only operations |\n| Intl.DateTimeFormat | toLocaleDateString() | toLocaleDateString() creates formatter each call, less efficient |\n| Date-only storage | Timestamp storage | Over-complicates comparison, timezone handling needed |\n\n**Installation:**\nNo additional dependencies needed - all functionality uses native HTML5, JavaScript, and browser APIs.\n\n## Architecture Patterns\n\n### Recommended Data Model Extension\n\n```javascript\n// Extend existing todo model\nconst todo = {\n  id: number | string,\n  text: string,\n  completed: boolean,\n  createdAt: string | number, // existing\n  dueDate: string | null // NEW: 'YYYY-MM-DD' format or null (optional)\n}\n```\n\n**Key decisions:**\n- **Format:** Store as ISO date string (`YYYY-MM-DD`) - matches native date input value format\n- **Optional:** Nullable field - tasks can exist without due dates\n- **No time component:** Date-only, no hours/minutes/seconds (simplifies comparison)\n\n### Recommended Implementation Structure\n\nExtend existing state management and render pattern:\n\n```javascript\n// Modified render function\nfunction render() {\n  // Get filtered/sorted todos\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = createTodoElement(todo, isOverdue)\n    todoList.appendChild(li)\n  })\n}\n\n// Date input handler\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null // null if empty\n  storage.save(todos)\n  render()\n}\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Compare at start of day\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00') // Avoid UTC interpretation\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today // Overdue if due date is before today\n}\n\n// Sort by due date (earliest first, null dates last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - compare them\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Only a has due date - a comes first\n    if (a.dueDate && !b.dueDate) return -1\n    // Only b has due date - b comes first\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain original order\n    return 0\n  })\n}\n\n// Format date for display\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short',\n    day: 'numeric',\n    year: 'numeric'\n  }).format(date)\n}\n```\n\n### Pattern 1: Native Date Input Integration\n\n**What:** Add `<input type=\"date\">` to each todo item for date selection\n**When:** Always - native input provides built-in picker, validation, accessibility\n**Example:**\n\n```html\n<!-- Inside todo item -->\n<li class=\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\">\n  <button class=\"toggle-btn\" data-id=\"${todo.id}\" aria-label=\"Toggle complete\">\n    ✓\n  </button>\n  \n  <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n  \n  <!-- Date input -->\n  <input \n    type=\"date\" \n    class=\"due-date-input\"\n    value=\"${todo.dueDate || ''}\"\n    data-id=\"${todo.id}\"\n    aria-label=\"Due date for ${escapeHtml(todo.text)}\"\n  />\n  \n  <!-- Formatted date display (optional, shows when input not focused) -->\n  <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n    ${todo.dueDate ? formatDate(todo.dueDate) : ''}\n  </span>\n  \n  <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n  <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n</li>\n```\n\n```javascript\n// Event delegation for date changes\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n**Key principles:**\n- Native `<input type=\"date\">` provides browser's built-in date picker\n- Value always returns `YYYY-MM-DD` format (standardized)\n- Display format adapts to user's locale automatically\n- Built-in keyboard navigation and screen reader support\n- Can be styled with CSS (though some limitations exist)\n\n### Pattern 2: Overdue Detection and Styling\n\n**What:** Compare due date to current date, apply visual indicator for overdue tasks\n**When:** On every render\n**Example:**\n\n```javascript\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0) // Start of today\n  \n  // CRITICAL: Add time component to avoid UTC interpretation\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n```\n\n```css\n/* Overdue styling */\n.todo-item.overdue {\n  border-left: 3px solid #ef4444; /* Red accent */\n}\n\n.todo-item.overdue .due-date-display,\n.todo-item.overdue .todo-text {\n  color: #ef4444;\n}\n\n.todo-item.overdue .due-date-display::before {\n  content: '⚠ ';\n  /* Warning icon */\n}\n```\n\n**Why this approach:**\n- Uses start-of-day comparison to avoid timezone edge cases\n- Completed tasks never show as overdue (common UX pattern)\n- Visual indicator (red) is universally understood\n- Subtle styling (border-left + text color) doesn't overwhelm UI\n\n### Pattern 3: Sorting with Nullable Due Dates\n\n**What:** Sort todos by due date, placing tasks without due dates at the end\n**When:** On every render (after state changes)\n**Example:**\n\n```javascript\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    // Both have due dates - sort chronologically\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    // Tasks with due dates come before tasks without\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    // Neither has due date - maintain creation order\n    return 0\n  })\n}\n```\n\n**Why this approach:**\n- Tasks with deadlines are more urgent (should appear first)\n- Null dates at the end prevents them from interrupting sorted order\n- Stable sort (maintains original order for equal priorities)\n- Simple comparison using Date subtraction (milliseconds)\n\n### Pattern 4: Date Display Formatting\n\n**What:** Format dates in user's locale with Intl.DateTimeFormat\n**When:** On render\n**Example:**\n\n```javascript\n// Create formatter once (reuse for performance)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  \n  const date = new Date(dateString + 'T00:00:00')\n  return dateFormatter.format(date)\n}\n\n// Examples:\n// en-US: \"Mar 15, 2026\"\n// en-GB: \"15 Mar 2026\"\n// de-DE: \"15.03.2026\"\n// ja-JP: \"2026年3月15日\"\n```\n\n**Why Intl.DateTimeFormat:**\n- Automatic locale detection (uses browser settings)\n- No manual formatting logic\n- Handles all edge cases (different calendars, numbering systems)\n- More efficient than toLocaleDateString() for repeated use\n\n### Anti-Patterns to Avoid\n\n- **Comparing dates without normalizing time:** Leads to false overdue detection due to time components\n- **Using `new Date(dateString)` without time component:** Date-only strings interpreted as UTC, causes timezone bugs\n- **Sorting null dates as 0 or epoch:** Clusters all no-date tasks at start (wrong UX)\n- **Showing overdue indicator on completed tasks:** Confusing UX - task is done, deadline irrelevant\n- **Storing date with time component:** Over-complicates comparison, user only cares about day\n- **Using toLocaleDateString() in render loop:** Creates new formatter every time, inefficient\n\n## Don't Hand-Roll\n\nProblems that look simple but have established solutions:\n\n| Problem | Don't Build | Use Instead | Why |\n|---------|-------------|-------------|-----|\n| Date picker UI | Custom calendar widget | `<input type=\"date\">` | Native, accessible, no code, consistent with OS |\n| Date formatting | Manual string concatenation | Intl.DateTimeFormat | Handles all locales, edge cases, calendars |\n| Timezone handling | Manual offset calculations | Store date-only + compare at start-of-day | Avoids timezone complexity entirely |\n| Date validation | Custom regex/parser | Native date input validation | Built-in min/max, required, invalid states |\n\n**Key insight:** Date handling is notoriously error-prone. Use native APIs and simple patterns (date-only, start-of-day comparison) to avoid timezone bugs.\n\n## Common Pitfalls\n\n### Pitfall 1: Timezone Bugs with Date-Only Strings\n**What goes wrong:** Task due \"2026-03-02\" shows as overdue on March 2nd due to timezone conversion\n**Why it happens:** `new Date('2026-03-02')` interprets as UTC midnight, which may be previous day in local timezone\n**How to avoid:** Always add time component: `new Date('2026-03-02' + 'T00:00:00')`\n```javascript\n// ❌ Wrong - timezone issues\nconst dueDate = new Date(todo.dueDate)\n\n// ✅ Correct - local timezone\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\n```\n**Warning signs:** Tasks show as overdue one day early, date display doesn't match input value\n\n### Pitfall 2: Overdue Detection Without Time Normalization\n**What goes wrong:** Task due today shows as overdue in the afternoon\n**Why it happens:** `new Date()` includes current time (e.g., 14:30), due date is midnight (00:00)\n**How to avoid:** Compare both dates at start-of-day (00:00:00)\n```javascript\n// ❌ Wrong - time component causes false positives\nconst today = new Date()\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\nreturn dueDate < today // FALSE POSITIVE if today is 14:30\n\n// ✅ Correct - compare at start of day\nconst today = new Date()\ntoday.setHours(0, 0, 0, 0)\nconst dueDate = new Date(todo.dueDate + 'T00:00:00')\ndueDate.setHours(0, 0, 0, 0)\nreturn dueDate < today\n```\n**Warning signs:** Tasks show overdue mid-day on due date\n\n### Pitfall 3: Null Dates Sorted as Epoch (1970)\n**What goes wrong:** Tasks without due dates appear first in sorted list (treated as Jan 1, 1970)\n**Why it happens:** `new Date(null)` returns epoch date\n**How to avoid:** Explicit null handling in sort comparator\n```javascript\n// ❌ Wrong - null becomes epoch\ntodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))\n\n// ✅ Correct - null dates last\ntodos.sort((a, b) => {\n  if (a.dueDate && b.dueDate) {\n    return new Date(a.dueDate) - new Date(b.dueDate)\n  }\n  if (a.dueDate && !b.dueDate) return -1\n  if (!a.dueDate && b.dueDate) return 1\n  return 0\n})\n```\n**Warning signs:** Tasks without due dates cluster at top of list\n\n### Pitfall 4: Completed Tasks Show Overdue\n**What goes wrong:** Completed task with past due date still shows red/overdue styling\n**Why it happens:** Overdue check doesn't exclude completed tasks\n**How to avoid:** Check completion status before overdue detection\n```javascript\n// ❌ Wrong - completed tasks can be overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n\n// ✅ Correct - completed tasks never overdue\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  return dueDate < today\n}\n```\n**Warning signs:** Completed tasks have red styling, confusing users\n\n### Pitfall 5: Inefficient Date Formatting in Render Loop\n**What goes wrong:** Performance issues with large todo lists (> 100 items)\n**Why it happens:** Creating new Intl.DateTimeFormat instance on every render\n**How to avoid:** Create formatter once, reuse\n```javascript\n// ❌ Wrong - new formatter every call\nfunction formatDate(dateString) {\n  return new Intl.DateTimeFormat(undefined, {\n    month: 'short', day: 'numeric', year: 'numeric'\n  }).format(new Date(dateString + 'T00:00:00'))\n}\n\n// ✅ Correct - reuse formatter\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short', day: 'numeric', year: 'numeric'\n})\n\nfunction formatDate(dateString) {\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n```\n**Warning signs:** Slow rendering with many todos\n\n### Pitfall 6: Date Input Value Format Mismatch\n**What goes wrong:** Date input shows wrong date or fails to set value\n**Why it happens:** Native date input expects `YYYY-MM-DD` format exactly\n**How to avoid:** Store dates in ISO format, set input.value directly\n```javascript\n// ❌ Wrong - wrong format\ndateInput.value = '03/15/2026' // MM/DD/YYYY - won't work\ndateInput.value = 'March 15, 2026' // won't work\n\n// ✅ Correct - ISO format\ndateInput.value = '2026-03-15' // YYYY-MM-DD\ndateInput.value = todo.dueDate || '' // empty string if null\n```\n**Warning signs:** Date input shows blank or incorrect date\n\n## Code Examples\n\n### Complete Due Date Integration (main.js)\n\n```javascript\n// State extension (todos already exists)\n// Date formatter (create once)\nconst dateFormatter = new Intl.DateTimeFormat(undefined, {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric'\n})\n\n// Overdue detection\nfunction isTodoOverdue(todo) {\n  if (!todo.dueDate || todo.completed) return false\n  \n  const today = new Date()\n  today.setHours(0, 0, 0, 0)\n  \n  const dueDate = new Date(todo.dueDate + 'T00:00:00')\n  dueDate.setHours(0, 0, 0, 0)\n  \n  return dueDate < today\n}\n\n// Date formatting\nfunction formatDate(dateString) {\n  if (!dateString) return ''\n  return dateFormatter.format(new Date(dateString + 'T00:00:00'))\n}\n\n// Sort by due date (earliest first, null last)\nfunction getDisplayTodos() {\n  return [...todos].sort((a, b) => {\n    if (a.dueDate && b.dueDate) {\n      return new Date(a.dueDate) - new Date(b.dueDate)\n    }\n    if (a.dueDate && !b.dueDate) return -1\n    if (!a.dueDate && b.dueDate) return 1\n    return 0\n  })\n}\n\n// Set due date\nfunction setDueDate(todoId, dateString) {\n  const todo = todos.find(t => t.id === todoId)\n  if (!todo) return\n  \n  todo.dueDate = dateString || null\n  storage.save(todos)\n  render()\n}\n\n// Update render function\nfunction render() {\n  const displayTodos = getDisplayTodos()\n  \n  todoList.innerHTML = ''\n  \n  if (displayTodos.length === 0) {\n    renderEmptyState()\n    return\n  }\n  \n  displayTodos.forEach(todo => {\n    const isOverdue = isTodoOverdue(todo)\n    const li = document.createElement('li')\n    li.className = `todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`\n    \n    li.innerHTML = `\n      <button class=\"toggle-btn\" data-id=\"${todo.id}\" \n              aria-label=\"Mark as ${todo.completed ? 'incomplete' : 'complete'}\"\n              aria-checked=\"${todo.completed}\">\n        ${todo.completed ? '✓' : ''}\n      </button>\n      \n      <span class=\"todo-text\">${escapeHtml(todo.text)}</span>\n      \n      <input \n        type=\"date\" \n        class=\"due-date-input\"\n        value=\"${todo.dueDate || ''}\"\n        data-id=\"${todo.id}\"\n        aria-label=\"Due date\"\n      />\n      \n      <span class=\"due-date-display ${isOverdue ? 'overdue' : ''}\">\n        ${formatDate(todo.dueDate)}\n      </span>\n      \n      <button class=\"edit-btn\" data-id=\"${todo.id}\" aria-label=\"Edit task\">✎</button>\n      <button class=\"delete-btn\" data-id=\"${todo.id}\" aria-label=\"Delete task\">×</button>\n    `\n    \n    todoList.appendChild(li)\n  })\n}\n\n// Event listeners (add to existing delegation)\ntodoList.addEventListener('change', (e) => {\n  if (e.target.matches('.due-date-input')) {\n    const todoId = e.target.dataset.id\n    const dateString = e.target.value\n    setDueDate(todoId, dateString)\n  }\n})\n```\n\n## State of the Art\n\n| Old Approach | Current Approach | When Changed | Impact |\n|--------------|------------------|--------------|--------|\n| Custom date picker libraries | Native HTML5 date input | 2021 (baseline support) | Less code, better accessibility, consistent UX |\n| toLocaleDateString() for formatting | Intl.DateTimeFormat | 2016+ | Better performance, more options |\n| Manual timezone handling | Date-only + start-of-day comparison | Best practice | Avoids timezone bugs entirely |\n| Sorting null dates as epoch | Explicit null handling | Best practice | Better UX (null dates last) |\n\n**Deprecated/outdated:**\n- Using jQuery UI datepicker: Replaced by native date input\n- Storing dates as timestamps: Over-complicates date-only use case\n- Custom timezone logic: Error-prone, better to avoid with date-only approach\n- Parsing dates with regex: Use native Date constructor with ISO format\n\n## Open Questions\n\nThings that couldn't be fully resolved:\n\n1. **Should we show date input always or only on hover/edit?**\n   - What we know: Always visible provides clear affordance\n   - What's unclear: Does it clutter the UI for tasks without due dates?\n   - Recommendation: Always visible, use compact styling (date input can be small)\n\n2. **Should overdue detection consider timezone?**\n   - What we know: Start-of-day comparison avoids most issues\n   - What's unclear: Edge cases with DST transitions, timezone changes\n   - Recommendation: Accept local timezone comparison (user's perspective), document limitation\n\n3. **Should we add time-of-day support in future?**\n   - What we know: Date-only is simpler, covers most use cases\n   - What's unclear: Do users need specific deadlines (e.g., \"5 PM\")?\n   - Recommendation: Keep date-only for MVP, add time support as future enhancement if requested\n\n## Sources\n\n### Primary (HIGH confidence)\n- MDN Web Docs - HTML input type=\"date\" (official documentation, verified 2025-12-08)\n- MDN Web Docs - JavaScript Date object (official reference, verified 2025-12-08)\n- MDN Web Docs - Intl.DateTimeFormat (official documentation, verified 2025-07-10)\n- MDN Web Docs - aria-invalid attribute (accessibility validation, verified 2025-06-02)\n- W3C HTML5 Specification - Date state (input type=date)\n- DigitalOcean Community - Understanding Date and Time in JavaScript (tutorial, 2021-08-25)\n\n### Secondary (MEDIUM confidence)\n- MDN Web Docs - Date and time formats used in HTML\n- ISO 8601 standard (date format specification)\n\n### Tertiary (LOW confidence)\n- None - all recommendations based on official MDN documentation and established patterns\n\n## Metadata\n\n**Confidence breakdown:**\n- Standard stack: HIGH - Based on native HTML5 and JavaScript APIs, no external dependencies\n- Architecture: HIGH - Extends existing patterns from chapters 1-4, follows date handling best practices\n- Accessibility: HIGH - Native date input provides built-in accessibility, aria-invalid for validation\n- Pitfalls: HIGH - Common date handling mistakes documented in MDN and industry blogs, verified against existing codebase\n\n**Research date:** 2026-03-02\n**Valid until:** 90 days (stable web standards, date handling patterns well-established)"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01",
          "name": "chapter-5-due-dates-plan-01",
          "kind": "feature",
          "summary": "{\n  \"objective\": \"Extend todo data model with due dates and implement date utility functions\",\n  \"purpose\": \"Establish foundation for time-based task management with proper date handling\",\n  \"output\": \"Working date utilities that can be tested via browser console\",\n  \"chapter\": \"chapter-5-due-dates\",\n  \"plan_number\": 1,\n  \"batch\": 1,\n  \"depends_on\": [],\n  \"autonomous\": true,\n  \"files_modified\": [\"src/main.js\"],\n  \"requirements\": {\n    \"truths\": [\n      \"Due dates can be stored and retrieved from the todo data model\",\n      \"Tasks can be sorted by due date with null dates appearing last\",\n      \"Overdue detection correctly identifies past-due incomplete tasks\",\n      \"Dates are formatted for human-readable display\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"Date utilities and extended todo model\",\n        \"exports\": [\"setDueDate\", \"formatDate\", \"isTodoOverdue\", \"getDisplayTodos\"],\n        \"modifications\": \"Add dueDate field to todo objects, add utility functions, integrate sort into render\"\n      }\n    ],\n    \"key_links\": [\n      {\n        \"from\": \"setDueDate\",\n        \"to\": \"storage.save\",\n        \"via\": \"direct call after state mutation\",\n        \"pattern\": \"storage.save(todos)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"getDisplayTodos\",\n        \"via\": \"call at render start\",\n        \"pattern\": \"const displayTodos = getDisplayTodos()\"\n      }\n    ]\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Extend todo model and add setDueDate function\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects in the form submit handler. Create setDueDate(todoId, dateString) function that finds todo by id, updates todo.dueDate to dateString or null (if empty), calls storage.save(todos), and calls render(). Follow existing pattern from toggle/delete operations. The dueDate field should default to null for backward compatibility with existing todos. For existing todos loaded from localStorage, ensure missing dueDate field is handled gracefully - the formatDate() and sorting functions already handle null/undefined, so no migration step is needed since StorageService.load() returns todos as-is and all functions are defensive.\",\n      \"verify\": \"In browser console: Add a new todo, then run setDueDate(todoId, '2026-03-15'), check that localStorage contains the dueDate field and todo list re-renders\",\n      \"done\": \"New todos have dueDate: null field, setDueDate function persists changes to localStorage and triggers re-render\"\n    },\n    {\n      \"name\": \"Implement date utility functions\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Create three utility functions:\\n\\n1. isTodoOverdue(todo) - Returns false if !todo.dueDate OR todo.completed (critical: completed tasks never overdue). Normalize dates to start-of-day: today.setHours(0,0,0,0) and dueDate = new Date(todo.dueDate + 'T00:00:00') (avoids timezone bugs). Return dueDate < today.\\n\\n2. formatDate(dateString) - Returns empty string if !dateString. Create dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) at module level (reuse for performance). Return dateFormatter.format(new Date(dateString + 'T00:00:00')).\\n\\n3. getDisplayTodos() - Call getFilteredTodos(todos, currentFilter) first (Chapter 4 filter pattern), then sort the filtered result. Pattern: const filtered = getFilteredTodos(todos, currentFilter); return filtered.sort((a, b) => { if (a.dueDate && b.dueDate) { return new Date(a.dueDate) - new Date(b.dueDate) } if (a.dueDate && !b.dueDate) return -1; if (!a.dueDate && b.dueDate) return 1; return 0 }). Return sorted array.\",\n      \"verify\": \"In browser console: Test isTodoOverdue with past date (should return true), future date (false), completed task (false), null date (false). Test formatDate('2026-03-15') returns formatted string. Test getDisplayTodos() returns filtered and sorted array with null dates at end.\",\n      \"done\": \"All three utility functions work correctly with proper timezone handling, null handling, filter integration, and sorting behavior\"\n    },\n    {\n      \"name\": \"Integrate sort into render function\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Update render() function to use getDisplayTodos() which handles both filtering and sorting: const displayTodos = getDisplayTodos(). Replace direct 'todos' references in render with 'displayTodos'. The getDisplayTodos function calls getFilteredTodos(todos, currentFilter) first (Chapter 4 pattern), then sorts the filtered results by due date. This ensures the UI shows filtered tasks in sorted order without duplicating filter logic.\",\n      \"verify\": \"Create multiple todos with different due dates and null dates, set different filters (all/active/completed), verify they appear in sorted order (earliest first, null last) within each filter view\",\n      \"done\": \"Todo list displays filtered and sorted by due date, null dates appear at the end, filter state is preserved\"\n    }\n  ]\n}\n\n# Plan 01: Data Model & Date Utilities\n\n**Objective:** Extend todo data model with due dates and implement date utility functions\n\n**Purpose:** Establish foundation for time-based task management with proper date handling\n\n**Output:** Working date utilities that can be tested via browser console\n\n## Requirements\n\n### Observable Truths\n- Due dates can be stored and retrieved from the todo data model\n- Tasks can be sorted by due date with null dates appearing last\n- Overdue detection correctly identifies past-due incomplete tasks\n- Dates are formatted for human-readable display\n\n### Artifacts\n- **src/main.js** - Date utilities and extended todo model\n  - Exports: setDueDate, formatDate, isTodoOverdue, getDisplayTodos\n  - Modifications: Add dueDate field, add utility functions, integrate sort\n\n### Key Links\n- setDueDate → storage.save → render (state mutation flow)\n- render → getDisplayTodos (filtered and sorted display)\n\n## Tasks\n\n### Task 1: Extend todo model and add setDueDate function\n**Files:** src/main.js\n**Action:** Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects. Create setDueDate(todoId, dateString) function following existing CRUD patterns. Functions are defensive - handle missing dueDate field from localStorage gracefully.\n**Verify:** Console test: setDueDate(todoId, '2026-03-15') persists to localStorage\n**Done:** New todos have dueDate field, setDueDate function works, backward compatible\n\n### Task 2: Implement date utility functions\n**Files:** src/main.js\n**Action:** Create isTodoOverdue (timezone-safe), formatDate (Intl.DateTimeFormat), getDisplayTodos (calls getFilteredTodos then sorts, null dates last)\n**Verify:** Console tests for each function including filter integration\n**Done:** All utilities work correctly with proper edge case handling and filter integration\n\n### Task 3: Integrate sort into render function\n**Files:** src/main.js\n**Action:** Update render() to use getDisplayTodos() which calls getFilteredTodos() then sorts\n**Verify:** Create todos with different due dates and filters, verify sorted order in each filter view\n**Done:** Todo list displays filtered and sorted by due date\n\n## Execution\n\n**Batch:** 1\n**Autonomous:** Yes\n**Depends on:** Nothing"
        },
        {
          "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02",
          "name": "chapter-5-due-dates-plan-02",
          "kind": "feature",
          "summary": "{\n  \"objective\": \"Add date picker UI, overdue styling, and formatted date display\",\n  \"purpose\": \"Complete user-facing due date feature with visual feedback for overdue tasks\",\n  \"output\": \"Working date picker with overdue indicators and date formatting in UI\",\n  \"chapter\": \"chapter-5-due-dates\",\n  \"plan_number\": 2,\n  \"batch\": 2,\n  \"depends_on\": [\"chapter-5-due-dates-plan-01\"],\n  \"autonomous\": true,\n  \"files_modified\": [\"src/main.js\", \"src/style.css\"],\n  \"requirements\": {\n    \"truths\": [\n      \"User can see a date picker input for each task\",\n      \"User can select a due date using the native date picker\",\n      \"User sees overdue tasks highlighted in red\",\n      \"User sees formatted date display (not YYYY-MM-DD)\",\n      \"Completed tasks are never marked as overdue\"\n    ],\n    \"artifacts\": [\n      {\n        \"path\": \"src/main.js\",\n        \"provides\": \"Date picker integration and event handling\",\n        \"modifications\": \"Add date input to render, add change event listener, integrate formatDate and isTodoOverdue\"\n      },\n      {\n        \"path\": \"src/style.css\",\n        \"provides\": \"Overdue task styling\",\n        \"modifications\": \"Add .overdue class with red border-left and text color\"\n      }\n    ],\n    \"key_links\": [\n      {\n        \"from\": \"date input onChange\",\n        \"to\": \"setDueDate\",\n        \"via\": \"event delegation\",\n        \"pattern\": \"todoList.addEventListener('change', ...)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"isTodoOverdue\",\n        \"via\": \"call for each todo\",\n        \"pattern\": \"const isOverdue = isTodoOverdue(todo)\"\n      },\n      {\n        \"from\": \"render\",\n        \"to\": \"formatDate\",\n        \"via\": \"display formatted date\",\n        \"pattern\": \"${formatDate(todo.dueDate)}\"\n      }\n    ]\n  },\n  \"tasks\": [\n    {\n      \"name\": \"Add date picker to todo item rendering\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"In the render() function's todo item HTML, add:\\n1. Native date input: <input type=\\\"date\\\" class=\\\"due-date-input\\\" value=\\\"${todo.dueDate || ''}\\\" data-id=\\\"${todo.id}\\\" aria-label=\\\"Due date\\\"> (value uses YYYY-MM-DD format, empty string if null)\\n2. Formatted date display: <span class=\\\"due-date-display ${isOverdue ? 'overdue' : ''}\\\">${formatDate(todo.dueDate)}</span> (call isTodoOverdue(todo) at start of loop, use formatDate for display)\\n3. Add isOverdue to li classList: class=\\\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\\\"\\n\\nPlace date input and display between todo text and edit/delete buttons. Input is always visible (research recommendation).\",\n      \"verify\": \"Add a todo, verify date picker appears for each todo item. Set a date, verify formatted date appears next to input.\",\n      \"done\": \"Each todo item shows a date picker and formatted date display\"\n    },\n    {\n      \"name\": \"Add change event handler for date picker\",\n      \"type\": \"auto\",\n      \"files\": [\"src/main.js\"],\n      \"action\": \"Add event delegation handler to todoList for date input changes:\\n\\ntodoList.addEventListener('change', (e) => {\\n  if (e.target.matches('.due-date-input')) {\\n    const todoId = e.target.dataset.id\\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\\n    setDueDate(todoId, dateString) // already handles storage.save and render\\n  }\\n})\\n\\nPlace this with other event listeners (toggle, delete, edit). Native date input fires 'change' event when user selects a date.\",\n      \"verify\": \"Set a due date for a todo, verify it persists on page refresh and sorts correctly\",\n      \"done\": \"Date picker changes persist to localStorage and trigger re-render with sorted order\"\n    },\n    {\n      \"name\": \"Add overdue task styling\",\n      \"type\": \"auto\",\n      \"files\": [\"src/style.css\"],\n      \"action\": \"Add CSS rules for overdue tasks:\\n\\n.todo-item.overdue {\\n  border-left: 3px solid #ef4444;\\n}\\n\\n.todo-item.overdue .todo-text,\\n.todo-item.overdue .due-date-display {\\n  color: #ef4444;\\n}\\n\\n.todo-item.overdue .due-date-display::before {\\n  content: '⚠ ';\\n}\\n\\nUsing #ef4444 (red) directly for danger color. Note: Future enhancement could extract to --color-danger custom property, but current codebase does not define this property. The border-left creates a subtle visual indicator without overwhelming the UI. Completed tasks should never have .overdue class (isTodoOverdue returns false for completed).\",\n      \"verify\": \"Create a todo with a past due date, verify it shows red border and text. Complete the task, verify red styling disappears. Create a todo with future due date, verify no red styling.\",\n      \"done\": \"Overdue tasks display red border-left and text color with warning icon, completed tasks never show overdue styling\"\n    }\n  ]\n}\n\n# Plan 02: Date Picker UI & Overdue Styling\n\n**Objective:** Add date picker UI, overdue styling, and formatted date display\n\n**Purpose:** Complete user-facing due date feature with visual feedback for overdue tasks\n\n**Output:** Working date picker with overdue indicators and date formatting in UI\n\n## Requirements\n\n### Observable Truths\n- User can see a date picker input for each task\n- User can select a due date using the native date picker\n- User sees overdue tasks highlighted in red\n- User sees formatted date display (not YYYY-MM-DD)\n- Completed tasks are never marked as overdue\n\n### Artifacts\n- **src/main.js** - Date picker integration and event handling\n- **src/style.css** - Overdue task styling\n\n### Key Links\n- date input onChange → setDueDate → render (user interaction flow)\n- render → isTodoOverdue (visual feedback)\n- render → formatDate (date display)\n\n## Tasks\n\n### Task 1: Add date picker to todo item rendering\n**Files:** src/main.js\n**Action:** Add native date input and formatted date display to render() function\n**Verify:** Date picker appears for each todo, formatted date displays\n**Done:** Each todo shows date picker and formatted date\n\n### Task 2: Add change event handler for date picker\n**Files:** src/main.js\n**Action:** Add event delegation for .due-date-input changes\n**Verify:** Date selection persists and triggers sort\n**Done:** Date picker changes save and re-render\n\n### Task 3: Add overdue task styling\n**Files:** src/style.css\n**Action:** Add .overdue class with red border-left and text color using #ef4444 directly\n**Verify:** Overdue tasks show red styling, completed tasks don't\n**Done:** Visual indicator for overdue tasks works correctly\n\n## Execution\n\n**Batch:** 2\n**Autonomous:** Yes\n**Depends on:** Plan 01"
        }
      ],
      "edges": [],
      "incoming_edges": [
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
          "from_name": "chapter-5-due-dates-research",
          "relation": "connects_to",
          "description": "Research findings connect to and inform planning for Chapter 5 implementation"
        },
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01",
          "from_name": "chapter-5-due-dates-plan-01",
          "relation": "implements",
          "description": "Plan 01 implements chapter 5 due dates feature"
        },
        {
          "from": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02",
          "from_name": "chapter-5-due-dates-plan-02",
          "relation": "implements",
          "description": "Plan 02 implements chapter 5 due dates feature UI layer"
        }
      ],
      "parent": {
        "id": "main/roadmap",
        "name": "roadmap"
      },
      "similarity": 0.6130737576376675
    },
    {
      "id": "main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research",
      "name": "chapter-5-due-dates-research",
      "kind": "pattern",

...215005 bytes truncated...

The tool call succeeded but the output was truncated. Full output saved to: /Users/mikaelj/.local/share/opencode/tool-output/tool_caece086a001VnQTKdk5u5Vkvf
Use the Task tool to have explore agent process this file with Grep and Read (with offset/limit). Do NOT read the full file yourself - delegate to save context.
```

---

## Assistant (Fuska-Planner · glm-5 · 7342.7s)

**Tool: task**

**Input:**
```json
{
  "description": "Re-verify Chapter 5 plans",
  "prompt": "<objective>\nRe-verify Chapter 5 plans after revisions to ensure all issues are resolved\n</objective>\n\n<chapter_data>\n{\n  \"name\": \"chapter-5-due-dates\",\n  \"goal\": \"Users can track deadlines and prioritize time-sensitive tasks\",\n  \"success_criteria\": [\n    \"User can set a due date for any task using a date picker\",\n    \"User sees visual indicator (red highlight) for overdue tasks\",\n    \"User can sort task list by due date (earliest first)\"\n  ]\n}\n</chapter_data>\n\n<plans>\n[\n  {\n    \"id\": \"main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01\",\n    \"name\": \"chapter-5-due-dates-plan-01\",\n    \"batch\": 1,\n    \"depends_on\": [],\n    \"autonomous\": true,\n    \"files_modified\": [\"src/main.js\"],\n    \"objective\": \"Extend todo data model with due dates and implement date utility functions\",\n    \"tasks\": [\n      {\n        \"name\": \"Extend todo model and add setDueDate function\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Add dueDate field (string | null, YYYY-MM-DD format) to new todo objects in the form submit handler. Create setDueDate(todoId, dateString) function that finds todo by id, updates todo.dueDate to dateString or null (if empty), calls storage.save(todos), and calls render(). Follow existing pattern from toggle/delete operations. The dueDate field should default to null for backward compatibility with existing todos. For existing todos loaded from localStorage, ensure missing dueDate field is handled gracefully - the formatDate() and sorting functions already handle null/undefined, so no migration step is needed since StorageService.load() returns todos as-is and all functions are defensive.\",\n        \"verify\": \"In browser console: Add a new todo, then run setDueDate(todoId, '2026-03-15'), check that localStorage contains the dueDate field and todo list re-renders\",\n        \"done\": \"New todos have dueDate: null field, setDueDate function persists changes to localStorage and triggers re-render\"\n      },\n      {\n        \"name\": \"Implement date utility functions\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Create three utility functions:\\n\\n1. isTodoOverdue(todo) - Returns false if !todo.dueDate OR todo.completed (critical: completed tasks never overdue). Normalize dates to start-of-day: today.setHours(0,0,0,0) and dueDate = new Date(todo.dueDate + 'T00:00:00') (avoids timezone bugs). Return dueDate < today.\\n\\n2. formatDate(dateString) - Returns empty string if !dateString. Create dateFormatter = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) at module level (reuse for performance). Return dateFormatter.format(new Date(dateString + 'T00:00:00')).\\n\\n3. getDisplayTodos() - Call getFilteredTodos(todos, currentFilter) first (Chapter 4 filter pattern), then sort the filtered result. Pattern: const filtered = getFilteredTodos(todos, currentFilter); return filtered.sort((a, b) => { if (a.dueDate && b.dueDate) { return new Date(a.dueDate) - new Date(b.dueDate) } if (a.dueDate && !b.dueDate) return -1; if (!a.dueDate && b.dueDate) return 1; return 0 }). Return sorted array.\",\n        \"verify\": \"In browser console: Test isTodoOverdue with past date (should return true), future date (false), completed task (false), null date (false). Test formatDate('2026-03-15') returns formatted string. Test getDisplayTodos() returns filtered and sorted array with null dates at end.\",\n        \"done\": \"All three utility functions work correctly with proper timezone handling, null handling, filter integration, and sorting behavior\"\n      },\n      {\n        \"name\": \"Integrate sort into render function\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Update render() function to use getDisplayTodos() which handles both filtering and sorting: const displayTodos = getDisplayTodos(). Replace direct 'todos' references in render with 'displayTodos'. The getDisplayTodos function calls getFilteredTodos(todos, currentFilter) first (Chapter 4 pattern), then sorts the filtered results by due date. This ensures the UI shows filtered tasks in sorted order without duplicating filter logic.\",\n        \"verify\": \"Create multiple todos with different due dates and null dates, set different filters (all/active/completed), verify they appear in sorted order (earliest first, null last) within each filter view\",\n        \"done\": \"Todo list displays filtered and sorted by due date, null dates appear at the end, filter state is preserved\"\n      }\n    ],\n    \"requirements\": {\n      \"truths\": [\n        \"Due dates can be stored and retrieved from the todo data model\",\n        \"Tasks can be sorted by due date with null dates appearing last\",\n        \"Overdue detection correctly identifies past-due incomplete tasks\",\n        \"Dates are formatted for human-readable display\"\n      ]\n    }\n  },\n  {\n    \"id\": \"main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02\",\n    \"name\": \"chapter-5-due-dates-plan-02\",\n    \"batch\": 2,\n    \"depends_on\": [\"chapter-5-due-dates-plan-01\"],\n    \"autonomous\": true,\n    \"files_modified\": [\"src/main.js\", \"src/style.css\"],\n    \"objective\": \"Add date picker UI, overdue styling, and formatted date display\",\n    \"tasks\": [\n      {\n        \"name\": \"Add date picker to todo item rendering\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"In the render() function's todo item HTML, add:\\n1. Native date input: <input type=\\\"date\\\" class=\\\"due-date-input\\\" value=\\\"${todo.dueDate || ''}\\\" data-id=\\\"${todo.id}\\\" aria-label=\\\"Due date\\\"> (value uses YYYY-MM-DD format, empty string if null)\\n2. Formatted date display: <span class=\\\"due-date-display ${isOverdue ? 'overdue' : ''}\\\">${formatDate(todo.dueDate)}</span> (call isTodoOverdue(todo) at start of loop, use formatDate for display)\\n3. Add isOverdue to li classList: class=\\\"todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}\\\"\\n\\nPlace date input and display between todo text and edit/delete buttons. Input is always visible (research recommendation).\",\n        \"verify\": \"Add a todo, verify date picker appears for each todo item. Set a date, verify formatted date appears next to input.\",\n        \"done\": \"Each todo item shows a date picker and formatted date display\"\n      },\n      {\n        \"name\": \"Add change event handler for date picker\",\n        \"type\": \"auto\",\n        \"files\": [\"src/main.js\"],\n        \"action\": \"Add event delegation handler to todoList for date input changes:\\n\\ntodoList.addEventListener('change', (e) => {\\n  if (e.target.matches('.due-date-input')) {\\n    const todoId = e.target.dataset.id\\n    const dateString = e.target.value // 'YYYY-MM-DD' or empty string\\n    setDueDate(todoId, dateString) // already handles storage.save and render\\n  }\\n})\\n\\nPlace this with other event listeners (toggle, delete, edit). Native date input fires 'change' event when user selects a date.\",\n        \"verify\": \"Set a due date for a todo, verify it persists on page refresh and sorts correctly\",\n        \"done\": \"Date picker changes persist to localStorage and trigger re-render with sorted order\"\n      },\n      {\n        \"name\": \"Add overdue task styling\",\n        \"type\": \"auto\",\n        \"files\": [\"src/style.css\"],\n        \"action\": \"Add CSS rules for overdue tasks:\\n\\n.todo-item.overdue {\\n  border-left: 3px solid #ef4444;\\n}\\n\\n.todo-item.overdue .todo-text,\\n.todo-item.overdue .due-date-display {\\n  color: #ef4444;\\n}\\n\\n.todo-item.overdue .due-date-display::before {\\n  content: '⚠ ';\\n}\\n\\nUsing #ef4444 (red) directly for danger color. Note: Future enhancement could extract to --color-danger custom property, but current codebase does not define this property. The border-left creates a subtle visual indicator without overwhelming the UI. Completed tasks should never have .overdue class (isTodoOverdue returns false for completed).\",\n        \"verify\": \"Create a todo with a past due date, verify it shows red border and text. Complete the task, verify red styling disappears. Create a todo with future due date, verify no red styling.\",\n        \"done\": \"Overdue tasks display red border-left and text color with warning icon, completed tasks never show overdue styling\"\n      }\n    ],\n    \"requirements\": {\n      \"truths\": [\n        \"User can see a date picker input for each task\",\n        \"User can select a due date using the native date picker\",\n        \"User sees overdue tasks highlighted in red\",\n        \"User sees formatted date display (not YYYY-MM-DD)\",\n        \"Completed tasks are never marked as overdue\"\n      ]\n    }\n  }\n]\n</plans>\n\n<verification_context>\n\n**Previous Issues (Now Addressed):**\n\n1. ~~Filter + Sort integration unclear~~ - FIXED: Plan 01 Task 2 and Task 3 now explicitly state that getDisplayTodos() calls getFilteredTodos() first, then sorts.\n\n2. ~~CSS custom property dependency assumed~~ - FIXED: Plan 02 Task 3 now uses #ef4444 directly with note about future extraction.\n\n3. ~~Backward compatibility handling~~ - FIXED: Plan 01 Task 1 now explains that functions are defensive and handle missing dueDate fields gracefully.\n\n</verification_context>\n\n<verification_dimensions>\nCheck each plan against:\n1. **Requirement coverage** - Does the plan address all requirements needed for the goal?\n2. **Task completeness** - Does each task have: name, type, files, action, verify, done?\n3. **Dependency correctness** - Are dependencies correctly identified? Are batches valid?\n4. **Key links planned** - Are critical connections between components identified?\n5. **Scope sanity** - Is the plan scope reasonable (2-3 tasks, ~50% context budget)?\n6. **Requirements derivation** - Are requirements properly derived from goal-backward analysis?\n</verification_dimensions>\n\n<output>\nReturn:\n- ## VERIFICATION PASSED (if all plans pass)\n- ## ISSUES FOUND (with structured issues list)\n</output>",
  "subagent_type": "fuska-plan-checker-panel"
}
```

**Output:**
```
task_id: ses_35130bb91ffeleohIZn7kw8Pkm (for resuming to continue this task if needed)

<task_result>
Let me perform the comprehensive panel verification by analyzing both plans systematically.

## QUALITY ADVOCATE VERIFICATION

### Plan 01: Data Model & Date Utilities

**Task 1: Extend todo model and add setDueDate function**
✅ File paths: Specific (src/main.js)
✅ Action: Detailed with dueDate format, null handling, existing patterns
✅ Verify: Console test with specific example
✅ Done: Clear criteria with backward compatibility
✅ Error handling: Leverages existing storage.save pattern

**Task 2: Implement date utility functions**
✅ File paths: Specific (src/main.js)
✅ Action: Very detailed with timezone handling (T00:00:00), null safety, filter integration
✅ Verify: Console tests for all three functions with edge cases
✅ Done: Clear completion criteria
✅ Edge cases: Null dates, timezone bugs, completed tasks

**Task 3: Integrate sort into render function**
✅ File paths: Specific (src/main.js)
✅ Action: Clear - use getDisplayTodos() which calls getFilteredTodos() then sorts
✅ Verify: Multiple todos with different dates and filters
✅ Done: Filtered and sorted correctly
✅ Integration: Explicit filter → sort pattern

### Plan 02: Date Picker UI & Overdue Styling

**Task 1: Add date picker to todo item rendering**
✅ File paths: Specific (src/main.js)
✅ Action: Detailed with native date input, formatted display, aria-labels
✅ Verify: Add todo, verify date picker appears
✅ Done: Each todo shows date picker and formatted display
✅ Accessibility: aria-label included

**Task 2: Add change event handler**
✅ File paths: Specific (src/main.js)
✅ Action: Detailed with event delegation pattern
✅ Verify: Set date, verify persistence and sorting
✅ Done: Changes persist and trigger re-render
✅ Event handling: Proper delegation

**Task 3: Add overdue task styling**
✅ File paths: Specific (src/style.css)
✅ Action: Detailed CSS with direct color (#ef4444), note about future extraction
✅ Verify: Overdue shows red, completed doesn't, future doesn't
✅ Done: Red styling with warning icon, completed tasks excluded
✅ Edge cases: Completed tasks never overdue

---

## DATA ARCHITECT VERIFICATION

**Data Model Changes:**
✅ Schema extension: dueDate field with format specification (YYYY-MM-DD)
✅ Null handling: Defensive programming in all utility functions
✅ Migration strategy: Explicit - no migration needed, functions handle missing fields
✅ Backward compatibility: Default null for new todos, graceful handling of existing

**Filter + Sort Integration:**
✅ getDisplayTodos() calls getFilteredTodos() first (Chapter 4 pattern)
✅ Then sorts filtered results
✅ No duplication of filter logic
✅ Clear separation: filter → sort → display

**CSS Dependency:**
✅ Uses direct color value (#ef4444)
✅ Note about future extraction to custom property
✅ No assumption of undefined variables

---

## CROSS-VALIDATION ANALYSIS

No issues were flagged by both checkers. The revised plans address all previous concerns:

1. ✅ Filter + Sort integration: Now explicitly states getDisplayTodos calls getFilteredTodos first
2. ✅ CSS dependency: Uses direct color value with future enhancement note
3. ✅ Backward compatibility: Explains defensive null handling throughout

---

## VERIFICATION PASSED

**Chapter:** chapter-5-due-dates
**Plans verified:** 2
**Checkers:** quality-advocate, data-architect

All checkers passed. No issues found.

### Plan Quality Assessment

**Plan 01 - Data Model & Date Utilities:**
- ✅ Complete task specifications with clear verify/done criteria
- ✅ Comprehensive edge case handling (null dates, timezone bugs, completed tasks)
- ✅ Explicit filter integration pattern
- ✅ Backward compatible with defensive programming

**Plan 02 - Date Picker UI & Overdue Styling:**
- ✅ Clear UI implementation details with accessibility
- ✅ Proper event delegation pattern
- ✅ Correct overdue logic (completed tasks never overdue)
- ✅ No undefined CSS dependencies

### Ready for Execution

The revised plans are **well-structured, complete, and ready for execution**. Run `/fuska-build chapter-5-due-dates` to proceed.
</task_result>
```

---

## Assistant (Fuska-Planner · glm-5 · 12.7s)

Perfect! All plans have passed verification. Let me update the state concept and present the final status.

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "state main",
  "top_k": 1
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/roadmap/chapter-2-core-operations/chapter-02-implementation",
      "name": "chapter-02-implementation",
      "kind": "component",
      "summary": "Chapter 2 implementation complete: State management with in-memory todos array, CRUD operations (add, toggle complete, delete with confirmation, inline edit), input validation (trim, non-empty check), visual feedback (strikethrough + 0.6 opacity for completed tasks, highlight animation for new tasks), event delegation pattern for efficient event handling, unidirectional data flow (action → update state → render). All 3 plans implemented in single batch.",
      "why": "Core CRUD functionality is the heart of the application - must work perfectly before adding persistence or advanced features",
      "file_refs": [
        "src/main.js:1-145",
        "src/style.css:240-340"
      ],
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-2-core-operations",
          "to_name": "chapter-2-core-operations",
          "relation": "implements",
          "description": "Complete implementation of chapter 2"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-2-core-operations",
        "name": "chapter-2-core-operations"
      },
      "similarity": 0.29617051400914707
    }
  ]
}
```

---

## Assistant (Fuska-Planner · glm-5 · 8.2s)

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "roadmap main",
  "top_k": 1
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/milestones",
      "name": "milestones",
      "kind": "module",
      "summary": "Initiative milestones tracking",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "part_of",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.35640901852462537
    }
  ]
}
```

---

## User

---

## Assistant (Compaction · glm-5 · 34.2s)

---
## Goal

The user initiated the `/fuska-plan 5` command to create executable chapter concepts (plan concepts) for Chapter 5 of a roadmap using the Fuska planning workflow with MegaMemory integration.

## Instructions

The workflow follows a specific process:
1. **Research** (if needed) → **Plan** → **Verify** → **Done**
2. Plans must be verified by a checker agent before finalizing
3. If issues found, iterate through revision loops (max 3 iterations)
4. Update state concept when complete
5. Present final status with next steps

**Key flags available:** `--research`, `--skip-research`, `--fixes`, `--skip-verify`, `--no-review`

## Discoveries

1. **Chapter 5: Due Dates** - Goal: "Users can track deadlines and prioritize time-sensitive tasks"
   - Requirements: ENHANCE-01 (date picker, overdue indicators, sort by date)
   - Success criteria: Set due dates, see red highlight for overdue, sort by date (earliest first)
   - Dependencies: Chapters 1-4 (all complete)

2. **Research Findings** (created `chapter-5-due-dates-research` concept):
   - Use native HTML5 `<input type="date">` for date picker (no dependencies)
   - Store dates as `YYYY-MM-DD` strings (or null)
   - Compare at start-of-day (setHours(0,0,0,0)) to avoid timezone bugs
   - Use Intl.DateTimeFormat for display (create once, reuse)
   - Exclude completed tasks from overdue detection
   - Sort with explicit null handling (null dates last)

3. **Plans Created** (2 plans in 2 batches):
   - **Plan 01**: Data Model & Date Utilities (Batch 1, src/main.js)
   - **Plan 02**: Date Picker UI & Overdue Styling (Batch 2, src/main.js, src/style.css)

4. **Verification Issues Found & Fixed** (Iteration 1):
   - HIGH: Filter + Sort integration unclear → Fixed: getDisplayTodos() now explicitly calls getFilteredTodos() first, then sorts
   - MEDIUM: CSS custom property assumption → Fixed: Now uses #ef4444 directly with note about future extraction
   - MEDIUM: Backward compatibility incomplete → Fixed: Clarified defensive function design handles missing fields

## Accomplished

- ✅ Preflight checks passed (MegaMemory validated, config found, chapter validated)
- ✅ Research spawned and completed (chapter-5-due-dates-research concept created)
- ✅ Planner spawned and created 2 plan concepts
- ✅ Checker verification ran (found 3 issues)
- ✅ Revision loop (iteration 1) - Planner fixed all 3 issues
- ✅ Re-verification passed (all checkers passed)

**Still in progress / next:**
- ⏳ Update state concept with chapter-5-due-dates status
- ⏳ Present final status output

## Relevant files / directories

**MegaMemory Concepts Created/Updated:**
- `main/roadmap/chapter-5-due-dates` - Chapter concept (exists)
- `main/roadmap/chapter-5-due-dates/chapter-5-due-dates-research` - Research concept (created)
- `main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-01` - Plan 01 concept (created, revised)
- `main/roadmap/chapter-5-due-dates/chapter-5-due-dates-plan-02` - Plan 02 concept (created, revised)

**Files to be modified during execution:**
- `src/main.js` - Date utilities (setDueDate, isTodoOverdue, formatDate, getDisplayTodos) + UI integration
- `src/style.css` - Overdue styling (.overdue class with red border-left, text color)

**Project location:** `/Users/mikaelj/code/fuska/main`

**Next steps to complete:**
1. Update state concept (set current_chapter: "chapter-5-due-dates", status: "ready_to_execute")
2. Present final status output (use the `<offer_next>` template from the workflow)
3. Offer user the option to run `/fuska-build 5` to execute the plans

---

---

## User

---

## Assistant (Fuska-Planner · glm-5 · 8.2s)

I'll complete the remaining steps: update the state concept and present the final status.

**Tool: megamemory_understand**

**Input:**
```json
{
  "query": "fuska state",
  "top_k": 5
}
```

**Output:**
```
{
  "matches": [
    {
      "id": "main/state",
      "name": "state",
      "kind": "config",
      "summary": "{\n  \"current_phase\": \"planned\",\n  \"current_chapter\": \"chapter-05\",\n  \"current_plan\": null,\n  \"status\": \"ready_for_build\",\n  \"progress\": 80,\n  \"roadmap\": {\n    \"total_chapters\": 5,\n    \"created\": \"2026-03-02\",\n    \"depth\": \"quick\",\n    \"coverage\": \"100%\"\n  },\n  \"chapter_01\": {\n    \"status\": \"complete\",\n    \"plan_count\": 3,\n    \"plans_completed\": 3,\n    \"batches\": 2,\n    \"planned_date\": \"2026-03-02\",\n    \"completed_date\": \"2026-03-02\"\n  },\n  \"chapter_02\": {\n    \"status\": \"complete\",\n    \"plan_count\": 3,\n    \"plans_completed\": 3,\n    \"batches\": 2,\n    \"planned_date\": \"2026-03-02\",\n    \"completed_date\": \"2026-03-02\"\n  },\n  \"chapter_03\": {\n    \"status\": \"complete\",\n    \"plan_count\": 2,\n    \"plans_completed\": 2,\n    \"batches\": 2,\n    \"planned_date\": \"2026-03-02\",\n    \"completed_date\": \"2026-03-02\"\n  },\n  \"chapter_04\": {\n    \"status\": \"complete\",\n    \"plan_count\": 2,\n    \"plans_completed\": 2,\n    \"batches\": 1,\n    \"planned_date\": \"2026-03-02\",\n    \"completed_date\": \"2026-03-02\",\n    \"commit\": \"ce45d8a\",\n    \"verification_score\": \"11/12\",\n    \"issues_found\": [\"Filter preference does not persist across page refreshes\"]\n  },\n  \"chapter_05\": {\n    \"status\": \"planned\",\n    \"plan_count\": 2,\n    \"plans_completed\": 0,\n    \"batches\": 2,\n    \"planned_date\": \"2026-03-02\"\n  },\n  \"last_activity\": \"2026-03-02T00:00:00.000Z\"\n}",
      "why": null,
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main",
          "to_name": "main",
          "relation": "configured_by",
          "description": null
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main",
        "name": "main"
      },
      "similarity": 0.1696940178054637
    },
    {
      "id": "main/roadmap/chapter-1-ui-foundation/chapter-01-verification",
      "name": "chapter-01-verification",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-01-ui-foundation\",\n  \"verified\": \"2026-03-02T08:30:00.000Z\",\n  \"status\": \"passed\",\n  \"score\": \"3/3 requirements verified\",\n  \"verification_results\": [\n    \"User can run the application and see it loads successfully\",\n    \"User sees proper HTML structure with form and input field\",\n    \"User sees empty state message when app loads\",\n    \"Screen reader users can skip to main content\",\n    \"User sees clean modern interface with proper visual hierarchy\",\n    \"User sees light gray background (#f4f6f8) and white cards\",\n    \"User sees blue accent color (#3b82f6) on interactive elements\",\n    \"User sees proper spacing and typography\",\n    \"User sees responsive layout that adapts to screen size\",\n    \"User can press Enter from input field to submit form\",\n    \"User can press Escape to clear input and cancel action\",\n    \"User can Tab through all interactive elements in logical order\",\n    \"User sees visual focus indicator on all interactive elements\"\n  ],\n  \"issues_found\": [],\n  \"recommendations\": [],\n  \"concepts_reviewed\": [\n    \"chapter-01-plan-01\",\n    \"chapter-01-plan-02\",\n    \"chapter-01-plan-03\"\n  ],\n  \"requirements\": {\n    \"UI-01\": {\n      \"description\": \"Clean modern UI with semantic HTML, CSS custom properties, responsive design\",\n      \"status\": \"satisfied\",\n      \"evidence\": [\n        \"HTML uses semantic elements: main, form, ul, li, section, button\",\n        \"CSS defines 28 custom properties in :root\",\n        \"Responsive breakpoints at 480px with mobile-first approach\",\n        \"All user-locked values correctly implemented: #f4f6f8, #ffffff, #3b82f6, 16px base, 8px unit, 600px max-width, 8/12px radius, 0 4px 20px shadow\"\n      ]\n    },\n    \"UI-05\": {\n      \"description\": \"Empty state message when no todos exist\",\n      \"status\": \"satisfied\",\n      \"evidence\": [\n        \"Empty state section in index.html (lines 40-50)\",\n        \"SVG icon (64x64px) with inbox design\",\n        \"Message: 'No tasks yet. Add your first task to get started!'\",\n        \"CSS styles empty-state with centered flex layout, 64px icon, responsive typography\"\n      ]\n    },\n    \"UI-06\": {\n      \"description\": \"Keyboard support: Enter to submit, Tab navigation, Escape to cancel\",\n      \"status\": \"satisfied\",\n      \"evidence\": [\n        \"Enter: Semantic <form> element provides built-in Enter submission, main.js has submit event listener\",\n        \"Tab: Semantic HTML provides natural tab order, no custom tabindex to disrupt it\",\n        \"Escape: main.js keydown listener (line 22) checks for Escape key, clears input, keeps focus\",\n        \"Focus indicators: CSS :focus-visible rule with 2px solid blue outline and 2px offset\"\n      ]\n    }\n  },\n  \"artifacts_verified\": [\n    {\n      \"path\": \"index.html\",\n      \"exists\": true,\n      \"lines\": 58,\n      \"substantive\": true,\n      \"wired\": true,\n      \"features\": [\n        \"Semantic HTML structure (main, form, ul, li)\",\n        \"Skip link for accessibility\",\n        \"Form with input and submit button\",\n        \"Empty state with SVG icon and message\",\n        \"ARIA attributes (aria-label, aria-hidden)\",\n        \"Visually hidden label for screen readers\"\n      ]\n    },\n    {\n      \"path\": \"src/main.js\",\n      \"exists\": true,\n      \"lines\": 35,\n      \"substantive\": true,\n      \"wired\": true,\n      \"features\": [\n        \"Imports style.css\",\n        \"Gets DOM elements (form, input)\",\n        \"Form submit handler with preventDefault\",\n        \"Input value trimming\",\n        \"Input clearing after submission\",\n        \"Escape key handler with focus management\"\n      ]\n    },\n    {\n      \"path\": \"src/style.css\",\n      \"exists\": true,\n      \"lines\": 239,\n      \"substantive\": true,\n      \"wired\": true,\n      \"features\": [\n        \"28 CSS custom properties defined\",\n        \"All user-locked values correctly implemented\",\n        \"Base styles with box-sizing and body reset\",\n        \"Form styling with flexbox, card appearance, shadow\",\n        \"Empty state styling with centered layout\",\n        \"Accessibility styles (skip link, visually hidden, focus-visible)\",\n        \"Responsive breakpoints at 480px\"\n      ]\n    },\n    {\n      \"path\": \"package.json\",\n      \"exists\": true,\n      \"lines\": 14,\n      \"substantive\": true,\n      \"wired\": true,\n      \"features\": [\n        \"Vite 6.2.0 dependency\",\n        \"dev/build/preview scripts\",\n        \"ES modules type\"\n      ]\n    },\n    {\n      \"path\": \"vite.config.js\",\n      \"exists\": true,\n      \"lines\": 13,\n      \"substantive\": true,\n      \"wired\": true,\n      \"features\": [\n        \"Server configuration on port 5173\",\n        \"Build output directory\"\n      ]\n    }\n  ],\n  \"key_links_verified\": [\n    {\n      \"from\": \"index.html\",\n      \"to\": \"src/main.js\",\n      \"via\": \"script module import\",\n      \"status\": \"wired\",\n      \"evidence\": \"Line 56: <script type='module' src='/src/main.js'>\"\n    },\n    {\n      \"from\": \"src/main.js\",\n      \"to\": \"src/style.css\",\n      \"via\": \"ES module import\",\n      \"status\": \"wired\",\n      \"evidence\": \"Line 2: import './style.css'\"\n    },\n    {\n      \"from\": \"src/main.js\",\n      \"to\": \"index.html\",\n      \"via\": \"DOM event listeners\",\n      \"status\": \"wired\",\n      \"evidence\": \"getElementById('todo-form'), getElementById('todo-input'), addEventListener for submit and keydown\"\n    },\n    {\n      \"from\": \"src/style.css\",\n      \"to\": \"index.html\",\n      \"via\": \"class selectors\",\n      \"status\": \"wired\",\n      \"evidence\": \"All HTML classes (container, todo-form, empty-state, skip-link, visually-hidden, empty-icon, empty-message) defined in CSS\"\n    }\n  ],\n  \"antipattern_scan\": {\n    \"scan_date\": \"2026-03-02\",\n    \"files_scanned\": [\"index.html\", \"src/main.js\", \"src/style.css\"],\n    \"blockers\": [],\n    \"warnings\": [],\n    \"info\": []\n  },\n  \"human_verification\": [\n    {\n      \"test\": \"Visual appearance verification\",\n      \"description\": \"Verify the UI looks clean, modern, and has proper visual hierarchy\",\n      \"expected\": \"User should see a professional-looking todo interface with clear visual hierarchy (title, form, empty state)\",\n      \"why_human\": \"Cannot programmatically verify aesthetic qualities\"\n    },\n    {\n      \"test\": \"Responsive behavior\",\n      \"description\": \"Resize browser window to test breakpoints\",\n      \"expected\": \"Layout should adapt smoothly at 480px breakpoint (container padding increases from 20px to 30px, button padding adjusts)\",\n      \"why_human\": \"Requires interactive testing with browser resize\"\n    },\n    {\n      \"test\": \"Touch target verification\",\n      \"description\": \"Verify 44px minimum touch targets feel appropriate on mobile\",\n      \"expected\": \"All interactive elements (input, button) should be easily tappable on mobile devices\",\n      \"why_human\": \"Requires mobile device or emulator testing\"\n    },\n    {\n      \"test\": \"Skip link behavior\",\n      \"description\": \"Press Tab key to verify skip link appears and works\",\n      \"expected\": \"Skip link should appear when focused, clicking it should jump to main-content\",\n      \"why_human\": \"Requires keyboard interaction testing\"\n    },\n    {\n      \"test\": \"Focus indicator visibility\",\n      \"description\": \"Tab through interactive elements and verify focus indicators\",\n      \"expected\": \"2px solid blue outline with 2px offset should be clearly visible on all interactive elements\",\n      \"why_human\": \"Requires keyboard interaction testing\"\n    }\n  ],\n  \"re_verification\": false\n}\n\n# Chapter 1 Verification Report\n\n**Status:** ✅ PASSED  \n**Score:** 3/3 requirements verified (100%)  \n**Verified:** 2026-03-02\n\n## Summary\n\nChapter 1 (UI Foundation) has been verified against the chapter goal: **\"Users see a clean, responsive, accessible todo interface ready for task management\"**\n\nAll automated verification checks passed successfully. The implementation is complete, substantive (not stubs), and properly wired together.\n\n## Requirements Verified\n\n### ✅ UI-01: Clean modern UI with semantic HTML, CSS custom properties, responsive design\n\n**Evidence:**\n- HTML uses semantic elements: `<main>`, `<form>`, `<ul>`, `<li>`, `<section>`, `<button>`\n- CSS defines 28 custom properties in `:root` for theming\n- Responsive breakpoints at 480px with mobile-first approach\n- All user-locked values correctly implemented:\n  - Background: #f4f6f8\n  - Cards: #ffffff\n  - Accent: #3b82f6\n  - Typography: system-ui stack, 16px base\n  - Spacing: 8px unit system (4/8/16/20/30px)\n  - Layout: 600px max-width, 8/12px border radius\n  - Shadow: 0 4px 20px rgba(0,0,0,0.1)\n\n### ✅ UI-05: Empty state message when no todos exist\n\n**Evidence:**\n- Empty state section in index.html (lines 40-50)\n- SVG icon (64x64px) with inbox design\n- Friendly message: \"No tasks yet. Add your first task to get started!\"\n- CSS styles: centered flex layout, 64px icon, responsive typography with clamp()\n\n### ✅ UI-06: Keyboard support: Enter to submit, Tab navigation, Escape to cancel\n\n**Evidence:**\n- **Enter:** Semantic `<form>` element provides built-in Enter key submission, main.js has submit event listener\n- **Tab:** Semantic HTML provides natural tab order (no custom tabindex)\n- **Escape:** main.js keydown listener checks for Escape key, clears input, keeps focus\n- **Focus indicators:** CSS `:focus-visible` rule with 2px solid blue outline and 2px offset\n\n## Artifacts Verified (3-Level Check)\n\nAll 5 artifacts passed the 3-level verification (existence, substantive, wired):\n\n| Artifact | Exists | Substantive | Wired | Lines | Status |\n|----------|--------|-------------|-------|-------|--------|\n| index.html | ✅ | ✅ | ✅ | 58 | VERIFIED |\n| src/main.js | ✅ | ✅ | ✅ | 35 | VERIFIED |\n| src/style.css | ✅ | ✅ | ✅ | 239 | VERIFIED |\n| package.json | ✅ | ✅ | ✅ | 14 | VERIFIED |\n| vite.config.js | ✅ | ✅ | ✅ | 13 | VERIFIED |\n\n**No stubs, placeholders, or incomplete implementations found.**\n\n## Key Links Verified\n\nAll critical connections are properly wired:\n\n1. **HTML → JavaScript** ✅  \n   Script module import in index.html (line 56)\n\n2. **JavaScript → CSS** ✅  \n   ES module import in main.js (line 2)\n\n3. **JavaScript → HTML** ✅  \n   DOM event listeners for form submit and input keydown\n\n4. **CSS → HTML** ✅  \n   All HTML classes defined in CSS with proper styling\n\n## Observable Truths Verified\n\nAll 13 observable truths from the 3 plans have been verified:\n\n**Plan 01 - Project Setup & HTML Structure:**\n- ✅ User can run the application and see it loads successfully\n- ✅ User sees proper HTML structure with form and input field\n- ✅ User sees empty state message when app loads\n- ✅ Screen reader users can skip to main content\n\n**Plan 02 - CSS Styling & Responsive Design:**\n- ✅ User sees clean modern interface with proper visual hierarchy\n- ✅ User sees light gray background (#f4f6f8) and white cards\n- ✅ User sees blue accent color (#3b82f6) on interactive elements\n- ✅ User sees proper spacing and typography\n- ✅ User sees responsive layout that adapts to screen size\n\n**Plan 03 - Keyboard Interactivity:**\n- ✅ User can press Enter from input field to submit form\n- ✅ User can press Escape to clear input and cancel action\n- ✅ User can Tab through all interactive elements in logical order\n- ✅ User sees visual focus indicator on all interactive elements\n\n## Anti-Pattern Scan\n\n**Files scanned:** index.html, src/main.js, src/style.css  \n**Blockers found:** 0  \n**Warnings found:** 0  \n**Info found:** 0\n\nNo TODO comments, FIXME, placeholder content, or stub implementations detected.\n\n## Human Verification Required\n\nWhile all automated checks passed, the following items require human testing:\n\n### 1. Visual Appearance Verification\n**Test:** Open the app and verify it looks clean and modern  \n**Expected:** Professional-looking todo interface with clear visual hierarchy  \n**Why human:** Cannot programmatically verify aesthetic qualities\n\n### 2. Responsive Behavior\n**Test:** Resize browser window to test breakpoints  \n**Expected:** Layout adapts smoothly at 480px (padding changes, button sizing adjusts)  \n**Why human:** Requires interactive testing with browser resize\n\n### 3. Touch Target Verification\n**Test:** Verify 44px minimum touch targets on mobile  \n**Expected:** All interactive elements easily tappable  \n**Why human:** Requires mobile device or emulator testing\n\n### 4. Skip Link Behavior\n**Test:** Press Tab key to verify skip link appears and works  \n**Expected:** Skip link appears when focused, clicking jumps to main-content  \n**Why human:** Requires keyboard interaction testing\n\n### 5. Focus Indicator Visibility\n**Test:** Tab through elements and verify focus indicators  \n**Expected:** 2px solid blue outline clearly visible on all interactive elements  \n**Why human:** Requires keyboard interaction testing\n\n## Conclusion\n\n**Chapter 1 has achieved its goal.** The implementation is complete, well-structured, and ready for Chapter 2 (Core Task Operations). All automated verification checks passed with no issues found.\n\nThe only remaining items are human verification tests for visual and interactive qualities that cannot be verified programmatically. These are expected for UI work and do not block progression to the next chapter.",
      "why": null,
      "file_refs": [
        "index.html",
        "src/main.js",
        "src/style.css",
        "package.json",
        "vite.config.js"
      ],
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation",
          "to_name": "chapter-1-ui-foundation",
          "relation": "connects_to",
          "description": "Verifies chapter 1 achieved its goal"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.16185255517985556
    },
    {
      "id": "main/roadmap/chapter-1-ui-foundation/chapter-01-plan-03-summary",
      "name": "chapter-01-plan-03-summary",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-01\",\n  \"plan\": \"chapter-01-plan-03\",\n  \"subsystem\": \"ui-interactivity\",\n  \"tags\": [\"keyboard\", \"accessibility\", \"events\", \"svg\", \"empty-state\"],\n  \"requires\": [\"chapter-01-plan-01\", \"chapter-01-plan-02\"],\n  \"provides\": [\"keyboard-navigation\", \"form-submission\", \"escape-key-handler\", \"svg-icon-complete\"],\n  \"affects\": [\"src/main.js\", \"index.html\"],\n  \"tech_stack\": {\n    \"added\": [],\n    \"patterns\": [\"event-listeners\", \"dom-manipulation\", \"keyboard-events\"]\n  },\n  \"key_files\": {\n    \"created\": [],\n    \"modified\": [\"src/main.js\"]\n  },\n  \"key_decisions\": [],\n  \"accomplishments\": [\n    \"Added form submission handler with Enter key support via semantic HTML form element\",\n    \"Implemented Escape key handler to clear input and maintain focus\",\n    \"Verified Tab navigation handled by semantic HTML (form → input → button)\",\n    \"Confirmed focus indicators already handled by CSS :focus-visible\",\n    \"Verified inline SVG icon for empty state is complete and styled at 64x64px with muted color\"\n  ],\n  \"task_commits\": [],\n  \"files_modified\": [\"src/main.js\"],\n  \"decisions_made\": {},\n  \"deviations\": [],\n  \"issues_encountered\": [],\n  \"next_chapter_readiness\": \"ready\"\n}\n\n## Summary\n\n### Accomplishments\n- Added form submission handler with Enter key support via semantic HTML form element\n- Implemented Escape key handler to clear input and maintain focus\n- Verified Tab navigation handled by semantic HTML (form → input → button)\n- Confirmed focus indicators already handled by CSS :focus-visible\n- Verified inline SVG icon for empty state is complete and styled at 64x64px with muted color\n\n### Key Files\n- **Created:** none\n- **Modified:** src/main.js\n\n### Technical Details\n\n**Keyboard Event Handlers Added:**\n1. **Form Submit Event:** Listens for form submission (Enter key or button click), prevents default, trims input, logs to console, and clears input field\n2. **Escape Key Handler:** Listens for Escape key on input, clears input value, maintains focus on input, prevents default behavior\n\n**Accessibility Features:**\n- Tab order: Automatically handled by semantic HTML elements (form → input → button)\n- Focus indicators: Already implemented via CSS :focus-visible (2px solid accent color with 2px offset)\n- No custom tabindex or JavaScript focus management needed\n\n**SVG Icon:**\n- Inline SVG with inbox-style design already in place\n- Styled via .empty-icon CSS class at 64x64px\n- Muted color (var(--color-text-muted)) applied via CSS\n- aria-hidden=\"true\" for screen reader compatibility",
      "why": "Documents execution of chapter-01-plan-03 which added keyboard event handlers and verified empty state SVG icon",
      "file_refs": [
        "src/main.js"
      ],
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-1-ui-foundation",
          "to_name": "chapter-1-ui-foundation",
          "relation": "connects_to",
          "description": "Plan completes UI foundation chapter"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-1-ui-foundation",
        "name": "chapter-1-ui-foundation"
      },
      "similarity": 0.1580470112164128
    },
    {
      "id": "main/roadmap/chapter-4-filtering-management/chapter-04-plan-01-summary",
      "name": "chapter-04-plan-01-summary",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-04\",\n  \"plan\": \"chapter-04-plan-01\",\n  \"subsystem\": \"filtering-management\",\n  \"tags\": [\"filter\", \"task-counts\", \"clear-completed\", \"empty-states\", \"accessibility\"],\n  \"requires\": [],\n  \"provides\": [\"Filter controls\", \"Task count display\", \"Clear completed functionality\", \"Filter-specific empty states\"],\n  \"affects\": [\"index.html\", \"src/main.js\", \"src/style.css\"],\n  \"tech_stack\": {\n    \"added\": [],\n    \"patterns\": [\"Event delegation\", \"Filter state management\", \"Real-time count updates\", \"Conditional rendering\"]\n  },\n  \"key_files\": {\n    \"created\": [],\n    \"modified\": [\"index.html\", \"src/main.js\", \"src/style.css\"]\n  },\n  \"key_decisions\": [],\n  \"accomplishments\": [\n    \"Added filter state management with currentFilter variable (default: 'all')\",\n    \"Implemented getFilteredTodos() function for filtering by status\",\n    \"Implemented getTaskCounts() function for real-time count updates\",\n    \"Added filter controls HTML with All/Active/Completed buttons and aria-pressed attributes\",\n    \"Added todo-footer section with Clear Completed button\",\n    \"Added complete CSS styling for filter controls and footer\",\n    \"Implemented filter button click handler with event delegation\",\n    \"Updated render() to use filtered todos and display counts\",\n    \"Implemented updateClearCompletedButton() to show/hide button based on completed count\",\n    \"Added Clear Completed button handler with confirmation dialog\",\n    \"Implemented filter-specific empty states with different messages and icons\",\n    \"All filter states (All/Active/Completed) have unique empty state messages\"\n  ],\n  \"task_commits\": [],\n  \"files_modified\": [\"index.html\", \"src/main.js\", \"src/style.css\"],\n  \"decisions_made\": {},\n  \"deviations\": [],\n  \"issues_encountered\": [],\n  \"next_chapter_readiness\": \"ready\",\n  \"self_check\": \"PASSED\"\n}\n\n## Summary\n\n### Accomplishments\n- Added filter state management with currentFilter variable (default: 'all')\n- Implemented getFilteredTodos() function for filtering by status\n- Implemented getTaskCounts() function for real-time count updates\n- Added filter controls HTML with All/Active/Completed buttons and aria-pressed attributes\n- Added todo-footer section with Clear Completed button\n- Added complete CSS styling for filter controls and footer\n- Implemented filter button click handler with event delegation\n- Updated render() to use filtered todos and display counts\n- Implemented updateClearCompletedButton() to show/hide button based on completed count\n- Added Clear Completed button handler with confirmation dialog\n- Implemented filter-specific empty states with different messages and icons\n- All filter states (All/Active/Completed) have unique empty state messages\n\n### Key Files\n- **Created:** none\n- **Modified:** index.html, src/main.js, src/style.css\n\n### Technical Details\n\n**Filter State Management:**\n- `currentFilter` state variable initialized to 'all'\n- `getFilteredTodos()`: Returns filtered array based on current filter\n- `getTaskCounts()`: Returns object with total, active, and completed counts\n\n**Filter Controls HTML:**\n- Section with aria-label='Filter tasks'\n- Task count span displaying \"N total • N active • N completed\"\n- Filter buttons group with aria-label='Task filters'\n- Buttons with data-filter and aria-pressed attributes\n- Todo footer section with Clear Completed button\n\n**CSS Styling:**\n- .filter-controls: Flex container with gap, card styling\n- .filter-btn: Transparent buttons with hover/active states\n- .filter-btn.active: Accent color and bold font weight\n- .todo-footer: Flex container with space-between layout\n- .clear-completed-btn: Transparent button with accent color, hover underline\n\n**Event Handlers:**\n- Filter click handler with event delegation on parent container\n- Updates currentFilter state and active button classes\n- Updates aria-pressed attributes for accessibility\n- Clear Completed button with confirmation dialog\n- Shows/hides based on completed task count\n\n**Empty States:**\n- 'All' filter: \"No tasks yet. Add your first task to get started!\" (inbox icon)\n- 'Active' filter: \"No active tasks. All caught up!\" (checkmark icon)\n- 'Completed' filter: \"No completed tasks yet. Keep up the good work!\" (star icon)\n\n**Accessibility Features:**\n- Tab navigation through filter buttons\n- aria-pressed state on filter buttons\n- aria-label on sections for screen readers\n- Focus indicators via CSS :focus-visible\n- 44px minimum touch targets on all buttons",
      "why": "Documents successful execution of chapter-04-plan-01 implementing filter controls with task counts and real-time display updates",
      "file_refs": null,
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-4-filtering-management/chapter-04-plan-01",
          "to_name": "chapter-04-plan-01",
          "relation": "implements",
          "description": "Summary implements plan execution"
        },
        {
          "to": "main/roadmap/chapter-4-filtering-management",
          "to_name": "chapter-4-filtering-management",
          "relation": "connects_to",
          "description": "Plan summary for chapter"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-4-filtering-management",
        "name": "chapter-4-filtering-management"
      },
      "similarity": 0.1459269764561099
    },
    {
      "id": "main/roadmap/chapter-4-filtering-management/chapter-04-plan-02-summary",
      "name": "chapter-04-plan-02-summary",
      "kind": "component",
      "summary": "{\n  \"chapter\": \"chapter-04\",\n  \"plan\": \"chapter-04-plan-02\",\n  \"subsystem\": \"task-management\",\n  \"tags\": [\"clear-completed\", \"bulk-delete\", \"filter-states\", \"empty-states\"],\n  \"requires\": [\"chapter-04-plan-01\"],\n  \"provides\": [\"Clear completed functionality\", \"Filter-specific empty states\"],\n  \"affects\": [\"src/main.js\"],\n  \"tech_stack\": {\n    \"added\": [],\n    \"patterns\": [\"event-handlers\", \"confirmation-dialogs\", \"dynamic-empty-states\"]\n  },\n  \"key_files\": {\n    \"created\": [],\n    \"modified\": [\"src/main.js\"]\n  },\n  \"key_decisions\": [],\n  \"accomplishments\": [\n    \"Verified clear completed handler works with confirmation dialog\",\n    \"Verified filter-specific empty states for all three filters\",\n    \"Confirmed clear completed button visibility toggles correctly\",\n    \"Verified task counts update after clearing completed tasks\"\n  ],\n  \"task_commits\": [],\n  \"files_modified\": [\"src/main.js\"],\n  \"decisions_made\": {},\n  \"deviations\": [],\n  \"issues_encountered\": [\"Implementation was already completed in previous plan\"],\n  \"next_chapter_readiness\": \"ready\",\n  \"self_check\": \"PASSED\"\n}\n\n## Summary\n\n### Accomplishments\n- Verified clear completed handler works with confirmation dialog\n- Verified filter-specific empty states for all three filters\n- Confirmed clear completed button visibility toggles correctly\n- Verified task counts update after clearing completed tasks\n\n### Key Files\n- **Created:** none\n- **Modified:** src/main.js\n\n### Implementation Details\n\n**Clear Completed Handler (lines 269-280):**\n- Filters completed tasks\n- Shows confirmation dialog with count\n- Removes all completed tasks from state\n- Saves to localStorage and re-renders\n\n**Clear Completed Button Visibility (lines 263-266):**\n- Disabled when completedCount === 0\n- Hidden when completedCount === 0\n- Visible when completedCount > 0\n\n**Filter-Specific Empty States (lines 59-94):**\n1. **'All' filter:** \"No tasks yet. Add your first task to get started!\" with inbox icon\n2. **'Active' filter:** \"No active tasks. All caught up!\" with checkmark icon\n3. **'Completed' filter:** \"No completed tasks yet. Keep up the good work!\" with star icon\n\nAll requirements met:\n✓ User can click 'Clear Completed' button (appears only when there are completed tasks)\n✓ User sees confirmation dialog before completed tasks are deleted\n✓ All completed tasks are removed from the list at once\n✓ User sees updated task counts (completed count goes to 0)\n✓ Active filter shows 'No active tasks' empty state when all tasks are completed\n✓ Completed filter shows 'No completed tasks' empty state when all tasks are active\n✓ All filter shows default empty state when all tasks are deleted",
      "why": "Documents completion of chapter-04-plan-02: clear completed functionality and filter-specific empty states",
      "file_refs": [
        "src/main.js"
      ],
      "children": [],
      "edges": [
        {
          "to": "main/roadmap/chapter-4-filtering-management",
          "to_name": "chapter-4-filtering-management",
          "relation": "connects_to",
          "description": "Summary is part of chapter-04"
        }
      ],
      "incoming_edges": [],
      "parent": {
        "id": "main/roadmap/chapter-4-filtering-management",
        "name": "chapter-4-filtering-management"
      },
      "similarity": 0.13834454819914765
    }
  ]
}
```

---

## Assistant (Fuska-Planner · glm-5 · 19.0s)

The state concept shows Chapter 5 is already marked as "planned" with 2 plans created. The planning workflow is complete - all verification passed. Let me present the final status:

---

## ✅ PLANNING COMPLETE

**Chapter:** `chapter-5-due-dates`  
**Plans:** 2 plan(s) in 2 batch(es)

### Batch Structure

| Batch | Plans | Autonomous |
|-------|-------|------------|
| 1 | chapter-5-due-dates-plan-01 | yes |
| 2 | chapter-5-due-dates-plan-02 | yes |

### Plans Created

| Plan | Objective | Tasks | Files |
|------|-----------|-------|-------|
| **plan-01** | Data Model & Date Utilities | 2 | src/main.js |
| **plan-02** | Date Picker UI & Overdue Styling | 2 | src/main.js, src/style.css |

### Key Decisions from Research

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Date picker | Native HTML5 `<input type="date">` | No dependencies, works everywhere |
| Date storage | `YYYY-MM-DD` string or null | Simple, no timezone issues |
| Date comparison | Start-of-day (`setHours(0,0,0,0)`) | Avoids timezone edge cases |
| Display formatting | `Intl.DateTimeFormat` (create once, reuse) | Locale-aware, performant |
| Overdue logic | Exclude completed tasks | Prevents clutter |
| Sort behavior | Null dates last | Natural ordering |

### Verification Status

✅ All checkers passed after revision (3 issues fixed)

---

### Next Steps

Execute the plans:

```
/fuska-build 5
```

Run `/new` first for a fresh context window before building.

---

