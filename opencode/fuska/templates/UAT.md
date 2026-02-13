# UAT Template (MegaMemory-Backed)

Template for UAT session tracking using MegaMemory concepts — persistent test tracking across /new invocations.

---

<megamemory_schema>

## Concept: `uat-session`

**Kind:** `feature`

**Summary:** User Acceptance Testing session with persistent test tracking, results, gaps, and diagnosis. Supports resumable sessions across /new invocations.

**Fields:**
- `phase_id` (string) - Phase identifier
- `status` (string) - "testing", "complete", or "diagnosed"
- `source` (array) - SUMMARY.md files being tested
- `started` (string) - ISO timestamp when session started
- `updated` (string) - ISO timestamp of last update
- `current_test` (object)
  - `number` (number) - Test number currently being executed
  - `name` (string) - Test name
  - `expected` (string) - What user should observe
  - `awaiting` (string) - "user response" or "[testing complete]"
- `tests` (array)
  - `number` (number) - Test number
  - `name` (string) - Test name
  - `expected` (string) - Observable behavior
  - `result` (string) - "pending", "pass", "issue", "skipped"
  - `reported` (string, optional) - Verbatim user response for issues
  - `severity` (string, optional) - Inferred severity for issues
  - `reason` (string, optional) - Why skipped
- `summary` (object)
  - `total` (number) - Total tests
  - `passed` (number) - Passed tests
  - `issues` (number) - Tests with issues
  - `pending` (number) - Pending tests
  - `skipped` (number) - Skipped tests
- `gaps` (array) - Failed tests with diagnosis (filled after diagnosis)
  - `truth` (string) - Expected behavior from test
  - `status` (string) - "failed"
  - `reason` (string) - User's verbatim response
  - `severity` (string) - Inferred severity
  - `test` (number) - Test number
   - `root_cause` (string, optional) - Filled by diagnosis
   - `artifacts` (array, optional) - Files with issues
   - `missing` (array, optional) - What's missing
   - `debug_session` (string, optional) - Debug session MegaMemory concept ID

**Relationships:**
- `depends_on` → `phase-summary:source` - Tests against phase summaries
- `connects_to` → `phase-plan:gaps` - Diagnosed gaps feed back into planning

</megamemory_schema>

<megamemory_operations>

## Create UAT Session

```typescript
// When starting new UAT session for a phase
await megamemory.create_concept({
  name: `uat-session:${phaseId}`,
  kind: "feature",
  summary: `UAT session for phase ${phaseId}. Status: testing. ${tests.length} tests from ${source.length} summaries. Current: test ${currentTest.number} - ${currentTest.name}. Summary: ${summary.passed} passed, ${summary.issues} issues, ${summary.pending} pending.`,
  why: "Persistent UAT session tracking across /new invocations, supports resumable testing and gap diagnosis",
  parent_id: `project:${projectId}`,
  edges: [
    ...source.map((sum, i) => ({
      to: `phase-summary:${sum}`,
      relation: "depends_on",
      description: `Tests against ${sum}`
    }))
  ]
})
```

## Query UAT Session Status

```typescript
// After /new invocation - resume UAT if active
const result = await megamemory.understand({
  query: `uat session for phase ${phaseId} current test status`,
  top_k: 3
})

// Returns:
// - current_test: where we are in testing
// - summary: progress so far
// - status: testing | complete | diagnosed
// verify-work agent resumes from pending test
```

## Update UAT with Test Result

```typescript
// When user responds to a test
await megamemory.update_concept({
  id: `uat-session:${phaseId}`,
  changes: {
    summary: `UAT session for phase ${phaseId}. Status: ${status}. ${tests.length} tests. Current: test ${currentTest.number} - ${currentTest.name}. Summary: ${summary.passed} passed, ${summary.issues} issues, ${summary.pending} pending. Gaps: ${gaps.length}.`
  }
})
```

## Link UAT Gaps to Planning

```typescript
// After diagnosis - link gaps to phase planning
gaps.forEach(gap => {
  megamemory.link({
    from: `uat-session:${phaseId}`,
    to: `phase-plan:${phaseId}`,
    relation: "connects_to",
    description: `Diagnosed gap: ${gap.truth} - root cause: ${gap.root_cause}`
  })
})
```

