---
name: fuska-plan
description: Create detailed execution plan for a chapter with MegaMemory and verification loop
argument-hint: "[chapter] [--research] [--skip-research] [--fixes] [--skip-verify] [--no-review]"
agent: "fuska-planner"
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

<output_requirements>
OUTPUT FORMAT REQUIREMENTS:
- MUST output plan summary before asking questions
- MUST NOT skip text output and jump directly to question tool
- MUST display all context (plan objective, tasks) visibly to user
- MUST format output as markdown, not as code blocks
</output_requirements>

<objective>

Create executable chapter concepts (plan concepts) for a roadmap chapter with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate chapter, research domain (unless skipped), spawn fuska-planner agent, verify plans with fuska-plan-checker-jury, iterate until plans pass or max iterations, present results.

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

Chapter number: `$ARGUMENTS` (optional - auto-detects next unplanned chapter)

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
| fuska-plan-checker-jury | balanced_model | balanced_model | budget_model |

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
const visionModel = aliases.vision_model || aliases.quality_model
const visionMode = aliases.vision_model ? "native" : "mcp"
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

## 6.5. Vision Pre-Processing (if images detected)

Scan chapter goal, research data, and requirements for image file paths:

```
const imagePattern = /(?:^|\s)(\S+\.(?:png|jpe?g|gif|bmp|webp|svg))(?:\s|$)/gi
const goalText = chapterData?.goal || ""
const researchText = researchData ? JSON.stringify(researchData) : ""
const reqText = requirements ? JSON.stringify(requirements) : ""
const allText = `${goalText} ${researchText} ${reqText}`
const imageMatches = [...allText.matchAll(imagePattern)]
const uniqueImages = [...new Map(imageMatches.map(m => [m[1].trim(), m[1].trim()])).values()]
```

If no images found: skip to Step 7.

Display: `Vision: Analyzing ${uniqueImages.length} image(s)...`

For each image, spawn fuska-vision-reader:

```
Task(
  subagent_type="fuska-vision-reader",
  model=visionModel,
  description=`Analyze image: ${imagePath}`,
  prompt=`<vision_mode>${visionMode}</vision_mode>
${visionMode === "native" ? "<critical>Do NOT call any MCP vision tools (vision_analyze_image, etc.). You MUST analyze the image using your native model vision only. MCP tools are for fallback mode only.</critical>" : ""}

<objective>Analyze the image at ${imagePath} for chapter planning context.</objective>

<image_context>
Path: ${imagePath}
Task: Plan chapter ${chapterNumber} — ${chapterData?.goal || ""}
</image_context>

<output>
Return: ## VISION COMPLETE with Visual Facts and Suggested Fix Plan
</output>`
)
```

Error handling: If vision-reader returns `## VISION FAILED`, log warning and continue. If ALL images fail, proceed without vision context.

Collect results:

```
const visionContext = visionResults.filter(r => !r.text.includes('VISION FAILED')).map(r => r.text).join('\n---\n')
```

Inject into planner prompt in Step 7.

```
const plannerPrompt = filled_prompt + (visionContext ? `\n\n<vision_context>\n${visionContext}\n</vision_context>` : '')
```

---

## 7. Spawn fuska-planner Agent

Display banner:
```
-----------------------------------------------------
 Fuska: PLANNING CHAPTER {X}
-----------------------------------------------------
```

Build prompt using **plan-prompts.md Planner Prompt Template**. Fill placeholders with cached data from step 6. Inline the actual JSON summaries for stateData, roadmapData, requirements, contextData, researchData, verificationData, import graph context, and visionContext (if available from Step 6.5).

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

## 10. Spawn fuska-plan-checker-jury Agent

Display banner:
```
-----------------------------------------------------
 Fuska: VERIFYING PLANS
-----------------------------------------------------
```

Build prompt using **plan-prompts.md Checker Panel Prompt Template**. Fill with plan data from step 9, chapter data from step 3, and checker panel config from step 1.

```
Task(
  subagent_type="fuska-plan-checker-jury",
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

**CRITICAL: Output this text directly to the user as markdown. Do NOT use tool calls for this output:**

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

**❌ WRONG - DO NOT DO THIS:**
- Skip plan summary output
- Jump directly to execution suggestion
- Output summary as code block

**✅ CORRECT - ALWAYS DO THIS:**
- Display plan summary with batch table FIRST
- THEN suggest next step
- Format as markdown with proper headers

</offer_next>

<success_criteria>

- [ ] MegaMemory validated
- [ ] Chapter validated
- [ ] Research completed (unless skipped/exists)
- [ ] fuska-planner spawned with context
- [ ] Plan concepts created
- [ ] fuska-plan-checker-jury spawned (unless --skip-verify)
- [ ] Verification passed OR user override
- [ ] Interactive review loop (unless --no-review)
- [ ] State concept updated
- [ ] User knows next steps

</success_criteria>
