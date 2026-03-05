---
name: fuska-code-review
description: Review uncommitted changes against Fuska project context using the code reviewer agent
argument-hint: "[optional task description]"
tools:
  - read
  - bash
  - grep
  - glob
  - megamemory:understand
  - megamemory:list_roots
  - task
---

<objective>

Review uncommitted git changes against Fuska project context from MegaMemory.

Purpose: Run the fuska-code-reviewer agent on uncommitted changes, enriched with current project state (chapter, plan, task context) if available. Catches stubs, missing wiring, plan deviations, and anti-patterns before commit.

Output: REVIEW PASSED or ISSUES FOUND with structured issue list.

</objective>

<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md

</execution_context>

<context>

Arguments: `$ARGUMENTS` (optional description to guide review focus)

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

---

## 1. Load Initiative Context and Project State

Query MegaMemory for project context to enrich the review.

**Step 1.1:** Load current initiative

```
megamemory_understand(query="config concepts", top_k=10000)

const configNode = allConcepts.matches?.find(n => n.name === 'config' && n.kind === 'config')
const currentInitiative = configNode ? JSON.parse(configNode.summary).current_initiative : null

const initiativeRoot = allConcepts.matches?.find(n =>
  n.name === currentInitiative && n.kind === 'feature' && !n.parent_id
)
const initiativeId = initiativeRoot?.id
```

**Step 1.2:** Query state concept scoped by initiative

```
const stateNode = allConcepts.matches?.find(n =>
  n.name === 'state' && n.kind === 'config' && n.parent_id === initiativeId
)
```

If stateNode exists:
```
const stateData = JSON.parse(stateNode.summary)
const currentChapter = stateData.current_chapter || null
const currentPlan = stateData.current_plan || null
```

**Step 1.3:** Query plan data if current_plan exists

If currentPlan is not null:
```
const planNode = allConcepts.matches?.find(n => n.name === currentPlan)
```

If planNode exists:
```
const planData = JSON.parse(planNode.summary)
```

**Step 1.4:** Query research data if plan has research

If planData exists and planData includes research reference:
```
const researchNode = allConcepts.matches?.find(n => n.name === `${currentPlan}-research`)
```

If researchNode exists:
```
const researchData = JSON.parse(researchNode.summary)
```

---

## 1.5. Resolve Model

Query config to get model profile, then resolve the code-reviewer model.

```
const configData = configNode
  ? JSON.parse(configNode.summary)
  : { model_aliases: { budget_model: "zai-coding-plan/glm-4.7" } }

const modelProfile = configData.profiles?.active_profile || "balanced"
const codeReviewerModel = configData.model_aliases?.budget_model || "zai-coding-plan/glm-4.7"
```

Note: Code reviewer always uses budget_model regardless of active profile.

---

## 2. Get Git Diff and Modified Files

**Step 2.1:** Run git diff to get uncommitted changes

```
git diff HEAD
```

Store output as `diffOutput`.

**Step 2.2:** Get list of modified files

```
git diff HEAD --name-only
```

Store output as `modifiedFiles` (array of file paths).

---

## 3. Check for Empty Diff

If `diffOutput` is empty or whitespace-only:
```
Display: "No uncommitted changes to review."
Stop
```

---

## 4. Determine Review Context Type

Based on available context:

| Context | Description |
|---------|-------------|
| Has plan + research | Full review against plan and research patterns |
| Has plan only | Review against plan tasks |
| No plan (standalone) | Standalone code review without plan context |

**Task description source:**
1. If `$ARGUMENTS` provided → use as task description
2. If planData exists → use `planData.description`
3. Otherwise → "Standalone code review"

---

## 5. Build Code Reviewer Prompt

Construct the prompt for fuska-code-reviewer:

```
const codeReviewerPrompt = `<critical_constraints>
Return one of:
- ## REVIEW PASSED -- code is ready
- ## ISSUES FOUND -- structured issue list with fix hints
Review ONLY the diff and modified files. Do NOT create MegaMemory concepts.
</critical_constraints>

<review_context>

**Task:** ${taskDescription}

${planData ? `**Plan Data:**\n${JSON.stringify(planData, null, 2)}` : ''}

${researchData ? `**Research Findings:**\n${JSON.stringify(researchData, null, 2)}` : ''}

**Modified Files:**
${modifiedFiles.join('\n')}

**Git Diff:**
${diffOutput}

</review_context>`
```

---

## 6. Spawn Code Reviewer Agent

```
Task(
  description="Review uncommitted changes",
  subagent_type="fuska-code-reviewer",
  model=codeReviewerModel,
  variant="validate",
  prompt=codeReviewerPrompt
)
```

---

## 7. Return Reviewer Output

Display the complete output from the code reviewer agent.

The agent will return either:
- `## REVIEW PASSED` with summary of checks passed
- `## ISSUES FOUND` with structured blocker/warning lists and fix hints

</process>

<offer_next>

If REVIEW PASSED:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Code Review Passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes are ready to commit.

Run: git add -A && git commit
Or: /fuska git-message (to generate commit message)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If ISSUES FOUND:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Code Review: Issues Found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Review the issues above and fix them.

Then run: /fuska-code-review (to re-review)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</offer_next>

<success_criteria>

- [ ] Preflight check passes (initiative exists)
- [ ] State loaded from MegaMemory (if available)
- [ ] Plan data loaded if current_plan in state
- [ ] Git diff obtained from HEAD
- [ ] Modified files list obtained
- [ ] Empty diff detected and handled (exit with message)
- [ ] Code reviewer spawned with enriched context
- [ ] Reviewer output returned directly

</success_criteria>
