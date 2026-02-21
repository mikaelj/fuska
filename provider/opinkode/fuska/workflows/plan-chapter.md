---
name: fuska-plan-megamemory
description: Create detailed execution plan for a chapter with MegaMemory and verification loop
argument-hint: "[chapter] [--research] [--skip-research] [--fixes] [--skip-verify]"
agent: fuska-planner
tools:
  - read
  - bash

  - webfetch
  - megamemory-understand
  - megamemory-create-concept
  - megamemory-update-concept

---

@../references/megamemory-integration.md

<objective>

Create executable chapter concepts (plan concepts) for a roadmap chapter with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate chapter, research domain (unless skipped or exists), spawn fuska-planner agent, verify plans with fuska-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees flow between agents in main context.

</objective>

<execution_context>

@fuska-opencode/fuska-opencode/integration/src/chapter-templates.ts
@fuska-opencode/fuska-opencode/integration/src/helpers.ts

</execution_context>

<context>

Chapter number: `$ARGUMENTS` (optional - auto-detects next unplanned chapter if not provided)

**Flags:**
- `--research` — Force re-research even if research concept exists
- `--skip-research` — Skip research entirely, go straight to planning
- `--fixes` — Fix planning mode (uses verification concept for issues, skips research)
- `--skip-verify` — Skip planner → checker verification loop

Normalize chapter input in step 2 before any MegaMemory lookups.

</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
# Check MegaMemory is available
megamemory list_roots
```

**If not found:** Error - user should run `fuska init` first.

**Resolve model profile for agent spawning:**

```bash
# Query config concept for model profile
CONFIG_RESULTS=$(megamemory understand "config" top_k=5)
# Extract model_profile and model_aliases from JSON summary
MODEL_PROFILE=$(echo $CONFIG_RESULTS | ... extract model_profile ...)
ALIASES=$(echo $CONFIG_RESULTS | ... extract model_aliases or use defaults ...)
```

Default to "balanced" if not set. Default aliases if not set:
```
quality_model: "opencode/claude-opus-4"
balanced_model: "opencode/claude-sonnet-4"
budget_model: "opencode/claude-haiku-4"
```

**Model lookup table (uses aliases):**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-chapter-researcher | quality_model | balanced_model | budget_model |
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |

```
const modelLookup = {
  quality: { researcher: aliases.quality_model, planner: aliases.quality_model, checker: aliases.balanced_model },
  balanced: { researcher: aliases.balanced_model, planner: aliases.quality_model, checker: aliases.balanced_model },
  budget: { researcher: aliases.budget_model, planner: aliases.balanced_model, checker: aliases.budget_model }
}
const models = modelLookup[modelProfile]
```

Store resolved models for use in Task calls below.

## 2. Parse and Normalize Arguments

Extract from `$ARGUMENTS`:

- Chapter number (integer or decimal like `2.1`)
- `--research` flag to force re-research
- `--skip-research` flag to skip research
- `--fixes` flag for fix planning mode
- `--skip-verify` flag to bypass verification loop

**If no chapter number:** Detect next unplanned chapter from roadmap.

**Normalize chapter to zero-padded format:**

```bash
# Normalize chapter number (8 → 08, but preserve decimals like 2.1 → 02.1)
if [[ "$CHAPTER" =~ ^[0-9]+$ ]]; then
  CHAPTER=$(printf "%02d" "$CHAPTER")
