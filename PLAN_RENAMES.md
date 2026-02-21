# Renaming Plan: Gaps, UAT, MM, Orchestrator, Must-Haves

**Status:** Not started  
**Created:** 2025-02-21  
**Scope:** Replace opaque jargon with clear terminology across Fuska project

---

## Summary Table

| Category | Current | New |
|----------|---------|-----|
| **Acronyms** | | |
| | `UAT` | `verification` |
| | `MM` | `MegaMemory` |
| **Flags** | `--gaps` | `--fixes` |
| | `--gaps-only` | `--fixes-only` |
| **JSON fields** | `gap_closure: true` | `is_fix: true` |
| | `gap_closure_chapters_created` | `fix_chapters_created` |
| | `gap_closure_chapter_count` | `fix_chapter_count` |
| **Status values** | `gaps_found` | `issues_found` |
| **Mode names** | `gap_closure` | `fix_planning` |
| **Route names** | `'gaps'` | `'issues'` |
| **Jargon** | `gap closure` | `fix planning` |
| | `orchestrator` | `coordinator` |
| | `must_haves` | `requirements` |
| **Concepts** | `{chapter}-uat` | `{chapter}-verification` |
| **Variables** | `gaps`, `test_gaps`, `gapSection` | `issues`, `test_issues`, `issueSection` |
| **Step names** | `plan_gap_closure` | `plan_fixes` |
| **Command name** | `fuska-plan-milestone-gaps` | `fuska-plan-milestone-fixes` |
| **Template file** | `templates/UAT.md` | `templates/verification.md` |
| **Wrong command refs** | `/fuska-plan-chapter` | `/fuska-plan` |
| | `/fuska-build-chapter` | `/fuska-build` |
| | `/fuska-execute-chapter` | `/fuska-build` |

---

## Rationale

### Why rename "gap closure"?
"Gap closure" is jargon requiring mental translation (gap → missing thing → needs fixing). "Fix planning" is self-explanatory and action-oriented.

Semantics:
- `status: issues_found` → describes current state (open)
- `route: 'issues'` → triggered by finding issues
- `--fixes` flag → action to create fix plans

### Why rename "UAT"?
UAT (User Acceptance Testing) is an acronym. "Verification" is a word that describes what the concept contains: verification results for a chapter.

### Why rename "MM"?
MM is an opaque abbreviation for MegaMemory. Spell it out for clarity.

### Why rename "orchestrator"?
"Coordinator" is more intuitive - it coordinates subagents. "Orchestrator" is common in agent systems but less clear to newcomers.

### Why rename "must_haves"?
"Requirements" is the standard industry term. `must_haves` is internal jargon.

---

## Phase 1: Command Name Bug Fixes

Fix incorrect command references (72+ occurrences).

### Wrong References to Fix

| Wrong | Correct | Estimated Count |
|-------|---------|-----------------|
| `/fuska-plan-chapter` | `/fuska-plan` | ~72 |
| `/fuska-build-chapter` | `/fuska-build` | ~25 |
| `/fuska-execute-chapter` | `/fuska-build` | ~15 |

### Directories Affected

- `provider/opinkode/command/fuska/*.md`
- `provider/opinkode/agents/fuska/*.md`
- `provider/opinkode/fuska/workflows/*.md`
- `provider/opinkode/fuska/templates/*.md`
- `provider/opinkode/fuska/references/*.md`
- `src/commands/progress.ts`

### Grep Commands to Find Occurrences

```bash
grep -r "fuska-plan-chapter" provider/opinkode --include="*.md"
grep -r "fuska-build-chapter" provider/opinkode --include="*.md"
grep -r "fuska-execute-chapter" provider/opinkode --include="*.md"
```

---

## Phase 2: Rename Files

| Action | Current Path | New Path |
|--------|--------------|----------|
| Rename | `provider/opinkode/command/fuska/fuska-plan-milestone-gaps.md` | `provider/opinkode/command/fuska/fuska-plan-milestone-fixes.md` |
| Rename | `provider/opinkode/fuska/templates/UAT.md` | `provider/opinkode/fuska/templates/verification.md` |

### Updates Inside Renamed Files

**fuska-plan-milestone-fixes.md:**
- `name: fuska-plan-milestone-gaps` → `name: fuska-plan-milestone-fixes`
- Update description and all internal references

**verification.md:**
- Update all `UAT` references to `verification`
- Update concept name pattern documentation

---

## Phase 3: Rename Flags and Mode Names

### Command Files

