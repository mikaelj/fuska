---
name: fuska-plan-phase-megamemory
description: Create detailed execution plan for a phase with MegaMemory and verification loop
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: fuska-planner
tools:
  - read
  - bash

  - webfetch
  - megamemory-understand
  - megamemory-create-concept
  - megamemory-update-concept

---

@~/.config/opencode/fuska/references/megamemory-integration.md

<objective>

Create executable phase concepts (plan concepts) for a roadmap phase with integrated research and verification using MegaMemory.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped or exists), spawn fuska-planner agent, verify plans with fuska-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees flow between agents in main context.

</objective>

<execution_context>

@fuska-opencode/fuska-opencode/integration/src/phase-templates.ts
@fuska-opencode/fuska-opencode/integration/src/helpers.ts

</execution_context>

<context>

Phase number: `$ARGUMENTS` (optional - auto-detects next unplanned phase if not provided)

**Flags:**
- `--research` — Force re-research even if research concept exists
- `--skip-research` — Skip research entirely, go straight to planning
- `--gaps` — Gap closure mode (uses UAT concept for gaps, skips research)
- `--skip-verify` — Skip planner → checker verification loop

Normalize phase input in step 2 before any MegaMemory lookups.

</context>

<process>

## 1. Validate Environment and Resolve Model Profile

```bash
# Check MegaMemory is available
megamemory list_roots
```

**If not found:** Error - user should run `/fuska-new-project-megamemory` first.

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
| fuska-phase-researcher | quality_model | balanced_model | budget_model |
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

- Phase number (integer or decimal like `2.1`)
- `--research` flag to force re-research
- `--skip-research` flag to skip research
- `--gaps` flag for gap closure mode
- `--skip-verify` flag to bypass verification loop

**If no phase number:** Detect next unplanned phase from roadmap.

**Normalize phase to zero-padded format:**

```bash
# Normalize phase number (8 → 08, but preserve decimals like 2.1 → 02.1)
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

**Check for existing research and plans:**

```bash
# Query for existing research
RESEARCH_RESULTS=$(megamemory understand "${PHASE}-research" top_k=5)

# Query for existing plans
PLAN_RESULTS=$(megamemory understand "${PHASE}-plan" top_k=20)
```

## 3. Validate Phase

```bash
# Query roadmap for phase information
ROADMAP_RESULTS=$(megamemory understand "phase ${PHASE}" top_k=10)
```

**If not found:** Error with available phases (query all phase concepts).

**If found:** Extract phase number, name, goal from concept.

## 4. Handle Research

**If `--gaps` flag:** Skip research (gap closure uses UAT concept instead).

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
- Display: `Using existing research: ${PHASE}-research concept`
- Skip to step 6

**If research concept missing OR `--research` flag set:**

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: RESEARCHING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning researcher...
```

Proceed to spawn researcher.

### Spawn fuska-phase-researcher

Gather context for research prompt:

```bash
# Query phase concept for description
PHASE_DESC=$(megamemory understand "phase ${PHASE}" top_k=10)

# Query requirements if they exist
REQUIREMENTS=$(megamemory understand "requirements" top_k=50)

# Query phase context if exists
PHASE_CONTEXT=$(megamemory understand "${PHASE}-context" top_k=5)

# Query previous decisions from state
STATE=$(megamemory understand "state" top_k=5)
```

Fill research prompt and spawn:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<context>
**Phase description:**
{phase_description}

**Requirements (if any):**
{requirements}

**Phase context (if any):**
{phase_context}

**Prior decisions:**
{decisions from state}
</context>

<output>
Create/update research concept: {phase}-research
Use: PhaseConceptTemplates.createResearch()
</output>
```

```
Task(
  prompt=research_prompt,
  subagent_type="fuska-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
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
- question: "Plans already exist for this phase. What would you like to do?"
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

# Query phase context if exists
CONTEXT_RESULTS=$(megamemory understand "${PHASE}-context" top_k=5)

# Query research if exists
RESEARCH_RESULTS=$(megamemory understand "${PHASE}-research" top_k=5)

# Gap closure concepts (only if --gaps mode)
UAT_RESULTS=$(megamemory understand "${PHASE}-uat" top_k=5)
```

## 7. Spawn fuska-planner Agent

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning planner...
```

Fill prompt with inlined concept data and spawn:

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
{state_results.summary}

**Roadmap:**
{roadmap_results.summary}

**Requirements (if exists):**
{requirements_results.summary}

**Phase Context (if exists):**
{context_results.summary}

**Research (if exists):**
{research_results.summary}

**Gap Closure (if --gaps mode):**
{uat_results.summary}

</planning_context>

<downstream_consumer>
Output consumed by /fuska-execute-phase-megamemory

Plans must be executable prompts with:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification

Use MegaMemory:
- Create plan concepts: PhaseConceptTemplates.createPlan()
- Reference patterns from MegaMemory: megamemory.understand()
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] Plan concepts created in MegaMemory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
- [ ] Patterns referenced from MegaMemory (if found)
</quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Plan Phase {phase} with MegaMemory"
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
# Query all plan concepts for this phase
PLANS_RESULTS=$(megamemory understand "${PHASE}-plan" top_k=20)

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

**Phase:** {phase_number}
**Phase Goal:** {goal from phase concept}

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
  description="Verify Phase {phase} plans"
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
PLANS_RESULTS=$(megamemory understand "${PHASE}-plan" top_k=20)
```

Spawn fuska-planner with revision prompt:

```markdown
<revision_context>

**Phase:** {phase_number}
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
  description="Revise Phase {phase} plans"
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
      current_phase: "phase-" + phaseNumber.toString().padStart(2, '0'),
      status: "ready_to_execute",
      last_activity: "Phase " + PHASE + " planned"
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
  Fuska: Phase {X} planned
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

──────────────────────────────────────────────────────────────

## > Next Up

**Execute Phase {X}** — run all {N} plans
/fuska-execute-phase-megamemory {X}

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Query MegaMemory for plans: `megamemory understand "${PHASE}-plan" top_k=20`
- /fuska-plan-phase-megamemory {X} --research — re-research first
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] MegaMemory validated (roots exist)
- [ ] Phase validated against roadmap (phase concept exists)
- [ ] Research completed (unless --skip-research or --gaps or exists)
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