elif [[ "$CHAPTER" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  CHAPTER=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

**Check for existing research and plans:**

```bash
# Query for existing research
RESEARCH_RESULTS=$(megamemory understand "${CHAPTER}-research" top_k=5)

# Query for existing plans
PLAN_RESULTS=$(megamemory understand "${CHAPTER}-plan" top_k=20)
```

## 3. Validate Chapter

```bash
# Query roadmap for chapter information
ROADMAP_RESULTS=$(megamemory understand "chapter ${CHAPTER}" top_k=10)
```

**If not found:** Error with available chapters (query all chapter concepts).

**If found:** Extract chapter number, name, goal from concept.

## 4. Handle Research

**If `--fixes` flag:** Skip research (fix planning uses verification concept instead).

**If `--skip-research` flag:** Skip to step 6.

**Check config for research setting:**

```bash
# Query config concept
CONFIG_RESULTS=$(megamemory understand "config" top_k=5)
# Extract workflow.research setting
WORKFLOW_RESEARCH=$(echo $CONFIG_RESULTS | ... extract workflow.research ...)
```

**If `workflow.research` is `false` AND `--research` flag NOT set:** Skip to step 6.

**Otherwise:**

Check for existing research from step 2.

**If research concept exists AND `--research` flag NOT set:**
- Display: `Using existing research: ${CHAPTER}-research concept`
- Skip to step 6

**If research concept missing OR `--research` flag set:**

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: RESEARCHING CHAPTER {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning researcher...
```

Proceed to spawn researcher.

### Spawn fuska-chapter-researcher

Gather context for research prompt:

```bash
# Query chapter concept for description
CHAPTER_DESC=$(megamemory understand "chapter ${CHAPTER}" top_k=10)

# Query requirements if they exist
REQUIREMENTS=$(megamemory understand "requirements" top_k=50)

# Query chapter context if exists
CHAPTER_CONTEXT=$(megamemory understand "${CHAPTER}-context" top_k=5)

# Query previous decisions from state
STATE=$(megamemory understand "state" top_k=5)
```

Fill research prompt and spawn:

```markdown
<objective>
Research how to implement Chapter {chapter_number}: {chapter_name}

Answer: "What do I need to know to PLAN this chapter well?"
</objective>

<context>
**Chapter description:**
{chapter_description}

**Requirements (if any):**
{requirements}

**Chapter context (if any):**
{chapter_context}

**Prior decisions:**
{decisions from state}
</context>

<output>
Create/update research concept: {chapter}-research
Use: ChapterConceptTemplates.createResearch()
</output>
```

```
Task(
  prompt=research_prompt,
  subagent_type="fuska-chapter-researcher",
  model="{researcher_model}",
  description="Research Chapter {chapter}"
)
```

### Handle Researcher Return

**`## RESEARCH COMPLETE`:**
- Display: `Research complete. Proceeding to planning...`
- Continue to step 6

**`## RESEARCH BLOCKED`:**
- Display blocker information
- Offer: 1) Provide more context, 2) Skip research and plan anyway, 3) Abort
- Wait for user response

## 5. Check Existing Plans

From step 2 results:

**If plan concepts exist:** Use question tool:
- header: "Existing Plans"
- question: "Plans already exist for this chapter. What would you like to do?"
- options:
  - "Continue planning" — Add more plans
  - "View existing" — Show current plans
  - "Replan from scratch" — Delete and recreate

Wait for user response.

## 6. Query Context from MegaMemory

Gather all context needed for planner agent:

```bash
# Query state concept
STATE_RESULTS=$(megamemory understand "state" top_k=5)

# Query roadmap concept
ROADMAP_RESULTS=$(megamemory understand "roadmap" top_k=5)

# Query requirements if they exist
REQUIREMENTS_RESULTS=$(megamemory understand "requirements" top_k=50)

# Query chapter context if exists
CONTEXT_RESULTS=$(megamemory understand "${CHAPTER}-context" top_k=5)

# Query research if exists
RESEARCH_RESULTS=$(megamemory understand "${CHAPTER}-research" top_k=5)

# Fix planning concepts (only if --fixes mode)
VERIFICATION_RESULTS=$(megamemory understand "${CHAPTER}-verification" top_k=5)
```

## 7. Spawn fuska-planner Agent

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: PLANNING CHAPTER {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning planner...
```

Fill prompt with inlined concept data and spawn:

```markdown
<planning_context>

**Chapter:** {chapter_number}
**Mode:** {standard | fix_planning}

**Project State:**
{state_results.summary}

**Roadmap:**
{roadmap_results.summary}

**Requirements (if exists):**
{requirements_results.summary}

**Chapter Context (if exists):**
{context_results.summary}

**Research (if exists):**
{research_results.summary}

**Fix Planning (if --fixes mode):**
{verification_results.summary}

</planning_context>

<downstream_consumer>
Output consumed by /fuska-build

Plans must be executable prompts with:
- Frontmatter (batch, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification

Use MegaMemory:
- Create plan concepts: ChapterConceptTemplates.createPlan()
- Reference patterns from MegaMemory: megamemory.understand()
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] Plan concepts created in MegaMemory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Batchs assigned for parallel execution
- [ ] must_haves derived from chapter goal
- [ ] Patterns referenced from MegaMemory (if found)
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Plan Chapter {chapter} with MegaMemory"
)
```

## 8. Handle Planner Return

Parse planner output:

**`## PLANNING COMPLETE`:**
- Display: `Planner created {N} plan(s). Concepts created in MegaMemory.`
- If `--skip-verify`: Skip to step 13
- Check config for plan_check setting (from step 1)
- If `workflow.plan_check` is `false`: Skip to step 13
- Otherwise: Proceed to step 10

