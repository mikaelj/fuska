<purpose>
Validate built features through conversational testing with persistent state. Creates UAT concept in MegaMemory that tracks test progress, survives /new, and feeds gaps into /fuska-plan-phase --gaps.

User tests, OpenCode records. One test at a time. Plain text responses.
</purpose>

<philosophy>
**Show expected, ask if reality matches.**

OpenCode presents what SHOULD happen. User confirms or describes what's different.
- "yes" / "y" / "next" / empty → pass
- Anything else → logged as issue, severity inferred

No Pass/Fail buttons. No severity questions. Just: "Here's what should happen. Does it?"
</philosophy>

@../references/megamemory-integration.md

<process>

<step name="resolve_model_profile" priority="first">
Query MegaMemory for planning config and resolve model profile:

```bash
# Query for planning config concept
megamemory:understand({query: "planning config"})

# Parse response: If config concept exists, extract model_profile and model_aliases from summary JSON
# If config concept missing, use default "balanced" with default aliases
```

**Model aliases (with defaults):**
```
const aliases = configData.model_aliases || {
  quality_model: "opencode/claude-opus-4",
  balanced_model: "opencode/claude-sonnet-4",
  budget_model: "opencode/claude-haiku-4"
}
```

**Model lookup table (uses aliases):**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| fuska-planner | quality_model | quality_model | balanced_model |
| fuska-plan-checker | balanced_model | balanced_model | budget_model |

```
const modelLookup = {
  quality: { planner: aliases.quality_model, checker: aliases.balanced_model },
  balanced: { planner: aliases.quality_model, checker: aliases.balanced_model },
  budget: { planner: aliases.balanced_model, checker: aliases.budget_model }
}
const models = modelLookup[modelProfile]
```

Store resolved models for use in Task calls below.
</step>

<step name="check_active_session">
**First: Check for active UAT sessions**

Query MegaMemory for active UAT concepts:

```bash
megamemory:understand(query="UAT testing sessions with status testing")
```

**If active sessions exist AND no `$ARGUMENTS` provided:**

Parse each concept's summary JSON to extract (status, phase) and current_test.

Display inline:

```
## Active UAT Sessions

| # | Phase | Status | Current Test | Progress |
|---|-------|--------|--------------|----------|
| 1 | 04-comments | testing | 3. Reply to Comment | 2/6 |
| 2 | 05-auth | testing | 1. Login Form | 0/4 |

Reply with a number to resume, or provide a phase number to start new.
```

Wait for user response.

- If user replies with number (1, 2) → Load that concept, go to `resume_from_concept`
- If user replies with phase number → Treat as new session, go to `create_uat_concept`

**If active sessions exist AND `$ARGUMENTS` provided:**

Check if session exists for that phase. If yes, offer to resume or restart.
If no, continue to `create_uat_concept`.

**If no active sessions AND no `$ARGUMENTS`:**

```
No active UAT sessions.

Provide a phase number to start testing (e.g., /fuska-verify-work 4)
```

**If no active sessions AND `$ARGUMENTS` provided:**

Continue to `create_uat_concept`.
</step>

<step name="find_summaries">
**Find what to test:**

Parse `$ARGUMENTS` as phase number (e.g., "4") or plan number (e.g., "04-02").

Query MegaMemory for phase concept:

```bash
# Query for phase concept to get phase details and parent_id
megamemory:understand({query: "phase ${PHASE_ARG}", top_k: 10})
```

Parse phase concept.summary JSON to extract:
- Phase number/slug
- Phase directory name
- Any metadata about deliverables

Query MegaMemory for summary concepts for this phase:

```bash
# Query for summary concepts related to this phase
megamemory:understand({query: "${phase_slug} summary", top_k: 100})
```

Parse each summary concept's.summary JSON to extract testable deliverables.
</step>

<step name="extract_tests">
**Extract testable deliverables from SUMMARY.md:**

Parse for:
1. **Accomplishments** - Features/functionality added
2. **User-facing changes** - UI, workflows, interactions

Focus on USER-OBSERVABLE outcomes, not implementation details.

For each deliverable, create a test:
- name: Brief test name
- expected: What the user should see/experience (specific, observable)

Examples:
- Accomplishment: "Added comment threading with infinite nesting"
  → Test: "Reply to a Comment"
  → Expected: "Clicking Reply opens inline composer below comment. Submitting shows reply nested under parent with visual indentation."

Skip internal/non-observable items (refactors, type changes, etc.).
</step>

<step name="create_uat_concept">
**Create UAT concept in MegaMemory with all tests:**

Build test list from extracted deliverables.

Construct JSON summary:

