---
name: fuska-review
description: Validate built features through conversational verification using MegaMemory
argument-hint: "[chapter number, e.g., '4']"
tools:
  - read
  - bash
  - task
  - edit
  - megamemory:understand
  - megamemory:create_concept
  - megamemory:update_concept
---

<objective>

Validate built features through conversational testing with persistent state using MegaMemory.

Purpose: Confirm what OpenCode built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {chapter}-verification concept — tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /fuska-build.

</objective>

<execution_context>

@../../fuska/references/megamemory-quick-ref.md
@../../fuska/references/preflight-check-initiative-exists.md

@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>

<context>

Chapter: `$ARGUMENTS` (optional)
- If provided: Test specific chapter (e.g., "4")
- If not provided: Check state concept for active chapter

**Load all concepts upfront:**
```
const allConcepts = megamemory_understand(query="config state chapter summary", top_k=10000)
const nodeMap = new Map(allConcepts.matches?.map(n => [n.id, n]) || [])
```

**Layer 1 - Initiative Scoping:**
```
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

**Load state scoped by initiative:**
```
const stateNode = allConcepts.matches?.find(n =>
  n.name === 'state' &&
  n.kind === 'config' &&
  n.parent_id === initiativeId
)

const stateData = stateNode ? JSON.parse(stateNode.summary) : null
```

**Load roadmap scoped by initiative with dual-path parsing:**
```
const roadmapNode = allConcepts.matches?.find(n =>
  n.name === 'roadmap' &&
  n.kind === 'module' &&
  n.parent_id === initiativeId
)

let chapters = []

if (roadmapNode) {
  try {
    const roadmapData = JSON.parse(roadmapNode.summary)
    chapters = roadmapData.chapters || []
  } catch {
    const chapterConcepts = allConcepts.matches?.filter(n =>
      n.kind === 'feature' &&
      n.name.startsWith('chapter-') &&
      n.parent_id === initiativeId
    ) || []
    chapters = chapterConcepts.map(m => {
      const chapterData = JSON.parse(m.summary)
      return {
        number: chapterData.number,
        slug: chapterData.slug,
        name: chapterData.name,
        goal: chapterData.goal
      }
    }).sort((a, b) => a.number - b.number)
  }
}
```

</context>

<process>

## 0. Preflight Check

Follow the MegaMemory Initiative Exists Preflight Check from @preflight-check-initiative-exists.md.

## 1. Check for Active Verification Session or Start New

**Step 1.1: Parse chapter number from arguments**

The variable `input` contains the raw argument string provided by the user.

```
const chapterNumber = input.match(/\d+/)?.[0]
if (!chapterNumber) {
  Display: "Chapter number is required"
  Display: "Usage: /fuska-review <chapter>"
  Stop
}

const chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
```

**Step 1.2: Query state for current chapter (optional)**

If no chapter number provided:
Use the stateData already loaded in context section above.
```
if (!chapterNumber && stateData) {
  chapterNumber = parseInt(stateData.current_chapter?.replace('chapter-', '') || '1')
  chapterSlug = `chapter-${chapterNumber.toString().padStart(2, '0')}`
}
```

**Step 1.3: Query existing verification concept scoped by initiative**

```
const verificationNode = allConcepts.matches?.find(n =>
  n.name === `${chapterSlug}-verification` &&
  n.kind === 'component'
)
```

**Step 1.4: Check if verification exists**

If verificationNode:
```
const verificationData = JSON.parse(verificationNode.summary)
const verificationId = verificationNode.id
const verificationExists = true
```

Else:
```
const verificationExists = false
const verificationId = null
const verificationData = null
```

**Step 1.4a: Extract config for model resolution**

Use the configNode already loaded in context section above.
```
const configData = JSON.parse(configNode.summary)
const aliases = configData.model_aliases || {}
const gitMessageModel = aliases.explore_model || aliases.budget_model
```

**Step 1.5: Handle verification existence**

If verificationExists === true:
→ Use question tool:
```
const verificationResponse = question(questions=[{
  header: "Existing Verification",
  question: "Verification concept already exists for this chapter. What would you like to do?",
  options: [
    {label: "Resume verification", description: "Continue existing verification tests"},
    {label: "Start fresh", description: "Create new verification concept"}
  ]
}])
```

If user chooses "Resume verification":
→ Display: verificationData
→ Continue to step 2

If user chooses "Start fresh":
→ Continue to step 1.6 (create new verification)

---

## 2. Find Summary Concepts for Chapter

**Step 2.1: Query summary concepts with parent chain filtering**

```
const belongsToInitiative = (nodeId) => {
  let current = nodeId
  let depth = 0
  while (current && depth < 20) {
    const node = nodeMap.get(current)
    if (!node) break
    if (node.parent_id === initiativeId) return true
    if (node.id === initiativeId) return true
    current = node.parent_id
    depth++
  }
  return false
}

