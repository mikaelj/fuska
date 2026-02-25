# Fuska-Do Session: Checked Mode in Action

- **Task:** Improve workflow mode display in `fuska config`
- **Date:** February 25, 2026
- **Commit:** `466fdf1`

---

## What is fuska-do?

`/fuska-do` is Fuska's ad-hoc task orchestrator. It takes a one-line task description and runs it through a configurable multi-agent pipeline: research, plan, validate, build, review, commit. The "mode" determines which agents participate:

| Mode | Pipeline |
|------|----------|
| planned | Planner -> Builder -> Code Reviewer |
| **checked** | **Planner -> Plan Checker -> Builder -> Code Reviewer** |
| researched | Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer |
| verified | Researcher -> Planner -> Plan Checker -> Builder -> Code Reviewer -> Verifier |

**Checked mode** adds a Plan Checker agent between planning and execution. The user is also prompted to approve the plan before building starts (`autoExecute: false`).

## The task

The user noticed that `fuska config` shows workflow modes with misleading percentages like "standard (90%)" when standard actually runs 100% of the agents. Instead, it should show the agent pipeline for each mode.

---

## Phase 1: Preflight & Context Loading

The orchestrator queries MegaMemory three times upfront to load all context needed for the session:

| Query | Purpose | Key result |
|-------|---------|------------|
| `megamemory_understand("config", top_k=5)` | Find initiative config | Found `config` concept with workflow settings, model aliases |
| `megamemory_understand("state", top_k=5)` | Find initiative state | Found domain-level state concepts |
| `megamemory_understand("task-", top_k=50)` | Find existing tasks | Found tasks up to task-025, so next is 026 |

Then `megamemory_list_roots()` to confirm the initiative structure and locate child concepts.

> The MegaMemory outputs are massive JSON blobs (hundreds of lines of concept data, similarity scores, edges). The orchestrator parses them silently and extracts only what it needs.

---

## Phase 2: Argument Parsing & Mode Resolution

From the user's input:
- **Mode:** `checked` (explicitly provided as first word)
- **Description:** _"fuska config lists 'workflow mode' => 'standard' as 90%, but read through the documentation and you'll see that standard is 100%. But instead of just saying 'mode (x%)', it should say 'standard: researched, planned, executed, etc', for each of the selectable modes."_

Mode config resolved:
```
research: false, planCheck: true, codeReview: true, verifier: false, autoExecute: false
```

Display:
```
Mode: checked | Profile: balanced
```

---

## Phase 3: Task Concept Creation

The orchestrator generates a slug and creates the task concept in MegaMemory:

- **Tool:** `megamemory_create_concept`
- **Name:** `task-026-improve-config-mode-display`
- **Kind:** feature
- **Status:** planning

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK 026: Improve fuska config mode display
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 4: Planner Agent

**Agent:** `fuska-planner` (model: glm-5, 114.4s)

The planner is given the task description and project state, and asked to create a focused 1-3 task plan.

**What it returned:**

A single task targeting `src/commands/config.ts` with 5 specific update locations:
1. Update `MODE_DESCRIPTIONS` constant with agent pipeline strings
2. Update `setWorkflowMode()` interactive choices
3. Update `displayState()` output
4. Update `displayTreeView()` output
5. Update `displaySettingsBanner()` output

The planner also updated the task concept in MegaMemory with the full plan data via `megamemory_update_concept`.

---

## Phase 5: Plan Checker

> **This is where checked mode earns its keep.** The plan-checker is a separate agent that validates the planner's output before execution.

**Agent:** `fuska-plan-checker` (model: glm-5, 65.7s)

The orchestrator first queries MegaMemory for the updated plan concept, then spawns the checker with the plan data.

**What it checked:**
- Task completeness: Does every task have files, action, verify, done?
- Scope sanity: 1-3 tasks? Would they complete in ~30% context?

**Result: VERIFICATION PASSED**

```
| Field  | Status |
|--------|--------|
| Files  | ok     | src/commands/config.ts
| Action | ok     | 5 specific steps with line number hints
| Verify | ok     | Run fuska config and check display
| Done   | ok     | Clear acceptance criteria

| Metric  | Value | Target | Status |
|---------|-------|--------|--------|
| Tasks   | 1     | 2-3    | Good   |
| Files   | 1     | 5-8    | Good   |
| Context | ~15%  | <30%   | Good   |
```

The plan passed validation on the first try -- clean, focused, well-scoped.

---

## Phase 6: Plan Review (User Interaction)

Because checked mode has `autoExecute: false`, the orchestrator presents the plan and asks the user before building.

**Displayed plan:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TASK 026 PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objective: Update fuska config output to show detailed mode descriptions
Purpose: Replace misleading percentages with actual agent pipelines
Files: src/commands/config.ts

Task 1: Update mode display to show pipeline steps
  ...5 specific action steps...

Verify: Run 'fuska config' and verify pipeline descriptions shown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**User choice:** Execute now

---

## Phase 7: Builder Agent

**Agent:** `fuska-executor` (model: glm-5, 169.7s)

The executor receives the plan and implements all changes. It reads the source file, makes the edits, and runs `npm run build` to verify.

**What it did:**
- Updated `MODE_DESCRIPTIONS` with pipeline strings using arrow notation
- Updated all 4 display locations to use descriptions instead of percentages
- Build passed

**Tools used:** Read, Edit, Bash (npm run build)

**Created:** `task-026-improve-config-mode-display-summary` concept in MegaMemory

---

## Phase 8: Code Review

> **This is the highlight of the session.** The code reviewer caught a real bug.