```json
{
  "status": "testing",
  "phase": "XX-name",
  "phase_dir": "XX-name",
  "source": ["04-01-SUMMARY.md", "04-02-SUMMARY.md"],
  "started": "[ISO timestamp]",
  "updated": "[ISO timestamp]",
  "current_test": {
    "number": 1,
    "name": "[first test name]",
    "expected": "[what user should observe]",
    "awaiting": "user response"
  },
  "tests": [
    {
      "number": 1,
      "name": "[Test Name]",
      "expected": "[observable behavior]",
      "result": "pending"
    }
  ],
  "summary": {
    "total": [N],
    "passed": 0,
    "issues": 0,
    "pending": [N],
    "skipped": 0
  },
  "gaps": []
}
```

Create MegaMemory concept:

```bash
megamemory:create_concept(
  name="{phase} UAT",
  kind="feature",
  summary="{JSON string}",
  parent_id="{phase_concept_id}",
  why="Tracks UAT testing progress for phase",
  created_by_task="verify-work workflow"
)
```

Store returned concept_id for updates.

Proceed to `present_test`.
</step>

<step name="present_test">
**Present current test to user:**

Query MegaMemory for UAT concept and parse current_test from summary.

Display using checkpoint box format:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Test {number}: {name}**

{expected}

──────────────────────────────────────────────────────────────
→ Type "pass" or describe what's wrong
──────────────────────────────────────────────────────────────
```

Wait for user response (plain text, no question).
</step>

<step name="process_response">
**Process user response and update MegaMemory concept:**

Query UAT concept to get current summary JSON.

**If response indicates pass:**
- Empty response, "yes", "y", "ok", "pass", "next", "approved", "[OK]"

Update tests array in JSON:
```json
{
  "number": {N},
  "name": "{name}",
  "expected": "{expected}",
  "result": "pass"
}
```

**If response indicates skip:**
- "skip", "can't test", "n/a"

Update tests array in JSON:
```json
{
  "number": {N},
  "name": "{name}",
  "expected": "{expected}",
  "result": "skipped",
  "reason": "[user's reason if provided]"
}
```

**If response is anything else:**
- Treat as issue description

Infer severity from description:
- Contains: crash, error, exception, fails, broken, unusable → blocker
- Contains: doesn't work, wrong, missing, can't → major
- Contains: slow, weird, off, minor, small → minor
- Contains: color, font, spacing, alignment, visual → cosmetic
- Default if unclear: major

Update tests array in JSON:
```json
{
  "number": {N},
  "name": "{name}",
  "expected": "{expected}",
  "result": "issue",
  "reported": "{verbatim user response}",
  "severity": "{inferred}"
}
```

Append to gaps array in JSON:
```json
{
  "truth": "{expected behavior from test}",
  "status": "failed",
  "reason": "User reported: {verbatim user response}",
  "severity": "{inferred}",
  "test": {N},
  "artifacts": [],
  "missing": []
}
```

**After any response:**

Update summary counts in JSON.
Update updated timestamp.

If more tests remain → Update current_test, update MegaMemory concept, go to `present_test`
If no more tests → Go to `complete_session`

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{uat_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```
</step>

<step name="resume_from_concept">
**Resume testing from UAT concept in MegaMemory:**

Query MegaMemory for UAT concept and parse full summary JSON.

Find first test with `result: "pending"`.

Announce:
```
Resuming: Phase {phase} UAT
Progress: {passed + issues + skipped}/{total}
Issues found so far: {issues count}

Continuing from Test {N}...
```

Update current_test in JSON with the pending test.
Update MegaMemory concept.
Proceed to `present_test`.
</step>

<step name="complete_session">
**Complete testing:**

Update JSON summary:
- status: "complete"
- updated: [now]
- current_test: {awaiting: "complete"}

**MegaMemory Update:**
```bash
megamemory:update_concept(
  id="{uat_concept_id}",
  changes={"summary": "{updated JSON string}"}
)
```

**Commit changes (if any files were modified):**

```bash
# Note: MegaMemory concepts are not committed to git
# Only commit actual source code changes made during testing
git commit -m "test({phase}): complete UAT - {passed} passed, {issues} issues"
```

Present summary:
```
## UAT Complete: Phase {phase}

| Result | Count |
|--------|-------|
| Passed | {N}   |
| Issues | {N}   |
| Skipped| {N}   |

[If issues > 0:]
### Issues Found

[List from gaps array]
```

**If issues > 0:** Proceed to `diagnose_issues`

**If issues == 0:**
```
All tests passed. Ready to continue.

- `/fuska-plan-phase {next}` — Plan next phase
- `/fuska-execute-phase {next}` — Execute next phase
```
</step>

<step name="diagnose_issues">
**Diagnose root causes before planning fixes:**

```
---

{N} issues found. Diagnosing root causes...

Spawning parallel debug agents to investigate each issue.
```

- Load diagnose-issues workflow
- Follow @./diagnose-issues.md
- Spawn parallel debug agents for each issue
- Collect root causes
- Update UAT concept's gaps array with root causes in JSON summary
- Update MegaMemory concept
- Proceed to `plan_gap_closure`

Diagnosis runs automatically - no user prompt. Parallel agents investigate simultaneously, so overhead is minimal and fixes are more accurate.
</step>