const summaryNodes = allConcepts.matches?.filter(n =>
  n.name.includes(`${chapterSlug}-`) &&
  n.name.endsWith('-summary') &&
  n.kind === 'component' &&
  belongsToInitiative(n.id)
) || []
```

**Step 2.2: Check for summaries**

If summaryNodes.length === 0:
→ Display: "No summary concepts found for ${chapterSlug}"
→ Stop

**Step 2.3: Extract summary data**

```
const summaryConcepts = summaryNodes.map(match => {
  const summaryData = JSON.parse(match.summary)
  return {
    id: match.id,
    name: match.name,
    data: summaryData
  }
})
```

Extract user-observable outcomes and requirements from each summary to build the test list.

---

## 3. Extract Testable Deliverables

**Step 3.1: Extract user-observable outcomes and requirements**

For each summary concept from step 2.3:
```
const userOutcomes = summaryData.verification_results || []
const requirements = summaryData.requirements || []
```

---

## 4. Create Verification Concept with Test List

**Step 4.1: Build verification data structure**

```
const summaryConceptIds = summaryConcepts.map(sc => sc.id)

const verificationData = {
  verification_results: [],
  issues_found: [],
  recommendations: [],
  concepts_reviewed: summaryConceptIds
}
```

**Step 4.2: Create or update verification concept**

If verificationExists === true:
→ Update existing:
```
megamemory_update_concept(
  id=verificationId,
  changes={
    summary: JSON.stringify(verificationData)
  }
)
```

If verificationExists === false:
→ Create new:
```
megamemory_create_concept(
  name=`${chapterSlug}-verification`,
  kind="component",
  summary=JSON.stringify(verificationData),
  parent_id=chapterSlug,
  why=`Verification concept created for Chapter ${chapterNumber}`
)
```

**Step 4.3: Save verification concept ID**

If verificationExists === false:
```
const verificationId = response.id  // Save the newly created concept's ID
```

---

## 5. Present Tests One at a Time

**Step 5.1: Build test list from requirements and outcomes**

```
const testList = []

for (const summary of summaryConcepts) {
  const summaryData = summary.data
  const userOutcomes = summaryData.verification_results || []
  const requirements = summaryData.requirements || []
  
  for (const outcome of userOutcomes) {
    for (const requirement of requirements) {
      testList.push({
        summary_id: summary.id,
        outcome: outcome,
        requirement: requirement
      })
    }
  }
}
```

**Step 5.2: Present tests to user**

Display:
```
-----------------------------------------------
 Fuska: VERIFICATION CHAPTER ${chapterNumber}
---------------------------------------------

${testList.length} tests to run
${testList.map((test, i) => `${i+1}. ${test.outcome}: ${test.requirement}`).join('\n')}
```

**Step 5.3: Run each test and collect responses**

For each test:
```
Display: `Expected: ${test.outcome}`
Display: `Check this manually and respond with: "yes" (passes) or describe the issue (fails)`

Wait for plain text response

**Step 5.4: Record test result**

If response starts with "yes" or "y":
```
const result = {
  status: "passed"
}
```

Else:
```
const result = {
  status: "failed",
  issue: response  // User's description of the problem
}
```

