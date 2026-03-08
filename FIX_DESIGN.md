# Fix Plan: fuska-design Command Output Display Issue

**Plan ID:** `task-fix-fuska-design-output`  
**Version:** 2.0-revised  
**Status:** Ready for execution  
**Created:** 2026-03-08  
**Last Updated:** 2026-03-08

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Proposed Solution](#proposed-solution)
4. [Plan Structure](#plan-structure)
5. [Execution Details](#execution-details)
6. [Risk Mitigation](#risk-mitigation)
7. [Success Criteria](#success-criteria)
8. [Rollback Procedure](#rollback-procedure)

---

## Problem Statement

### Observed Behavior

When executing `/fuska-design 1`, the command does not display the chapter design overview and assumptions text before asking the user questions. Instead, the agent jumps directly to the question tool without presenting context to the user.

**What the user sees:**
1. Agent loads data from MegaMemory (3 tool calls shown)
2. Agent immediately asks question: "How do these assumptions look for Chapter 1?"
3. **NO chapter overview or assumptions text displayed**

### Expected Behavior

Based on the working tutorial example (`tutorial-data/003-fuska-design.md` lines 2029-2110):

1. Agent loads data from MegaMemory
2. Agent outputs chapter design overview (name, goal, status)
3. Agent outputs assumptions across 5 areas:
   - Technical Approach
   - Implementation Order
   - Scope Boundaries
   - Risk Areas
   - Dependencies
4. **THEN** agent asks question for user feedback

### Impact

- **User experience:** Poor - users don't see context before making decisions
- **Workflow integrity:** Broken - the design session is incomplete without context
- **Scope:** 8 fuska commands affected (not just fuska-design)

---

## Root Cause Analysis

### Technical Root Cause

The command file `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-design.md` has presentation templates inside code blocks with instructions like:

```markdown
**Step X.X: Do something**

Output this markdown directly (not as a code block):

```
[template inside code block]
```
```

The GLM-5 model interprets these as **internal pseudocode comments** rather than **actual text output requirements**. It loads the data internally but doesn't present it to the user.

### Evidence

**Working example location:**  
`/Users/mikaelj/code/fuska/main/tutorial-data/003-fuska-design.md` (lines 2029-2110)

The tutorial shows the agent correctly outputting formatted text THEN asking the question, proving the desired behavior is achievable.

### Affected Files (8 total)

**Primary file:**
1. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-design.md`
   - Section 1.7.3 (lines 200-218): Chapter design overview
   - Section 1.8.3 (lines 245-304): Assumptions template
   - Section 7 (lines 656-690): Completion summary

**7 additional files with identical issue:**
2. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-review.md` (line 588)
3. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-plan.md` (line 401)
4. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-add-chapter.md` (line 336)
5. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-audit.md` (line 412)
6. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-doc.md` (line 837)
7. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-add-todo.md` (line 272)
8. `/Users/mikaelj/code/fuska/main/provider/opinkode/commands/fuska/fuska-add-chapter-todo.md` (line 223)

---

## Proposed Solution

### Instruction Pattern Design

**❌ Current (failing) pattern:**
```markdown
**Step X.X: Do something**

Output this markdown directly (not as a code block):

```
[template inside code block]
```
```

**✅ New (working) pattern:**
```markdown
**Step X.X: Do something**

**CRITICAL: Output this text directly to the user as markdown. Do NOT use tool calls for this output. Do NOT wrap in code blocks. Substitute variables with actual values:**

-----------------------------------------------------
[Template with ${variable} markers OUTSIDE code block]
-----------------------------------------------------
```

### Key Changes

1. **Move templates OUTSIDE code blocks** - Present as actual output text
2. **Add "CRITICAL:" directive** - Makes it clear this is executable instruction
3. **Explicit variable substitution** - Show ${variable} markers clearly
4. **No tool calls directive** - Prevent agent from using tools for output
5. **Apply consistently** - Same pattern across all 8 affected commands

---

## Plan Structure

### Overview

```
Total Plans: 5 plans + 1 checkpoint
Total Batches: 6 batches
Total Tasks: ~25 tasks
Execution Mode: 4 autonomous batches + 2 human verification checkpoints
```

### Batch Structure

#### Batch 1: Plan 00 (Pre-flight) 🛡️
**Mode:** Autonomous  
**Objective:** Prepare environment, verify scope, create safety measures

| Task | Description | Verification |
|------|-------------|--------------|
| 1 | Create git branch `fix-fuska-output-issue` | `git branch` shows branch exists |
| 2 | Grep all 8 files to verify identical issue pattern | All 8 files contain "Output this markdown directly" |
| 3 | Pre-verify all line numbers are accurate | Line numbers match grep output |
| 4 | Create test checklist with acceptance criteria | Checklist file created with 8+ criteria |
| 5 | Investigate original tutorial command file | Document what tutorial output format shows |

**Output:** Safe environment with verified scope and test criteria

---

#### Batch 2: Plan 01 (Analysis)
**Mode:** Autonomous  
**Objective:** Design GLM-5-compatible instruction pattern

| Task | Description | Verification |
|------|-------------|--------------|
| 1 | Analyze working tutorial output format | Pattern documented |
| 2 | Design instruction pattern with CRITICAL directive | Pattern template created |
| 3 | Validate pattern against tutorial example | Pattern matches tutorial behavior |
| 4 | Commit analysis to git | Commit created |

**Output:** Tested instruction pattern ready for application

---

#### Batch 3: Plan 02 (Fix Pilot File)
**Mode:** Autonomous  
**Objective:** Fix fuska-design.md as pilot (1 file, 3 sections)

| Task | Description | Verification |
|------|-------------|--------------|
| 1 | Fix Section 1.7.3 (chapter design overview) | Section updated with new pattern |
| 2 | Fix Section 1.8.3 (assumptions template) | Section updated with new pattern |
| 3 | Fix Section 7 (completion summary) | Section updated with new pattern |
| 4 | Commit pilot fix | Commit created on branch |

**Output:** fuska-design.md fixed (1/8 files)

---

#### Batch 4: Checkpoint 01 (Validation Gate) ⚠️
**Mode:** **HUMAN VERIFICATION REQUIRED**  
**Objective:** Test pilot fix before scaling to 7 remaining files

**Tests to perform:**
1. Run `/fuska-design 1` in test environment
2. Verify chapter design overview displays
3. Verify assumptions across 5 areas display
4. Verify question appears AFTER text output

**Gate criteria:**
- [ ] All 4 tests pass
- [ ] No regression in other fuska-design functionality
- [ ] Output format matches tutorial example

**Decision:**
- ✅ **If all tests pass:** Proceed to Batch 5 (Plan 03)
- ❌ **If any test fails:** Halt execution, debug, fix pilot

**Output:** Go/No-Go decision for scaling fix

---

#### Batch 5: Plan 03 (Fix 7 Remaining Files)
**Mode:** Autonomous  
**Dependency:** Batch 4 checkpoint must PASS  
**Objective:** Apply proven pattern to 7 remaining files

| Task | File | Section |
|------|------|---------|
| 1 | fuska-review.md | Line 588 |
| 2 | fuska-plan.md | Line 401 |
| 3 | fuska-add-chapter.md | Line 336 |
| 4 | fuska-audit.md | Line 412 |
| 5 | fuska-doc.md | Line 837 |
| 6 | fuska-add-todo.md | Line 272 |
| 7 | fuska-add-chapter-todo.md | Line 223 |

**Each task includes:**
- Apply pattern to identified section
- Verify file syntax (markdown valid)
- Verify no unintended changes
- Git commit after each file

**Output:** All 8 files fixed (8/8 complete)

---

#### Batch 6: Plan 04 (Final Validation) ⚠️
**Mode:** **HUMAN VERIFICATION REQUIRED**  
**Objective:** Validate all fixes, create documentation

| Task | Description | Verification |
|------|-------------|--------------|
| 1 | Run test checklist (created in Plan 00) | All criteria pass |
| 2 | Test 2-3 other fixed commands | Output displays correctly |
| 3 | Document best practices | Best practices guide created |
| 4 | Final commit | All changes committed |

**Output:** Production-ready fixes on `fix-fuska-output-issue` branch

---

## Execution Details

### Prerequisites

- [ ] Working directory: `/Users/mikaelj/code/goride/centralstationen/fw/main/fw/nrf9160`
- [ ] Fuska source code: `/Users/mikaelj/code/fuska/main/`
- [ ] Git repository initialized
- [ ] Clean working tree (no uncommitted changes)

### How to Execute

```bash
# Step 1: Fresh context window (recommended)
/new

# Step 2: Execute the plan
/fuska-do task-fix-fuska-design-output

# Step 3: Monitor execution
# - Batches 1-3 run automatically
# - Batch 4 STOPS for your verification
# - If checkpoint passes, Batches 5-6 continue
# - Batch 6 STOPS for final verification
```

### Execution Timeline

```
Batch 1 (Plan 00):     ~5 minutes  [autonomous]
Batch 2 (Plan 01):     ~3 minutes  [autonomous]
Batch 3 (Plan 02):     ~2 minutes  [autonomous]
Batch 4 (Checkpoint):  ~2 minutes  [HUMAN VERIFY]
Batch 5 (Plan 03):     ~7 minutes  [autonomous]
Batch 6 (Plan 04):     ~3 minutes  [HUMAN VERIFY]
─────────────────────────────────────────────
Total:                 ~22 minutes + human verification time
```

### Human Verification Points

**Checkpoint 01 (after Batch 3):**
- **What:** Test fuska-design.md fix
- **How:** Run `/fuska-design 1` and verify output
- **Time:** ~2 minutes
- **Decision needed:** Continue or halt

**Final Checkpoint (after Batch 6):**
- **What:** Validate all 8 fixes
- **How:** Run test checklist + spot check 2-3 commands
- **Time:** ~3 minutes
- **Decision needed:** Merge branch or request changes

---

## Risk Mitigation

### Risk Register

| Risk | Severity | Likelihood | Mitigation | Status |
|------|----------|------------|------------|--------|
| **Changes break functionality** | High | Low | Git branch for rollback | ✅ Mitigated |
| **Scope underestimated** | Medium | Low | Pre-verification in Plan 00 | ✅ Mitigated |
| **Wrong line numbers** | Medium | Medium | Pre-verified in Plan 00 | ✅ Mitigated |
| **Pattern doesn't work** | High | Medium | Pilot test before scaling | ✅ Mitigated |
| **Fixes not tested** | High | Low | Test checklist before fixes | ✅ Mitigated |
| **Bulk fix fails** | Medium | Low | Checkpoint gate | ✅ Mitigated |
| **GLM-5 interprets differently** | Medium | Low | Validated against tutorial | ✅ Mitigated |

### Mitigation Strategies

1. **Git branch isolation**
   - All work on `fix-fuska-output-issue` branch
   - Main branch untouched
   - Easy to discard if issues arise

2. **Pre-verification (Plan 00)**
   - Grep confirms all 8 files affected
   - Line numbers verified before edits
   - Test checklist defines success criteria upfront

3. **Pilot testing (Batch 4)**
   - Fix 1 file first
   - Test thoroughly
   - Only scale if pilot succeeds

4. **Checkpoint gates**
   - Human verification at critical points
   - No auto-proceed without approval
   - Stop on any failure

5. **Incremental commits**
   - Commit after each plan
   - Easy to identify problematic change
   - Can revert specific commits

---

## Success Criteria

### Immediate Success Criteria (Per Batch)

**Batch 1 (Plan 00):**
- [ ] Git branch `fix-fuska-output-issue` created
- [ ] All 8 files contain identical issue pattern (verified via grep)
- [ ] All line numbers pre-verified
- [ ] Test checklist created with 8+ criteria
- [ ] Tutorial analysis documented

**Batch 2 (Plan 01):**
- [ ] Instruction pattern designed
- [ ] Pattern validated against tutorial
- [ ] Pattern documented
- [ ] Changes committed

**Batch 3 (Plan 02):**
- [ ] fuska-design.md Section 1.7.3 updated
- [ ] fuska-design.md Section 1.8.3 updated
- [ ] fuska-design.md Section 7 updated
- [ ] Changes committed

**Batch 4 (Checkpoint 01):**
- [ ] `/fuska-design 1` shows chapter overview
- [ ] `/fuska-design 1` shows assumptions (5 areas)
- [ ] Question appears AFTER text output
- [ ] No regressions detected

**Batch 5 (Plan 03):**
- [ ] All 7 remaining files updated
- [ ] Each file committed separately
- [ ] No syntax errors introduced

**Batch 6 (Plan 04):**
- [ ] All test checklist criteria pass
- [ ] 2-3 other commands tested successfully
- [ ] Best practices documented
- [ ] Final commit created

### Overall Success Criteria

After execution completes:

- [ ] `/fuska-design 1` outputs chapter design overview banner (visible to user)
- [ ] `/fuska-design 1` outputs assumptions across 5 areas (visible to user)
- [ ] Question tool called AFTER text output
- [ ] Pattern applied consistently to all 8 fuska commands
- [ ] Test checklist validates all fixes pass
- [ ] All changes on `fix-fuska-output-issue` branch
- [ ] No regressions in existing functionality
- [ ] Best practices documented for future development

### Measurable Outcomes

| Metric | Target | Verification Method |
|--------|--------|---------------------|
| Files fixed | 8/8 | Git diff count |
| Regressions introduced | 0 | Test checklist |
| Human interventions required | 2 (checkpoints) | Execution log |
| Time to complete | < 30 min | Stopwatch |
| Rollback capability | ✅ Yes | Git branch exists |
| Pattern consistency | 100% | Grep verification |

---

## Rollback Procedure

### If Checkpoint 01 Fails (Pilot Fix Doesn't Work)

```bash
# Option 1: Debug and retry
# - Investigate failure
# - Adjust pattern
# - Re-run Batch 3

# Option 2: Abort entirely
git checkout main
git branch -D fix-fuska-output-issue
# Plan execution halted
```

### If Batch 5 Fails (Bulk Fix Issues)

```bash
# Option 1: Revert specific commit
git log --oneline
git revert <commit-hash>

# Option 2: Reset to checkpoint
git reset --hard <checkpoint-01-commit>

# Option 3: Abort entirely
git checkout main
git branch -D fix-fuska-output-issue
```

### If Final Validation Fails

```bash
# Review all changes
git diff main...fix-fuska-output-issue

# Option 1: Fix issues
# - Address validation failures
# - Re-run Batch 6

# Option 2: Partial merge
# - Cherry-pick working commits
# - Leave problematic changes on branch

# Option 3: Discard all
git checkout main
git branch -D fix-fuska-output-issue
```

### Nuclear Option (Everything Went Wrong)

```bash
# Complete reset
git checkout main
git branch -D fix-fuska-output-issue

# Restore from backup if needed
cd /Users/mikaelj/code/fuska/main
git checkout .
git clean -fd

# Investigation required before retry
```

---

## Post-Execution Actions

### After Successful Execution

1. **Review changes on branch:**
   ```bash
   git diff main...fix-fuska-output-issue
   ```

2. **Test in real environment:**
   ```bash
   /fuska-design 1
   /fuska-plan 1
   # Test other fixed commands
   ```

3. **Merge to main (if satisfied):**
   ```bash
   git checkout main
   git merge fix-fuska-output-issue
   git push origin main
   ```

4. **Clean up:**
   ```bash
   git branch -d fix-fuska-output-issue
   ```

5. **Update documentation:**
   - Note pattern in fuska development guide
   - Update command template documentation
   - Share best practices with team

### If Further Work Needed

1. **Keep branch alive:**
   ```bash
   git push origin fix-fuska-output-issue
   ```

2. **Create follow-up task:**
   - Document remaining issues
   - Plan additional changes
   - Execute separately

---

## Appendix A: File Change Details

### fuska-design.md Changes

**Section 1.7.3 (lines 200-218): Chapter Design Overview**

Current:
```markdown
**Step 1.7.3: Display design session overview**

Output this markdown directly (not as a code block):

```
-----------------------------------------------------
  Fuska: Chapter {chapterNumber} Design Session
-----------------------------------------------------
...
```

New:
```markdown
**Step 1.7.3: Display design session overview**

**CRITICAL: Output this text directly to the user as markdown. Do NOT use tool calls for this output. Do NOT wrap in code blocks. Substitute variables: {chapterNumber}, {chapterName}, {chapterGoal}, {chapterStatus}**

-----------------------------------------------------
  Fuska: Chapter {chapterNumber} Design Session
-----------------------------------------------------

**Chapter {chapterNumber}: {chapterName}**

Goal: {chapterGoal}
Status: {chapterStatus}

This session gathers context and decisions to guide planning.
You'll discuss implementation choices for this chapter.

────────────────────────────────────────────────────
```

**Section 1.8.3 (lines 245-304): Assumptions Template**

Similar change - move template outside code block, add CRITICAL directive.

**Section 7 (lines 656-690): Completion Summary**

Similar change - move template outside code block, add CRITICAL directive.

---

### Other Files (7 files)

Each file has similar pattern at identified line numbers:
- Move template outside code block
- Add CRITICAL directive
- Add variable substitution instructions
- Preserve template content

---

## Appendix B: Test Checklist Template

**Created in Plan 00, Task 4**

```markdown
# Test Checklist: fuska-output-fix

## Pre-Execution Verification
- [ ] Git branch `fix-fuska-output-issue` exists
- [ ] All 8 files identified correctly
- [ ] Line numbers verified

## Pilot Test (fuska-design.md)
- [ ] Run `/fuska-design 1`
- [ ] Chapter overview displays (banner visible)
- [ ] Assumptions display (5 areas visible)
- [ ] Question appears AFTER text
- [ ] No errors in execution

## Bulk Fix Tests (7 files)
- [ ] `/fuska-plan 1` - text displays before questions
- [ ] `/fuska-review` - text displays before questions
- [ ] `/fuska-add-chapter 1` - text displays before questions
- [ ] `/fuska-audit` - text displays before questions
- [ ] `/fuska-doc` - text displays before questions
- [ ] `/fuska-add-todo` - text displays before questions
- [ ] `/fuska-add-chapter-todo` - text displays before questions

## Regression Tests
- [ ] Other fuska commands still work
- [ ] No syntax errors in command files
- [ ] No unintended side effects

## Documentation
- [ ] Best practices guide created
- [ ] Pattern documented
- [ ] Changes committed

## Final Verification
- [ ] All 8 files fixed
- [ ] All tests pass
- [ ] Ready to merge
```

---

## Appendix C: MegaMemory Concept Structure

**Plan concepts stored in:**  
`/Users/mikaelj/code/goride/centralstationen/fw/main/fw/nrf9160/.megamemory/knowledge.db`

### Main Task Concept
```
ID: task-fix-fuska-design-output
Kind: task
Summary: Fix GLM-5 text output issue in fuska-design command (8 files)
Status: ready
Version: 2.0-revised
```

### Sub-Plan Concepts
```
ID: task-fix-fuska-design-output-plan-00
Name: Plan 00 (Pre-flight)
Batch: 1
Tasks: 5

ID: task-fix-fuska-design-output-plan-01
Name: Plan 01 (Analysis)
Batch: 2
Tasks: 4

ID: task-fix-fuska-design-output-plan-02
Name: Plan 02 (Fix Pilot File)
Batch: 3
Tasks: 4

ID: task-fix-fuska-design-output-checkpoint-01
Name: Checkpoint 01 (Validation Gate)
Batch: 4
Type: human-verify

ID: task-fix-fuska-design-output-plan-03
Name: Plan 03 (Fix 7 Remaining Files)
Batch: 5
Tasks: 7

ID: task-fix-fuska-design-output-plan-04
Name: Plan 04 (Final Validation)
Batch: 6
Tasks: 4
```

### Dependency Edges
```
plan-00 → plan-01 (depends_on)
plan-01 → plan-02 (depends_on)
plan-02 → checkpoint-01 (depends_on)
checkpoint-01 → plan-03 (depends_on)
plan-03 → plan-04 (depends_on)
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-08 | Initial plan created | fuska-planner |
| 2.0 | 2026-03-08 | Revised based on jury feedback | fuska-planner |

**Jury review findings (Version 1.0):**
- 4 high-priority issues identified
- 5 medium-priority issues identified
- Verdict: APPROVED WITH CONDITIONS

**Revisions made (Version 2.0):**
- Added Plan 00 (pre-flight) with 5 tasks
- Added Checkpoint 01 (validation gate)
- Added git branch for rollback
- Added pre-verification tasks
- Moved test checklist to Plan 00
- Clarified file counts (1 + 7 = 8)
- Added risk mitigation section

---

## Contact & Support

**Plan location:** Current directory MegaMemory  
**Source code:** `/Users/mikaelj/code/fuska/main/`  
**Tutorial reference:** `tutorial-data/003-fuska-design.md`

---

**END OF DOCUMENT**