<step name="plan_gap_closure">
**Auto-plan fixes from diagnosed gaps:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: Planning fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning planner for gap closure...
```

Spawn fuska-planner in --gaps mode:

```
Task(
  prompt="""
<planning_context>

**Phase:** {phase_number}
**Mode:** gap_closure

**UAT with diagnoses:**
Query MegaMemory for UAT concept: megamemory:understand(query="{phase} UAT")

**Project State:**
Query MegaMemory for STATE concept: megamemory:understand(query="project state")

**Roadmap:**
Query MegaMemory for ROADMAP concept: megamemory:understand(query="roadmap")

Parse JSON from concept.summary fields for structured data.

</planning_context>

<downstream_consumer>
Output consumed by /fuska-execute-phase
Plans must be executable prompts.
</downstream_consumer>
""",
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Plan gap fixes for Phase {phase}"
)
```

On return:
- **PLANNING COMPLETE:** Proceed to `verify_gap_plans`
- **PLANNING INCONCLUSIVE:** Report and offer manual intervention
</step>

<step name="verify_gap_plans">
**Verify fix plans with checker:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: Verifying fix plans
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[IN_PROGRESS] Spawning plan checker...
```

Initialize: `iteration_count = 1`

Spawn fuska-plan-checker:

```
Task(
  prompt="""
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** Close diagnosed gaps from UAT

**Plans to verify:**

Query MegaMemory for plan concepts for this phase:

```bash
megamemory:understand({query: "phase ${phase_number} plans", top_k: 100})
```

Parse plan concepts' summary JSON for verification.

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
""",
  subagent_type="fuska-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} fix plans"
)
```

On return:
- **VERIFICATION PASSED:** Proceed to `present_ready`
- **ISSUES FOUND:** Proceed to `revision_loop`
</step>

<step name="revision_loop">
**Iterate planner ↔ checker until plans pass (max 3):**

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Spawn fuska-planner with revision context:

```
Task(
  prompt="""
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

**Existing plans:**

Query MegaMemory for plan concepts for this phase:

```bash
megamemory:understand({query: "phase ${phase_number} plans", top_k: 100})
```

Parse plan concepts' summary JSON for plan details.

**Checker issues:**
{structured_issues_from_checker}

</revision_context>

<instructions>
read existing PLAN.md files. Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
</instructions>
""",
  subagent_type="fuska-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

After planner returns → spawn checker again (verify_gap_plans logic)
Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain.`

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit, user runs /fuska-plan-phase manually)

Wait for user response.
</step>

<step name="present_ready">
**Present completion and next steps:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fuska: Fixes ready
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} gap(s) diagnosed, {M} fix plan(s) created

| Gap | Root Cause | Fix Plan |
|-----|------------|----------|
| {truth 1} | {root_cause} | {phase}-04 |
| {truth 2} | {root_cause} | {phase}-04 |

Plans verified and ready for execution.

───────────────────────────────────────────────────────────────

## > Next Up

**Execute fixes** — run fix plans

`/new` then `/fuska-execute-phase {phase} --gaps-only`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<update_rules>
**MegaMemory updates for efficiency:**

Keep results in memory. Update concept only when:
1. **Issue found** — Preserve the problem immediately
2. **Session complete** — Final update
3. **Checkpoint** — Every 5 passed tests (safety net)

| Field | Rule | When Updated |
|-------|------|--------------|
| status | OVERWRITE | Start, complete |
| updated | OVERWRITE | On any concept update |
| current_test | OVERWRITE | On any concept update |
| tests[{N}].result | OVERWRITE | On any concept update |
| summary | OVERWRITE | On any concept update |
| gaps | APPEND | When issue found |

On context reset: Concept shows last checkpoint. Resume from there.
</update_rules>

<severity_inference>
**Infer severity from user's natural language:**

| User says | Infer |
|-----------|-------|
| "crashes", "error", "exception", "fails completely" | blocker |
| "doesn't work", "nothing happens", "wrong behavior" | major |
| "works but...", "slow", "weird", "minor issue" | minor |
| "color", "spacing", "alignment", "looks off" | cosmetic |

Default to **major** if unclear. User can correct if needed.

**Never ask "how severe is this?"** - just infer and move on.
</severity_inference>

<success_criteria>
- [ ] UAT concept created in MegaMemory with all tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip
- [ ] Severity inferred from description (never asked)
- [ ] MegaMemory concept updated: on issue, every 5 passes, or completion
- [ ] Committed on completion (if enabled)
- [ ] If issues: parallel debug agents diagnose root causes
- [ ] If issues: fuska-planner creates fix plans (gap_closure mode)
- [ ] If issues: fuska-plan-checker verifies fix plans
- [ ] If issues: revision loop until plans pass (max 3 iterations)
- [ ] Ready for `/fuska-execute-phase --gaps-only` when complete
</success_criteria>