**Step 5.5: Update verification concept**

```
verificationData.verification_results.push(result)
```

**Step 5.6: Persist verification results**

Every 5 tests passed or on completion:
```
megamemory_update_concept(
  id=verificationId,
  changes={
    summary: JSON.stringify(verificationData)
  }
)
```

---

## 6. On Completion

**Step 6.1: Check if all tests passed**

```
const allPassed = verificationData.verification_results.every(r => r.status === 'passed')
```

**Step 6.2: Commit verification concept to git using fuska-git-message**

```
Task(
  description="Generate verification commit message",
  model=gitMessageModel,
  subagent_type="fuska-git-message",
  variant="amend",
  prompt=`<commit_context>
**Mode:** verification-commit
**Chapter:** ${chapterSlug}
**Commit Strategy:** per-chapter

**Verification Summary:**
${allPassed ? 'All tests passed' : `${passedCount}/${testList.length} tests passed`}

**Staged files:**
${modifiedFiles.join('\n')}
</commit_context>`
)
```

The agent returns the commit message. Then execute:

```bash
git add -u
git commit -m "${generatedMessage}"
```

**Step 6.3: Display completion summary**

If allPassed === true:
```
Display: "All ${testList.length} tests passed [OK]"
```

Else:
```
Display: `${verificationData.verification_results.filter(r => r.status === 'passed').length}/${testList.length} tests passed, ${verificationData.verification_results.filter(r => r.status !== 'passed').length} failed`
```

---

## 7. If Issues Found

**Step 7.1: Check for issues**

```
const hasIssues = verificationData.verification_results.some(r => r.status === 'failed')
```

**Step 7.2: Diagnose issues with debuggers**

If hasIssues === true:
```
const failedResults = verificationData.verification_results.filter(r => r.status === 'failed')
```

For each failed result:
→ Spawn fuska-debugger to investigate root cause:
```
Task(
  subagent_type="fuska-debugger",
  variant="validate",
  description=`Diagnose issue: ${result.issue}`,
  model="{debugger_model}",
  prompt=`Investigate why this test failed:

Chapter: ${chapterNumber}
Test: ${result.outcome}
Expected: ${result.requirement}
Issue: ${result.issue}

Examine the codebase using Read tool. Identify root cause.
Return a detailed diagnosis of the problem.
`
)
```

Collect all diagnosis results.

**Step 7.3: Plan fixes for gaps**

```
const gapDescriptions = verificationData.verification_results.filter(r => r.status === 'failed').map(r => r.issue)
```

Spawn fuska-planner in --fixes mode:
```
Task(
  subagent_type="fuska-planner",
  variant="plan",
  description=`Plan fixes for Chapter ${chapterNumber}`,
  model="{planner_model}",
  prompt=`Create additional plans to fix these issues:

Chapter: ${chapterNumber}
Verification issues: ${gapDescriptions.join(', ')}

Each gap should have a plan that:
- Clearly defines what needs to be fixed
- Has requirements for verification
- Is ready for execution

Use MegaMemory:
- Create plan concepts: megamemory:create_concept()
- Reference patterns from MegaMemory: megamemory:understand()
`
)
```

**Step 7.4: Verify fix plans**

Query newly created fix plan concepts:
```
megamemory_understand(query=`${chapterSlug}-plan`, top_k=20)
```

```
const fixPlanConcepts = response.matches.map(match => {
  const planSummaryString = match.summary
  const planData = JSON.parse(planSummaryString)
  return { id: match.id, name: match.name, data: planData }
})
```

Spawn fuska-plan-checker:
```
Task(
  subagent_type="fuska-plan-checker",
  variant="validate",
  description=`Verify gap closure plans for Chapter ${chapterNumber}`,
  model="{checker_model}",
  prompt=`Verify these fix plans will close gaps:

Chapter: ${chapterNumber}
Fix plans: ${fixPlanConcepts.map(fp => fp.name).join(', ')}

Check that each plan:
- Clearly defines what to fix
- Has requirements for verification
- Is ready for execution

