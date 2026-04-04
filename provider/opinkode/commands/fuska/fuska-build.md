---
name: fuska-build
description: Execute all plans in a chapter with batch-based parallelization using MegaMemory
argument-hint: "<chapter-number> [--fixes-only] [--no-code-review]"
tools:
  - read
  - edit
  - bash
  - task
  - todowrite
  - question
  - megamemory:understand
  - megamemory:get_concept
  - megamemory:create_concept
  - megamemory:update_concept
---

<objective>

Execute all plans in a chapter using batch-based parallel execution with MegaMemory concepts.

Orchestrator stays lean: discover plans, analyze dependencies, group into batches, spawn subagents, collect results. Each subagent loads full execute-plan context and handles its own plan.

Context budget: ~15% coordinator, 100% fresh per subagent.

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/model-resolution.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Chapter: `$ARGUMENTS`

**Flags:**
- `--fixes-only` — Execute only fix plans (plans with is_fix marker). Use after verify-work creates fix plans.
- `--mode MODE` — Override workflow mode for this chapter only (one-off, doesn't persist).
- `--code-review` — Force code review loop (default: enabled)
- `--no-code-review` — Skip code review loop

## Context Loading (Single Pass)

Load all MegaMemory concepts upfront. All subsequent steps use cached results — NO additional queries.

**Step 0.1: Load all concepts**
```
const allConcepts = megamemory_understand(query="config state chapter plan", top_k=10000)
const nodeMap = new Map(allConcepts.matches?.map(n => [n.id, n]) || [])
```

**Step 0.2: Layer 1 - Initiative Scoping**
```
const chapterNumber = input.match(/\d+/)?.[0]
const chapterSlug = `chapter-${chapterNumber.padStart(2, '0')}`
const modeOverride = input.match(/--mode\s+(\S+)/)?.[1] || null
const hasNoCodeReviewFlag = input.includes("--no-code-review")
const hasCodeReviewFlag = input.includes("--code-review") && !hasNoCodeReviewFlag

const configNode = allConcepts.matches?.find(n => {
  if (n.name !== 'config' || n.kind !== 'config') return false
  try {
    const data = JSON.parse(n.summary)
    return 'current_initiative' in data
  } catch {
    return false
  }
})

if (!configNode) {
  console.error('No config concept with current_initiative found')
  process.exit(1)
}

const currentInitiative = JSON.parse(configNode.summary).current_initiative
const initiativeRoot = allConcepts.matches?.find(n =>
  n.name === currentInitiative &&
  n.kind === 'feature' &&
  !n.parent_id
)

if (!initiativeRoot) {
  console.error(`Initiative ${currentInitiative} not found`)
  process.exit(1)
}

const initiativeId = initiativeRoot.id
```

**Step 0.3: Layer 2 - Load scoped data**
```
const stateNode = allConcepts.matches?.find(n =>
  n.name === 'state' &&
  n.kind === 'config' &&
  n.parent_id === initiativeId
)

let chapterNode = allConcepts.matches?.find(n =>
  n.name === chapterSlug &&
  n.kind === 'feature' &&
  n.parent_id === initiativeId
)

const planConcepts = allConcepts.matches?.filter(n =>
  n.name.startsWith(`${chapterSlug}-plan-`) &&
  !n.name.endsWith('-summary') &&
  n.kind === 'feature'
).map(m => ({ id: m.id, name: m.name, ...JSON.parse(m.summary) })) || []
```

**Step 0.4: Parse results**
```
const configData = JSON.parse(configNode.summary)
const stateData = stateNode ? JSON.parse(stateNode.summary) : null
let chapterData = chapterNode ? JSON.parse(chapterNode.summary) : null

// Validation: get_concept for known slugs as reliability check
const chapterValidation = await megamemory_get_concept({ id: chapterSlug })
if (chapterValidation && chapterValidation.id !== chapterNode?.id) {
  chapterNode = chapterValidation
  chapterData = JSON.parse(chapterValidation.summary)
}

const modelProfile = configData?.model_profile || "balanced"
const parallelization = configData?.parallelization === true
const commitStrategy = configData?.git?.commit_strategy || 'per-chapter'
const branchingStrategy = configData?.git?.branching_strategy || 'none'
const chapterBranchTemplate = configData?.git?.chapter_branch_template || 'chapter-${chapterNumber}'
const milestoneBranchTemplate = configData?.git?.milestone_branch_template || 'milestone-v${chapterNumber}'
```

If config, state, or chapter not found → tell user to run `fuska init`.

</context>

<process>

## 0. Handle Git Branching (if configured)

If `branchingStrategy === "none"` → skip to Step 1.

For "chapter" or "milestone": check current branch via `git rev-parse --abbrev-ref HEAD`. If not on the correct branch, create/checkout it (`git checkout -b ${template}`). Otherwise proceed.

---

## 1. Preflight Check

Follow MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

---

## 2. Resolve Models

Follow model-resolution.md. Extract aliases from config, then apply this lookup table:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-executor | quality_model | balanced_model | balanced_model |
| fuska-verifier | balanced_model | balanced_model | budget_model |
| fuska-code-reviewer | budget_model | budget_model | budget_model |
| fuska-git-message | explore_model | explore_model | explore_model |

```
const models = modelLookup[modelProfile]  // { executor, verifier, codeReviewer }
const gitMessageModel = aliases.explore_model || aliases.budget_model
const visionModel = aliases.vision_model || aliases.quality_model
const visionMode = aliases.vision_model ? "native" : "mcp"
```

---

## 3. Validate Chapter and Discover Plans

**Step 3.1:** Validate chapter exists from cached `chapterResponse`. If empty → display error, suggest querying roadmap → Stop. Extract `chapterName`, `chapterGoal`, `chapterStatus`.

**Step 3.2:** Validate plans exist from cached `plansResponse`. If empty → suggest `/fuska-plan ${chapterNumber}` → Stop.

**Step 3.3:** Check for summary concepts per plan (`${plan.name}-summary`, top_k=1). Filter to `incompletePlans` (no summary).

**Step 3.4:** If `--fixes-only`: filter to plans where `planData.is_fix === true`. Use fix plans if any, else fall back to all incomplete.

Display: `Found ${plansToExecute.length} incomplete plans to execute`

---

## 4. Present Execution Plan and Confirm

**Step 4.1:** Group plans by batch, sort batch keys.

**Step 4.2: Display**

```
-----------------------------------------------------
  Fuska: Chapter {chapterNumber} Execution Plan
-----------------------------------------------------

**Chapter {chapterNumber}: {chapterName}**

Goal: {chapterGoal}

{plansToExecute.length} plan(s) to execute in {batches.length} batch(s):

### Batch N
- **plan-name**: objective
...

────────────────────────────────────────────────────
```

**Step 4.3:** Check auto mode: `isAutoMode = input.includes("--no-review") || configData?.workflow?.interactive_review === false || modeOverride === "yolo"`

If auto → proceed. Otherwise prompt: Proceed | View details | Cancel.

If "View details" → show full plan details, re-offer. If "Cancel" → Stop.

---

## 4.5. Vision Pre-Processing (if images detected)

Scan plan descriptions and chapter context for image file paths:

```
const imagePattern = /(?:^|\s)(\S+\.(?:png|jpe?g|gif|bmp|webp|svg))(?:\s|$)/gi
const planTexts = plansToExecute.map(p => `${p.objective} ${(p.tasks || []).map(t => t.action || '').join(' ')}`).join(' ')
const chapterText = `${chapterGoal} ${JSON.stringify(contextData || {})}`
const allText = `${planTexts} ${chapterText}`
const imageMatches = [...allText.matchAll(imagePattern)]
const uniqueImages = [...new Map(imageMatches.map(m => [m[1].trim(), m[1].trim()])).values()]
```

If no images found: skip to Step 5.

Display: `Vision: Analyzing ${uniqueImages.length} image(s)...`

For each image, spawn fuska-vision-reader:

```
Task(
  subagent_type="fuska-vision-reader",
  model=visionModel,
  description=`Analyze image: ${imagePath}`,
  prompt=`<vision_mode>${visionMode}</vision_mode>
${visionMode === "native" ? "<critical>Do NOT call any MCP vision tools (vision_analyze_image, etc.). You MUST analyze the image using your native model vision only. MCP tools are for fallback mode only.</critical>" : ""}

<objective>Analyze the image at ${imagePath} and produce a Visual Facts + Suggested Fix Plan analysis.</objective>

<image_context>
Path: ${imagePath}
Task: Chapter ${chapterNumber} execution
</image_context>

<output>
Return: ## VISION COMPLETE with Visual Facts and Suggested Fix Plan sections
</output>`
)
```

Error handling: If vision-reader returns `## VISION FAILED`, log warning and continue without vision context for that image. If ALL images fail, proceed without vision context (do not block execution).

Collect results:

```
const visionContext = visionResults.filter(r => !r.text.includes('VISION FAILED')).map(r => r.text).join('\n---\n')
```

Inject into executor prompt in Step 5.2 by appending after the git commit strategy line:

```
${visionContext ? `\n<vision_context>\n${visionContext}\n</vision_context>` : ''}
```

---

## 5. Execute Batches

**Pre-execution:** Capture base commit and pre-existing dirty state:
```
const baseCommit = await bash("git rev-parse HEAD")
const preExistingDirtyFiles = await bash("git diff HEAD --name-only").trim()
```

**For each batch in sorted order:**

**Step 5.1:** Load current state for context (query "state", top_k=5). Load plan details for each plan in batch.

**Step 5.2: Spawn executors**

If `parallelization === true`, spawn all in one message (parallel):

```
Task(
  variant="execute",
  description=`Execute ${plan.name}`,
  subagent_type="fuska-executor",
  model=models.executor,
  prompt=`Execute this plan:

Chapter: ${chapterSlug}
Plan: ${plan.name}
Commit Strategy: ${commitStrategy}

Plan Details:
${JSON.stringify(planFullData, null, 2)}

Project State:
${JSON.stringify(stateData, null, 2)}

Use plan's objective, tasks, and requirements to guide implementation.
Git commit strategy is "${commitStrategy}". If "per-chapter", stage files but do NOT commit — the coordinator commits when the chapter completes. If "per-plan", stage files and commit once after all tasks complete. If "per-task", commit after each task.
When complete, create a summary concept named "${plan.name}-summary" using megamemory:create_concept with execution results.
${visionContext ? `\n<vision_context>\n${visionContext}\n</vision_context>` : ''}
`
```

If `parallelization === false`, spawn sequentially (wait for each before next).

**Step 5.3:** Verify summary concepts created per plan. Warn if missing.

---

## 6. Aggregate Results

Query `${plan.name}-summary` for each plan. Display:

```
-----------------------------------------------------
 Fuska: CHAPTER ${chapterNumber} EXECUTION COMPLETE
-----------------------------------------------------

Executed: ${plansToExecute.length} plan(s)
Status: All summaries created [OK]
```

---

## 6.5. Code Review Loop

Skip if `hasNoCodeReviewFlag`.

**Step 6.5.0: Check for pre-existing uncommitted changes**

If `preExistingDirtyFiles` is non-empty:
- Display warning (strategy-aware):
  - If `commitStrategy === "per-chapter"`:
    ```
    ⚠ Found uncommitted changes from before this chapter build.
    Pre-existing modified files: ${preExistingDirtyFiles}
    Code review will include ALL uncommitted changes, not just this chapter's.
    ```
  - If `commitStrategy === "per-plan"` or `"per-task"`:
    ```
    ⚠ Found uncommitted changes from before this chapter build.
    Pre-existing modified files: ${preExistingDirtyFiles}
    Code review uses committed changes only, but uncommitted files may conflict with execution.
    ```
- Use question tool:

  | Option | Action |
  |--------|--------|
  | Commit existing first | Run `git add -A && git commit` for the pre-existing changes (prompt user for commit message), recapture `baseCommit = await bash("git rev-parse HEAD")`, then continue |
  | Stash existing | Run `git stash push -m "pre-fuska-build stash"`, recapture `baseCommit`, continue, remind user to `git stash pop` later |
  | Skip code review | Jump to Step 7 |
  | Proceed anyway | Continue — reviewer sees everything (old behavior) |

**Step 6.5.1:** Determine diff command based on commit strategy:
- `per-chapter`: `git diff HEAD` (changes are staged but uncommitted)
- `per-plan` or `per-task`: `git diff ${baseCommit}..HEAD` (changes already committed)

If diff is empty → skip to Step 7.

**Step 6.5.2:** Get modified files list (same strategy-aware diff command with `--name-only`).

**Step 6.5.3: Build code reviewer prompt**

```
const codeReviewerPrompt = `<critical_constraints>
Return one of:
- ## REVIEW PASSED -- code is ready
- ## ISSUES FOUND -- structured issue list with fix hints
Review ONLY the diff and modified files. Do NOT create MegaMemory concepts.
</critical_constraints>

<review_context>

**Chapter:** ${chapterSlug}
**Chapter Goal:** ${chapterGoal}

**Plan Data:**
${plansToExecute.map(p => JSON.stringify(p, null, 2)).join('\n\n')}

${researchData ? `**Research Findings:**\n${JSON.stringify(researchData, null, 2)}` : ''}

**Modified Files:**
${modifiedFiles.join('\n')}

**Git Diff:**
${diffOutput}

</review_context>`
```

**Step 6.5.4:** Spawn Task(subagent_type="fuska-code-reviewer", model=models.codeReviewer, variant="validate").

**Step 6.5.5: Handle return + revision loop**

Track `reviewIterationCount = 1`.

If `## REVIEW PASSED` → continue to Step 7.

If `## ISSUES FOUND` and reviewIterationCount < 3:
- Display: `Code reviewer found issues. Fixing... (${reviewIterationCount}/3)`
- Build revision prompt with reviewer issues:

```
const revisionPrompt = `<critical_constraints>
Fix ONLY the flagged issues — surgical precision, not a rewrite.
Do NOT commit (commit strategy is "${commitStrategy}").
Return: ## REVISION COMPLETE
</critical_constraints>

<revision_context>
${reviewerIssuesYaml}
</revision_context>

Chapter: ${chapterSlug}
Chapter Goal: ${chapterGoal}
Commit Strategy: ${commitStrategy}`
```

- Spawn Task(subagent_type="fuska-executor", model=models.executor, variant="execute")
- Re-run code reviewer with updated diff
- Increment reviewIterationCount

If reviewIterationCount >= 3 and still issues:
- Display remaining issues
- Use question tool: Proceed anyway / Provide guidance / Abort

---

## 7. Commit Chapter

**Step 7.1:** Check `git status --porcelain`. Stage any unstaged coordinator corrections.

**Step 7.2:** If `commitStrategy === "per-chapter"`: spawn git-message agent for the single chapter commit:

```
Task(
  variant="amend",
  model=gitMessageModel,
  subagent_type="fuska-git-message",
  description="Generate chapter commit message",
  prompt=`<commit_context>
**Mode:** chapter-commit
**Chapter:** ${chapterSlug}
**Chapter Goal:** ${chapterGoal}
**Commit Strategy:** ${commitStrategy}

**Plans completed:**
${planSummaries.map(s => `- ${s.name}: ${s.summary}`).join('\n')}

**Staged files:**
${stagedFiles.join('\n')}
</commit_context>`
)
```

Execute: `git commit -m "${generatedMessage}"`

If `commitStrategy === "per-plan"` or `"per-task"`: plans already committed. Only commit coordinator corrections if any, using same pattern with mode="coordinator-corrections".

If git status clean → continue.

---

## 8. Verify Chapter Goal

**Step 8.1:** Extract mode: `mode = modeOverride || configData.workflow?.mode || "standard"`. Reviewer runs only if `mode === "standard"` or `--verify` flag.

**Step 8.2:** If disabled: Display "Reviewer disabled — treating as passed" → Step 9.

**Step 8.3: Spawn reviewer**

```
Task(
  variant="validate",
  subagent_type="fuska-verifier",
  model=models.verifier,
  description=`Verify chapter ${chapterNumber}`,
  prompt=`Verify Chapter ${chapterNumber}: ${chapterName}

Chapter Goal: ${chapterGoal}

Use megamemory:understand to:
1. Load the chapter concept (query "chapter ${chapterNumber}")
2. Load all plan summaries (query "${chapterSlug}-summary", top_k=20)
3. Check each plan's requirements against the actual codebase

Use the Read tool to examine source files directly. Do NOT rely on summary claims.

Create a verification concept named "${chapterSlug}-verification" using megamemory:create_concept with:
- A detailed verification report
- Which requirements passed/failed
- Status: "passed" | "human_needed" | "issues_found"
- If issues_found: list specific issues to fix

Return the verification concept's status and findings.`
)
```

**Step 8.4:** Handle result:
- `passed` → Step 9
- `human_needed` → present checklist, question user. If approved → Step 9, else suggest re-planning
- `issues_found` → present issues, suggest `/fuska-plan ${chapterNumber} --fixes` → Stop

---

## 9. Update Chapter in MegaMemory

Query chapter concept. Update status to "complete", add `completed_at` timestamp.

If chapter has requirements: query each, update status to "complete".

---

## 10. Update State Concept

Query state and roadmap concepts. Determine next state:

```
const nextChapterNum = currentChapterNum + 1
const nextChapterSlug = `chapter-${nextChapterNum.toString().padStart(2, '0')}`
const chapterExists = chapters.some(p => p.slug === nextChapterSlug)
const isLastChapterInMilestone = currentChapterNum >= maxChapterInMilestone
```

| Condition | New Status | current_chapter |
|-----------|-----------|-----------------|
| No more chapters anywhere | milestone_complete | null |
| Next chapter exists | chapter_complete | nextChapterSlug |
| Last in milestone, more in next | milestone_complete | null |
| Fallback | chapter_complete | (keep current) |

Update state concept with new status, progress, and current_chapter.

---

## 11. Offer Next Steps

Route based on state status. Output markdown directly:

**Route A: Chapter verified, more chapters remain**
```
Fuska: Chapter {Z} complete — {Y} plans executed, goal verified [OK]
> Next Up: Chapter {Z+1}: {Name} — {Goal}
  /fuska-design {Z+1}
  */new first → fresh context window*
