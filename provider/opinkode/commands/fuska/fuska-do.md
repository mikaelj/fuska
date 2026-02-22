---
name: fuska-do
description: Execute unplanned tasks with mode-aware agent chain using MegaMemory
argument-hint: "[mode] [description]"
flags: --review, --no-review, --auto-commit
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
  planned    - Planner → Builder | Review: Skipped | You have a plan, just build it
  checked    - Planner → Plan Checker → Builder | Review: Prompted | Plan gets validated, you review before building
  researched - Researcher → Planner → Plan Checker → Builder | Review: Prompted | Research adds context, review before committing
  verified   - Researcher → Planner → Plan Checker → Builder → Reviewer | Review: Skipped | Full pipeline with post-build review

Flags:
  --review       Force plan review before executing (any mode)
  --no-review    Skip plan review (any mode)
  --auto-commit  Auto-commit with generated message (no prompt)
```

---

## 1. Load All Context (Single Pass)

Query MegaMemory upfront. All subsequent steps use cached results — NO additional queries for data already loaded here.

**Step 1.1:** Query `config` (top_k=5). If empty: Display "No initiative found. Run `fuska init` first." → Stop. Extract `configData`, `modelProfile` (default: "balanced").

**Step 1.1a:** Check if prompt contains `<debug_findings>`. If present: extract root_cause, evidence, fix_complexity, suggested_fix, files_involved, session_id. Set DESCRIPTION = suggested_fix unless provided in arguments.

**Step 1.2:** Query `state` (top_k=5). If empty: Display "State concept not found." → Stop. Extract `stateId`, `stateData`.

**Step 1.3:** Query `task` (top_k=50). Extract existing task numbers for incrementing.

---

## 2. Parse Arguments and Resolve Mode

**Step 2.1: Parse arguments**

```
const validModes = ["planned", "checked", "researched", "verified"]
const words = input.trim().split(/\s+/)
const hasReviewFlag = input.includes("--review") && !input.includes("--no-review")
const hasNoReviewFlag = input.includes("--no-review")
const hasAutoCommitFlag = input.includes("--auto-commit")
const flagPattern = /--(?:no-review|review|auto-commit)/gi

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
| Planned | Planner → Builder. Auto-build. You have a plan, just build it. |
| Checked | Planner → Plan Checker → Builder. Ask first. Plan gets validated. |
| Researched | Researcher → Planner → Plan Checker → Builder. Ask first. Research adds context. |
| Verified | Full pipeline with Reviewer. Auto-build. Critical systems, production code. |

**Step 2.3:** If DESCRIPTION is null, prompt user: "What do you want to do?"

**Step 2.4: Derive mode config**

```
modeConfig = {
  planned:    { research: false, planCheck: false, verifier: false, autoExecute: true },
  checked:    { research: false, planCheck: true,  verifier: false, autoExecute: false },
  researched: { research: true,  planCheck: true,  verifier: false, autoExecute: false },
  verified:   { research: true,  planCheck: true,  verifier: true,  autoExecute: true }
}[MODE]

if (hasReviewFlag) modeConfig.autoExecute = false
if (hasNoReviewFlag) modeConfig.autoExecute = true
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

```
const models = modelLookup[modelProfile]  // { researcher, planner, checker, executor, verifier }
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
Create concept with name="task-${nextNum}-${slug}-research", kind="pattern"
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
  name="task-${nextNum}-${slug}-research",
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

<output>
Update plan concept: ${planConceptId}
Use: megamemory_update_concept(id="${planConceptId}", changes={summary: JSON.stringify(updatedPlanData)})
</output>`
```

**Step 6.2:** Spawn Task(subagent_type="fuska-planner", model=models.planner, variant="plan").

**Step 6.3:** If `## PLANNING COMPLETE`: continue. If error: display failure → Stop.

---

## 7. Spawn Plan-Checker + Revision Loop (if modeConfig.planCheck)

