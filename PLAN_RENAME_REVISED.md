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
| **Template files** | `templates/UAT.md` | `templates/verification.md` |
| | `templates/verification-report.md` | `templates/verification-results.md` |
| **Wrong command refs** | `/fuska-plan-chapter` | `/fuska-plan` |
| | `/fuska-build-chapter` | `/fuska-build` |
| | `/fuska-execute-chapter` | `/fuska-build` |

---

## Scope Note

All markdown changes apply to **both** `provider/opinkode/` and `provider/klod/`. These are parallel provider directories with near-identical content (different frontmatter formatting, same substance). Every `.md` change in opinkode has a corresponding file in klod that needs the same update.

---

## Rationale

### Why rename "gap closure"?
"Gap closure" is jargon requiring mental translation (gap -> missing thing -> needs fixing). "Fix planning" is self-explanatory and action-oriented.

Semantics:
- `status: issues_found` -> describes current state (open)
- `route: 'issues'` -> triggered by finding issues
- `--fixes` flag -> action to create fix plans

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

Fix incorrect command references (~129 occurrences across both providers).

### Wrong References to Fix

| Wrong | Correct | Count (opinkode) | Count (klod) |
|-------|---------|-------------------|--------------|
| `/fuska-plan-chapter` | `/fuska-plan` | ~76 | ~similar |
| `/fuska-build-chapter` | `/fuska-build` | ~20 | ~similar |
| `/fuska-execute-chapter` | `/fuska-build` | ~28 | ~similar |

### Directories Affected

- `provider/opinkode/command/fuska/*.md` + `provider/klod/skills/fuska-*/SKILL.md`
- `provider/opinkode/agents/fuska/*.md` + `provider/klod/agents/fuska/*.md`
- `provider/opinkode/fuska/workflows/*.md` + `provider/klod/fuska/workflows/*.md`
- `provider/opinkode/fuska/templates/*.md` + `provider/klod/fuska/templates/*.md`
- `provider/opinkode/fuska/references/*.md` + `provider/klod/fuska/references/*.md`
- `src/commands/progress.ts`

### Also Update: migrate-terminology.ts

Update `src/commands/migrate-terminology.ts` to map phase-based names directly to final command names:
- `fuska-plan-phase` -> `fuska-plan` (not `fuska-plan-chapter`)
- `fuska-build-phase` -> `fuska-build` (not `fuska-build-chapter`)

---

## Phase 2: Rename Files

| Action | Current Path | New Path |
|--------|--------------|----------|
| Rename | `provider/opinkode/command/fuska/fuska-plan-milestone-gaps.md` | `.../fuska-plan-milestone-fixes.md` |
| Rename | `provider/opinkode/fuska/templates/UAT.md` | `.../templates/verification.md` |
| Rename | `provider/opinkode/fuska/templates/verification-report.md` | `.../templates/verification-results.md` |
| Rename | `provider/klod/skills/fuska-plan-milestone-gaps/` | `.../fuska-plan-milestone-fixes/` |
| Rename | `provider/klod/fuska/templates/UAT.md` | `.../templates/verification.md` |
| Rename | `provider/klod/fuska/templates/verification-report.md` | `.../templates/verification-results.md` |

### Updates Inside Renamed Files

**fuska-plan-milestone-fixes.md:**
- `name: fuska-plan-milestone-gaps` -> `name: fuska-plan-milestone-fixes`
- Update description and all internal references

**verification.md (was UAT.md):**
- Update all `UAT` references to `verification`
- Update concept name pattern documentation

**verification-results.md (was verification-report.md):**
- Update all `gaps_found` -> `issues_found`
- Update any internal template references

---

## Phase 3: Rename Flags and Mode Names

### Command Files (both opinkode and klod)

| File | Changes |
|------|---------|
| `fuska-plan.md` | `--gaps` -> `--fixes`, `gap_closure` -> `fix_planning` |
| `fuska-build.md` | `--gaps-only` -> `--fixes-only`, `gap_closure` -> `fix_planning` |
| `fuska-review.md` | `--gaps` -> `--fixes` |

### Agent Files (both opinkode and klod)

| File | Changes |
|------|---------|
| `fuska-planner.md` | `--gaps`, `gap_closure_mode`, all gap references |
| `fuska-verifier.md` | All `--gaps` references, `gaps_found` -> `issues_found` |
| `fuska-debugger.md` | `--gaps` reference |
| `fuska-executor.md` | Any gap references |

### Template Files (both opinkode and klod)