| File | Changes |
|------|---------|
| `fuska-plan.md` | `--gaps` → `--fixes`, `gap_closure` → `fix_planning` |
| `fuska-build.md` | `--gaps-only` → `--fixes-only`, `gap_closure` → `fix_planning` |
| `fuska-review.md` | `--gaps` → `--fixes` |

### Agent Files

| File | Changes |
|------|---------|
| `fuska-planner.md` | `--gaps`, `gap_closure_mode`, all gap references |
| `fuska-verifier.md` | All `--gaps` references, `gaps_found` → `issues_found` |
| `fuska-debugger.md` | `--gaps` reference |
| `fuska-executor.md` | Any gap references |

### Template Files

| File | Changes |
|------|---------|
| `planner-subagent-prompt.md` | Mode `gap_closure` → `fix_planning`, `--gaps` → `--fixes` |
| `verification-report.md` | `gaps_found` → `issues_found`, rename file to `verification.md` |
| `chapter-prompt.md` | Gap references |

### Workflow Files

| File | Changes |
|------|---------|
| `verify-work.md` | `--gaps` → `--fixes`, `--gaps-only` → `--fixes-only`, `plan_gap_closure` → `plan_fixes` |
| `plan-chapter.md` | `--gaps` → `--fixes`, mode `gap_closure` → `fix_planning` |
| `diagnose-issues.md` | All `--gaps` references |
| `verify-chapter.md` | `gaps_found` → `issues_found` |
| `execute-plan.md` | `gaps_found` → `issues_found` |

### TypeScript Files

| File | Changes |
|------|---------|
| `src/commands/progress.ts` | `--gaps` → `--fixes`, route `'gaps'` → `'issues'` (lines 120, 427, 579-581) |
| `src/commands/info.ts` | `test_gaps` → `test_issues`, `gapSection` → `issueSection` (lines 43, 264, 266, 267, 269) |

---

## Phase 4: Rename JSON Fields

| Current | New | Files Affected |
|---------|-----|----------------|
| `gap_closure: true` | `is_fix: true` | `fuska-plan.md`, `fuska-planner.md`, `fuska-plan-milestone-fixes.md`, `fuska-build.md` |
| `gap_closure_chapters_created` | `fix_chapters_created` | `fuska-plan-milestone-fixes.md` |
| `gap_closure_chapter_count` | `fix_chapter_count` | `fuska-plan-milestone-fixes.md` |

### Example Change

```json
// Before
{
  "name": "chapter-01-plan-03",
  "gap_closure": true,
  "fixes_issues": ["auth-failure", "missing-validation"]
}

// After
{
  "name": "chapter-01-plan-03",
  "is_fix": true,
  "fixes_issues": ["auth-failure", "missing-validation"]
}
```

---

## Phase 5: Rename Status Values

| Current | New |
|---------|-----|
| `gaps_found` | `issues_found` |

### Files to Update

- `fuska-do.md`
- `fuska-audit.md`
- `fuska-build.md`
- `verify-chapter.md`
- `verification-report.md` (→ `verification.md`)
- `fuska-verifier.md`

### Grep Command

```bash
grep -r "gaps_found" provider/opinkode --include="*.md"
```

---

## Phase 6: Rename UAT → Verification

### Changes

| Current | New |
|---------|-----|
| `UAT` (acronym) | `verification` |
| `{chapter}-uat` | `{chapter}-verification` |
| `UAT concept` | `verification concept` |
| `UAT session` | `verification session` |
| `conversational UAT` | `conversational verification` |

### Files with UAT References

```bash
grep -r "\bUAT\b" provider/opinkode --include="*.md"
```

### High-Impact Files

- `fuska-review.md` (primary creator of verification concepts)
- `fuska-build.md` (creates verification concepts)
- `fuska-verifier.md` (populates verification concepts)
- `templates/UAT.md` → `templates/verification.md`
- `workflows/verify-work.md`
- `workflows/verify-chapter.md`
- `workflows/diagnose-issues.md`

---

## Phase 7: Rename MM → MegaMemory

### Changes

| Current | New |
|---------|-----|
| `MM` | `MegaMemory` |
| `MM concept` | `MegaMemory concept` |
| `MM UAT` | `MegaMemory verification` |
| `from MM` | `from MegaMemory` |
| `query MM` | `query MegaMemory` |

### Files with MM References

```bash
grep -r "\bMM\b" provider/opinkode --include="*.md"
```

### High-Impact Files

- `workflows/resume-project.md`
- `workflows/list-chapter-assumptions.md`
- `workflows/discovery-chapter.md`
- `workflows/diagnose-issues.md`
- `references/tdd.md`

---

## Phase 8: Rename orchestrator → coordinator

### Changes