If plans pass, verification is complete. If issues remain, iterate.
`
)
```

**Step 7.5: Present ready status**

When all issues resolved and verification complete:

→ Display: "Gap closure plans verified. Ready for execution."
→ Suggest: `/fuska-build ${chapterNumber}`

</process>

<anti_patterns>

- Don't use question for test responses — plain text conversation
- Don't ask severity — infer from description
- Don't present full checklist upfront — one test at a time
- Don't run automated tests — this is manual user validation
- Don't fix issues during testing — log as gaps, diagnose after all tests complete

</anti_patterns>

<offer_next>

Output this markdown directly (not as a code block). Route based on verification results:

| Status | Route |
|--------|-------|
| All tests pass + more chapters | Route A (next chapter) |
| All tests pass + last chapter | Route B (milestone complete) |
| Issues found + fix plans ready | Route C (execute fixes) |
| Issues found + planning blocked | Route D (manual intervention) |

---

**Route A: All tests pass, more chapters remain**

```
----------------------------------------------------
  Fuska: Chapter {Z} verified
----------------------------------------------------

**Chapter {Z}: {Name}**

{N}/{N} tests passed
Verification complete [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Chapter {Z+1}: {Name}** — {Goal from chapter concept}
/fuska-design {Z+1} — gather context and clarify approach

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-plan {Z+1} — skip design, plan directly
- /fuska-build {Z+1} — skip to execution (if already planned)
──────────────────────────────────────────────────────────────
```

---

**Route B: All tests pass, milestone complete**

```
----------------------------------------------------
  Fuska: Chapter {Z} verified
----------------------------------------------------

**Chapter {Z}: {Name}**

{N}/{N} tests passed
Final chapter verified [OK]

──────────────────────────────────────────────────────────────

## > Next Up

**Audit milestone** — verify requirements, cross-chapter integration, E2E flows
/fuska-audit

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- /fuska-complete — skip audit, archive directly
──────────────────────────────────────────────────────────────
```

---

**Route C: Issues found, fix plans ready**

```
-----------------------------------------------------
  Fuska: Chapter {Z} issues found
-----------------------------------------------------

**Chapter {Z}: {Name}**

{N}/{M} tests passed
{X} issues diagnosed
Fix plans verified [OK]

### Issues Found

{List issues with severity from verification concept}

──────────────────────────────────────────────────────────────

## > Next Up

**Execute fix plans** — run diagnosed fixes
/fuska-build {Z} --fixes-only

*/new first → fresh context window*

──────────────────────────────────────────────────────────────

**Also available:**
- Query fix plans: use megamemory:understand to search for the chapter's plan concepts
- /fuska-plan {Z} --fixes — regenerate fix plans
──────────────────────────────────────────────────────────────
```

---

**Route D: Issues found, planning blocked**

```
-----------------------------------------------------
  Fuska: Chapter {Z} blocked
-----------------------------------------------------

**Chapter {Z}: {Name}**

{N}/{M} tests passed
Fix planning blocked after {X} iterations

### Unresolved Issues

{List blocking issues from planner/checker output}

──────────────────────────────────────────────────────────────

## > Next Up

**Manual intervention required**

Review the issues above and either:
1. Provide guidance for fix planning
2. Manually address blockers
3. Accept current state and continue

──────────────────────────────────────────────────────────────

**Options:**
- /fuska-plan {Z} --fixes — retry fix planning with guidance
- /fuska-design {Z} — gather more context before replanning
──────────────────────────────────────────────────────────────
```

</offer_next>

<success_criteria>

- [ ] Verification concept created with tests from summary concepts
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] Verification concept updated batched (every 5 passes or completion)
- [ ] Committed on completion
- [ ] If issues: Parallel debug agents diagnose root causes
- [ ] If issues: fuska-planner creates fix plans from diagnosed gaps
- [ ] If issues: fuska-plan-checker verifies fix plans (max 3 iterations)
- [ ] Ready for `/fuska-build` when complete

</success_criteria>