| File | Changes |
|------|---------|
| `planner-subagent-prompt.md` | Mode `gap_closure` -> `fix_planning`, `--gaps` -> `--fixes` |
| `verification-results.md` | `gaps_found` -> `issues_found` |
| `chapter-prompt.md` | Gap references |

### Workflow Files (both opinkode and klod)

| File | Changes |
|------|---------|
| `verify-work.md` | `--gaps` -> `--fixes`, `--gaps-only` -> `--fixes-only`, `plan_gap_closure` -> `plan_fixes` |
| `plan-chapter.md` | `--gaps` -> `--fixes`, mode `gap_closure` -> `fix_planning` |
| `diagnose-issues.md` | All `--gaps` references |
| `verify-chapter.md` | `gaps_found` -> `issues_found` |
| `execute-plan.md` | `gaps_found` -> `issues_found` |

### TypeScript Files

| File | Changes |
|------|---------|
| `src/commands/progress.ts` | `--gaps` -> `--fixes`, route `'gaps'` -> `'issues'` (lines 120, 427, 579-581) |
| `src/commands/info.ts` | `test_gaps` -> `test_issues`, `gapSection` -> `issueSection` (lines 43, 264, 266, 267, 269) |

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

### Files to Update (both opinkode and klod)

- `fuska-do.md`
- `fuska-audit.md`
- `fuska-build.md`
- `verify-chapter.md`
- `verification-results.md`
- `fuska-verifier.md`

---

## Phase 6: Rename UAT -> Verification

### Changes

| Current | New |
|---------|-----|
| `UAT` (acronym) | `verification` |
| `{chapter}-uat` | `{chapter}-verification` |
| `UAT concept` | `verification concept` |
| `UAT session` | `verification session` |
| `conversational UAT` | `conversational verification` |
| `UATData` (TypeScript) | `VerificationData` |
| `createUAT()` | `createVerification()` |
| `generateUATMarkdown()` | `generateVerificationMarkdown()` |
| `parseUATFile()` | `parseVerificationFile()` |

### Markdown Files (both opinkode and klod, ~27 files total)

High-impact:
- `fuska-review.md` (primary creator of verification concepts)
- `fuska-build.md` (creates verification concepts)
- `fuska-verifier.md` (populates verification concepts)
- `templates/verification.md` (already renamed in Phase 2)
- `workflows/verify-work.md`
- `workflows/verify-chapter.md`
- `workflows/diagnose-issues.md`

### TypeScript Files

| File | Changes |
|------|---------|
| `src/scripts/types.ts` | `UATData` interface -> `VerificationData` |
| `src/scripts/helpers.ts` | `generateUATMarkdown()` -> `generateVerificationMarkdown()` |
| `src/scripts/chapter-templates.ts` | `createUAT()` -> `createVerification()`, update imports |
| `src/scripts/scripts/migrate-planning-to-megamemory.ts` | `parseUATFile()` -> `parseVerificationFile()`, UAT creation logic |
| `src/scripts/__tests__/workflow-integration.test.ts` | UAT references |
| `src/scripts/__tests__/e2e-lifecycle.test.ts` | UAT references |
| `src/scripts/__tests__/chapter-templates.test.ts` | UAT references |

### Template File References

Update all references from `@./UAT.md` to `@./verification.md` (search: `grep -r "UAT.md"`)

---

## Phase 7: Rename MM -> MegaMemory

### Changes

| Current | New |
|---------|-----|
| `MM` | `MegaMemory` |
| `MM concept` | `MegaMemory concept` |
| `MM UAT` | `MegaMemory verification` |
| `from MM` | `from MegaMemory` |
| `query MM` | `query MegaMemory` |

### Files (~25 files across both providers)

High-impact:
- `workflows/resume-project.md`
- `workflows/list-chapter-assumptions.md`
- `workflows/discovery-chapter.md`
- `workflows/diagnose-issues.md`
- `references/tdd.md`
- `references/git-integration.md`
- `templates/verification-results.md`
- `templates/roadmap.md`
- `templates/state.md`
- `templates/user-setup.md`
- `templates/milestone.md`

---

## Phase 8: Rename orchestrator -> coordinator

### Changes

| Current | New |
|---------|-----|
| `orchestrator` | `coordinator` |
| `orchestrator role` | `coordinator role` |
| `orchestrator stays lean` | `coordinator stays lean` |
| `return_to_orchestrator` | `return_to_coordinator` |

