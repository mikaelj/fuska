# Fuska Token Optimization Plan

## Goal

Reduce token consumption in Fuska's orchestration layer by 30-35% through condensation and extraction patterns.

---

## Current Baseline

| File | Lines | Type | Location |
|------|-------|------|----------|
| fuska-plan.md | 1,446 | Command | `provider/opinkode/command/fuska/` |
| fuska-executor.md | 979 | Agent | `provider/opinkode/agents/fuska/` |
| fuska-planner.md | 1,594 | Agent | `provider/opinkode/agents/fuska/` |
| fuska-verifier.md | 805 | Agent | `provider/opinkode/agents/fuska/` |
| fuska-debugger.md | 1,297 | Agent | `provider/opinkode/agents/fuska/` |
| **Total** | **8,307** | | |

---

## Strategy Overview

**Two complementary techniques:**

1. **Extraction** — Move static, reusable content to include files (reduces main file, enables reuse)
2. **Condensation** — Compress verbose sections in-place (removes redundancy, preserves behavior)

---

## Phase 1: Create Shared Resources

### 1.1 Create Directory

Create `provider/opinkode/fuska/config/` (does not exist yet)

### 1.2 Create Reference Files

| File | Lines | Purpose |
|------|-------|---------|
| `references/megamemory-quick-ref.md` | 25 | Quick API reference for MegaMemory tools (supplements existing `megamemory-integration.md`) |
| `config/workflow-modes.md` | 30 | Mode flag resolution logic (standard/quick/thorough/balanced/fast/direct) |

### 1.3 Create Template Files

| File | Lines | Purpose |
|------|-------|---------|
| `templates/plan-prompts.md` | 115 | Prompt templates for spawning fuska-planner and fuska-plan-checker subagents |
| `templates/review-loop.md` | 120 | Interactive review UI pattern for plan iteration |

**Phase 1 total:** ~290 lines (new content)

---

## Phase 2: Refactor fuska-plan.md

**Current:** 1,446 lines  
**Target:** ~450 lines  
**Savings:** ~1,000 lines (69%)

### Approach

Replace inline content with includes:

```markdown
<execution_context>

@../../fuska/references/preflight-check-initiative-exists.md
@../../fuska/references/model-validation.md
@../../fuska/references/megamemory-quick-ref.md
@../../fuska/config/workflow-modes.md
@../../fuska/templates/plan-prompts.md
@../../fuska/templates/review-loop.md
@../../fuska/scripts/types.ts
@../../fuska/scripts/chapter-templates.ts
@../../fuska/scripts/helpers.ts

</execution_context>
```

### Sections to Extract

| Section | Lines | Extract To |
|---------|-------|------------|
| MegaMemory API usage notes | ~25 | `megamemory-quick-ref.md` |
| Workflow mode resolution | ~30 | `workflow-modes.md` |
| Planner/checker prompt templates | ~115 | `plan-prompts.md` |
| Interactive review loop UI | ~120 | `review-loop.md` |

### Sections to Condense

| Section | Current | Target | Technique |
|---------|---------|--------|-----------|
| Step 1 (Validate Environment) | 174 | 50 | Remove redundant explanations |
| Step 6 (Load All Context) | 153 | 15 | Compress lookup patterns |
| Step 7 (Spawn Planner) | 90 | 20 | Delegate to template |
| Step 9 (Query Plans) | 60 | 15 | Compress query logic |
| Step 10 (Spawn Checker) | 50 | 15 | Delegate to template |
| Step 13 (Review Loop) | 282 | 40 | Delegate to template |

---

## Phase 3: Condense fuska-executor.md

**Current:** 979 lines  
**Target:** ~650 lines  
**Savings:** ~330 lines (34%)

### Sections to Condense In-Place

| Section | Current Lines | Target | Technique |
|---------|---------------|--------|-----------|
| `<deviation_rules>` | 144 | 60 | Remove verbose examples, compress process steps |
| `<checkpoint_protocol>` | 133 | 50 | Remove redundant format examples, compress descriptions |
| Authentication Gates | 50 | 20 | Compress indicator lists, simplify protocol |

### Condensation Pattern

**Before (verbose):**
```markdown
**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, incorrect output, errors)

**Action:** Fix immediately, track for Summary

**Examples:**

- Wrong SQL query returning incorrect data
- Logic errors (inverted condition, off-by-one, infinite loop)
- Type errors (null pointer, undefined variable, wrong type)
- Broken validation (missing checks, incorrect regex)
- [... 10 more examples ...]

**Process:**

1. Fix bug inline
2. Add/update tests to prevent regression
3. Verify fix works
4. Continue task
5. Track in deviations list: `[Rule 1 - Bug] [description]`
6. **Update MegaMemory** with the bug and fix

**No user permission needed.** Bugs must be fixed for correct operation.
```

**After (condensed):**
```markdown
**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, errors, incorrect output)

**Examples:** Wrong queries, logic errors, type errors, null pointers, broken validation, security vulnerabilities, race conditions

**Process:** Fix inline → add/update tests → verify → continue → track as `[Rule 1 - Bug] description`

No permission needed for Rules 1-3.
```

### Rules to Apply

- Remove "Action:" lines (redundant with rule name)
- Compress example lists to comma-separated lines
- Remove numbered process steps when flow is obvious
- Consolidate "No user permission needed" to single line

