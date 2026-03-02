---
name: fuska-do
description: Execute unplanned tasks with mode-aware agent chain using MegaMemory
argument-hint: "[mode] [description]"
flags: --review, --no-review, --auto-commit, --code-review, --no-code-review
tools:
  - read
  - write
  - edit
  - glob
  - grep
  - bash

  - question
  - task
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
  - megamemory:remove_concept
  - megamemory:list_roots
---

<objective>

Execute unplanned, ad-hoc tasks with Fuska guarantees (atomic commits, state tracking) using a mode-aware agent chain.

- Flexible mode selection: planned | checked | researched | verified
- Auto-executes for planned/verified; asks before executing for checked/researched
- Override plan review with --review (force) or --no-review (skip)
- Override commit behavior with --auto-commit (skip prompt and auto-commit)
- Suggests project creation if no project exists

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/model-resolution.md

Orchestration is inline. Mode determines which agents spawn.

</execution_context>

<context>
Arguments: `$ARGUMENTS`
</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

---

## 0.5. Help Check

If `$ARGUMENTS` starts with "help" (case-insensitive), display and stop:

```
Help for /fuska-do:

Execute unplanned tasks with mode-aware agent chain.

Usage: /fuska-do [mode] [description]

Modes:
  planned    Planner -> Builder -> Code Reviewer (auto-build)
  checked    Planner -> Plan Checker -> Builder -> Code Reviewer (ask first)
  researched Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer (ask first)
  verified   Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer -> Reviewer (auto-build)

Flags:
  --review          Force plan review before executing (any mode)
  --no-review       Skip plan review (any mode)
  --auto-commit     Auto-commit with generated message (no prompt)
  --no-code-review  Skip code review loop (any mode)
  --code-review     Force code review loop (any mode, already default)
```

---

## 1. Load All Context (Single Pass)

Query MegaMemory upfront. All subsequent steps use cached results — NO additional queries for data already loaded here.

**Step 1.0:** Initialize coordinator context:

```
const allDecisions = {
  planning: [],
  execution: []
}
```

**Step 1.1:** Query `config` (top_k=5). If empty: Display "No initiative found. Run `fuska init` first." → Stop. Extract `configData`, `modelProfile` (default: "balanced").

**Step 1.1a:** Check if prompt contains `<debug_findings>`. If present: extract root_cause, evidence, fix_complexity, suggested_fix, files_involved, session_id. Set DESCRIPTION = suggested_fix unless provided in arguments.

**Step 1.2:** Query `state` (top_k=5). If empty: Display "State concept not found." → Stop. Extract `stateId`, `stateData`.

**Step 1.3:** Query `task` (top_k=50). Extract existing task numbers for incrementing.

---

## 2. Parse Arguments and Resolve Mode

**Step 2.0: Check for task resume**

Check if first argument is a task reference. Supports two formats:
1. Numeric reference: "22" or "task-22"
2. Slug reference: "ignore-gitignore-patterns" (lowercase with dashes)

```
const taskRefMatch = input.match(/^(?:task-)?(\d+)(?:\s|$)/)
const slugRefMatch = !taskRefMatch && input.match(/^([a-z]+-[a-z0-9-]*[a-z0-9])(?:\s|$)/)
let resumeTask = null
let resumeTaskId = null
```

**If taskRefMatch (numeric):**
1. Extract task number: `taskNum = taskRefMatch[1]`
2. Query MegaMemory with exhaustive search:
   ```
   const query1 = await megamemory_understand(query="task-${taskNum}", top_k=50)
   const query2 = await megamemory_understand(query="task-${taskNum}-", top_k=50)
   const allResults = [...query1.concepts, ...query2.concepts]
   const uniqueResults = [...new Map(allResults.map(c => [c.id, c])).values()]
   ```
3. Filter uniqueResults to concepts matching pattern `task-${taskNum}-` (with trailing hyphen to avoid task-22 matching task-221)
4. **If exactly one match:** Set `resumeTask = matchedConcept`, `resumeTaskId = matchedConcept.id`, strip task ref from input
5. **If multiple matches:** Use question tool to disambiguate:
   ```
   Question: "Found multiple task-${taskNum} concepts. Which one?"
   Options: each match with label showing:
     - "{name} (parent: {parent_name || 'none'})"
   After selection: Set resumeTask and resumeTaskId, strip task ref from input
   ```