**Pre-review check:** The orchestrator runs `git diff HEAD --name-only` and discovers two modified files:
- `src/commands/config.ts` (task change)
- `opencode.json` (pre-existing, unrelated change)

It warns the user about the pre-existing changes and proceeds.

### First review (found a bug)

**Agent:** `fuska-code-reviewer` (model: glm-4.7, 103.2s)

**Result: ISSUES FOUND -- 1 blocker**

```yaml
issues:
  - dimension: "anti_patterns"
    severity: "blocker"
    file: "src/commands/config.ts"
    line: 542
    description: "Typo: 'this.config.workflow.workflow.mode' should be 'this.config.workflow.mode'"
    fix_hint: "Remove the duplicate 'workflow' property reference"
```

The code reviewer spotted `this.config.workflow.workflow.mode` -- a double `.workflow` property access that would silently return `undefined` and break the mode description display in one of the four locations.

### Orchestrator investigates

The orchestrator doesn't blindly trust the review. It:

1. **Reads the actual file** at line 540-549 to check
2. **Runs `git diff`** filtered to `workflow.mode` references
3. **Determines:** The actual file on disk is correct (`this.config.workflow.mode`). The typo existed in the diff that was passed to the reviewer's context, not in the actual committed code.

> This is an interesting edge case: the diff in the reviewer's prompt had a transcription error, but the real code was fine. The orchestrator verified before spawning a fix.

### Second review (passed)

**Agent:** `fuska-code-reviewer` (model: glm-4.7, 169.9s)

Re-ran with the verified current diff.

**Result: REVIEW PASSED**

All 5 dimensions checked:
- Plan fulfillment: all 5 locations updated
- Completeness: no stubs
- Wiring: `MODE_DESCRIPTIONS` used consistently
- Anti-patterns: none
- Edge cases: handles undefined mode gracefully

---

## Phase 9: Commit Message Generation

**Agent:** `fuska-git-message` (model: glm-5, 54.7s)

Generated:
```
feat(config): improve workflow mode display with agent pipelines

- Replace vague descriptions with clear agent pipeline notation
- Show exact agent sequence for each mode (e.g., Researcher -> Planner -> Executor)
- Users can now see which steps each mode includes at a glance

task-026
```

---

## Phase 10: Commit Confirmation (User Interaction)

The orchestrator detects pre-existing `opencode.json` changes and presents options:

| Option | Description |
|--------|-------------|
| **Commit task changes only** (Recommended) | Commit only `src/commands/config.ts` |
| Commit all changes | Include `opencode.json` too |
| Skip commit | Leave everything unstaged |

**User choice:** Commit task changes only

```bash
git add src/commands/config.ts && git commit -m "feat(config): improve workflow mode display..."
# [main 466fdf1] 1 file changed, 18 insertions(+), 15 deletions(-)
```

---

## Phase 11: State Update & Completion

The orchestrator updates the task concept to `status: "complete"` with commit hash and accomplishments.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Fuska > TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Task 026: Improve config mode display
 Mode: checked
 Plan: task-026-improve-config-mode-display
 Commit: 466fdf1

 Changes:
 - MODE_DESCRIPTIONS now shows agent pipelines
 - standard: Researcher -> Planner -> Checker -> Executor -> Verifier
 - thorough: Researcher -> Planner -> Checker -> Executor
 - balanced: Researcher -> Planner -> Executor
 - fast: Planner -> Checker -> Executor
 - quick: Planner -> Executor
 - direct: Planner only

 Note: opencode.json has uncommitted pre-existing changes

───────────────────────────────────────────────────
 Ready for next task: /fuska-do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Agent Summary

| Phase | Agent | Model | Time | Result |
|-------|-------|-------|------|--------|
| Plan | fuska-planner | glm-5 | 114s | 1 task, 1 file |
| Check | fuska-plan-checker | glm-5 | 66s | PASSED |
| Build | fuska-executor | glm-5 | 170s | COMPLETE |
| Review #1 | fuska-code-reviewer | glm-4.7 | 103s | ISSUES FOUND (1 blocker) |
| Review #2 | fuska-code-reviewer | glm-4.7 | 170s | PASSED |
| Commit msg | fuska-git-message | glm-5 | 55s | Generated |

**Total agent time:** ~678s across 6 agent spawns
**Orchestrator overhead:** ~105s (MegaMemory queries, diff checks, user prompts)

---

## Key Takeaways

1. **Checked mode adds a safety net.** The plan-checker validated that the plan was well-scoped and complete before any code was written. For a simple task this seems like overhead; for complex multi-file changes, it prevents executing a half-baked plan.

2. **The code reviewer caught a real (apparent) bug.** It flagged `this.config.workflow.workflow.mode` -- a double property access that would silently fail. The orchestrator's investigation showed the bug was in the diff context, not the actual file, but the reviewer's instinct was correct: that pattern *would* be a bug. In a different scenario, this catch prevents a runtime failure that no type checker or build would flag.

3. **The orchestrator doesn't blindly trust agents.** When the code reviewer reported a blocker, the orchestrator read the actual file and verified the diff before attempting a fix. This prevented an unnecessary fix-and-re-review cycle.

4. **Pre-existing dirty state is handled gracefully.** The orchestrator detected unrelated `opencode.json` changes, warned the user, and offered granular commit options -- preventing accidental inclusion of unrelated changes.

5. **Everything is tracked in MegaMemory.** The task concept goes from `planning` -> `planned` -> `complete` with full provenance: what was planned, what was built, what was reviewed, what was committed.