### Occurrence Count
~211 occurrences across ~55 files (commands, agents, workflows in both providers)

---

## Phase 9: Rename must_haves -> requirements

### Changes

| Current | New |
|---------|-----|
| `must_haves` | `requirements` |
| `must-haves` | `requirements` |
| `derive must_haves` | `derive requirements` |

### Occurrence Count
~272 occurrences across ~61 files (both providers + TypeScript)

### Markdown Files (both opinkode and klod)

High-impact:
- `fuska-planner.md`
- `fuska-verifier.md`
- `fuska-plan-checker.md`
- `planner-subagent-prompt.md`
- `verify-chapter.md`

### TypeScript Files

| File | Changes |
|------|---------|
| `src/scripts/types.ts` | `must_haves: string[]` -> `requirements: string[]` |
| `src/scripts/helpers.ts` | `must_haves` handling |
| `src/scripts/validators.ts` | `must_haves` validation |
| `src/scripts/__tests__/workflow-integration.test.ts` | must_haves refs |
| `src/scripts/__tests__/e2e-lifecycle.test.ts` | must_haves refs |
| `src/scripts/__tests__/helpers.test.ts` | must_haves refs |
| `src/scripts/__tests__/chapter-templates.test.ts` | must_haves refs |

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

## File Count Estimate

| Directory | Est. Files | Key Changes |
|-----------|------------|-------------|
| `provider/opinkode/command/fuska/` | ~15 | flags, status, UAT, coordinator |
| `provider/opinkode/agents/fuska/` | ~10 | UAT, coordinator, requirements |
| `provider/opinkode/fuska/workflows/` | ~9 | flags, UAT, MM, coordinator |
| `provider/opinkode/fuska/templates/` | ~8 | UAT, requirements, rename files |
| `provider/opinkode/fuska/references/` | ~6 | MM, UAT |
| `provider/klod/` (mirrors above) | ~48 | same changes as opinkode |
| `src/commands/` | 4 | routes, flags, variables, help, migrate |
| `src/scripts/` | 4 | types, helpers, validators, templates |
| `src/scripts/__tests__/` | 4 | test updates |
| **Total** | **~108 files** | |

---

## Execution Order

1. **Phase 1** -- Fix command name bugs (prerequisite, reduces noise in later phases)
2. **Phase 2** -- Rename files (both providers)
3. **Phase 3-5** -- Flags, JSON, status (core functionality)
4. **Phase 6** -- UAT -> verification (large scope, touches many files including TypeScript)
5. **Phase 7** -- MM -> MegaMemory
6. **Phase 8** -- orchestrator -> coordinator
7. **Phase 9** -- must_haves -> requirements (including TypeScript)
8. **Phase 10** -- Help text

---

## Verification Steps

After completing all phases:

### 1. Code Quality

```bash
npm run lint
npm run typecheck
```

### 2. Tests

```bash
npm test
```

### 3. Help Validation

```bash
npm run validate:help
```

### 4. Search for Remaining Old Terms

```bash
# Should return 0 results (search both providers)
grep -r "gap_closure" provider src --include="*.md" --include="*.ts"
grep -r "\-\-gaps" provider src --include="*.md" --include="*.ts"
grep -r "gaps_found" provider src --include="*.md" --include="*.ts"
grep -r "\bUAT\b" provider src --include="*.md" --include="*.ts"
grep -r "\bMM\b" provider --include="*.md"
grep -r "orchestrator" provider src --include="*.md" --include="*.ts"
grep -r "must_haves\|must-haves" provider src --include="*.md" --include="*.ts"
grep -r "fuska-plan-chapter\|fuska-build-chapter\|fuska-execute-chapter" provider src --include="*.md" --include="*.ts"
grep -r "verification-report" provider --include="*.md"
```

### 5. Functional Tests

1. Test: `/fuska-plan 1 --fixes` should work
2. Test: `/fuska-build 1 --fixes-only` should work
3. Test: `/fuska-review 1` should create `{chapter}-verification` concept
4. Test: Verification failures should report `issues_found` status

### 6. MegaMemory Check

No data migration needed - confirmed no existing `gap` or `UAT` concepts in database (checked 2025-02-21).

---

## Notes

- Large-scale rename affecting ~108 files across two provider directories and TypeScript source
- Do phases in separate commits for easier review
- No database migration required (MegaMemory concepts unaffected)
- CLI help in `src/commands/help.ts` must stay in sync with command frontmatter
- `migrate-terminology.ts` updated to chain phase -> final names directly