6. **If no matches:** Display "No task-${taskNum} found. Creating new task." → continue to Step 2.1

**If slugRefMatch (slug):**
1. Extract slug: `slugRef = slugRefMatch[1]`
2. Query MegaMemory:
   ```
   const query1 = await megamemory_understand(query="task-", top_k=50)
   const query2 = await megamemory_understand(query=slugRef, top_k=50)
   const allResults = [...query1.concepts, ...query2.concepts]
   const uniqueResults = [...new Map(allResults.map(c => [c.id, c])).values()]
   ```
3. Filter uniqueResults to concepts where `name.includes(slugRef)` or `name.endsWith("-" + slugRef)`
4. **If exactly one match:** Set `resumeTask = matchedConcept`, `resumeTaskId = matchedConcept.id`, strip slug ref from input
5. **If multiple matches:** Use question tool to disambiguate:
   ```
   Question: "Found multiple tasks matching '${slugRef}'. Which one?"
   Options: each match with label showing:
     - "{name} (parent: {parent_name || 'none'})"
   After selection: Set resumeTask and resumeTaskId, strip slug ref from input
   ```
6. **If no matches:** Display "No task matching '${slugRef}' found. Creating new task." → continue to Step 2.1

**If resumeTask (from either path):**
- Load task data: `taskData = JSON.parse(resumeTask.summary)`
- Set DESCRIPTION = taskData.description
- Set MODE = taskData.mode || "planned"
- Set planData = taskData (for use in subsequent steps)
- Set planConceptId = resumeTask.name (the full concept name like 'task-022-rename-command-to-commands')
- Set taskConceptId = resumeTask.id (the UUID for megamemory updates)
- Set slug = taskData.slug
- Set nextNum = taskData.task_number
- Skip to Step 8 (Plan Review) to confirm execution or Step 9 directly if user wants to execute

---

**Step 2.1: Parse arguments**

```
const validModes = ["planned", "checked", "researched", "verified"]
const words = input.trim().split(/\s+/)
const hasReviewFlag = input.includes("--review") && !input.includes("--no-review")
const hasNoReviewFlag = input.includes("--no-review")
const hasAutoCommitFlag = input.includes("--auto-commit")
const hasCodeReviewFlag = input.includes("--code-review") && !input.includes("--no-code-review")
const hasNoCodeReviewFlag = input.includes("--no-code-review")
const flagPattern = /--(?:no-review|review|auto-commit|no-code-review|code-review)/gi

if (validModes.includes(words[0]?.toLowerCase())) {
  MODE = words[0].toLowerCase()
  DESCRIPTION = words.slice(1).join(" ").replace(flagPattern, '').trim() || null
} else {
  DESCRIPTION = input.replace(flagPattern, '').trim() || null
}
```

**Step 2.2:** If MODE not set, ALWAYS ask user to select:

| Option | Description |
|--------|-------------|
| Planned | Planner → Builder → Code Reviewer. Auto-build. You have a plan, just build it. |
| Checked | Planner → Plan Checker → Builder → Code Reviewer. Ask first. Plan gets validated. |
| Researched | Researcher → Planner → Plan Checker → Builder → Code Reviewer. Ask first. Research adds context. |
| Verified | Full pipeline with Code Reviewer + Reviewer. Auto-build. Critical systems, production code. |

**Step 2.3:** If DESCRIPTION is null, prompt user: "What do you want to do?"

**Step 2.4: Derive mode config**

```
modeConfig = {
  planned:    { research: false, planCheck: false, codeReview: true, verifier: false, autoExecute: true },
  checked:    { research: false, planCheck: true,  codeReview: true, verifier: false, autoExecute: false },
  researched: { research: true,  planCheck: true,  codeReview: true, verifier: false, autoExecute: false },
  verified:   { research: true,  planCheck: true,  codeReview: true, verifier: true,  autoExecute: true }
}[MODE]

if (hasReviewFlag) modeConfig.autoExecute = false
if (hasNoReviewFlag) modeConfig.autoExecute = true
if (hasCodeReviewFlag) modeConfig.codeReview = true
if (hasNoCodeReviewFlag) modeConfig.codeReview = false
if (hasDebugContext) modeConfig.research = false
```

**Step 2.5: Resolve models**