---

## Phase 4: Condense fuska-planner.md

**Current:** 1,594 lines  
**Target:** ~1,100 lines  
**Savings:** ~500 lines (31%)

### Sections to Condense

| Section | Current | Target | Technique |
|---------|---------|--------|-----------|
| Goal-Backward Verification | ~200 | ~100 | Compress step-by-step explanations |
| Plan Creation | ~250 | ~150 | Remove redundant "how to create" text |
| Import Graph Usage | ~100 | ~60 | Inline usage notes |
| Quality Gates | ~80 | ~40 | Consolidate checklist items |

---

## Phase 5: Condense fuska-verifier.md

**Current:** 805 lines  
**Target:** ~550 lines  
**Savings:** ~255 lines (32%)

### Sections to Condense

| Section | Current | Target | Technique |
|---------|---------|--------|-----------|
| Verification Checklists | ~200 | ~120 | Consolidate overlapping items |
| Pattern Checks | ~150 | ~100 | Remove redundant "what to verify" |
| Report Generation | ~100 | ~70 | Compress format descriptions |

---

## Phase 6: Condense fuska-debugger.md

**Current:** 1,297 lines  
**Target:** ~900 lines  
**Savings:** ~400 lines (31%)

### Sections to Condense

| Section | Current | Target | Technique |
|---------|---------|--------|-----------|
| Debug Protocol | ~200 | ~120 | Condense step descriptions |
| Hypothesis Tracking | ~150 | ~100 | Remove verbose example scenarios |
| Checkpoint Integration | ~100 | ~70 | Compress continuation patterns |

---

## Summary Table

| Phase | File | Before | After | Savings |
|-------|------|--------|-------|---------|
| 1 | New includes | 0 | 290 | -290 |
| 2 | fuska-plan.md | 1,446 | 450 | 996 |
| 3 | fuska-executor.md | 979 | 650 | 329 |
| 4 | fuska-planner.md | 1,594 | 1,100 | 494 |
| 5 | fuska-verifier.md | 805 | 550 | 255 |
| 6 | fuska-debugger.md | 1,297 | 900 | 397 |
| **Net** | | **8,307** | **5,690** | **2,617** |

**Total reduction:** 2,617 lines (31.5%)

---

## Files to Create (4 files)

| Path | Lines |
|------|-------|
| `provider/opinkode/fuska/config/workflow-modes.md` | 30 |
| `provider/opinkode/fuska/references/megamemory-quick-ref.md` | 25 |
| `provider/opinkode/fuska/templates/plan-prompts.md` | 115 |
| `provider/opinkode/fuska/templates/review-loop.md` | 120 |

---

## Files to Modify (5 files)

| Path | Before | After |
|------|--------|-------|
| `provider/opinkode/command/fuska/fuska-plan.md` | 1,446 | ~450 |
| `provider/opinkode/agents/fuska/fuska-executor.md` | 979 | ~650 |
| `provider/opinkode/agents/fuska/fuska-planner.md` | 1,594 | ~1,100 |
| `provider/opinkode/agents/fuska/fuska-verifier.md` | 805 | ~550 |
| `provider/opinkode/agents/fuska/fuska-debugger.md` | 1,297 | ~900 |

---

## Execution Order

1. Create `provider/opinkode/fuska/config/` directory
2. Create `provider/opinkode/fuska/config/workflow-modes.md`
3. Create `provider/opinkode/fuska/references/megamemory-quick-ref.md`
4. Create `provider/opinkode/fuska/templates/plan-prompts.md`
5. Create `provider/opinkode/fuska/templates/review-loop.md`
6. Refactor `provider/opinkode/command/fuska/fuska-plan.md`
7. Condense `provider/opinkode/agents/fuska/fuska-executor.md`
8. Condense `provider/opinkode/agents/fuska/fuska-planner.md`
9. Condense `provider/opinkode/agents/fuska/fuska-verifier.md`
10. Condense `provider/opinkode/agents/fuska/fuska-debugger.md`

---

## Testing Strategy

### Per-File Verification

After each file modification:
1. Run `npm run lint` and `npm run typecheck` (if applicable)
2. Visual inspection that includes resolve correctly

### End-to-End Verification

1. **Baseline:** Run `/fuska-plan 1 --skip-research --skip-verify --no-review` in OpenCode, record token count from UI
2. **After all changes:** Run same command, record token count
3. **Compare:** Verify ~30% reduction achieved

### Functional Verification

Run typical Fuska workflows to ensure behavior unchanged:
- `/fuska-plan` creates plans correctly
- `/fuska-build` executes plans correctly
- Checkpoint handling works
- Deviation rules trigger appropriately

---

## Out of Scope (Future Work)

| Item | Rationale |
|------|-----------|
| fuska-do.md | Already spawns subagents; evaluate after this work complete |
| fuska-build.md | Already spawns subagents; evaluate after this work complete |
| Creating fuska-tools.js CLI | Current assessment: no clear token benefit for MegaMemory-based operations |

---

## Open Questions

1. **Token baseline measurement:** Should baseline be recorded now (before any changes), or separately?

2. **Execution batching:** All changes in one commit, or one commit per phase/file?

---

**Status:** Ready to execute when approved. Not yet executed.