</megamemory_operations>

<megamemory_examples>

## Example 1: Creating UAT Session

```typescript
// Starting UAT for Phase 4: Comments
await megamemory.create_concept({
  name: "uat-session:04-comments",
  kind: "feature",
  summary: "UAT session for phase 04-comments. Status: testing. 6 tests from 2 summaries. Current: test 1 - View Comments on Post. Summary: 0 passed, 0 issues, 6 pending.",
  why: "Test comment functionality: viewing, creating, replying, deleting, visual nesting, comment counts",
  parent_id: "project:social-app",
  edges: [
    {
      to: "phase-summary:04-comments-01",
      relation: "depends_on",
      description: "Tests against 04-01-SUMMARY.md"
    },
    {
      to: "phase-summary:04-comments-02",
      relation: "depends_on",
      description: "Tests against 04-02-SUMMARY.md"
    }
  ]
})
```

## Example 2: Resuming UAT After /new

```typescript
// User runs /new - verify-work agent checks for active UAT
const result = await megamemory.understand({
  query: "uat session 04-comments current test status pending",
  top_k: 3
})

// Returns: testing, current test 2, 1 test passed, 0 issues, 5 pending
// verify-work resumes from test 2: "Create Top-Level Comment"
// Summary shows progress: 1 passed, 0 issues, 5 pending
```

## Example 3: Updating UAT with Issue

```typescript
// User reports issue with test 2
await megamemory.update_concept({
  id: "uat-session:04-comments",
  changes: {
    summary: "UAT session for phase 04-comments. Status: testing. 6 tests. Current: test 3 - Reply to a Comment. Summary: 1 passed, 1 issues, 4 pending. Gaps: 1."
  }
})

// Append to gaps:
// - truth: "Comment appears immediately after submission in list"
//   status: failed
//   reason: "User reported: works but doesn't show until I refresh the page"
//   severity: major
//   test: 2
```

## Example 4: Linking Diagnosed Gaps to Planning

```typescript
// After diagnosis workflow completes
const gaps = [
  {
    truth: "Comment appears immediately after submission in list",
    status: "failed",
    reason: "works but doesn't show until I refresh the page",
    severity: "major",
    test: 2,
    root_cause: "useEffect in CommentList.tsx missing commentCount dependency",
    artifacts: [{path: "src/components/CommentList.tsx", issue: "useEffect missing dependency"}],
    missing: ["Add commentCount to useEffect dependency array"],
    debug_session: "debug-session:comment-not-refreshing"
  }
]

// Link each gap to planning
gaps.forEach(gap => {
  megamemory.link({
    from: "uat-session:04-comments",
    to: "phase-plan:04-comments",
    relation: "connects_to",
    description: `Diagnosed gap: ${gap.truth} - ${gap.root_cause}`
  })
})
```

## Example 5: Querying All Gaps for Planning

```typescript
// plan-phase --gaps asks: what diagnosed gaps need fixing?
const result = await megamemory.understand({
  query: `uat session ${phaseId} diagnosed gaps with root cause artifacts missing`,
  top_k: 20
})

// Returns all diagnosed gaps with:
// - truth (expected behavior)
// - root_cause (what went wrong)
// - artifacts (files to fix)
// - missing (what to add)
// - severity (blocker, major, minor, cosmetic)
// plan-phase creates fix plans for each gap
```

</megamemory_examples>

---

## File Template

```markdown
---
status: testing | complete | diagnosed
phase: XX-name
source: [list of SUMMARY.md files tested]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: [N]
name: [test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior - what user should see]
result: [pending]

### 2. [Test Name]
expected: [observable behavior]
result: pass

### 3. [Test Name]
expected: [observable behavior]
result: issue
reported: "[verbatim user response]"
severity: major

### 4. [Test Name]
expected: [observable behavior]
result: skipped
reason: [why skipped]

...

## Summary

total: [N]
passed: [N]
issues: [N]
pending: [N]
skipped: [N]

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
- truth: "[expected behavior from test]"
  status: failed
  reason: "User reported: [verbatim response]"
  severity: blocker | major | minor | cosmetic
  test: [N]
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
```