Follow model-resolution.md. Extract aliases from config, then apply this lookup table:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-chapter-researcher | quality_model | balanced_model | budget_model |
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |
| fuska-executor | quality_model | balanced_model | balanced_model |
| fuska-verifier | balanced_model | balanced_model | budget_model |
| fuska-code-reviewer | budget_model | budget_model | budget_model |
| fuska-git-message | explore_model | explore_model | explore_model |

```
const models = modelLookup[modelProfile]  // { researcher, planner, checker, executor, verifier, codeReviewer }
const gitMessageModel = aliases.explore_model || aliases.budget_model
```

Display: `Mode: ${MODE} | Profile: ${modelProfile}`

---

## 3. Generate Slug and Task Number

Generate slug: DESCRIPTION lowercase, replace non-alphanumeric with hyphens, collapse doubles, trim, max 40 chars.

Calculate next number from existing `task-NNN-*` concepts. If none: `nextNum = "001"`.

---

## 4. Create Plan Concept

**Step 4.1:** Create plan data with: task_number, slug, description, mode, status="planning", created_at, project_context (current_chapter from stateData), empty tasks/files_modified/depends_on arrays, autonomous=false. If debug context present, include debug_context (session_id, root_cause, complexity).

**Step 4.2:** Create concept: `name=task-${nextNum}-${slug}`, kind="feature", summary=JSON.stringify(planData).

**Step 4.2a:** Set `planConceptId = task-${nextNum}-${slug}` and `taskConceptId = <returned_concept_id>` for subsequent steps.

**Step 4.3: Display**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK ${nextNum}: ${DESCRIPTION}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mode: ${MODE} | Plan: task-${nextNum}-${slug}
```

---

## 5. Spawn Researcher (if modeConfig.research)

Only for researched, verified modes. Display: `Researching...`

**Step 5.1: Build researcher prompt**

```
const researcherPrompt = `<critical_constraints>
Return: ## RESEARCH COMPLETE with key findings
Create concept with name="${planConceptId}-research", kind="pattern"
Keep research focused and concise — this is a standalone task, not a full chapter
</critical_constraints>

<objective>
Research how to implement: ${DESCRIPTION}

Answer: "What do I need to know to PLAN this task well?"
This is a standalone task, not a full chapter. Focus on:
- Relevant patterns in the existing codebase
- Key libraries or APIs needed
- Common pitfalls for this type of task
</objective>

<context>
**Task:** ${DESCRIPTION}
**Project State:** ${JSON.stringify(stateData, null, 2)}
</context>

<output>
Create research concept:
megamemory_create_concept(
  name="${planConceptId}-research",
  kind="pattern",
  summary=JSON.stringify(researchFindings),
  why="Research for task ${nextNum}",
  parent_id=null
)
</output>`
```

**Step 5.2:** Spawn Task(subagent_type="fuska-chapter-researcher", model=models.researcher, variant="plan").

**Step 5.3:** If `## RESEARCH COMPLETE`: query research concept, continue. If `## RESEARCH BLOCKED`: offer Skip research / Provide context / Abort.

---

## 6. Spawn Planner

Display: `Planning...`

**Step 6.1: Build planner prompt**

```
const plannerPrompt = `<critical_constraints>
Create a SINGLE plan with 1-3 focused tasks
Quick tasks MUST be atomic and self-contained
Target ~30% context usage (simple, focused)
Each task needs: files, action, verify, done
Return: ## PLANNING COMPLETE with task list
</critical_constraints>

<planning_context>

**Mode:** ${MODE}
**Task Number:** ${nextNum}
**Description:** ${DESCRIPTION}
**Plan Concept ID:** ${planConceptId}

**Project State:**
${JSON.stringify(stateData, null, 2)}

${researchData ? `**Research Findings:**\n${JSON.stringify(researchData, null, 2)}` : ''}

${hasDebugContext ? `<debug_findings>
**Root Cause:** ${root_cause}
**Evidence:** ${evidence}
**Fix Complexity:** ${fix_complexity}
**Suggested Fix:** ${suggested_fix}
**Files Involved:** ${files_involved}
**Debug Session ID:** ${debug_session_id}
</debug_findings>

<instruction>
Research is complete (debug investigation done). Use these findings directly - no additional research needed.
</instruction>` : ''}

</planning_context>

<lesson_context>
Query plan-lessons before planning. Include relevant lessons in planning context.
Apply lesson solutions to avoid repeating mistakes identified in previous plan checks.
</lesson_context>