**`## CHECKPOINT REACHED`:**
- Present to user, get response, spawn continuation (see step 12)

**`## PLANNING INCONCLUSIVE`:**
- Show what was attempted
- Offer: Add context, Retry, Manual
- Wait for user response

## 9. Query Plans for Verification

```bash
# Query all plan concepts for this chapter
PLANS_RESULTS=$(megamemory understand "${CHAPTER}-plan" top_k=20)

# Query requirements
REQUIREMENTS_RESULTS=$(megamemory understand "requirements" top_k=50)
```

## 10. Spawn fuska-plan-checker Agent

Track: `iteration_count = 1`
Track: `issues_history = []`

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning plan checker...
```

Fill checker prompt with inlined concept data and spawn:

```markdown
<verification_context>

**Chapter:** {chapter_number}
**Chapter Goal:** {goal from chapter concept}

**Plans to verify:**
{plans_results.summary}

**Requirements (if exists):**
{requirements_results.summary}
</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="fuska-plan-checker",
  model="{checker_model}",
  description="Verify Chapter {chapter} plans"
)
```

## 11. Handle Checker Return

**If `## VERIFICATION PASSED`:**
- Output the checker's full response (contains verified plans JSON)
- Append orchestrator summary:
  - **Iterations:** {iteration_count}
  - **What Was Fixed:** {1 paragraph summary of issues raised and addressed, if iterations > 1}
- Proceed to step 13

**If `## ISSUES FOUND`:**
- Display: `Checker found issues:`
- List issues from checker output
- Append issues to `issues_history[]` for summary generation
- Proceed to step 12

## 12. Revision Loop (Max 3 Iterations)

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Query current plans for revision context:

```bash
PLANS_RESULTS=$(megamemory understand "${CHAPTER}-plan" top_k=20)
```

Spawn fuska-planner with revision prompt:

```markdown
<revision_context>

**Chapter:** {chapter_number}
**Mode:** revision

**Existing plans:**
{plans_results.summary}

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.

Use MegaMemory:
- Update plan concepts: megamemory.update_concept()
- Reference patterns from MegaMemory for solutions

Return what changed.
</instructions>
```

```
Task(
  prompt=revision_prompt,
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Revise Chapter {chapter} plans"
)
```

- After planner returns → spawn checker again (step 10)
- Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:`

List remaining issues.

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit planning)

Wait for user response.

## 13. Update State Concept

Update state concept to reflect planning status:

```bash
# Query current state
STATE_RESULTS=$(megamemory understand "state" top_k=5)

# Update with planning completion
await megamemory.update_concept({
  id: "state",
  changes: {
    summary: JSON.stringify({
      ...currentState,
      current_chapter: "chapter-" + chapterNumber.toString().padStart(2, '0'),
      status: "ready_to_execute",
      last_activity: "Chapter " + CHAPTER + " planned"
    })
  }
});
```

## 14. Present Final Status

Route to `<offer_next>`.

</process>

<offer_next>

Output this markdown directly (not as a code block):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: Chapter {X} planned
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
- Query MegaMemory for plans: `megamemory understand "${CHAPTER}-plan" top_k=20`
- /fuska-plan {X} --research — re-research first
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Chapter validated against roadmap (chapter concept exists)
- [ ] Research completed (unless --skip-research or --fixes or exists)
- [ ] Research concept created if needed
- [ ] Existing plan concepts checked
- [ ] fuska-planner spawned with MegaMemory context
- [ ] Plan concepts created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] fuska-plan-checker spawned (unless --skip-verify)
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] User sees status between agent spawns
- [ ] State concept updated with planning status
- [ ] User knows next steps (execute or review)

</success_criteria>