---

<section_rules>

**Frontmatter:**
- `status`: OVERWRITE - "testing" or "complete"
- `phase`: IMMUTABLE - set on creation
- `source`: IMMUTABLE - SUMMARY files being tested
- `started`: IMMUTABLE - set on creation
- `updated`: OVERWRITE - update on every change

**Current Test:**
- OVERWRITE entirely on each test transition
- Shows which test is active and what's awaited
- On completion: "[testing complete]"

**Tests:**
- Each test: OVERWRITE result field when user responds
- `result` values: [pending], pass, issue, skipped
- If issue: add `reported` (verbatim) and `severity` (inferred)
- If skipped: add `reason` if provided

**Summary:**
- OVERWRITE counts after each response
- Tracks: total, passed, issues, pending, skipped

**Gaps:**
- APPEND only when issue found (YAML format)
- After diagnosis: fill `root_cause`, `artifacts`, `missing`, `debug_session`
- This section feeds directly into /fuska-plan-phase --gaps

</section_rules>

<diagnosis_lifecycle>

**After testing complete (status: complete), if gaps exist:**

1. User runs diagnosis (from verify-work offer or manually)
2. diagnose-issues workflow spawns parallel debug agents
3. Each agent investigates one gap, returns root cause
4. UAT.md Gaps section updated with diagnosis:
   - Each gap gets `root_cause`, `artifacts`, `missing`, `debug_session` filled
5. status → "diagnosed"
6. Ready for /fuska-plan-phase --gaps with root causes

**After diagnosis:**
```yaml
## Gaps

- truth: "Comment appears immediately after submission"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  root_cause: "useEffect in CommentList.tsx missing commentCount dependency"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect missing dependency"
   missing:
     - "Add commentCount to useEffect dependency array"
   debug_session: "debug-session:comment-not-refreshing"
```

</diagnosis_lifecycle>

<lifecycle>

**Creation:** When /fuska-verify-work starts new session
- Extract tests from SUMMARY.md files
- Set status to "testing"
- Current Test points to test 1
- All tests have result: [pending]

**During testing:**
- Present test from Current Test section
- User responds with pass confirmation or issue description
- Update test result (pass/issue/skipped)
- Update Summary counts
- If issue: append to Gaps section (YAML format), infer severity
- Move Current Test to next pending test

**On completion:**
- status → "complete"
- Current Test → "[testing complete]"
- Commit file
- Present summary with next steps

**Resume after /new:**
1. read frontmatter → know phase and status
2. read Current Test → know where we are
3. Find first [pending] result → continue from there
4. Summary shows progress so far

</lifecycle>

<severity_guide>

Severity is INFERRED from user's natural language, never asked.

| User describes | Infer |
|----------------|-------|
| Crash, error, exception, fails completely, unusable | blocker |
| Doesn't work, nothing happens, wrong behavior, missing | major |
| Works but..., slow, weird, minor, small issue | minor |
| Color, font, spacing, alignment, visual, looks off | cosmetic |

Default: **major** (safe default, user can clarify if wrong)

</severity_guide>

<good_example>
```markdown
---
status: diagnosed
phase: 04-comments
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2025-01-15T10:30:00Z
updated: 2025-01-15T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. View Comments on Post
expected: Comments section expands, shows count and comment list
result: pass

### 2. Create Top-Level Comment
expected: Submit comment via rich text editor, appears in list with author info
result: issue
reported: "works but doesn't show until I refresh the page"
severity: major

### 3. Reply to a Comment
expected: Click Reply, inline composer appears, submit shows nested reply
result: pass

### 4. Visual Nesting
expected: 3+ level thread shows indentation, left borders, caps at reasonable depth
result: pass

### 5. Delete Own Comment
expected: Click delete on own comment, removed or shows [deleted] if has replies
result: pass

### 6. Comment Count
expected: Post shows accurate count, increments when adding comment
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Comment appears immediately after submission in list"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  root_cause: "useEffect in CommentList.tsx missing commentCount dependency"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect missing dependency"
   missing:
     - "Add commentCount to useEffect dependency array"
   debug_session: "debug-session:comment-not-refreshing"
```
</good_example>