<output>
Update plan concept: ${planConceptId}
Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlanData)})
</output>`
```

**Step 6.2:** Spawn Task(subagent_type="fuska-planner", model=models.planner, variant="plan").

**Step 6.3:** If `## PLANNING COMPLETE`: continue. If error: display failure → Stop.

---

## 6.5. Decision Collection (Planning)

**ADR OPT-IN CHECK:**

```typescript
// Query config to check adr_enabled
const configResult = await megamemory:understand({ query: 'config', top_k: 1 });
const configData = configResult.concepts.length > 0 
  ? JSON.parse(configResult.concepts[0].summary) 
  : {};

// Skip decision collection if ADR is not enabled
if (configData?.workflow?.adr_enabled !== true) {
  // Skip to Step 7 (Plan Review)
  return;
}
```

Extract decisions created by planner agent.

**Step 6.5.1:** Parse planner return for decisions created:

```
const plannerDecisions = []

// Check if planner created decision concepts
const decisionsQuery = await megamemory:understand({
  query: `${planConceptId} decision`,
  top_k: 10
})

for (const match of decisionsQuery.concepts) {
  if (match.kind === 'decision' && match.name.startsWith('decision-')) {
    const decisionData = JSON.parse(match.summary)
    plannerDecisions.push({
      id: match.name,
      conceptId: match.id,
      title: decisionData.title,
      context: decisionData.context,
      status: decisionData.status
    })
  }
}
```

**Step 6.5.2:** Store in coordinator context: `allDecisions.planning = plannerDecisions`

---

## 6.6. Decision Confirmation (Planning)

**ADR OPT-IN CHECK:**

```typescript
// Skip if ADR not enabled (already checked in Step 6.5)
if (configData?.workflow?.adr_enabled !== true) {
  // Skip to Step 9 (Plan Review)
  return;
}
```

If `plannerDecisions.length > 0`, prompt user for confirmation.

**Step 6.6.1:** Display planning decisions:

```
## Planning Decisions Created

| Decision | Context | Status |
|----------|---------|--------|
${plannerDecisions.map(d => `| ${d.id} | ${d.context.slice(0, 50)}... | ${d.status} |`).join('\n')}

_${plannerDecisions.length} decisions logged during planning_
```

**Step 6.6.2:** Use question tool:

| Option | Description |
|--------|-------------|
| Accept all | Keep all proposed decisions |
| Review individually | I'll review each decision |
| Skip logging | Don't log any decisions |

**Accept all** → Continue to Step 7

**Skip logging** →
1. Delete decision concepts:
   ```
   for (const decision of plannerDecisions) {
     await megamemory:remove_concept({
       id: decision.conceptId,
       reason: "User chose to skip decision logging"
     })
   }
   ```
2. Clear: `allDecisions.planning = []`
3. Continue to Step 7

**Review individually** →
1. For each decision in plannerDecisions:
   - Display full decision details (title, context, decision, alternatives, consequences)
   - Question: `Keep decision: ${decision.title}?`
   - Options: Keep | Remove
   - If Remove: delete concept via megamemory:remove_concept
2. After all reviewed → Continue to Step 7

---

## 7. Spawn Plan-Checker + Revision Loop (if modeConfig.planCheck)

Only for checked, researched, verified modes. Display: `Validating plan...`

**Step 7.1:** Query updated plan concept `${planConceptId}`.

**Step 7.2: Build checker prompt**

```
const checkerPrompt = `<critical_constraints>
Return one of:
- ## VERIFICATION PASSED -- plan is ready
- ## ISSUES FOUND -- structured issue list with fix hints
Skip chapter-specific checks (requirement coverage, dependency graph, requirements derivation, context compliance). This is a standalone task, not a chapter plan.
</critical_constraints>

<verification_context>

**Task:** ${DESCRIPTION}
**Plan Data:** ${JSON.stringify(planData, null, 2)}

Verify this task plan. Focus on:
1. Task completeness: Does every task have files, action, verify, done?
2. Scope sanity: Are there 1-3 tasks? Would they complete in ~30% context?

</verification_context>`
```

**Step 7.3:** Spawn Task(subagent_type="fuska-plan-checker", model=models.checker, variant="validate").

**Step 7.4: Handle return + revision loop**