Also: /fuska-plan {Z+1}, /fuska-review {Z}
```

**Route B: Milestone complete**
```
Fuska: Milestone complete — {N} chapters completed, all verified [OK]
> Next Up: Audit milestone
  /fuska-audit
  */new first → fresh context window*
Also: /fuska-review, /fuska-complete
```

**Route C: All chapters complete**
```
Fuska: All chapters complete — All {totalChapters} finished, verified [OK]
> Next Up: Complete Milestone
  /fuska-complete
  */new first → fresh context window*
Also: /fuska-review
```

**Route D: Gaps found**
```
Fuska: Chapter {Z} gaps found — Score: {N}/{M} requirements verified
> What's Missing: {gap summaries from verification}
> Next Up: Plan fixes
  /fuska-plan {Z} --fixes
  */new first → fresh context window*
```

After fix planning: user runs `/fuska-build {Z}` again → executes new plans → re-verify → loop until passed.

</process>

<deviation_rules>

During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in summary concept
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user

Only rule 4 requires user intervention. Update plan's summary concept via megamemory (append to `issues_encountered`, add fix details to `decisions_made`).

</deviation_rules>

<success_criteria>

- [ ] All incomplete plans in chapter executed, each has summary concept
- [ ] Code review loop runs after execution (skippable with --no-code-review); revision loop max 3
- [ ] Chapter goal verified (requirements checked against codebase)
- [ ] Verification concept created
- [ ] State and chapter concepts updated
- [ ] Requirements marked complete
- [ ] User informed of next steps

</success_criteria>