| Current | New |
|---------|-----|
| `orchestrator` | `coordinator` |
| `orchestrator role` | `coordinator role` |
| `orchestrator stays lean` | `coordinator stays lean` |
| `return_to_orchestrator` | `return_to_coordinator` |

### Occurrence Count
~196 occurrences across commands, agents, workflows

### Grep Command

```bash
grep -r "orchestrator" provider/opinkode --include="*.md"
grep -r "orchestrator" src --include="*.ts"
```

---

## Phase 9: Rename must_haves → requirements

### Changes

| Current | New |
|---------|-----|
| `must_haves` | `requirements` |
| `must-haves` | `requirements` |
| `derive must_haves` | `derive requirements` |

### Occurrence Count
~166 occurrences across planners, verifiers, templates

### Grep Command

```bash
grep -r "must_haves\|must-haves" provider/opinkode --include="*.md"
```

### High-Impact Files

- `fuska-planner.md`
- `fuska-verifier.md`
- `fuska-plan-checker.md`
- `planner-subagent-prompt.md`
- `verify-chapter.md`

---

## Phase 10: Update Help Text

### File
`src/commands/help.ts`

### Changes

1. Add entry for `fuska-plan-milestone-fixes`
2. Document `--fixes` flag for `fuska-plan`
3. Document `--fixes-only` flag for `fuska-build`
4. Update any UAT references to verification

---

## Phase 11: Update Template References

### Files to Update

All templates that reference `UAT.md`:
```bash
grep -r "UAT.md" provider/opinkode --include="*.md"
```

### Specific Changes

| File | Change |
|------|--------|
| `verification-report.md` | Rename to `verification.md`, update all status values |
| Templates referencing `@./UAT.md` | Update to `@./verification.md` |

---

## File Count Estimate

| Directory | Est. Files | Key Changes |
|-----------|------------|-------------|
| `provider/opinkode/command/fuska/` | ~15 | flags, status, UAT, coordinator |
| `provider/opinkode/agents/fuska/` | ~10 | UAT, coordinator, requirements |
| `provider/opinkode/fuska/workflows/` | ~8 | flags, UAT, MM, coordinator |
| `provider/opinkode/fuska/templates/` | ~6 | UAT, requirements, rename files |
| `provider/opinkode/fuska/references/` | ~4 | MM, UAT |
| `src/commands/` | 3 | routes, flags, variables |
| **Total** | ~46 files | |

---

## Execution Order

1. **Phase 1** — Fix command name bugs (prerequisite, reduces noise in later phases)
2. **Phase 2** — Rename files
3. **Phase 3-5** — Flags, JSON, status (core functionality)
4. **Phase 6** — UAT → verification (large scope, touches many files)
5. **Phase 7** — MM → MegaMemory
6. **Phase 8** — orchestrator → coordinator
7. **Phase 9** — must_haves → requirements
8. **Phase 10-11** — Help and templates

---

## Verification Steps

After completing all phases:

### 1. Code Quality

```bash
npm run lint
npm run typecheck
```

### 2. Help Validation

```bash
npm run validate:help
```

### 3. Search for Remaining Old Terms

```bash
# Should return 0 results
grep -r "gap_closure" provider/opinkode src --include="*.md" --include="*.ts"
grep -r "\-\-gaps" provider/opinkode src --include="*.md" --include="*.ts"
grep -r "gaps_found" provider/opinkode src --include="*.md" --include="*.ts"
grep -r "\bUAT\b" provider/opinkode src --include="*.md" --include="*.ts"
grep -r "\bMM\b" provider/opinkode --include="*.md"
grep -r "orchestrator" provider/opinkode src --include="*.md" --include="*.ts"
grep -r "must_haves\|must-haves" provider/opinkode src --include="*.md" --include="*.ts"
grep -r "fuska-plan-chapter\|fuska-build-chapter\|fuska-execute-chapter" provider/opinkode src --include="*.md" --include="*.ts"
```

### 4. Functional Tests

1. Test: `/fuska-plan 1 --fixes` should work
2. Test: `/fuska-build 1 --fixes-only` should work
3. Test: `/fuska-review 1` should create `{chapter}-verification` concept
4. Test: Verification failures should report `issues_found` status

### 5. MegaMemory Check

No data migration needed - confirmed no existing `gap` or `UAT` concepts in database (checked 2025-02-21).

---

## Notes

- This is a large-scale rename affecting ~46 files
- Consider doing phases in separate commits for easier review
- No database migration required (MegaMemory concepts unaffected)
- CLI help in `src/commands/help.ts` must stay in sync with command frontmatter