Track `iterationCount = 1`, `issuesHistory = []`.

If `## VERIFICATION PASSED`: output checker response with iteration summary → Step 8.

If `## ISSUES FOUND` and iterationCount < 3:
- Display: `Checker found issues. Revising... (N/3)`
- Note: Checker creates lesson concepts for each blocker/warning issue under plan-lessons module
- Spawn planner with revision context (mode=revision, current plan, checker issues)
- Re-run checker, increment iterationCount

If iterationCount >= 3 and still issues: display remaining issues, offer Proceed anyway / Provide guidance / Abort.

---

## 8. Plan Review

**Step 8.1:** Query plan concept, display full plan with: objective, purpose, output, files to modify, tasks (each with files/action/verify/done).

**Step 8.2:** Check skip: `skipReview = hasNoReviewFlag || modeConfig.autoExecute || configData?.workflow?.interactive_review === false`. If skip → Step 9.

**Step 8.3: Review loop**

Use question tool with these options:

| Option | Description |
|--------|-------------|
| Execute now | Start building immediately |
| Ask a question | Get clarification about the plan |
| Modify the plan | Request changes to the plan |
| Save and exit | Save plan for later execution |

**Execute now** → Step 9

**Ask a question** →
1. Question tool: "What would you like to know about the plan?"
2. Answer from planData context
3. Go to Step 8.1 (re-display plan + options)

**Modify the plan** →
1. Question tool: "What changes would you like to make?"
2. Spawn planner with revision context (current plan + user feedback)
3. Planner MUST call `megamemory_update_concept()` to save changes
4. Go to Step 7 (re-run plan-checker)
5. If checker passes → Step 8.1 (re-display updated plan + options)

**Save and exit** →
1. Display: `Plan saved as task-${nextNum}-${slug}`
2. Display: `Run /fuska-do ${nextNum} to execute later`
3. Stop

---

## 9. Spawn Builder

Display: `Executing...`

**Step 9.0: Capture pre-existing dirty state**

```
const preExistingDirtyFiles = await bash("git diff HEAD --name-only").trim()
```

**Step 9.1:** Query plan concept for planner's latest updates.

**Step 9.2: Build executor prompt**

```
const executorPrompt = `<critical_constraints>
Execute all tasks in the plan
Do NOT commit (commit happens at end of fuska-do, not during execution)
Create summary concept named exactly: ${planConceptId}-summary (kind: "config")
Do NOT update roadmap concept (standalone tasks are separate from chapters)
Return: ## EXECUTION COMPLETE
</critical_constraints>

Execute task ${nextNum}: ${DESCRIPTION}

Plan concept: ${planConceptId}
Plan data: ${JSON.stringify(planData, null, 2)}
Project state: ${JSON.stringify(stateData, null, 2)}

<lesson_context>
Query code-lessons before executing. Include relevant lessons in execution context.
Apply lesson solutions while coding to avoid repeating mistakes identified in previous code reviews.
</lesson_context>

<output>
Create summary concept:
megamemory_create_concept(
  name="${planConceptId}-summary",
  kind="config",
  summary=JSON.stringify(summaryData),
  why="Task ${nextNum} execution summary"
)
</output>`
```

**Step 9.3:** Spawn Task(subagent_type="fuska-executor", model=models.executor, variant="execute").

**Step 9.4:** If `## EXECUTION COMPLETE` → Step 9.7. If error → Stop.

---

## 9.7. Code Review Loop (if modeConfig.codeReview)

Display: `Reviewing code...`

**Step 9.7.0: Check for pre-existing uncommitted changes**

If `preExistingDirtyFiles` is non-empty:
- Get current dirty files: `currentDirtyFiles = await bash("git diff HEAD --name-only")`
- Check overlap: files in both `preExistingDirtyFiles` and current task's plan files
- Display warning:
  ```
  ⚠ Found uncommitted changes from before this task.
  Pre-existing modified files: ${preExistingDirtyFiles}
  Code review will include ALL uncommitted changes, not just this task's.
  ```
- Use question tool:

  | Option | Action |
  |--------|--------|
  | Commit existing first | Run `git add -A && git commit` for the pre-existing changes (prompt user for commit message), then continue to code review |
  | Stash existing | Run `git stash push -m "pre-fuska-do stash"`, continue to code review, remind user to `git stash pop` later |
  | Skip code review | Jump to Step 9.6, skip code review entirely |
  | Proceed anyway | Continue — code review will see everything (old behavior) |