Only for checked, researched, verified modes. Display: `Validating plan...`

**Step 7.1:** Query updated plan concept `task-${nextNum}-${slug}`.

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
- Spawn planner with revision context (mode=revision, current plan, checker issues)
- Re-run checker, increment iterationCount

If iterationCount >= 3 and still issues: display remaining issues, offer Proceed anyway / Provide guidance / Abort.

---

## 8. Plan Review

**Step 8.1:** Query plan concept, display full plan with: objective, purpose, output, files to modify, tasks (each with files/action/verify/done).

**Step 8.2:** Check skip: `skipReview = hasNoReviewFlag || modeConfig.autoExecute || configData?.workflow?.interactive_review === false`. If skip → Step 9.

**Step 8.3: Review loop**

Options: Execute now | Ask a question | Modify the plan | Save and exit

- **Execute now** → Step 9
- **Ask a question** → answer from planData context, re-display, loop
- **Modify the plan** → get feedback, spawn planner revision via Task, re-query, re-display, loop
- **Save and exit** → Display "Plan saved as task-${nextNum}-${slug}. Run `/fuska-do task-${nextNum}` to execute later." → Stop

---

## 9. Spawn Builder

Display: `Executing...`

**Step 9.1:** Query plan concept for planner's latest updates.

**Step 9.2: Build executor prompt**

```
const executorPrompt = `<critical_constraints>
Execute all tasks in the plan
Do NOT commit (commit happens at end of fuska-do, not during execution)
Create summary concept named exactly: task-${nextNum}-${slug}-summary (kind: "config")
Do NOT update roadmap concept (standalone tasks are separate from chapters)
Return: ## EXECUTION COMPLETE
</critical_constraints>

Execute task ${nextNum}: ${DESCRIPTION}

Plan concept: task-${nextNum}-${slug}
Plan data: ${JSON.stringify(planData, null, 2)}
Project state: ${JSON.stringify(stateData, null, 2)}

<output>
Create summary concept:
megamemory_create_concept(
  name="task-${nextNum}-${slug}-summary",
  kind="config",
  summary=JSON.stringify(summaryData),
  why="Task ${nextNum} execution summary"
)
</output>`
```

**Step 9.3:** Spawn Task(subagent_type="fuska-executor", model=models.executor, variant="execute").

**Step 9.4:** If `## EXECUTION COMPLETE` → Step 9.5. If error → Stop.

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

Task(subagent_type="fuska-git-message", variant="amend", description="Generate commit message")
```

**Step 9.5.3:** Store `generatedCommitMessage = agentOutput.trim()`.

---

## 10. Spawn Reviewer (if modeConfig.verifier)

Only for verified mode. Display: `Reviewing...`

**Step 10.1: Build reviewer prompt**

```
const verifierPrompt = `<critical_constraints>
Return: ## Review Complete with status: passed | issues_found
Create concept named: task-${nextNum}-${slug}-verification
</critical_constraints>

<verification_context>
Review task ${nextNum}: ${DESCRIPTION}

**Plan concept:** task-${nextNum}-${slug}
**Summary concept:** task-${nextNum}-${slug}-summary

Verify the task achieved its goal:
1. Check that committed files exist and are substantive (not stubs)
2. Check that the task description was fulfilled
3. Create a verification record

Create concept:
megamemory_create_concept(
  name="task-${nextNum}-${slug}-verification",
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
  plan_concept: `task-${nextNum}-${slug}`,
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
- [ ] Plan-checker spawned for check modes; revision loop works (max 3)
- [ ] Auto-execute for planned/verified; ask-before for checked/researched (overridable)
- [ ] Plan displayed; review loop with modify/question/save options
- [ ] Builder spawns, creates summary concept (no commit during build)
- [ ] Git-message agent generates commit; user confirms or auto-commits
- [ ] Reviewer spawned for verified mode
- [ ] State updated, completion banner displayed

</success_criteria>
