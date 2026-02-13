# Plan: Output Verified Plans from fuska-plan-checker

## Goal

When a plan has been finally verified by the Fuska plan-checker, print it out so the user can see it, plus a short summary (1 paragraph) on what was fixed vs the original plan.

## Files to Modify

1. `opencode/agents/fuska/fuska-plan-checker.md` - Update `<structured_returns>` section
2. `opencode/fuska/workflows/plan-phase.md` - Add plan output after VERIFICATION PASSED
3. `opencode/command/fuska/fuska-do.md` - Ensure plan output happens immediately after checker passes

## Changes

### 1. fuska-plan-checker.md (lines ~682-712)

In the `## VERIFICATION PASSED` section, add the full plan JSON and a "Changes from Original" section:

```markdown
## VERIFICATION PASSED

**Phase:** {phase-name}
**Plans verified:** {N}
**Status:** All checks passed
**Iterations:** {1 | 2 | 3}

### Verified Plans

```json
{full_plans_json}
```

### What Was Fixed (if iterations > 1)

{1 paragraph summary of issues that were raised and how they were addressed}

### Coverage Summary
...
```

### 2. plan-phase.md (step 11)

After "If `## VERIFICATION PASSED`:", add instruction to output the checker's response directly (it now contains the full plan).

### 3. fuska-do.md (step 7.4)

When VERIFICATION PASSED, output the checker's full response before continuing to Step 8.

## Implementation Details

### Key Design Decision

The plan-checker already has access to all plan data. By including it in the VERIFICATION PASSED output, we avoid extra MegaMemory queries. For the "what was fixed" summary, the orchestrator can track issues from each iteration and generate a summary when verification finally passes.

### Data Flow

1. **Plan-checker loads plans** from MegaMemory during verification
2. **If issues found**: Returns `## ISSUES FOUND` with structured issues
3. **Planner revises**: Updates plan concepts in MegaMemory
4. **Plan-checker re-verifies**: Loads updated plans
5. **If passed**: Returns `## VERIFICATION PASSED` with:
   - Full plan JSON (already loaded)
   - Iteration count (passed via context or tracked internally)
   - Summary of fixes (constructed from issue history)

### Tracking Changes

The orchestrator maintains:
- `original_plan_data` - plan state before first check
- `issues_history[]` - issues from each iteration
- `iteration_count` - current iteration (1-3)

When VERIFICATION PASSED, the orchestrator generates a 1-paragraph summary comparing original issues to final state.