**Step 9.7.1:** Run `git diff HEAD`. If empty → skip to Step 9.6 (nothing to review).

**Step 9.7.2:** Get modified files list: `git diff HEAD --name-only`.

**Step 9.7.3: Build code reviewer prompt**

```
const codeReviewerPrompt = `<critical_constraints>
Return one of:
- ## REVIEW PASSED -- code is ready
- ## ISSUES FOUND -- structured issue list with fix hints
Review ONLY the diff and modified files. Do NOT create MegaMemory concepts.
</critical_constraints>

<review_context>

**Task:** ${DESCRIPTION}
**Plan Data:** ${JSON.stringify(planData, null, 2)}

${researchData ? `**Research Findings:**\n${JSON.stringify(researchData, null, 2)}` : ''}

**Modified Files:**
${modifiedFiles.join('\n')}

**Git Diff:**
${diffOutput}

</review_context>`
```

**Step 9.7.4:** Spawn Task(subagent_type="fuska-code-reviewer", model=models.codeReviewer, variant="validate").

**Step 9.7.5: Handle return + revision loop**

Track `buildIterationCount = 1`.

If `## REVIEW PASSED` → continue to Step 9.6.

If `## ISSUES FOUND` and buildIterationCount < 3:
- Display: `Code reviewer found issues. Fixing... (${buildIterationCount}/3)`
- Note: Reviewer creates lesson concepts for each blocker issue under code-lessons module
- Build revision prompt with reviewer issues:

```
const revisionPrompt = `<critical_constraints>
Fix ONLY the flagged issues — surgical precision, not a rewrite.
Do NOT commit (commit happens at end of fuska-do).
Return: ## REVISION COMPLETE
</critical_constraints>

<revision_context>
${reviewerIssuesYaml}
</revision_context>

Execute task ${nextNum}: ${DESCRIPTION}

Plan concept: ${planConceptId}
Plan data: ${JSON.stringify(planData, null, 2)}
Project state: ${JSON.stringify(stateData, null, 2)}`
```

- Spawn Task(subagent_type="fuska-executor", model=models.executor, variant="execute")
- Re-run code reviewer with updated diff
- Increment buildIterationCount

If buildIterationCount >= 3 and still issues:
- Display remaining issues
- Use question tool: Proceed anyway / Provide guidance / Abort

---

## 9.7.5. Decision Collection (Execution)

**ADR OPT-IN CHECK:**

```typescript
// Query config to check adr_enabled
const configResult = await megamemory:understand({ query: 'config', top_k: 1 });
const configData = configResult.concepts.length > 0 
  ? JSON.parse(configResult.concepts[0].summary) 
  : {};

// Skip decision collection if ADR is not enabled
if (configData?.workflow?.adr_enabled !== true) {
  // Skip to Step 9.6 (Chapter-Todo Loop)
  return;
}
```

Extract decisions created by executor agent.

**Step 9.7.5.1:** Parse execution summary for decisions made:

```
const executorDecisions = []

// Check summary concept for decisions
const summaryQuery = await megamemory:understand({
  query: `${planConceptId}-summary`,
  top_k: 1
})

if (summaryQuery.concepts.length > 0) {
  const summaryData = JSON.parse(summaryQuery.concepts[0].summary)
  
  if (summaryData.decisions_made && Object.keys(summaryData.decisions_made).length > 0) {
    for (const [decisionId, decisionInfo] of Object.entries(summaryData.decisions_made)) {
      // Query the full decision concept
      const decisionQuery = await megamemory:understand({
        query: decisionId,
        top_k: 1
      })
      
      if (decisionQuery.concepts.length > 0) {
        const fullDecision = JSON.parse(decisionQuery.concepts[0].summary)
        executorDecisions.push({
          id: decisionId,
          conceptId: decisionQuery.concepts[0].id,
          title: fullDecision.title,
          context: fullDecision.context,
          status: fullDecision.status
        })
      }
    }
  }
}
```

**Step 9.7.5.2:** Store in coordinator context: `allDecisions.execution = executorDecisions`

---

## 9.7.6. Decision Confirmation (Execution)

**ADR OPT-IN CHECK:**

```typescript
// Skip if ADR not enabled (already checked in Step 9.7.5)
if (configData?.workflow?.adr_enabled !== true) {
  // Skip to Step 9.6 (Chapter-Todo Loop)
  return;
}
```

If `executorDecisions.length > 0`, prompt user for confirmation.

**Step 9.7.6.1:** Display execution decisions:

```
## Execution Decisions Created

| Decision | Context | Status |
|----------|---------|--------|
${executorDecisions.map(d => `| ${d.id} | ${d.context.slice(0, 50)}... | ${d.status} |`).join('\n')}

_${executorDecisions.length} decisions logged during execution_
```

**Step 9.7.6.2:** Use question tool:

| Option | Description |
|--------|-------------|
| Accept all | Keep all proposed decisions |
| Review individually | I'll review each decision |
| Skip logging | Don't log any execution decisions |

**Accept all** → Continue to Step 9.6

**Skip logging** →
1. Delete decision concepts:
   ```
   for (const decision of executorDecisions) {
     await megamemory:remove_concept({
       id: decision.conceptId,
       reason: "User chose to skip decision logging"
     })
   }
   ```
2. Clear: `allDecisions.execution = []`
3. Continue to Step 9.6

**Review individually** →
1. For each decision in executorDecisions:
   - Display full decision details (title, context, decision, alternatives, consequences)
   - Question: `Keep decision: ${decision.title}?`
   - Options: Keep | Remove
   - If Remove: delete concept via megamemory:remove_concept
2. After all reviewed → Continue to Step 9.6

---

## 9.6. Chapter-Todo Loop (for chapter tasks only)

Skip this step if no `stateData.current_chapter` exists (standalone task).

**Step 9.6.1: Query pending chapter-todos**

```
const currentChapter = stateData.current_chapter;
if (currentChapter) {
  const todosResult = await megamemory:understand({ query: `${currentChapter}-todo`, top_k: 20 });
  const pendingTodos = todosResult.matches.filter(m => {
    try { return JSON.parse(m.summary).status === 'pending'; }
    catch { return false; }
  });
  
  if (pendingTodos.length > 0 && (loopCount || 0) < 3) {
    loopCount = (loopCount || 0) + 1;
    Display: `Found ${pendingTodos.length} pending chapter-todos. Re-planning... (${loopCount}/3)`;
    
    // Go back to Step 6 with chapter-todos as additional context
    const todosContext = pendingTodos.map(t => JSON.parse(t.summary));
    // Re-spawn planner with todos included in planning context
    // Then re-run checker and executor
    // Continue loop until no pending todos or max iterations reached
  }
  
  if (pendingTodos.length > 0 && (loopCount || 0) >= 3) {
    Display: `Warning: ${pendingTodos.length} chapter-todos remain after 3 planning iterations.`;
    Display: `Remaining todos: ${pendingTodos.map(t => JSON.parse(t.summary).title).join(', ')}`;
    // Continue to Step 9.5 - user can address todos manually
  }
}
```

**Step 9.6.2:** Initialize `loopCount = 0` at Step 1 if not already set.

---

## 9.5. Generate Commit Message

**Step 9.5.1:** Run `git diff HEAD`. If empty: set `generatedCommitMessage = null`, skip to Step 10.

**Step 9.5.2: Spawn git-message agent**

```
const gitMessagePrompt = `<task_context>
**Task Number:** task-${nextNum}
**Description:** ${DESCRIPTION}
**Mode:** ${MODE}
**Plan:** ${JSON.stringify(planData, null, 2)}
</task_context>

<diff>
${diffOutput}
</diff>

<trailer_format>
Trailer: task-${nextNum}
</trailer_format>

Generate a commit message following Fuska format:
- type(scope): description
- 2-4 bullet points
- Trailer line: task-${nextNum}

Return ONLY the commit message, nothing else.`

Task(subagent_type="fuska-git-message", model=gitMessageModel, variant="amend", description="Generate commit message")
```

**Step 9.5.3:** Store `generatedCommitMessage = agentOutput.trim()`.

---

## 10. Spawn Reviewer (if modeConfig.verifier)

Only for verified mode. Display: `Reviewing...`

**Step 10.1: Build reviewer prompt**

```
const verifierPrompt = `<critical_constraints>
Return: ## Review Complete with status: passed | issues_found
Create concept named: ${planConceptId}-verification
</critical_constraints>

<verification_context>
Review task ${nextNum}: ${DESCRIPTION}

**Plan concept:** ${planConceptId}
**Summary concept:** ${planConceptId}-summary

Verify the task achieved its goal:
1. Check that committed files exist and are substantive (not stubs)
2. Check that the task description was fulfilled
3. Create a verification record

Create concept:
megamemory_create_concept(
  name="${planConceptId}-verification",
  kind="component",
  summary=JSON.stringify(verificationData),
  why="Verification for task ${nextNum}"
)

</verification_context>`
```

**Step 10.2:** Spawn Task(subagent_type="fuska-verifier", model=models.verifier, variant="validate").

**Step 10.3:** If "passed" → continue. If "issues_found" → display issues, continue (don't block for quick tasks).

---

## 11. Update State Concept

Skip if user chose "Save and exit" at Step 8 and no execution happened.

```
stateData.tasks_completed = stateData.tasks_completed || []
stateData.tasks_completed.push({
  number: nextNum,
  description: DESCRIPTION,
  date: new Date().toISOString().split('T')[0],
  commit: finalCommitHash || null,
  plan_concept: planConceptId,
  mode: MODE
})

megamemory_update_concept(id=stateId, changes={ summary: JSON.stringify(stateData) })
```

---

## 11.5. Commit Confirmation

Skip if `generatedCommitMessage` is null.

Display generated commit message in banner.

If `hasAutoCommitFlag`: auto-commit (`git add -A && git commit`), extract hash, skip to Step 12.

Otherwise prompt: Commit now | Edit first | Skip.
- **Commit now** → `git add -A && git commit`, extract hash
- **Edit first** → prompt for message, commit if provided
- **Skip** → `finalCommitHash = null`

---

## 11.6. Update Task Concept

Skip if `resumeTask` is null (new task, not resume).

Update the original task concept with completion status:

```
if (taskConceptId) {
  const currentTaskData = JSON.parse(resumeTask.summary)
  const updatedTaskData = {
    ...currentTaskData,
    status: "complete",
    last_updated: new Date().toISOString()
  }
  
  megamemory_update_concept(
    id=taskConceptId,
    changes={ summary: JSON.stringify(updatedTaskData) }
  )
}
```

This ensures the specific disambiguated task concept (e.g., `task-022-rename-command-to-commands`) gets its status updated, not a wrongly reconstructed one.

---

## 12. Display Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Task ${nextNum}: ${DESCRIPTION}
 Mode: ${MODE}
 Plan: task-${nextNum}-${slug}
 Commit: ${finalCommitHash || "(uncommitted)"}
 ${verification ? `Verification: ${verificationStatus}` : ''}
 ${!finalCommitHash ? '\n Note: Changes staged but not committed. Run: git commit' : ''}
```

**Step 12.1:** If `allDecisions.planning.length + allDecisions.execution.length > 0`, display decisions:

```
### Decisions Logged

| Decision | When | Status |
|----------|------|--------|
${allDecisions.planning.map(d => `| ${d.id} | Planning | ${d.status} |`).join('\n')}
${allDecisions.execution.map(d => `| ${d.id} | Execution | ${d.status} |`).join('\n')}

_Total: ${allDecisions.planning.length + allDecisions.execution.length} decisions logged_
```

**Step 12.2:** Final message:

```
───────────────────────────────────────────────────
 Ready for next task: /fuska-do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<success_criteria>

- [ ] Preflight passes, mode resolved, description obtained
- [ ] Slug generated, task number calculated, plan concept created
- [ ] Researcher spawned for research modes; research concept created
- [ ] Planner spawns with mode-appropriate constraints
- [ ] Planning decisions collected and confirmed (or skipped)
- [ ] Plan-checker spawned for check modes; revision loop works (max 3)
- [ ] Auto-execute for planned/verified; ask-before for checked/researched (overridable)
- [ ] Plan displayed; review loop with modify/question/save options
- [ ] Builder spawns, creates summary concept (no commit during build)
- [ ] Code reviewer spawned for all modes (skippable with --no-code-review); build revision loop works (max 3)
- [ ] Execution decisions collected and confirmed (or skipped)
- [ ] Git-message agent generates commit; user confirms or auto-commits
- [ ] Reviewer spawned for verified mode
- [ ] State updated, completion banner displayed with decisions summary

</success_criteria>
